import { escapeHtml } from './util.js';

const LINE_START = [
  ['tok-at', /^@[a-zA-Z-]+/],
  ['tok-sel', /^\.[a-zA-Z_][\w-]*/],
  ['tok-prop', /^[a-zA-Z_][\w.-]*(?=\s*:)/]
];

const ANYWHERE = [
  ['tok-str', /^[\w.-]+\.(?:png|jpe?g|webp|rcss)\b/i],
  ['tok-num', /^\d+(?:\.\d+)?(?:dp|px|em|rem|%)?\b/],
  ['tok-punc', /^[{};]/]
];

const span = (cls, text) => `<span class="${cls}">${escapeHtml(text)}</span>`;

function highlightLine(line) {
  if (/^\s*(\/\/|\/\*)/.test(line)) return span('tok-comment', line);

  let out = '';
  let i = 0;
  let atStart = true;

  while (i < line.length) {
    if (atStart && /\s/.test(line[i])) {
      out += escapeHtml(line[i++]);
      continue;
    }

    const rest = line.slice(i);
    let matched = false;
    for (const [cls, re] of atStart ? [...LINE_START, ...ANYWHERE] : ANYWHERE) {
      const m = rest.match(re);
      if (m) {
        out += span(cls, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) out += escapeHtml(line[i++]);
    atStart = false;
  }
  return out;
}

export const highlight = (code) => code.split('\n').map(highlightLine).join('\n');
