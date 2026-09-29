const tauriInvoke = () => window.__TAURI__?.core?.invoke;

function browserDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves a blob via the native dialog (desktop app) or a regular download (browser). */
export async function saveBlob(blob, fileName, extensions = []) {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const saved = await invoke('save_file_bytes', bytes, {
        headers: {
          'x-file-name': encodeURIComponent(fileName),
          'x-extensions': extensions.join(',')
        }
      });
      return Boolean(saved);
    } catch {
      // fall back to a regular browser download
    }
  }
  browserDownload(blob, fileName);
  return true;
}

const zipBlob = (zip) => zip.generateAsync({ type: 'blob' });
const addJobFiles = (folder, job) => {
  job.canvases.forEach((c) => folder.file(c.name, c.blob));
  if (job.code) folder.file(`${job.name}.rcss`, job.code);
};

export const downloadRcss = (job) =>
  saveBlob(new Blob([job.code], { type: 'text/plain' }), `${job.name}.rcss`, ['rcss', 'txt']);

export async function downloadJobZip(job) {
  const zip = new JSZip();
  addJobFiles(zip, job);
  return saveBlob(await zipBlob(zip), `${job.name}.zip`, ['zip']);
}

export async function downloadAllZip(jobs) {
  const zip = new JSZip();
  jobs.forEach((job) => addJobFiles(zip.folder(job.name), job));
  return saveBlob(await zipBlob(zip), 'sprite-sheet-batch.zip', ['zip']);
}

export async function downloadSelectedCanvases(job) {
  const picked = [...job.selected].sort((a, b) => a - b).map((i) => job.canvases[i]).filter(Boolean);
  if (!picked.length) return;
  if (picked.length === 1) return saveBlob(picked[0].blob, picked[0].name, ['png']);

  const zip = new JSZip();
  picked.forEach((c) => zip.file(c.name, c.blob));
  return saveBlob(await zipBlob(zip), `${job.name}-selected.zip`, ['zip']);
}
