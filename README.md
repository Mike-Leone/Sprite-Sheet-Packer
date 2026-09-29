# Sprite Sheet Packer

![License](https://img.shields.io/badge/license-GPL--3.0-2563EB.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-DB2777.svg)
![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-0EA5E9.svg?logo=tauri&logoColor=white)
![Web](https://img.shields.io/badge/web-GitHub%20Pages-brightgreen.svg?logo=github)

"Sprite Sheet Packer" is an offline tool for slicing images into frames and packing them into sprite sheets, with built-in generation of .rcss code for the "RmlUi" UI engine. It is designed for creating and editing UI skins for "The Usual Suspects" plugins (Gearmulator / DSP56300 emulator). Available as a desktop app for Windows, macOS and Linux, and as a browser-based web version.

- **"Sheets"** mode builds a separate sheet for every source image.
- **"Combine"** mode packs frames from all images into one sheet, or exports every frame as its own image ("Only slice").
- Eight fill directions, canvas size presets, automatic splitting across several canvases.
- Generates `.rcss` code in two styles — **"Knob"** and **"Button"**. The code is editable, with find & replace.
- Exports PNG / ZIP with optional lossless **"Optimize PNG"** re-compression.

Built with [Tauri 2](https://tauri.app).

---

## 🌐 Try it in the browser

A web version (no install, everything runs locally in your browser) is published with GitHub Pages:
https://mike-leone.github.io/Sprite-Sheet-Packer/

The only difference from the desktop app: files are saved through the browser's normal download instead of a "Save as" dialog.

---

## ⬇️ Download

Get the installer for your system from the [Releases](../../releases) page.
The builds are **not code-signed**, so the OS will warn you on first launch:

| System  | What to do |
|---------|------------|
| Windows | SmartScreen: **More info → Run anyway** |
| macOS   | Right-click the app → **Open** → **Open**. If macOS says the app is "damaged", run `xattr -cr "/Applications/Sprite Sheet Packer.app"` |
| Linux   | AppImage: `chmod +x *.AppImage`, then run it (needs `libfuse2`). Or install the `.deb` / `.rpm` |

---

## 📖 Manual

### 1. ⚡ Quick start

1. Drop images onto **"Drop images here"** (or click to choose files).
2. For each source, set **"Frame width"** and **"Frame height"**.
3. Choose **"Sheets"** or **"Combine"**.
4. Adjust the output canvas size and options ("Code style", "Optimize PNG") if needed.
5. Click **"Build"** (`Enter` or `Ctrl+Enter` / `Cmd+Enter`).
6. Download PNG, ZIP, or copy the generated code.

### 2. 🧩 Modes

#### Sheets

Each source image is processed **separately**:

- sliced by its own frame size;
- packed into its own sprite sheet (or several if frames don't fit).

Per source card:

| Field | Description |
|-------|-------------|
| **Name** | Sheet base name and code prefix |
| **Frame W / H** | Frame size |
| **Fill direction** | Packing order |
| **Code style** | **Knob** or **Button** (see §5) |

#### Combine

Frames from **all** sources go onto **one** shared sheet.

| Option | Description |
|--------|-------------|
| **Name** | Shared sheet name and **code** prefix (not source file names) |
| **Fill direction** | Layout order |
| **Code style** | Knob or Button for the whole sheet |
| **Only slice** | Slice only — no packing |

Source card order affects frame order on the sheet.

#### Only slice (checkbox in Combine)

- Each frame is saved as a **separate PNG**.
- Canvas size, "Fill direction", and "Code style" are **not used**.
- A **"Names"** block appears — base name per source.
- File names: `name`, or `name_000`, `name_001`… when there are multiple frames.
- **No `.rcss` is generated** — PNGs only (+ ZIP).

Useful for batch-cutting sprites without building an atlas.

### 3. 🖼️ Source images

- **Add:** drag-and-drop or click the drop zone (multiple files).
- **Order:** drag cards to reorder.
- **Name:** base name for the sheet / frames (no extension).
- **Frame W / H:** slice cell size. If the image does not divide evenly, extra pixels on the right/bottom are dropped (warning shown).
- **Fill direction**: packing direction.
- **Code style**: Knob or Button; default is Knob.
- **Collapse all** — collapse or expand all cards.

### 4. 📐 Output canvas

Maximum size of one sheet (width × height).

- Presets: 512, 1024, 2048, 4096.
- If frames don't fit — files are named `name_0`, `name_1`, …
- A single sheet has no numeric suffix.

#### Optimize PNG (lossless)

Checkbox in the **"Output canvas"** panel.

- After packing, PNGs are **re-encoded without quality loss** (identical pixels).
- Files are often smaller (more noticeable on flat UI sprites; noisy frames may shrink only a little).
- Build is slightly slower.
- If the optimized file is larger than the original encode, the original is kept.

### 5. 💻 Code style

Output format is **`.rcss`** (RmlUi / RCSS).

#### Knob (default)

Classic sheet with `frames` and `spriteprefix`:

```text
@spritesheet Button-Load {
    Button-Load_000: 0dp 0dp 92dp 30dp;
    Button-Load_001: 92dp 0dp 92dp 30dp;
    src: Button-Load.png;
}

.Button-Load {
    width: 92dp;
    height: 30dp;
    frames: 2;
    spriteprefix: Button-Load_;
}
```

#### Button

Button states via `decorator: image(...)` and **pseudo-classes**.

Frame order → sprite label → selector:

| # | Sprite in sheet | Class |
|---|-----------------|-------|
| 1 | `Name_default` | `.Name` |
| 2 | `Name_checked` | `.Name:checked` |
| 3 | `Name_active` | `.Name:active` |
| 4 | `Name_active-checked` | `.Name:active:checked` |
| 5 | `Name_hover` | `.Name:hover` |
| 6 | `Name_focus` | `.Name:focus` |
| 7 | `Name_disabled` | `.Name:disabled` |
| 8 | `Name_disabled-checked` | `.Name:disabled:checked` |
| 9 | `Name_selected` | `.Name:selected` |
| 10 | `Name_active-selected` | `.Name:active:selected` |

Further frames fall back to `_default` / `.Name`.

Example:

```text
@spritesheet Button-Load {
    Button-Load_default: 0dp 0dp 92dp 30dp;
    Button-Load_checked: 92dp 0dp 92dp 30dp;
    Button-Load_active: 184dp 0dp 92dp 30dp;
    src: Button-Load.png;
}

.Button-Load {
    width: 92dp;
    height: 30dp;
    decorator: image(Button-Load_default);
}
.Button-Load:checked {
    width: 92dp;
    height: 30dp;
    decorator: image(Button-Load_checked);
}
.Button-Load:active {
    width: 92dp;
    height: 30dp;
    decorator: image(Button-Load_active);
}
```

In **"Combine"**, `@spritesheet` and class names use the combined sheet's **"Name"** field, not the original file names.

### 6. 📦 After Build

Canvases and code appear on the right.

#### Canvas

- Preview and size in px.
- **"Name" field** — rename the file; the name is used for download and **updates the code** (Knob and Button).
- **"Enter"** in the rename field applies the name only and **does not run Build**.
- **"Download PNG"** — single file.
- Click the preview — lightbox (zoom, arrows).
- Select several → **"Download selected"**.

#### Code

- Editable `.rcss` with highlighting.
- **Copy**, download `.rcss`, ZIP (PNG + code).
- `Ctrl+F` — find, `Ctrl+H` — replace.
- In **Only slice** the code panel is hidden; **Download ZIP** exports PNGs.

### 7. ⌨️ Keyboard shortcuts

| Keys                           | Action |
|--------------------------------|--------|
| **Enter**                      | In source name/size fields — commit (may Build). In canvas **Rename** — apply name only. In the code editor — new line. |
| **Ctrl+Enter** / **Cmd+Enter** | **Build** from anywhere (including the code editor). |
| **Ctrl+Z** / **Cmd+Z**         | Undo (sources and canvas renames). |
| **Ctrl+Y** / **Cmd+Shift+Z**   | Redo |
| **Esc**                        | Close lightbox |
| **← →**                        | Lightbox — previous / next image |
| **+ / − and Scroll**           | Lightbox — zoom |

### 8. 📤 Export

- **"Download PNG"** — one canvas.
- **"Download selected"** — selected canvases as ZIP.
- **"Download all as ZIP"** / **"Download ZIP"** — all PNGs (+ `.rcss` when code was generated).
- Separate `.rcss` download and copy-to-clipboard.

File names come from the name field on each card.

### 9. 🔍 Image quality

- Frames are copied **pixel-for-pixel** (no smoothing).
- Output is **lossless PNG**.
- **File size (kb)** may differ from the source due to a different PNG encoder — that is not quality loss.
- **"Optimize PNG"** reduces weight while keeping pixels 1:1.
- Exact check: pixel compare (e.g. ImageMagick `compare -metric AE`); `0` means identical. File hashes will still differ.

### 10. ❓ Common issues

**"Build is disabled"**  
No source images loaded.

**"Doesn't divide evenly"**  
Image size is not a multiple of Frame W/H — edge pixels were dropped.

**"Frame larger than the canvas"**  
Frame is larger than Output canvas. Only slice does not block on this.

**"Code didn't update after renaming"**  
Renaming a canvas card should update the code automatically. If you edited the code by hand, fix it or run Build again.

**"Optimize PNG barely reduced size"**  
The image was already well compressed or is hard for PNG (noise/photo). Flat UI sprites usually shrink more.

---

## ⚖️ License

Copyright © 2026 Mike Leone. This project is distributed under the **GNU General Public License v3.0**.
The full license text is available in the [LICENSE.md](LICENSE.md) file.
Third-party components are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## 👤 Author: **Mike Leone**

## 📬 Contact

- **YouTube:** [Mike Sunrise](https://www.youtube.com/@MikeSunrise)
- **Discord:** [Mike Leone](https://discord.com/users/402421967812034560)

## 💝 Support the author

- **Donation:** [Support Mike Leone](https://www.donationalerts.com/r/mikesunrise)

 <img width="281" height="281" alt="QR 11" src="https://github.com/user-attachments/assets/3e4e6d49-9b45-4fd5-9f76-35030d04e269" />

*If you have any questions or suggestions — open an Issue in this repository.*
