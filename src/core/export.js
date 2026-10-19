'use strict';
// Export/convert helpers. Pure node functions (bytes in, bytes out); the
// renderer handles rasterization via pdfjs canvas, print-to-PDF via Electron.
const { PDFDocument } = require('pdf-lib');
const { loadDoc } = require('./pages.js');

/**
 * Compress: re-save through pdf-lib with object streams + minimal xref.
 * Note: real image downsampling is out of scope v1; this still typically
 * shrinks files with unused objects and enables object-stream compression.
 */
async function compress(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return doc.save({ useObjectStreams: true, addDefaultPage: false });
}

/** Convert a page (1-based) to a new single-page PDF bytes (for image export pipelines). */
async function pageToPdfBytes(bytes, page) {
  const src = await loadDoc(bytes);
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(src, [page - 1]);
  out.addPage(p);
  return out.save();
}

module.exports = { compress, pageToPdfBytes };
