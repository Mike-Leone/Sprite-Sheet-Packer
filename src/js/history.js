import { state } from './state.js';

const MAX_SNAPSHOTS = 60;
let onRestore = () => {};

const snapshotJobs = () =>
  state.jobs?.length
    ? state.jobs.map((job) => ({ build: job.build, name: job.name, code: job.code, canvasNames: job.canvases.map((c) => c.name) }))
    : null;

const snapshot = () => ({ sources: state.sources.map((s) => ({ ...s })), jobs: snapshotJobs() });

/** Records the current source list and output names/code. Call after every user edit. */
export function push() {
  const h = state.history;
  h.stack = h.stack.slice(0, h.index + 1);
  h.stack.push(snapshot());
  while (h.stack.length > MAX_SNAPSHOTS) h.stack.shift();
  h.index = h.stack.length - 1;
}

/**
 * Stores the current output names/code on the latest snapshot, so the next rename can be undone.
 * Call right before changing an output name.
 */
export function captureJobs() {
  const h = state.history;
  h.stack[h.index].jobs = snapshotJobs();
}

/** Puts saved names/code back on the results of the same build. Returns true if the output needs a redraw. */
function restoreJobs(saved) {
  const jobs = state.jobs;
  if (!saved || !jobs || jobs.length !== saved.length || jobs.some((job, i) => job.build !== saved[i].build)) return false;
  saved.forEach((snap, i) => {
    const job = jobs[i];
    job.name = snap.name;
    job.code = snap.code;
    snap.canvasNames.forEach((name, ci) => {
      if (job.canvases[ci]) job.canvases[ci].name = name;
    });
  });
  return true;
}

function travel(step) {
  const h = state.history;
  const target = h.index + step;
  if (target < 0 || target >= h.stack.length) return;
  h.index = target;
  const entry = h.stack[target];
  state.sources = entry.sources.map((s) => ({ ...s }));
  onRestore(restoreJobs(entry.jobs));
}

const TEXT_INPUT_TYPES = ['text', 'number', 'search'];

/**
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes the last source-list edit or output rename.
 * `restoreHandler(outputChanged)` redraws the UI. Inside text fields the browser's own undo is used.
 */
export function initHistory(restoreHandler) {
  onRestore = restoreHandler;
  document.addEventListener('keydown', (e) => {
    const { target } = e;
    if (target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (target.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes((target.type || 'text').toLowerCase())) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.code === 'KeyZ' && !e.shiftKey) {
      e.preventDefault();
      travel(-1);
    } else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
      e.preventDefault();
      travel(1);
    }
  });
}
