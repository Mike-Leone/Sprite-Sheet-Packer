import { packFrames } from './layout.js';
import { buildRcss, normalizeCodeStyle } from './rcss.js';
import { rasterize } from './rasterizer.js';

const sanitizeName = (name) => name.trim().replace(/\s+/g, '-');

const fileBase = (fileName) => fileName.replace(/\.[^.]+$/, '');
const smallerThanFrame = (file, fw, fh) => ({ error: `"${file}" is smaller than one ${fw}×${fh} frame.` });
const largerThanCanvas = (file, fw, fh) => ({ error: `"${file}": frame ${fw}×${fh} is larger than the canvas.` });

function leftoverNote(fileName, img, fw, fh) {
  const cols = Math.floor(img.width / fw);
  const rows = Math.floor(img.height / fh);
  if (cols * fw === img.width && rows * fh === img.height) return null;
  return `"${fileName}" (${img.width}×${img.height}) doesn't divide evenly into ${fw}×${fh} — extra pixels dropped.`;
}

/** Cuts an image into a grid of frames, row by row. */
function sliceGrid(img, fw, fh, firstIdx, decorate) {
  const cols = Math.floor(img.width / fw);
  const total = cols * Math.floor(img.height / fh);
  const frames = [];
  for (let i = 0; i < total; i++) {
    const frame = {
      idx: firstIdx + i,
      img,
      sx: (i % cols) * fw,
      sy: Math.floor(i / cols) * fh,
      w: fw,
      h: fh
    };
    frames.push(decorate ? Object.assign(frame, decorate(i, total)) : frame);
  }
  return frames;
}

async function finishJob({ name, frames, packed, fw, fh, srcFileName, notes, sliceOnly, codeStyle, optimize, onProgress }) {
  const canvases = await rasterize(name, frames, packed, { optimize, onProgress });
  return {
    name,
    srcFileName,
    canvases,
    code: buildRcss({ name, frames, packed, fw, fh, sliceOnly, codeStyle }),
    total: frames.length,
    numCanvases: packed.length,
    fw: fw || frames[0].w,
    fh: fh || frames[0].h,
    sliceOnly,
    notes
  };
}

/** Sheets mode: one job per source image. options: { maxW, maxH, optimize, onProgress } */
export async function buildJob(source, { maxW, maxH, optimize = false, onProgress }) {
  const { img, fw, fh, file } = source;
  const frames = sliceGrid(img, fw, fh, 0);
  if (!frames.length) return smallerThanFrame(file.name, fw, fh);
  if (fw > maxW || fh > maxH) return largerThanCanvas(file.name, fw, fh);

  const note = leftoverNote(file.name, img, fw, fh);
  return finishJob({
    name: sanitizeName(source.name) || 'sprite',
    frames,
    packed: packFrames(frames, maxW, maxH, source.direction),
    fw, fh,
    srcFileName: file.name,
    notes: note ? [note] : [],
    sliceOnly: false,
    codeStyle: normalizeCodeStyle(source.codeStyle),
    optimize,
    onProgress
  });
}

/**
 * Combine mode: frames of all sources on one shared sheet (or one PNG per frame with `sliceOnly`).
 * options: { name, direction, maxW, maxH, sliceOnly, codeStyle, optimize, onProgress }
 */
export async function buildLooseJob(sources, { name, direction, maxW, maxH, sliceOnly = false, codeStyle, optimize = false, onProgress }) {
  const frames = [];
  const notes = [];

  for (const { img, fw, fh, file, name: sourceName } of sources) {
    if (!sliceOnly && (fw > maxW || fh > maxH)) return largerThanCanvas(file.name, fw, fh);

    const base = sanitizeName(sourceName) || sanitizeName(fileBase(file.name)) || 'frame';
    const cells = sliceGrid(img, fw, fh, frames.length, (i, total) => {
      const digits = Math.max(3, String(total - 1).length);
      return { canvasName: total > 1 ? `${base}_${String(i).padStart(digits, '0')}` : base };
    });
    if (!cells.length) return smallerThanFrame(file.name, fw, fh);

    const note = leftoverNote(file.name, img, fw, fh);
    if (note) notes.push(note);
    frames.push(...cells);
  }
  if (!frames.length) return { error: 'Add at least one image.' };

  const packed = sliceOnly
    ? frames.map((f) => ({
        items: [{ idx: f.idx, x: 0, y: 0, w: f.w, h: f.h }],
        width: f.w,
        height: f.h,
        canvasName: f.canvasName
      }))
    : packFrames(frames, maxW, maxH, direction);

  return finishJob({
    name: sanitizeName(name) || 'sheet',
    frames,
    packed,
    fw: sources[0].fw,
    fh: sources[0].fh,
    srcFileName: sources.map((s) => s.file.name).join(', '),
    notes,
    sliceOnly,
    codeStyle: normalizeCodeStyle(codeStyle),
    optimize,
    onProgress
  });
}
