import { state } from './state.js';
import { $, button, el, escapeHtml, escapeRegExp, formatBytes, stripPng } from './util.js';
import { wireCodeEditor } from './code-editor.js';
import * as exporter from './exporter.js';
import * as lightbox from './lightbox.js';
import * as sourceHistory from './history.js';

const main = $('main');
const backdrop = $('codeModalBackdrop');

const EMPTY_HTML = '<div class="empty-main">Packed canvases and generated code will appear here.</div>';
const isLoose = () => state.mode === 'loose';

export function showEmpty() {
  main.innerHTML = EMPTY_HTML;
}

function syncBackdrop() {
  backdrop.classList.toggle('active', Boolean(document.querySelector('.code-block.expanded')));
}

backdrop.addEventListener('click', () => {
  document.querySelectorAll('.code-block.expanded').forEach((block) => {
    block.classList.remove('expanded');
    block.job.expanded = false;
    block.querySelector('.code-expand-btn').textContent = 'Expand code';
  });
  syncBackdrop();
});

const totalBytes = (job) => job.canvases.reduce((sum, c) => sum + (c.blob?.size ?? 0), 0);

function statsHtml(job) {
  const bytes = totalBytes(job);
  return `<span>Frames: <b>${job.total}</b></span><span>Canvases: <b>${job.numCanvases}</b></span><span>Frame size: <b>${job.fw}×${job.fh}px</b></span>`
    + (bytes ? `<span>Size: <b>${formatBytes(bytes)}</b></span>` : '');
}

function buildSummaryStrip(job, showStats) {
  const strip = el('div', 'summary-strip');
  if (!isLoose()) strip.appendChild(el('span', 'src-name', job.srcFileName));
  if (showStats) {
    const stats = el('div', 'src-stats');
    stats.innerHTML = statsHtml(job);
    strip.appendChild(stats);
  }
  return strip.childNodes.length ? strip : null;
}

function buildSelectionToolbar(job, onChange) {
  const toolbar = el('div', 'canvases-toolbar');
  const count = el('span', 'sel-count');
  const selectAll = button('btn-ghost', 'Select all');
  const clear = button('btn-ghost', 'Clear', () => { job.selected.clear(); onChange(); });
  const download = button('btn-ghost', 'Download selected', () => exporter.downloadSelectedCanvases(job));

  selectAll.addEventListener('click', () => {
    if (job.selected.size === job.canvases.length) job.selected.clear();
    else job.canvases.forEach((_, i) => job.selected.add(i));
    onChange();
  });
  toolbar.append(count, selectAll, clear, download);

  toolbar.sync = () => {
    const n = job.selected.size;
    toolbar.classList.toggle('visible', n > 0);
    count.textContent = n ? `${n} selected` : '';
    selectAll.textContent = n === job.canvases.length ? 'Deselect all' : 'Select all';
  };
  return toolbar;
}

/** Renaming a canvas also renames it inside the generated code. */
function renameCanvas(job, canvas, input, content) {
  const oldBase = stripPng(canvas.name);
  const base = input.value.trim().replace(/\.png$/i, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'frame';
  input.value = base;
  if (oldBase === base && canvas.name === `${base}.png`) return false;
  canvas.name = `${base}.png`;

  if (!job.sliceOnly && job.code && oldBase !== base) {
    job.code = job.code.replace(new RegExp(escapeRegExp(oldBase), 'g'), base);
    if (job.name === oldBase) job.name = base;
  }

  const textarea = content.querySelector('.code-wrap textarea');
  if (textarea) {
    textarea.value = job.code || '';
    textarea.dispatchEvent(new Event('input'));
  }
  return true;
}

function buildCanvasCard(job, canvas, index, content, onSelectionChange) {
  const card = el('div', `cnv-card${job.selected.has(index) ? ' selected' : ''}`);
  card.title = 'Click to select · edit name below';
  card.innerHTML = `
    <div class="cnv-thumb"><img src="${canvas.url}" alt=""></div>
    <div class="cnv-info">
      <input type="text" class="cnv-name-input" value="${escapeHtml(stripPng(canvas.name))}" spellcheck="false" title="Rename this image">
      <div class="dims">${canvas.w}×${canvas.h}px${canvas.blob?.size ? ` · ${formatBytes(canvas.blob.size)}` : ''}</div>
      <a class="dl" href="${canvas.url}" download="${escapeHtml(canvas.name)}">Download PNG</a>
    </div>`;

  const input = card.querySelector('.cnv-name-input');
  const link = card.querySelector('a.dl');

  card.addEventListener('click', (e) => {
    if (e.target.closest('a.dl, .cnv-name-input')) return;
    if (e.target.closest('.cnv-thumb')) {
      e.stopPropagation();
      lightbox.open(job.canvases, index);
      return;
    }
    if (job.selected.has(index)) job.selected.delete(index);
    else job.selected.add(index);
    card.classList.toggle('selected', job.selected.has(index));
    onSelectionChange();
  });

  const applyName = () => {
    sourceHistory.captureJobs();
    if (!renameCanvas(job, canvas, input, content)) return;
    link.download = canvas.name;
    sourceHistory.push();
  };
  input.addEventListener('change', applyName);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter') return;
    e.preventDefault();
    applyName();
    input.blur();
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('mousedown', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => { e.stopPropagation(); input.select(); });

  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    exporter.saveBlob(canvas.blob, canvas.name, ['png']);
  });
  return card;
}

