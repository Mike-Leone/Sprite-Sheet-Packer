import { state } from './state.js';
import { $, escapeHtml, formatBytes } from './util.js';
import { DEFAULT_DIRECTION, directionOptionsHtml } from './directions.js';
import { closeOpenSelect, enhanceSelect, wireStepper } from './controls.js';
import { setStatus } from './status.js';
import { renderSliceNames, isSliceOnly } from './slice-names.js';
import * as sourceHistory from './history.js';

const fileInput = $('fileInput');
const dropZone = $('drop');
const listEl = $('srcList');
const scrollEl = $('srcScroll');
const collapseAllBtn = $('srcCollapseAllBtn');
const buildBtn = $('genBtn');
const atlasName = $('atlasName');

const DRAG_THRESHOLD = 5;
const FLIP_MS = 300;

export const syncBuildEnabled = () => { buildBtn.disabled = state.sources.length === 0; };

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.sources.push({
        file, img, url,
        uid: state.nextUid(),
        name: file.name.replace(/\.[^.]+$/, ''),
        fw: img.width,
        fh: img.width,
        widthManuallySet: false,
        heightManuallySet: false,
        direction: DEFAULT_DIRECTION,
        codeStyle: 'Knob',
        collapsed: true
      });
      if (state.sources.length === 1 && !atlasName.dataset.touched) {
        atlasName.value = file.name.replace(/\.[^.]+$/, '');
      }
      renderSourceList();
      syncBuildEnabled();
      setStatus('');
      sourceHistory.push();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus(`Could not load ${file.name}.`, true);
    };
    img.src = url;
  }
}

function syncCollapseAllLabel() {
  const allCollapsed = state.sources.length > 0 && state.sources.every((s) => s.collapsed);
  collapseAllBtn.textContent = allCollapsed ? 'Expand all' : 'Collapse all';
}

function validateFrameSize(item, source, fwInput, fhInput, warning) {
  const fw = parseInt(fwInput.value, 10) || 0;
  const fh = parseInt(fhInput.value, 10) || 0;
  const { width: iw, height: ih } = source.img;

  let message = '';
  if (fw < 1 || fh < 1) {
    message = 'Frame size must be at least 1×1.';
  } else if (fw > iw || fh > ih) {
    message = `Frame ${fw}×${fh} is larger than image ${iw}×${ih}.`;
  } else if (iw % fw || ih % fh) {
    const cols = Math.floor(iw / fw);
    const rows = Math.floor(ih / fh);
    message = `Image ${iw}×${ih} doesn’t divide evenly into ${fw}×${fh} — using ${cols}×${rows} frames, leftover ${iw - cols * fw}×${ih - rows * fh}px dropped.`;
  }

  warning.textContent = message;
  warning.classList.toggle('show', Boolean(message));
  item.classList.toggle('frame-bad', Boolean(message));
  fwInput.classList.toggle('frame-bad', Boolean(message) && (fw > iw || (fw >= 1 && iw % fw !== 0)));
  fhInput.classList.toggle('frame-bad', Boolean(message) && (fh > ih || (fh >= 1 && ih % fh !== 0)));
}

