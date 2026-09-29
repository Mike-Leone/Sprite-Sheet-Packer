import { $ } from './util.js';

const statusEl = $('status');
const progressEl = $('progress');
const progressBarEl = $('progressBar');

export function setStatus(message = '', isError = false) {
  statusEl.textContent = message;
  statusEl.title = message;
  statusEl.classList.toggle('err', isError);
}

export function setProgress(fraction) {
  progressEl.hidden = fraction == null;
  const clamped = fraction == null ? 0 : Math.max(0, Math.min(1, fraction));
  progressBarEl.style.width = `${Math.round(clamped * 1000) / 10}%`;
}
