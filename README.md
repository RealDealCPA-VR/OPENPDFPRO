<div align="center">

# 📄 Open PDF Pro

**The open-source, local-only PDF editor aiming for Acrobat Pro parity — clean-room, no strings attached.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)]()
[![Tests](https://img.shields.io/badge/tests-17%2F17-brightgreen.svg)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)]()
[![No Cloud](https://img.shields.io/badge/cloud-critical%20data%20stays%20local-red.svg)]()

*Built from the ISO 32000 spec. Zero Adobe code. Zero telemetry. Zero excuses.*

</div>

---

## 🚀 Why

Adobe Acrobat Pro costs real money and phones home. Open PDF Pro is a **clean-room desktop editor** that runs entirely on your machine: your PDFs never leave your disk, and the only network call the app ever makes is an optional update check.

## ✨ Features

| | Feature | Details |
|---|---------|---------|
| 👁️ | **Viewer** | Pixel-accurate pdf.js rendering, zoom, rotate, thumbnails, bookmarks/outline, continuous scroll |
| 🔍 | **Search** | Full-text search with highlight overlays across all pages |
| ✍️ | **Annotations** | Highlight, ink, rectangles, free text, redaction boxes, notes |
| 📋 | **Forms** | Fill, list, and flatten AcroForm fields |
| 📑 | **Page ops** | Merge, split, extract range, delete, reorder, rotate — all unit-tested |
| 🖤 | **Redaction** | *Content-level* removal: text-show operators are surgically stripped from page streams, then covered with opaque boxes. Not just a black rectangle on top. |
| 🔡 | **OCR** | 300 DPI rasterize → tesseract.js (local CPU) → invisible text layer (render mode 3) so search & copy just work |
| 🔏 | **Signature verify** | ByteRange structural integrity + full CMS/PKCS#7 parse (minimal DER reader) + digest & signature verification against the embedded X.509 key |
| 📤 | **Export** | Page → PNG, per-page PDF extraction, compression (object-stream re-save), identity print-to-PDF |

## 🔒 Privacy posture

- **100% local processing** — your documents are never uploaded anywhere.
- The **only** network feature is the update check (`electron-updater` → GitHub Releases), and it's compiled out when running from source.
- No telemetry. No accounts. No phoning home.

## 🛠️ Getting started

```bash
git clone https://github.com/RealDealCPA-VR/OPENPDFPRO.git
cd OPENPDFPRO
npm install
npm start        # 🏃 run from source
npm test         # ✅ 17-test node:test suite
npm run dist     # 📦 Windows NSIS installer
```

## 🏗️ Architecture

```
src/
├── main.js        # Electron main: window, dialogs, unified pdf:op IPC dispatch
├── preload.js     # contextBridge API (window.pdfpro)
├── core/          # Pure "bytes in → bytes out" engines (all unit-tested)
│   ├── pages.js       # merge/split/extract/delete/reorder/rotate
│   ├── annotations.js # highlight/ink/shapes/free text/forms
│   ├── redact.js      # stream surgery + opaque boxes
│   ├── ocr.js         # tesseract.js + invisible text layer
│   ├── signature.js   # ByteRange + CMS/PKCS#7 verify
│   └── export.js      # compress, per-page extraction
└── renderer/      # pdf.js viewer + toolbar UI
test/              # node:test suite (17/17 ✅)
```

**Stack:** Electron 33 · pdf.js 4 · pdf-lib · tesseract.js 7 · node:crypto

## 🧪 Verification

| Check | Status |
|-------|--------|
| `npm test` | ✅ 17/17 (pages, annotations, redaction, OCR, signatures, export) |
| Smoke launch | ✅ Electron boots clean |
| `npm run dist` | ✅ `Open PDF Pro Setup 0.1.0.exe` |

## ⚠️ Known limits (v0.1.0)

- **Signature creation** not yet implemented (needs X.509 cert generation); *verification* is fully implemented.
- Redaction v1 handles FlateDecode streams with literal/hex/TJ strings; exotic subset-font encodings may slip through.
- OCR language data is fetched by tesseract.js on first use; all recognition runs locally.

## 📜 Legal

**Clean-room implementation.** Features were derived from public PDF specification behavior (ISO 32000-1/-2) and open-source library capabilities. No Adobe intellectual property, code, or assets were used. MIT licensed — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Built with 🖤 for people who own their documents.</sub>
</div>
