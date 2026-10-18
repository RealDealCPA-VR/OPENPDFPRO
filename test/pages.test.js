'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const pages = require('../src/core/pages.js');

async function makeDoc(nPages) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= nPages; i++) {
    const p = d.addPage([300, 300]);
    p.drawText(`Page ${i}`, { x: 20, y: 260, font: f, size: 14 });
  }
  return d.save();
}

test('split produces single pages with right text', async () => {
  const parts = await pages.split(await makeDoc(3));
  assert.equal(parts.length, 3);
  const first = await PDFDocument.load(parts[0]);
  assert.equal(first.getPageCount(), 1);
});

test('merge concatenates page counts', async () => {
  const merged = await pages.merge([await makeDoc(2), await makeDoc(3)]);
  const doc = await PDFDocument.load(merged);
  assert.equal(doc.getPageCount(), 5);
});

test('extractPages keeps range', async () => {
  const out = await pages.extractPages(await makeDoc(5), 2, 4);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 3);
});

test('deletePages removes selected', async () => {
  const out = await pages.deletePages(await makeDoc(4), [2, 4]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 2);
});

test('rotatePages sets rotation', async () => {
  const out = await pages.rotatePages(await makeDoc(2), [1], 90);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPage(0).getRotation().angle, 90);
});

test('reorderPages reverses order', async () => {
  const out = await pages.reorderPages(await makeDoc(3), [3, 2, 1]);
  const doc = await PDFDocument.load(out);
  assert.equal(doc.getPageCount(), 3);
});

test('sample.pdf from repo parses', async () => {
  const bytes = fs.readFileSync(path.join(__dirname, 'sample.pdf'));
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
});
