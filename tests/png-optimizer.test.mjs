import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { optimizePng } from '../src/js/png-optimizer.js';

const blobOf = (size) => new Blob([new Uint8Array(size)], { type: 'image/png' });
const useUpng = (encodedSize, { throws = false } = {}) => {
  globalThis.window = {
    UPNG: {
      decode: () => { if (throws) throw new Error('bad png'); return { width: 2, height: 2 }; },
      toRGBA8: () => [new Uint8Array(16)],
      encode: () => new Uint8Array(encodedSize).buffer
    }
  };
};

afterEach(() => { delete globalThis.window; });

test('returns the re-encoded PNG when it is smaller', async () => {
  useUpng(40);
  const result = await optimizePng(blobOf(100));
  assert.equal(result.size, 40);
});

test('keeps the original when the re-encoded PNG is not smaller', async () => {
  useUpng(150);
  const original = blobOf(100);
  assert.equal(await optimizePng(original), original);
});

test('keeps the original when decoding fails', async () => {
  useUpng(40, { throws: true });
  const original = blobOf(100);
  assert.equal(await optimizePng(original), original);
});

test('keeps the original when UPNG is not loaded', async () => {
  globalThis.window = {};
  const original = blobOf(100);
  assert.equal(await optimizePng(original), original);
});
