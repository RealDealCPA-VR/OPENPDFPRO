# Active Goal

Status: ACTIVE
Goal: Create a perfect open-source clone of Adobe PDF Pro: local-only desktop app using desktop resources; no cloud features except update checks. Push milestones to https://github.com/RealDealCPA-VR/OPENPDFPRO and continue across contexts until complete.
Started: 2026-02-14
Last updated: 2026-02-14 (wave 1, after M3)

## Scope and acceptance criteria
- [ ] A1: Desktop app (Electron) runs on Windows; opens and renders PDFs locally (pdf.js)
- [ ] A2: No network calls except update check (electron-updater against GitHub releases)
- [ ] A3: Core Pro-parity features implemented & testable: viewer (zoom/rotate/search/thumbnails), annotations, page manipulation (insert/delete/extract/reorder/rotate), text editing basics, forms fill, redact, OCR, digital signature (verify), export/convert (print-to-PDF, images), merge/split, compress
- [ ] A4: Automated test suite passes (unit + smoke)
- [ ] A5: Milestones pushed to GitHub remote RealDealCPA-VR/OPENPDFPRO
- [ ] A6: README documents features, build, legal posture (clean-room, no Adobe code)

## Constraints and decisions
- NO Adobe code/assets; clean-room from open standards (ISO 32000) + OSS libs: pdfjs-dist, pdf-lib, tesseract.js
- Desktop resources only (local CPU/GPU); no cloud APIs
- Updates: electron-updater w/ GitHub Releases provider = only allowed network
- Node/npm on Windows host; PowerShell + bash available

## Baseline
- Workspace state: branch main, latest 42378f2 (M3 redaction), clean tree
- Checks before changes: `npm test` — PASS (11/11)

## Todo
- [x] T001: git init, ledger, remote config | Verify: git remote -v
- [x] T002: Scaffold Electron app | Verify: smoke launch PASS
- [x] T003: Viewer: thumbnails, zoom, rotate, nav, search+highlight, TOC | Verify: smoke + tests
- [x] T004: Annotations core (highlight, ink, shapes, free text, redact box) | Verify: round-trip tests
- [x] T005: Page ops: merge/split/extract/delete/reorder/rotate | Verify: test/pages.test.js 7/7
- [x] T006: Forms fill/flatten/list | Verify: test/annotations.test.js
- [x] T008: Redaction with content removal | Verify: test/redact.test.js 11/11
- [ ] T007: OCR (tesseract.js) → hidden text layer | Verify: test on generated image PDF
- [ ] T009: Signatures: verify existing + create (self-signed, node:crypto) | Verify: test
- [ ] T009b: Renderer toolbar for annotation/ops modes wired to core + IPC | Verify: smoke
- [ ] T010: Export/convert: print-to-PDF, rasterize images, compress | Verify: test
- [ ] T011: Auto-update via electron-updater (GitHub releases, disabled in dev) | Verify: config + unit
- [ ] T012: Packaging (electron-builder NSIS) + README + LICENSE (MIT) | Verify: build artifacts
- [ ] T013: Final regression: full test suite + app smoke + push milestone | Verify: CI green

## Progress and evidence
- 2026-02-14 T008: src/core/redact.js (zlib stream surgery + pdfjs victim detection) + test/redact.test.js — 11/11 pass. Pushed 42378f2.
- 2026-02-14 T004+T006: src/core/annotations.js + test/annotations.test.js — 9/9 pass. Pushed 2d8947b.
- 2026-02-14 T005: src/core/pages.js + test/pages.test.js — 7/7 pass. Fixed pdf-lib setRotation needs degrees(). Pushed 5020460.
- 2026-02-14 T002: Electron+pdf.js scaffold built; electron launched & killed OK (smoke PASS); pushed fad6a7e.
- 2026-02-14 T001: git init main; ledger created; remote = RealDealCPA-VR/OPENPDFPRO (had Initial commit c8fafa3; rebased onto it).

## Pickup verification
- 2026-02-14 wave1: repo verified: git log shows 4 commits, npm test 11/11 PASS, ledger todo rewritten after edit mangle.

## Handoff
- Current checkpoint: M3 pushed (42378f2); 11/11 tests
- Last completed: T008
- In progress: T007 (OCR)
- Next exact action: `npm i tesseract.js`; create src/core/ocr.js (rasterize page via pdfjs → PNG bytes → tesseract.recognize → overlay invisible text via pdf-lib drawText with renderMode 3 / Tr 3); test with generated image-only PDF. Then T009 signatures (node:crypto PKCS#7 verify is complex — start with verify via pdfjs getFieldObjects/permissions or qpdf-less minimal check), then T009b renderer toolbar.
- Files changed: src/core/redact.js, test/redact.test.js (latest)
- Commands/checks: npm test 11/11 PASS; git push PASS
- Decisions/assumptions: Electron + pdfjs-dist + pdf-lib + tesseract.js stack; updates via electron-updater only; redaction v1 works on FlateDecode streams with literal-string text (falls back to box-only)
- Blockers/risks: T009 signature creation needs cert gen (node:crypto can't make X.509 easily — consider self-signed via openssl or pure-JS); redaction edge cases (hex/TJ arrays handled, subset fonts may need more)
- Context note: rewritten after checkbox edit mangle; evidence intact
