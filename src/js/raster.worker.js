self.onmessage = async ({ data }) => {
  const { jobId, canvasDefs, bitmaps } = data;
  try {
    const canvases = [];
    for (const def of canvasDefs) {
      const canvas = new OffscreenCanvas(def.width, def.height);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (const it of def.items) {
        ctx.drawImage(bitmaps[it.bitmap], it.sx, it.sy, it.w, it.h, it.x, it.y, it.w, it.h);
      }
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      canvases.push({ name: def.name, width: def.width, height: def.height, blob });
      self.postMessage({ type: 'progress', jobId, done: canvases.length, total: canvasDefs.length });
    }
    self.postMessage({ type: 'done', jobId, canvases });
  } catch (err) {
    self.postMessage({ type: 'error', jobId, message: err?.message || String(err) });
  }
};