function buildCodeBlock(job) {
  const block = el('div', `code-block${job.expanded ? ' expanded' : ''}`);
  block.job = job;

  const head = el('div', 'code-head');
  head.innerHTML = '<h4>Code</h4>';
  const actions = el('div', 'code-actions');

  const expand = button('btn-ghost code-expand-btn', job.expanded ? 'Collapse code' : 'Expand code', () => {
    job.expanded = !job.expanded;
    block.classList.toggle('expanded', job.expanded);
    expand.textContent = job.expanded ? 'Collapse code' : 'Expand code';
    syncBackdrop();
  });
  const copy = button('btn-ghost', 'Copy', async () => {
    await navigator.clipboard.writeText(job.code);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
  });
  actions.append(
    expand,
    copy,
    button('btn-ghost', 'Download .rcss', () => exporter.downloadRcss(job)),
    button('btn-ghost', 'Download ZIP', () => exporter.downloadJobZip(job))
  );
  head.appendChild(actions);

  const codeWrap = el('div', 'code-wrap');
  wireCodeEditor(codeWrap, job, head);
  block.append(head, codeWrap);
  return block;
}

function buildSliceActions(job) {
  const actions = el('div', 'slice-actions');
  actions.appendChild(button('btn-ghost', 'Download ZIP', () => exporter.downloadJobZip(job)));
  return actions;
}

function buildJobContent(job, { showStats = false, hideStrip = false } = {}) {
  const content = el('div', 'job-content');
  if (!job.selected) job.selected = new Set();

  const strip = hideStrip ? null : buildSummaryStrip(job, showStats);
  if (strip) content.appendChild(strip);

  const grid = el('div', 'canvases');
  const toolbar = buildSelectionToolbar(job, () => {
    grid.querySelectorAll('.cnv-card').forEach((card, i) => card.classList.toggle('selected', job.selected.has(i)));
    toolbar.sync();
  });
  job.canvases.forEach((canvas, i) => grid.appendChild(buildCanvasCard(job, canvas, i, content, toolbar.sync)));

  content.append(toolbar, grid, job.sliceOnly ? buildSliceActions(job) : buildCodeBlock(job));
  toolbar.sync();
  return content;
}

