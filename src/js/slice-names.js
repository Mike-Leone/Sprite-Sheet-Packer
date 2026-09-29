import { state } from './state.js';
import { $, el } from './util.js';

const list = $('sliceNamesList');

/** "Only slice" mode: one output-name field per source image. */
export function renderSliceNames() {
  list.innerHTML = '';
  const sources = state.sources;
  if (!sources.length) {
    list.appendChild(el('div', 'hint', 'Add source images first.'));
    return;
  }

  sources.forEach((source, i) => {
    const label = el('div', 'sn-file', source.file?.name ?? `Source ${i + 1}`);
    label.title = label.textContent;

    const input = el('input');
    input.type = 'text';
    input.value = source.name || '';
    input.spellcheck = false;
    input.placeholder = 'Output base name';
    input.addEventListener('input', () => {
      source.name = input.value;
      const twin = document.querySelector(`.src-item[data-uid="${source.uid}"] .f-name`);
      if (twin && twin.value !== source.name) twin.value = source.name;
    });

    const row = el('div', 'slice-name-row');
    row.append(label, input);
    list.appendChild(row);
  });
}

export function syncSliceOnlyUi() {
  const on = $('sliceOnly').checked;
  document.body.classList.toggle('slice-only', on);
  $('sliceNamesField').hidden = !on;
  $('atlasNameField').hidden = on;
  if (on) renderSliceNames();
}

export const isSliceOnly = () => document.body.classList.contains('slice-only');
