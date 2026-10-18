'use strict';
// OCR: rasterize a PDF page (caller supplies PNG bytes via pdfjs canvas) and
// run tesseract.js locally, then overlay recognized text as an invisible
// (render mode 3) text layer so search/copy work.
const { PDFDocument, PDFName, PDFNumber, PDFHexString, rgb, StandardFonts } = require('pdf-lib');
const { loadDoc } = require('./pages.js');

/**
 * ocrPage(pngBytes, { lang }) → [{ text, bbox: {x0,y0,x1,y1} }]
 * Caller must render the page at a known DPI and pass scale info:
 * pngScalePointsPerPixel = 72 / dpi.
 */
async function ocrImage(Tesseract, pngBytes, { lang = 'eng' } = {}) {
  const worker = await Tesseract.createWorker(lang);
  try {
    const { data } = await worker.recognize(pngBytes);
    return data.words.map((w) => ({
      text: w.text,
      bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }
    }));
  } finally {
    await worker.terminate();
  }
}

/**
 * Add an invisible text layer to a page. words: ocrImage() output mapped to
 * PDF points (origin bottom-left): [{ text, x, y, size }] where y is baseline.
 */
async function addInvisibleTextLayer(bytes, { page, words }) {
  const doc = await loadDoc(bytes);
  const pdfPage = doc.getPage(page - 1);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const w of words) {
    pdfPage.drawText(w.text, { x: w.x, y: w.y, size: w.size || 10, font, opacity: 0, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

/** Convert OCR word bboxes (pixel space, top-left origin) to PDF points baseline words. */
function wordsToPdfPoints(words, pointsPerPixel, pageHeightPx) {
  return words.map((w) => ({
    text: w.text,
    x: w.bbox.x0 * pointsPerPixel,
    y: (pageHeightPx - w.bbox.y1) * pointsPerPixel, // baseline approx = bottom of word box
    size: Math.max(1, (w.bbox.y1 - w.bbox.y0) * pointsPerPixel * 0.9)
  }));
}

module.exports = { ocrImage, addInvisibleTextLayer, wordsToPdfPoints };
