# Sprite Sheet Packer

Fast offline desktop tool that slices images into frames and packs them into sprite sheets.

- **Sheets** mode builds a separate sheet for every source image.
- **Combine** mode packs frames from all images into one sheet, or exports every frame as its own image ("Only slice").
- Eight fill directions, canvas size presets, automatic splitting across several canvases.
- Generates `.rcss` code in two styles — **Knob** (animated sprite) and **Button** (one sprite per UI state); editable, with find & replace.
- Exports PNG / ZIP, with optional lossless **Optimize PNG** re-compression.

Built with [Tauri 2](https://tauri.app). The UI is plain HTML/CSS/JS (ES modules) with no build step.

## Try it in the browser

A web version (no install, everything runs locally in your browser) is published with GitHub Pages:
`https://<your-username>.github.io/sprite-sheet-packer/`

The only difference from the desktop app: files are saved through the browser's normal download instead of a "Save as" dialog.

## Download

Get the installer for your system from the [Releases](../../releases) page.
The builds are **not code-signed**, so the OS will warn you on first launch:

| System  | What to do |
|---------|------------|
| Windows | SmartScreen: **More info → Run anyway** |
| macOS   | Right-click the app → **Open** → **Open**. If macOS says the app is "damaged", run `xattr -cr "/Applications/Sprite Sheet Packer.app"` |
| Linux   | AppImage: `chmod +x *.AppImage`, then run it (needs `libfuse2`). Or install the `.deb` / `.rpm` |

## Development

Requirements: [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run dev      # run the desktop app with live frontend
npm run build    # build installers into src-tauri/target/release/bundle
npm test         # unit tests for layout and code generation
npm run web      # serve src/ in a browser at http://localhost:8080 (no native save dialog)
npm run build:single   # build dist/sprite-sheet-packer.html, one file that opens with a double-click
```

## Project layout

```
src/                 frontend (index.html, css/, js/, fonts/, img/, vendor/: jszip, pako, upng)
  js/main.js         entry point and build pipeline
  js/layout.js       pure frame packing algorithm
  js/rcss.js         .rcss code generation
  js/packing.js      slicing + job assembly
  js/rasterizer.js   PNG rendering (Web Worker with main-thread fallback)
src-tauri/           Rust shell: window, native "Save as" dialog
tests/               node:test unit tests
assets/app-icon.png  1024x1024 icon source (regenerate icons: npx tauri icon assets/app-icon.png)
```

## Web version (GitHub Pages)

Every push to `main` publishes the `src/` folder via `.github/workflows/pages.yml`.
One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The page needs a web server (browsers do not load ES modules from `file://`), which Pages provides.

### Offline single file

Opening `src/index.html` by double-click does **not** work: the browser blocks the scripts. Run `npm run build:single` instead —
it produces `dist/sprite-sheet-packer.html` with all code, fonts and images inlined, which works from any folder without a server.
The file can also be attached to a GitHub release as a download.

## Releasing

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Commit, then tag and push: `git tag v1.0.0 && git push origin main --tags`.
3. GitHub Actions (`.github/workflows/release.yml`) builds Windows, Linux and macOS (Apple Silicon + Intel)
   installers and attaches them to a **draft** release. Review it on the Releases page and click **Publish**.

## License

Copyright © 2026 Mike Leone. Licensed under the [GNU General Public License v3.0](LICENSE).
Third-party components are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
