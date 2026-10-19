# Open PDF Pro

Open-source, **local-only** desktop PDF editor aiming at Adobe Acrobat Pro feature parity via a clean-room implementation. No Adobe code or assets — built on open standards (ISO 32000) and open-source libraries: `pdfjs-dist`, `pdf-lib`, `tesseract.js`.

## Features (v0.1.0)

- **Viewer** — open/render local PDFs, zoom, rotate, page nav, thumbnails, full-text search with highlight overlays, bookmarks/outline
- **Annotations** — highlight, ink, shapes (rectangles), free text, redaction boxes, note/annotation objects; form fill, flatten, field listing
- **Page ops** — merge, split, extract range, delete, reorder, rotate (with tests)
- **Redaction** — content-level: removes matching text-show operators from page streams and draws opaque boxes (works on FlateDecode streams)
- **OCR** — rasterize a page at 300 DPI, recognize words with tesseract.js (local), overlay an invisible (render mode 3) text layer so search/copy work
- **Digital signature verification** — finds `/ByteRange` signatures, checks structural integrity (ranges tile the file exactly around `/Contents`), parses the CMS/PKCS#7 SignedData with a minimal DER reader, verifies the messageDigest attribute and the signature with the embedded X.509 public key (node:crypto). Signature *creation* is not implemented (requires certificate generation).
- **Export/convert** — page → PNG (renderer rasterization), compress (object-stream re-save), identity print-to-PDF export of current bytes; per-page PDF extraction

## Privacy posture

- All processing happens locally on your machine (desktop CPU/GPU).
- The **only** network feature is the update check (`electron-updater` against this GitHub Releases), and it is disabled when running from source (`app.isPackaged` guard).
- No telemetry, no cloud APIs.

## Build & run

```bash
npm install
npm start        # run from source (electron)
npm test         # node:test suite (17 tests)
npm run dist     # Windows NSIS installer via electron-builder
```

## Legal

Clean-room implementation: features were derived from public PDF specification behavior (ISO 32000-1/-2) and open-source library capabilities; no Adobe intellectual property, code, or assets were used or referenced. MIT licensed — see [LICENSE](LICENSE).
