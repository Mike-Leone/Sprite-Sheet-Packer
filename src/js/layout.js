/**
 * Pure frame layout. Direction codes:
 *   row-major:    'ltr' | 'rtl' + '-' + 'ttb' | 'btt'
 *   column-major: 'ttb' | 'btt' + '-' + 'ltr' | 'rtl'
 * Returns canvases as { items: [{ idx, x, y, w, h }], width, height }.
 */
export function packFrames(frames, maxW, maxH, direction) {
  const canvases = [];
  let current = [];

  const finalize = () => {
    if (!current.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of current) {
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + it.w);
      maxY = Math.max(maxY, it.y + it.h);
    }
    canvases.push({
      items: current.map((it) => ({ ...it, x: it.x - minX, y: it.y - minY })),
      width: maxX - minX,
      height: maxY - minY
    });
    current = [];
  };

  const rowMajor = direction.startsWith('ltr') || direction.startsWith('rtl');
  const ltr = direction.startsWith('ltr') || direction.endsWith('ltr');
  const ttb = direction.startsWith('ttb') || direction.endsWith('ttb');
  const startX = ltr ? 0 : maxW;

  if (rowMajor) {
    let x = startX, y = 0, rowH = 0;
    for (const f of frames) {
      const fits = ltr ? x + f.w <= maxW : x - f.w >= 0;
      if (current.length && !fits) {
        x = startX;
        y = ttb ? y + rowH : y - rowH;
        rowH = 0;
      }
      if (current.length && Math.abs(y) + f.h > maxH) {
        finalize();
        x = startX; y = 0; rowH = 0;
      }
      current.push({ idx: f.idx, x: ltr ? x : x - f.w, y: ttb ? y : y - f.h, w: f.w, h: f.h });
      x = ltr ? x + f.w : x - f.w;
      rowH = Math.max(rowH, f.h);
    }
  } else {
    let x = startX, y = 0, colW = 0;
    for (const f of frames) {
      if (current.length && Math.abs(y) + f.h > maxH) {
        y = 0;
        x = ltr ? x + colW : x - colW;
        colW = 0;
      }
      const exceeds = ltr ? x + f.w > maxW : x - f.w < 0;
      if (current.length && exceeds) {
        finalize();
        x = startX; y = 0; colW = 0;
      }
      current.push({ idx: f.idx, x: ltr ? x : x - f.w, y: ttb ? y : y - f.h, w: f.w, h: f.h });
      y = ttb ? y + f.h : y - f.h;
      colW = Math.max(colW, f.w);
    }
  }

  finalize();
  return canvases;
}