/** Pointer-based drag & reorder with a floating, slightly tilting ghost card. */
function wireDrag(item, index) {
  item.addEventListener('pointerdown', (down) => {
    if (down.button !== 0 || down.target.closest('.rm, input, select, button')) return;

    const rect = item.getBoundingClientRect();
    const offsetX = down.clientX - rect.left;
    const offsetY = down.clientY - rect.top;
    let ghost = null;
    let dragging = false;
    let rafId = 0;
    let pointerX = down.clientX, pointerY = down.clientY;
    let prevX = down.clientX;
    let rotation = 0, velocity = 0;

    const tick = () => {
      if (!dragging || !ghost) { rafId = 0; return; }
      const smooth = velocity / (1 + Math.abs(velocity));
      rotation = rotation * 0.9 + smooth * 1.5;
      if (Math.abs(rotation) < 0.01) rotation = 0;
      velocity *= 0.85;
      if (Math.abs(velocity) < 0.01) velocity = 0;
      ghost.style.transform = `translate(${pointerX - offsetX}px, ${pointerY - offsetY}px) rotate(${rotation}deg)`;
      rafId = requestAnimationFrame(tick);
    };

    const targetAt = (x, y) => {
      const target = document.elementFromPoint(x, y)?.closest('.src-item');
      return target && target !== item ? target : null;
    };
    const clearMarks = (...classes) =>
      document.querySelectorAll('.src-item').forEach((n) => n.classList.remove(...classes));

    const startDrag = () => {
      dragging = true;
      item.classList.add('dragging');
      ghost = item.cloneNode(true);
      ghost.classList.add('drag-ghost');
      Object.assign(ghost.style, { width: `${item.offsetWidth}px`, left: '0px', top: '0px' });
      document.body.appendChild(ghost);
      requestAnimationFrame(() => ghost?.classList.add('visible'));
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      if (!dragging && (Math.abs(e.clientX - down.clientX) > DRAG_THRESHOLD || Math.abs(e.clientY - down.clientY) > DRAG_THRESHOLD)) {
        startDrag();
      }
      if (!dragging) return;
      velocity = e.clientX - prevX;
      prevX = pointerX = e.clientX;
      pointerY = e.clientY;
      clearMarks('drag-over-target');
      targetAt(e.clientX, e.clientY)?.classList.add('drag-over-target');
    };

    const onUp = (e) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (rafId) cancelAnimationFrame(rafId);

      if (!dragging) return;
      let reordered = false;
      const target = targetAt(e.clientX, e.clientY);
      const to = target ? parseInt(target.dataset.index, 10) : NaN;
      if (!Number.isNaN(to) && to !== index) {
        const [moved] = state.sources.splice(index, 1);
        state.sources.splice(to, 0, moved);
        reordered = true;
      }

      ghost.classList.remove('visible');
      const dying = ghost;
      setTimeout(() => dying.remove(), 150);
      clearMarks('dragging', 'drag-over-target');
      renderSourceList();
      if (reordered) sourceHistory.push();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

const numberField = (cls, label, value) => `
  <div>
    <label>${label}</label>
    <div class="num-field">
      <input type="number" class="${cls}" min="1" value="${value}">
      <div class="num-steppers"><button type="button" class="num-up"></button><button type="button" class="num-down"></button></div>
    </div>
  </div>`;

function buildItem(source, index) {
  const item = document.createElement('div');
  item.className = `src-item${source.collapsed ? ' collapsed' : ''}`;
  item.dataset.index = index;
  item.dataset.uid = source.uid;

  const fileName = escapeHtml(source.file.name);
  item.innerHTML = `
    <div class="src-head">
      <span class="chev"></span>
      <div class="thumb"><img src="${source.url}"></div>
      <div class="meta">
        <div class="fname" title="${fileName}">${fileName}</div>
        <div class="dims">${source.img.width}×${source.img.height}px${source.file.size ? ` · ${formatBytes(source.file.size)}` : ''}</div>
      </div>
      <button class="rm" type="button" title="Remove">×</button>
    </div>
    <div class="src-body">
      <div class="full src-name-only">
        <label>Name</label>
        <input type="text" class="f-name" value="${escapeHtml(source.name)}">
      </div>
      ${numberField('f-fw', 'Frame width, px', source.fw)}
      ${numberField('f-fh', 'Frame height, px', source.fh)}
      <div class="full src-dir-only">
        <label>Fill direction</label>
        <select class="f-dir">${directionOptionsHtml()}</select>
      </div>
      <div class="full src-code-style-only">
        <label>Code style</label>
        <select class="f-code-style">
          <option value="Knob">Knob</option>
          <option value="Button">Button</option>
        </select>
      </div>
      <p class="frame-warn"></p>
    </div>`;

  const head = item.querySelector('.src-head');
  const remove = item.querySelector('.rm');
  const nameInput = item.querySelector('.f-name');
  const fwInput = item.querySelector('.f-fw');
  const fhInput = item.querySelector('.f-fh');
  const dirSelect = item.querySelector('.f-dir');
  const codeStyleSelect = item.querySelector('.f-code-style');
  const warning = item.querySelector('.frame-warn');
  const validate = () => validateFrameSize(item, source, fwInput, fhInput, warning);

  head.addEventListener('click', (e) => {
    if (e.target.closest('.rm') || item.classList.contains('dragging')) return;
    source.collapsed = !source.collapsed;
    item.classList.toggle('collapsed', source.collapsed);
    syncCollapseAllLabel();
  });

  remove.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
  remove.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeOpenSelect();
    const scrollTop = scrollEl.scrollTop;
    state.sources.splice(index, 1);
    renderSourceList();
    scrollEl.scrollTop = scrollTop;
    syncBuildEnabled();
    sourceHistory.push();
  });

  nameInput.addEventListener('input', () => {
    source.name = nameInput.value;
    if (isSliceOnly()) renderSliceNames();
  });
  nameInput.addEventListener('change', () => sourceHistory.push());

  fwInput.addEventListener('input', () => {
    source.widthManuallySet = true;
    source.fw = parseInt(fwInput.value, 10) || source.fw;
    if (!source.heightManuallySet) {
      source.fh = source.fw;
      fhInput.value = source.fw;
    }
    validate();
  });
  fhInput.addEventListener('input', () => {
    source.heightManuallySet = true;
    source.fh = parseInt(fhInput.value, 10) || source.fh;
    validate();
  });
  for (const input of [fwInput, fhInput]) {
    input.addEventListener('change', () => { validate(); sourceHistory.push(); });
    wireStepper(input.closest('.num-field'));
  }

  for (const input of [nameInput, fwInput, fhInput]) {
    input.addEventListener('dblclick', (e) => { e.stopPropagation(); input.select(); });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  dirSelect.value = source.direction;
  dirSelect.addEventListener('change', () => { source.direction = dirSelect.value; sourceHistory.push(); });
  enhanceSelect(dirSelect);

  codeStyleSelect.value = source.codeStyle === 'Button' ? 'Button' : 'Knob';
  codeStyleSelect.addEventListener('change', () => {
    source.codeStyle = codeStyleSelect.value === 'Button' ? 'Button' : 'Knob';
    sourceHistory.push();
  });
  enhanceSelect(codeStyleSelect);

  wireDrag(item, index);
  validate();
  return item;
}

/** Slide surviving cards from their old position (FLIP) — skipped on removal to avoid a scroll flash. */
function animateReorder(previousTops) {
  if (state.sources.length < previousTops.size) return;
  listEl.querySelectorAll('.src-item').forEach((item) => {
    const before = previousTops.get(item.dataset.uid);
    if (before == null) return;
    const dy = before - item.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) {
      item.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: FLIP_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      });
    }
  });
}

export function renderSourceList() {
  closeOpenSelect();
  const previousTops = new Map();
  listEl.querySelectorAll('.src-item').forEach((item) => {
    previousTops.set(item.dataset.uid, item.getBoundingClientRect().top);
  });

  const sources = state.sources;
  collapseAllBtn.disabled = sources.length <= 1;
  syncCollapseAllLabel();

  listEl.innerHTML = '';
  sources.forEach((source, i) => {
    if (source.uid == null) source.uid = state.nextUid();
    listEl.appendChild(buildItem(source, i));
  });

  animateReorder(previousTops);
  if (isSliceOnly()) renderSliceNames();
}

export function initSourceList() {
  collapseAllBtn.addEventListener('click', () => {
    const collapsing = collapseAllBtn.textContent === 'Collapse all';
    state.sources.forEach((s) => { s.collapsed = collapsing; });
    listEl.querySelectorAll('.src-item').forEach((item) => item.classList.toggle('collapsed', collapsing));
    collapseAllBtn.textContent = collapsing ? 'Expand all' : 'Collapse all';
  });

  atlasName.addEventListener('input', () => { atlasName.dataset.touched = '1'; });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  dropZone.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag');
  }));
  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
}
