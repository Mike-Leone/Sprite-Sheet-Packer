import { state } from './state.js';
import { $ } from './util.js';
import { directionOptionsHtml } from './directions.js';
import { enhanceSelect, wireStepper } from './controls.js';
import { setProgress, setStatus } from './status.js';
import { isSliceOnly, syncSliceOnlyUi } from './slice-names.js';
import { initSourceList, renderSourceList, syncBuildEnabled } from './source-list.js';
import { buildJob, buildLooseJob } from './packing.js';
import { initHistory } from './history.js';
import { renderOutput, showEmpty } from './output.js';
import './lightbox.js';

const DEFAULT_CANVAS_SIZE = 2000;
let buildCounter = 0;

const widthInput = $('mw');
const heightInput = $('mh');
const presets = $('canvasPresets');
const packSwitch = $('packSwitch');
const buildBtn = $('genBtn');
const qrLightbox = $('qrLightbox');

function initCanvasSize() {
  document.querySelectorAll('.canvas-size .num-field').forEach((field) => {
    wireStepper(field);
    field.querySelector('input').addEventListener('dblclick', (e) => e.target.select());
  });

  const syncPresets = () => {
    presets.querySelectorAll('button').forEach((btn) => {
      const size = btn.dataset.size;
      btn.classList.toggle('active', size === widthInput.value && size === heightInput.value);
    });
  };
  presets.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-size]');
    if (!btn) return;
    widthInput.value = heightInput.value = btn.dataset.size;
    syncPresets();
  });
  widthInput.addEventListener('input', syncPresets);
  heightInput.addEventListener('input', syncPresets);
  syncPresets();
}

function initModeSwitch() {
  packSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn || btn.dataset.mode === state.mode) return;

    state.mode = btn.dataset.mode;
    state.activeTab = 0;
    const loose = state.mode === 'loose';
    packSwitch.classList.toggle('loose-active', loose);
    packSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    document.body.classList.toggle('mode-loose', loose);
    document.body.classList.toggle('mode-sheets', !loose);

    renderSourceList();
    syncBuildEnabled();
    if (state.jobs?.length) renderOutput(state.jobs);
    else showEmpty();
  });
}

function initQrLightbox() {
  const setOpen = (open) => { qrLightbox.hidden = !open; };
  $('footerQrBtn').addEventListener('click', () => setOpen(true));
  $('qrLightboxBackdrop').addEventListener('click', () => setOpen(false));
  $('qrLightboxClose').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !qrLightbox.hidden) setOpen(false);
  });
}

const NON_TEXT_INPUTS = ['checkbox', 'radio', 'file', 'button', 'submit'];

/**
 * Ctrl/Cmd+Enter builds from anywhere. A plain Enter builds too, except where it has its own
 * meaning: the code editor (newline), selects, buttons and links.
 */
function initBuildShortcut() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.ctrlKey || e.metaKey) {
      if (!buildBtn.disabled) {
        e.preventDefault();
        buildBtn.click();
      }
      return;
    }

    const target = e.target;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select' || target.isContentEditable) return;
    if (target.closest('button, a, [role="button"]')) return;

    if (tag === 'input') {
      if (NON_TEXT_INPUTS.includes((target.type || 'text').toLowerCase())) return;
      e.preventDefault();
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.blur();
      setTimeout(() => { if (!buildBtn.disabled) buildBtn.click(); }, 0);
    } else if (!buildBtn.disabled) {
      e.preventDefault();
      buildBtn.click();
    }
  });
}

async function runBuild() {
  const sources = state.sources;
  if (!sources.length) {
    setStatus('Add at least one source image.', true);
    return;
  }

  const loose = state.mode === 'loose';
  const sliceOnly = loose && isSliceOnly();
  const optimize = $('optimizePng').checked;
  const maxW = parseInt(widthInput.value, 10) || DEFAULT_CANVAS_SIZE;
  const maxH = parseInt(heightInput.value, 10) || DEFAULT_CANVAS_SIZE;
  if (!sliceOnly && (maxW < 1 || maxH < 1)) {
    setStatus('Invalid canvas size.', true);
    return;
  }

  buildBtn.disabled = true;
  setStatus(sliceOnly ? 'Slicing…' : 'Packing…');
  setProgress(0);

  const jobs = [];
  const notes = [];
  const errors = [];
  const accept = (job) => {
    if (job.error) {
      errors.push(job.error);
      return;
    }
    notes.push(...job.notes);
    jobs.push(job);
  };

  try {
    if (loose) {
      accept(await buildLooseJob(sources, {
        name: $('atlasName').value,
        direction: $('atlasDir').value,
        codeStyle: $('atlasCodeStyle').value,
        maxW, maxH, sliceOnly, optimize,
        onProgress: (done, total) => setProgress(done / total)
      }));
    } else {
      for (let i = 0; i < sources.length; i++) {
        setStatus(`Packing "${sources[i].file.name}" (${i + 1}/${sources.length})…`);
        accept(await buildJob(sources[i], {
          maxW, maxH, optimize,
          onProgress: (done, total) => setProgress((i + done / total) / sources.length)
        }));
      }
    }
  } catch (err) {
    errors.push(err.message || String(err));
  }

  state.jobs?.forEach((job) => job.canvases.forEach((c) => URL.revokeObjectURL(c.url)));
  const buildId = ++buildCounter;
  jobs.forEach((job) => { job.build = buildId; });
  state.jobs = jobs;
  state.activeTab = 0;
  renderOutput(jobs);

  const summary = [];
  if (jobs.length) {
    if (sliceOnly) {
      const frames = jobs.reduce((sum, job) => sum + job.total, 0);
      summary.push(`Done: ${frames} frame${frames !== 1 ? 's' : ''} sliced.`);
    } else {
      summary.push(`Done: ${jobs.length} source${jobs.length > 1 ? 's' : ''} packed.`);
    }
  }
  setStatus([...summary, ...notes, ...errors].join(' '), errors.length > 0);
  setProgress(null);
  buildBtn.disabled = false;
}

$('atlasDir').innerHTML = directionOptionsHtml();
enhanceSelect($('atlasDir'));
enhanceSelect($('atlasCodeStyle'));
$('sliceOnly').addEventListener('change', syncSliceOnlyUi);

initCanvasSize();
initModeSwitch();
initQrLightbox();
initBuildShortcut();
initSourceList();
initHistory((outputChanged) => {
  renderSourceList();
  syncBuildEnabled();
  if (outputChanged) renderOutput(state.jobs);
});
syncSliceOnlyUi();
buildBtn.addEventListener('click', runBuild);
