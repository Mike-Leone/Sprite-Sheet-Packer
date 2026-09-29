/** Lossless PNG re-encode (UPNG + pako, loaded as vendor scripts). Returns the original if it isn't smaller. */
export async function optimizePng(blob) {
  const { UPNG } = window;
  if (!UPNG?.decode || !UPNG?.encode) return blob;
  try {
    const decoded = UPNG.decode(new Uint8Array(await blob.arrayBuffer()));
    const rgba = UPNG.toRGBA8(decoded)[0];
    const optimized = new Blob([UPNG.encode([rgba], decoded.width, decoded.height, 0)], { type: 'image/png' });
    return optimized.size > 0 && optimized.size < blob.size ? optimized : blob;
  } catch {
    return blob;
  }
}
