import { highlight } from './tokenizer.js';
import { escapeRegExp } from './util.js';

const FIND_BAR_HTML = `
  <div class="cf-row">
    <input type="text" class="cf-search" placeholder="Find">
    <span class="cf-count">0/0</span>
    <button type="button" class="cf-prev" title="Previous match (Shift+Enter)">&#8593;</button>
    <button type="button" class="cf-next" title="Next match (Enter)">&#8595;</button>
    <button type="button" class="cf-toggle-replace" title="Toggle replace (Ctrl+H)">&#8646;</button>
    <button type="button" class="cf-close" title="Close (Esc)">&times;</button>
  </div>
  <div class="cf-row cf-replace-row hidden">
    <input type="text" class="cf-replace" placeholder="Replace with">
    <button type="button" class="cf-replace-one">Replace</button>
    <button type="button" class="cf-replace-all">Replace all</button>
  </div>`;

/**
 * Replaces ta.value[start, end) through the browser's editing command instead of assigning `ta.value`,
 * which would wipe the textarea's native undo stack (Ctrl+Z / Ctrl+Y). Fires a normal `input` event.
 */
function editText(ta, start, end, text) {
  ta.focus();
  ta.setSelectionRange(start, end);
  const done = text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text);
  if (done) return;
  ta.setRangeText(text, start, end, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Editable, syntax-highlighted code box with a Ctrl+F / Ctrl+H find & replace bar.
 * `job.code` is kept in sync with the textarea. The bar is appended to `barHost`.
 */
export function wireCodeEditor(codeWrap, job, barHost) {
  const pre = document.createElement('pre');
  pre.className = 'code-highlight';
  pre.setAttribute('aria-hidden', 'true');

  const ta = document.createElement('textarea');
  ta.spellcheck = false;
  ta.value = job.code;
  ta.setAttribute('aria-label', 'Generated code (editable)');

  const bar = document.createElement('div');
  bar.className = 'code-find-bar hidden';
  bar.innerHTML = FIND_BAR_HTML;

  codeWrap.append(pre, ta);
  barHost.appendChild(bar);

  const find = bar.querySelector('.cf-search');
  const replace = bar.querySelector('.cf-replace');
  const count = bar.querySelector('.cf-count');
  const replaceRow = bar.querySelector('.cf-replace-row');
  const toggleReplace = bar.querySelector('.cf-toggle-replace');

  let matches = [];
  let current = -1;

  const render = () => { pre.innerHTML = `${highlight(ta.value)}\n`; };
  const commit = () => { job.code = ta.value; render(); };
  const showCount = () => { count.textContent = matches.length ? `${current + 1}/${matches.length}` : '0/0'; };
  const select = () => {
    ta.focus();
    ta.setSelectionRange(matches[current], matches[current] + find.value.length);
  };

  function refresh(reset) {
    const needle = find.value.toLowerCase();
    const haystack = ta.value.toLowerCase();
    matches = [];
    for (let at = needle ? haystack.indexOf(needle) : -1; at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
      matches.push(at);
    }
    if (reset || current < 0) current = matches.length ? 0 : -1;
    if (current >= matches.length) current = matches.length - 1;
    showCount();
    if (current >= 0) select();
  }

  function go(direction) {
    if (!matches.length) return;
    current = (current + direction + matches.length) % matches.length;
    showCount();
    select();
  }

  function replaceCurrent() {
    if (current < 0 || !matches.length) return;
    const at = matches[current];
    editText(ta, at, at + find.value.length, replace.value);
    refresh(false);
  }

  function replaceAll() {
    if (!find.value) return;
    const next = ta.value.replace(new RegExp(escapeRegExp(find.value), 'gi'), () => replace.value);
    if (next !== ta.value) {
      const { scrollTop, scrollLeft } = ta;
      editText(ta, 0, ta.value.length, next);
      ta.scrollTop = scrollTop;
      ta.scrollLeft = scrollLeft;
    }
    refresh(true);
  }

  function openBar(withReplace) {
    bar.classList.remove('hidden');
    replaceRow.classList.toggle('hidden', !withReplace);
    toggleReplace.classList.toggle('on', Boolean(withReplace));
    const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (selected) find.value = selected;
    find.focus();
    find.select();
    refresh(true);
  }

  function closeBar() {
    bar.classList.add('hidden');
    matches = [];
    current = -1;
    ta.focus();
  }

  const onEnterOrEscape = (onEnter) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter(e); }
    else if (e.key === 'Escape') { e.preventDefault(); closeBar(); }
  };

  ta.addEventListener('input', () => {
    commit();
    if (!bar.classList.contains('hidden')) refresh(false);
  });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab') {
      e.preventDefault();
      editText(ta, ta.selectionStart, ta.selectionEnd, '  ');
    } else if (mod && e.code === 'KeyF') {
      e.preventDefault();
      openBar(false);
    } else if (mod && e.code === 'KeyH') {
      e.preventDefault();
      openBar(true);
    }
  });

  find.addEventListener('input', () => refresh(true));
  find.addEventListener('keydown', onEnterOrEscape((e) => go(e.shiftKey ? -1 : 1)));
  replace.addEventListener('keydown', onEnterOrEscape(replaceCurrent));
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeBar(); }
  });
  bar.querySelector('.cf-next').addEventListener('click', () => go(1));
  bar.querySelector('.cf-prev').addEventListener('click', () => go(-1));
  bar.querySelector('.cf-close').addEventListener('click', closeBar);
  bar.querySelector('.cf-replace-one').addEventListener('click', replaceCurrent);
  bar.querySelector('.cf-replace-all').addEventListener('click', replaceAll);
  toggleReplace.addEventListener('click', () => {
    const show = replaceRow.classList.contains('hidden');
    replaceRow.classList.toggle('hidden', !show);
    toggleReplace.classList.toggle('on', show);
    if (show) replace.focus();
  });

  render();
}
