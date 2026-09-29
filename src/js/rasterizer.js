import { stripPng } from './util.js';
import { optimizePng } from './png-optimizer.js';

const workerSupported =
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof OffscreenCanvas.prototype.convertToBlob === 'function';

let worker = null;
let nextJobId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./raster.worker.js', import.meta.url));
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.jobId);
    if (!request) return;
    if (data.type === 'progress') {
      request.onProgress?.(data.done, data.total);
      return;
    }
    pending.delete(data.jobId);
    if (data.type === 'done') request.resolve(data.canvases);
    else request.reject(new Error(data.message));
  };
  worker.onerror = (event) => {
    pending.forEach((request) => request.reject(event.error || new Error('Worker failed')));
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

/** PNG base name: an explicit per-canvas name ("Only slice"), else `name`, suffixed with the index if several. */
const canvasBaseName = (canvas, name, index, count) =>
  canvas.canvasName ? stripPng(String(canvas.canvasName)) : count > 1 ? `${name}_${index}` : name;

const describeCanvases = (name, frames, packed) =>
  packed.map((canvas, i) => ({
    name: `${canvasBaseName(canvas, name, i, packed.length)}.png`,
    width: canvas.width,
    height: canvas.height,
    items: canvas.items.map((it) => ({ ...it, frame: frames[it.idx] }))
  }));

const toResult = (blob, width, height, name) => ({ blob, url: URL.createObjectURL(blob), w: width, h: height, name });

async function rasterizeInWorker(defs, onProgress) {
  const bitmapIndex = new Map();
  const bitmapJobs = [];
  for (const def of defs) {
    for (const { frame } of def.items) {
      if (!bitmapIndex.has(frame.img)) {
        bitmapIndex.set(frame.img, bitmapJobs.length);
        bitmapJobs.push(createImageBitmap(frame.img));
      }
    }
  }
  const bitmaps = await Promise.all(bitmapJobs);

  const canvasDefs = defs.map((def) => ({
    name: def.name,
    width: def.width,
    height: def.height,
    items: def.items.map(({ frame, x, y, w, h }) => ({
      x, y, w, h, sx: frame.sx, sy: frame.sy, bitmap: bitmapIndex.get(frame.img)
    }))
  }));

  const jobId = ++nextJobId;
  const canvases = await new Promise((resolve, reject) => {
    pending.set(jobId, { resolve, reject, onProgress });
    getWorker().postMessage({ jobId, canvasDefs, bitmaps }, bitmaps);
  });
  return canvases.map((c) => toResult(c.blob, c.width, c.height, c.name));
}

async function rasterizeOnMainThread(defs, onProgress) {
  const results = [];
  for (const def of defs) {
    const canvas = document.createElement('canvas');
    canvas.width = def.width;
    canvas.height = def.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (const { frame, x, y, w, h } of def.items) {
      ctx.drawImage(frame.img, frame.sx, frame.sy, w, h, x, y, w, h);
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    results.push(toResult(blob, def.width, def.height, def.name));
    onProgress?.(results.length, defs.length);
  }
  return results;
}

async function optimizeCanvases(canvases, onProgress) {
  const results = [];
  for (const [i, canvas] of canvases.entries()) {
    const blob = await optimizePng(canvas.blob);
    URL.revokeObjectURL(canvas.url);
    results.push(toResult(blob, canvas.w, canvas.h, canvas.name));
    onProgress?.(i + 1, canvases.length);
  }
  return results;
}

/**
 * Draws packed frames to PNG canvases: [{ blob, url, w, h, name }].
 * Uses a worker when available; `optimize` re-encodes every PNG losslessly afterwards.
 */
export async function rasterize(name, frames, packed, { optimize = false, onProgress } = {}) {
  const defs = describeCanvases(name, frames, packed);
  let canvases = null;
  if (workerSupported) {
    try {
      canvases = await rasterizeInWorker(defs, onProgress);
    } catch {
      // fall back to the main thread
    }
  }
  if (!canvases) canvases = await rasterizeOnMainThread(defs, onProgress);
  return optimize ? optimizeCanvases(canvases, onProgress) : canvases;
}
