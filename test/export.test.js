'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { compress, pageToPdfBytes } = require('../src/core/export.js');

async function makePdf(pages = 2) {
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([300, 300]);
    p.drawText(`page ${i}`, { x: 10, y: 280, size: 12, font });
  }
  return d.save();
}

test('compress round-trips', async () => {
  const bytes = await makePdf();
  const out = await compress(bytes);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
});

test('pageToPdfBytes extracts one page', async () => {
  const bytes = await makePdf(3);
  const single = await pageToPdfBytes(bytes, 2);
  const doc = await PDFDocument.load(single);
  assert.equal(doc.getPageCount(), 1);
});
