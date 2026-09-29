import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packFrames } from '../src/js/layout.js';
import { buildRcss, normalizeCodeStyle } from '../src/js/rcss.js';

const frames = Array.from({ length: 4 }, (_, idx) => ({ idx, w: 10, h: 10 }));
const build = (overrides = {}) =>
  buildRcss({
    name: 'hero', frames, packed: packFrames(frames, 20, 20, 'ltr-ttb'),
    fw: 10, fh: 10, sliceOnly: false, codeStyle: 'Knob', ...overrides
  });

test('Knob style: spritesheet block plus one animated class', () => {
  assert.equal(build(), `@spritesheet hero {
    hero_000: 0dp 0dp 10dp 10dp;
    hero_001: 10dp 0dp 10dp 10dp;
    hero_002: 0dp 10dp 10dp 10dp;
    hero_003: 10dp 10dp 10dp 10dp;
    src: hero.png;
}

.hero {
    width: 10dp;
    height: 10dp;
    frames: 4;
    spriteprefix: hero_;
}`);
});

test('Button style: state-named sprites and one class per state', () => {
  const code = build({ codeStyle: 'Button' });
  assert.match(code, /hero_default: 0dp 0dp 10dp 10dp;/);
  assert.match(code, /hero_checked: 10dp 0dp 10dp 10dp;/);
  assert.match(code, /\n\.hero \{\n {4}width: 10dp;\n {4}height: 10dp;\n {4}decorator: image\(hero_default\);\n\}/);
  assert.match(code, /\.hero:checked \{[^}]*image\(hero_checked\)/);
  assert.match(code, /\.hero:active:checked \{[^}]*image\(hero_active-checked\)/);
});

test('sheets are suffixed with an index only when there are several', () => {
  const many = Array.from({ length: 9 }, (_, idx) => ({ idx, w: 10, h: 10 }));
  const code = buildRcss({
    name: 'a', frames: many, packed: packFrames(many, 20, 20, 'ltr-ttb'),
    fw: 10, fh: 10, sliceOnly: false, codeStyle: 'Knob'
  });
  assert.match(code, /@spritesheet a_0 \{/);
  assert.match(code, /@spritesheet a_2 \{/);
  assert.doesNotMatch(build(), /hero_0 \{/);
});

test('"Only slice" produces no code', () => {
  assert.equal(build({ sliceOnly: true }), '');
});

test('unknown code styles fall back to Knob', () => {
  assert.equal(normalizeCodeStyle('Button'), 'Button');
  assert.equal(normalizeCodeStyle('nope'), 'Knob');
  assert.equal(normalizeCodeStyle(undefined), 'Knob');
});
