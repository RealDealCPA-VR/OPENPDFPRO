'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { addInvisibleTextLayer, wordsToPdfPoints } = require('../src/core/ocr.js');

test('wordsToPdfPoints maps pixel space to PDF points', () => {
  const out = wordsToPdfPoints([{ text: 'Hi', bbox: { x0: 100, y0: 700, x1: 120, y1: 720 } }], 0.5, 1000);
  assert.equal(out[0].x, 50);
  assert.equal(out[0].y, 140);
  assert.ok(out[0].size > 0);
});

test('addInvisibleTextLayer round-trips', async () => {
  const d = await PDFDocument.create();
  d.addPage([300, 300]);
  let bytes = await d.save();
  bytes = await addInvisibleTextLayer(bytes, { page: 1, words: [{ text: 'OCR hello', x: 10, y: 280, size: 10 }] });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
});
