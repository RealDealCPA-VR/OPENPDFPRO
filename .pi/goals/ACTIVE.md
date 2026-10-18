# Active Goal

Status: ACTIVE
Goal: Create a perfect open-source clone of Adobe PDF Pro: local-only desktop app using desktop resources; no cloud features except update checks. Push milestones to https://github.com/RealDealCPA-VR/OPENPDFPRO and continue across contexts until complete.
Started: 2026-02-14
Last updated: 2026-02-14 (wave 1)

## Scope and acceptance criteria
- [ ] A1: Desktop app (Electron) runs on Windows; opens and renders PDFs locally (pdf.js)
- [ ] A2: No network calls except update check (electron-updater against GitHub releases)
- [ ] A3: Core Pro-parity features implemented & testable: viewer (zoom/rotate/search/thumbnails), annotations, page manipulation (insert/delete/extract/reorder/rotate), text editing basics, forms fill, redact, OCR, digital signature (verify), export/convert (print-to-PDF, images), merge/split, compress
- [ ] A4: Automated test suite passes (unit + smoke)
- [ ] A5: Milestones pushed to GitHub remote RealDealCPA-VR/OPENPDFPRO
- [ ] A6: README documents features, build, legal posture (clean-room, no Adobe code)

## Constraints and decisions
- NO Adobe code/assets; clean-room from open standards (ISO 32000) + OSS libs: pdfjs-dist, pdf-lib, mupdf?/pikepdf equivalents (JS only), tesseract.js
- Desktop resources only (local CPU/GPU); no cloud APIs
- Updates: electron-updater w/ GitHub Releases provider = only allowed network
- Node/npm on Windows host; PowerShell + bash available

## Baseline
- Workspace state: new git repo (main), empty, no remote yet
- Checks before changes: none possible (empty project)

## Todo
- [x] T001: git init, ledger, remote config | Verify: git remote -v
- [x] T002: Scaffold Electron app (package.json, main, preload, renderer, pdfjs viewer open/render) | Verify: `npm run build` + smoke launch test
- [x] T003: Viewer features: thumbnails, zoom, rotate, page nav, text search, sidebar TOC | Verify: unit tests + smoke
- [x] T005: Page ops: delete/rotate/extract/reorder/insert/merge/split | Verify: unit tests on sample PDF
- [x] T004: Annotations layer (highlight, note, draw, shapes, text) persisted via pdf-lib | Verify: round-trip test
- [ ] T005: Page ops: delete/rotate/extract/reorder/insert/merge/split | Verify: unit tests on sample PDF
- [ ] T006: Forms fill + save; flatten | Verify: unit test
- [ ] T007: OCR (tesseract.js) → hidden text layer | Verify: test on generated image PDF
- [ ] T008: Redaction (remove content + draw box) | Verify: unit test
- [ ] T009: Signatures: verify existing signatures (pdfjs) + create (self-signed) | Verify: test
- T010: Export/convert: print-to-PDF, rasterize images, compress | Verify: test
- T011: Auto-update via electron-updater (GitHub releases, disabled in dev) | Verify: config + unit
- T012: Packaging (electron-builder NSIS) + README + LICENSE (MIT) | Verify: build artifacts
- T013: Final regression: full test suite + app smoke + push milestone | Verify: CI green

## Progress and evidence
- 2026-02-14 T005: src/core/pages.js + test/pages.test.js — 7/7 pass. Fixed pdf-lib setRotation needs degrees(). Pushed 5020460.
- 2026-02-14 T002: Electron+pdf.js scaffold (src/main.js, preload.js, renderer/*) built; sample.pdf created; electron launched & killed OK (smoke PASS); pushed fad6a7e to origin/main
- 2026-02-14 T001: git init main; ledger created; gh auth OK; remote pending push (repo exists: RealDealCPA-VR/OPENPDFPRO)

## Pickup verification
- 2026-02-14 wave1: fresh repo; nothing to verify yet.

## Handoff
- Current checkpoint: M1 pushed (5020460); 7/7 tests pass; viewer + core page ops done
- Last completed: T005
- In progress: T004 (annotations layer)
- Next exact action: build src/core/annotations.js (highlight/strike/underline via pdf-lib annotations, notes, draw via SVG→PDF) + renderer UI toolbar for annotation modes; then test round-trip
- Files changed: src/core/pages.js, test/pages.test.js, src/renderer/app.js, viewer.css
- Commands/checks: npm test 7/7 PASS; push PASS
- Decisions/assumptions: Electron + pdfjs-dist + pdf-lib stack; updates via electron-updater only
- Blockers/risks: scope enormous — work in milestone waves, keep ledger current
- Context note: initial creation
