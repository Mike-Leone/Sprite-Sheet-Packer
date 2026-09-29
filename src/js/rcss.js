export const normalizeCodeStyle = (style) => (style === 'Button' ? 'Button' : 'Knob');

// Button style: one sprite per UI state, in this order (extra frames fall back to "default").
const BUTTON_STATES = [
  'default', 'checked', 'active', 'active-checked', 'hover',
  'focus', 'disabled', 'disabled-checked', 'selected', 'active-selected'
];

const buttonState = (index) => BUTTON_STATES[index < BUTTON_STATES.length ? index : 0];
const buttonLabel = (name, index) => `${name}_${buttonState(index)}`;

function buttonSelector(name, index) {
  const stateName = buttonState(index);
  return stateName === 'default' ? `.${name}` : `.${name}${stateName.split('-').map((s) => `:${s}`).join('')}`;
}

const byIdx = (a, b) => a.idx - b.idx;

/**
 * Generates the .rcss text for a job. Sheet and sprite names always derive from `name`.
 * "Only slice" exports plain PNGs, so it has no code.
 */
export function buildRcss({ name, frames, packed, fw, fh, sliceOnly, codeStyle }) {
  if (sliceOnly) return '';

  const button = codeStyle === 'Button';
  const digits = Math.max(3, String(Math.max(0, frames.length - 1)).length);
  const prefix = `${name}_`;
  const refW = fw || frames[0]?.w || 0;
  const refH = fh || frames[0]?.h || 0;
  const spriteLabel = (idx) => (button ? buttonLabel(name, idx) : prefix + String(idx).padStart(digits, '0'));

  const blocks = packed.map((canvas, i) => {
    const sheet = packed.length > 1 ? `${name}_${i}` : name;
    const lines = [...canvas.items].sort(byIdx).map((it) => `    ${spriteLabel(it.idx)}: ${it.x}dp ${it.y}dp ${it.w}dp ${it.h}dp;\n`);
    return `@spritesheet ${sheet} {\n${lines.join('')}    src: ${sheet}.png;\n}`;
  });

  if (button) {
    for (const canvas of packed) {
      for (const it of [...canvas.items].sort(byIdx)) {
        const frame = frames[it.idx];
        blocks.push(
`${buttonSelector(name, it.idx)} {
    width: ${frame.w || refW}dp;
    height: ${frame.h || refH}dp;
    decorator: image(${buttonLabel(name, it.idx)});
}`);
      }
    }
  } else {
    blocks.push(
`.${name} {
    width: ${refW}dp;
    height: ${refH}dp;
    frames: ${frames.length};
    spriteprefix: ${prefix};
}`);
  }
  return blocks.join('\n\n');
}
