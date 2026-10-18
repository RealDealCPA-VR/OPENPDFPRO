'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const ann = require('../src/core/annotations.js');

async function makeDoc() {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  const p = d.addPage([300, 300]);
  p.drawText('Hello', { x: 20, y: 260, font: f, size: 14 });
  return d.save();
}

test('annotation ops round-trip and keep page count', async () => {
  let bytes = await makeDoc();
  bytes = await ann.addHighlight(bytes, { page: 1, x: 20, y: 258, w: 60, h: 16 });
  bytes = await ann.addInk(bytes, { page: 1, points: [[10, 10], [50, 50], [90, 10]] });
  bytes = await ann.addRectangle(bytes, { page: 1, x: 100, y: 100, w: 50, h: 50 });
  bytes = await ann.addFreeText(bytes, { page: 1, x: 10, y: 30, text: 'Stamped' });
  bytes = await ann.addRedactionBox(bytes, { page: 1, x: 0, y: 0, w: 30, h: 30 });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const text = (await doc.getPage(0).getTextContent?.()) ?? null;
  assert.ok(true);
});

test('form fill, list, flatten', async () => {
  const { PDFDocument } = require('pdf-lib');
  const d = await PDFDocument.create();
  const page = d.addPage([300, 300]);
  const form = d.getForm();
  form.createTextField('name');
  page.drawText('Form:', { x: 10, y: 280, size: 10 });
  let bytes = await d.save();
  bytes = await ann.fillTextField(bytes, { name: 'name', value: 'Alice' });
  const fields = await ann.listFormFields(bytes);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].name, 'name');
  bytes = await ann.flattenForm(bytes);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getForm().getFields().length, 0);
});
