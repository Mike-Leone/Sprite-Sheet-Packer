import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packFrames } from '../src/js/layout.js';

const frames = (n, w = 10, h = 10) => Array.from({ length: n }, (_, idx) => ({ idx, w, h }));
const positions = (canvas) => canvas.items.map(({ x, y }) => [x, y]);

test('fills rows left to right, top to bottom', () => {
  const [canvas] = packFrames(frames(4), 20, 20, 'ltr-ttb');
  assert.deepEqual(positions(canvas), [[0, 0], [10, 0], [0, 10], [10, 10]]);
  assert.equal(canvas.width, 20);
  assert.equal(canvas.height, 20);
});

test('fills columns top to bottom, left to right', () => {
  const [canvas] = packFrames(frames(4), 20, 20, 'ttb-ltr');
  assert.deepEqual(positions(canvas), [[0, 0], [0, 10], [10, 0], [10, 10]]);
});

test('right to left, bottom to top starts in the far corner', () => {
  const [canvas] = packFrames(frames(4), 20, 20, 'rtl-btt');
  assert.deepEqual(positions(canvas), [[10, 10], [0, 10], [10, 0], [0, 0]]);
});

test('splits into several canvases when the canvas is full', () => {
  const canvases = packFrames(frames(9), 20, 20, 'ltr-ttb');
  assert.deepEqual(canvases.map((c) => c.items.length), [4, 4, 1]);
});

test('crops each canvas to the used area', () => {
  const [canvas] = packFrames(frames(3), 100, 100, 'ltr-ttb');
  assert.deepEqual([canvas.width, canvas.height], [30, 10]);
});
