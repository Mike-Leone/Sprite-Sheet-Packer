// Builds dist/sprite-sheet-packer.html: the whole app in one file that also works via file:// (double-click).
import { build, transform } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (file) => readFile(file, 'utf8');

const MIME = { '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const dataUri = async (file) =>
  `data:${MIME[path.extname(file)]};base64,${(await readFile(file)).toString('base64')}`;

// Keeps the browser from ending an inline <script> early.
const forInlineScript = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

async function replaceAsync(text, regex, replacer) {
  const parts = await Promise.all([...text.matchAll(regex)].map((m) => replacer(...m)));
  let i = 0;
  return text.replace(regex, () => parts[i++]);
}

// 1. App code: ES modules -> one classic script. The raster worker becomes an inline Blob worker,
//    because browsers refuse to load worker files from file://.
const workerCode = (await transform(await read(src('js/raster.worker.js')), { minify: true })).code;
const bundled = await build({
  entryPoints: [src('js/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  define: { 'import.meta.url': '"file:///"' }
});

const workerCall = /new Worker\(new URL\("\.\/raster\.worker\.js",[^)]*\)\)/;
let appCode = bundled.outputFiles[0].text;
if (!workerCall.test(appCode)) throw new Error('Worker construction not found in bundle; update build-single.mjs');
appCode = appCode.replace(workerCall, () =>
  `new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerCode)}],{type:"text/javascript"})))`);

// 2. Stylesheet with fonts inlined.
const css = await replaceAsync(await read(src('css/styles.css')), /url\("\.\.\/([^"]+)"\)/g,
  async (_, file) => `url("${await dataUri(src(file))}")`);

// 3. HTML with everything inlined.
let html = await read(src('index.html'));
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`Not found in index.html: ${from}`);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="css/styles.css">', `<style>${css}</style>`);
html = await replaceAsync(html, /<script src="(vendor\/[^"]+)"><\/script>/g,
  async (_, file) => `<script>${forInlineScript(await read(src(file)))}</script>`);
swap('<script type="module" src="js/main.js"></script>', `<script>${forInlineScript(appCode)}</script>`);
html = await replaceAsync(html, /(src|href)="(img\/[^"]+)"/g, async (_, attr, file) => `${attr}="${await dataUri(src(file))}"`);

const out = path.join(root, 'dist', 'sprite-sheet-packer.html');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`${path.relative(root, out)}  ${(html.length / 1024).toFixed(0)} KB`);