function buildTabsBar(jobs, panel) {
  const bar = el('div', `tabs-bar${jobs.length === 1 ? ' single' : ''}`);

  if (jobs.length === 1) {
    const job = jobs[0];
    const head = el('div', 'tabs-single-head');
    head.innerHTML = `${isLoose()
      ? `<span class="src-name">${escapeHtml(job.name)}</span>`
      : `<span class="src-name" title="${escapeHtml(job.srcFileName)}">${escapeHtml(job.srcFileName)}</span>`}<div class="src-stats">${statsHtml(job)}</div>`;
    bar.appendChild(head);
    return bar;
  }

  const prev = button('tabs-nav tabs-prev', '‹');
  const next = button('tabs-nav tabs-next', '›');
  prev.setAttribute('aria-label', 'Previous tabs');
  next.setAttribute('aria-label', 'Next tabs');
  const tabs = el('div', 'tabs');

  const syncNav = () => {
    const max = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
    prev.disabled = tabs.scrollLeft <= 1;
    next.disabled = tabs.scrollLeft >= max - 1;
    bar.classList.toggle('has-nav', tabs.scrollWidth > tabs.clientWidth + 2);
  };
  const scrollTabs = (direction) =>
    tabs.scrollBy({ left: direction * Math.max(120, tabs.clientWidth * 0.6), behavior: 'smooth' });

  jobs.forEach((job, i) => {
    const tab = button(`tab-btn${i === state.activeTab ? ' active' : ''}`, null, () => {
      state.activeTab = i;
      panel.querySelectorAll('.tab-btn').forEach((b, bi) => b.classList.toggle('active', bi === i));
      panel.querySelectorAll('.tab-panel').forEach((p, pi) => p.classList.toggle('active', pi === i));
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      syncNav();
    });
    tab.title = job.name;
    tab.innerHTML = `<span class="idx">${i + 1}</span><span class="fn">${escapeHtml(job.name)}</span>`;
    tabs.appendChild(tab);
  });

  prev.addEventListener('click', () => scrollTabs(-1));
  next.addEventListener('click', () => scrollTabs(1));
  tabs.addEventListener('scroll', syncNav, { passive: true });
  bar.append(prev, tabs, next);

  requestAnimationFrame(() => {
    syncNav();
    tabs.querySelector('.tab-btn.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  return bar;
}

function buildTabsView(jobs) {
  const panel = el('div', 'panel output-panel');
  panel.appendChild(buildTabsBar(jobs, panel));
  jobs.forEach((job, i) => {
    const tabPanel = el('div', `tab-panel${i === state.activeTab || jobs.length === 1 ? ' active' : ''}`);
    tabPanel.appendChild(buildJobContent(job, { showStats: jobs.length > 1, hideStrip: jobs.length === 1 }));
    panel.appendChild(tabPanel);
  });
  return panel;
}

function buildListView(jobs) {
  const list = el('div', 'jobs-list');
  jobs.forEach((job, i) => {
    if (job.collapsed === undefined) job.collapsed = i !== 0;

    const item = el('div', `job${job.collapsed ? ' collapsed' : ''}`);
    const head = el('div', 'job-head');
    head.innerHTML = `
      <span class="chev"></span>
      <h3>${escapeHtml(job.name)}</h3>
      <span class="sub">${escapeHtml(job.srcFileName)} — ${job.total} frames, ${job.numCanvases} canvas${job.numCanvases > 1 ? 'es' : ''}, frame size ${job.fw}×${job.fh}px</span>`;
    head.addEventListener('click', () => {
      const wasCollapsed = job.collapsed;
      jobs.forEach((j, ji) => {
        j.collapsed = true;
        list.children[ji].classList.add('collapsed');
      });
      if (wasCollapsed) {
        job.collapsed = false;
        item.classList.remove('collapsed');
      }
    });

    const body = el('div', 'job-body');
    body.appendChild(buildJobContent(job, { hideStrip: true }));
    item.append(head, body);
    list.appendChild(item);
  });
  return list;
}

function fillBody(jobs) {
  let body = main.querySelector('.output-body');
  if (!body) {
    body = el('div', 'output-body');
    main.appendChild(body);
  }
  body.innerHTML = '';
  body.appendChild(isLoose() || state.viewMode === 'tabs' ? buildTabsView(jobs) : buildListView(jobs));
}

function buildViewSwitch() {
  const switcher = el('div', `view-switch${state.viewMode === 'list' ? ' list-active' : ''}`);
  switcher.appendChild(el('div', 'switch-slider'));
  for (const mode of ['tabs', 'list']) {
    const btn = button(mode === state.viewMode ? 'active' : '', mode === 'tabs' ? 'Tabs' : 'List', () => {
      if (state.viewMode === mode) return;
      state.viewMode = mode;
      switcher.classList.toggle('list-active', mode === 'list');
      switcher.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      fillBody(state.jobs);
    });
    switcher.appendChild(btn);
  }
  return switcher;
}

export function renderOutput(jobs) {
  if (!jobs.length) {
    main.innerHTML = '<div class="empty-main">Nothing to show — check the errors above.</div>';
    return;
  }

  main.innerHTML = '';
  const topbar = el('div', 'output-topbar');
  topbar.appendChild(isLoose() ? el('span', 'topbar-label', jobs[0].name || 'Sheet') : buildViewSwitch());

  if (isLoose()) {
    topbar.appendChild(button('btn-ghost', 'Download ZIP', () => exporter.downloadJobZip(jobs[0])));
  } else if (jobs.length > 1) {
    topbar.appendChild(button('btn-ghost', 'Download all as ZIP', () => exporter.downloadAllZip(state.jobs)));
  }
  main.appendChild(topbar);
  fillBody(jobs);
}
