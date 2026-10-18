'use strict';
// Annotation operations via pdf-lib. All pure bytes-in/bytes-out.
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const { loadDoc } = require('./pages.js');

/**
 * Add a text annotation (sticky note) to a page.
 * page: 1-based; x/y: PDF points from bottom-left.
 */
async function addNote(bytes, { page, x, y, title = 'Note', content = '' }) {
  const doc = await loadDoc(bytes);
  const pdfPage = doc.getPage(page - 1);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const icon = doc.context.obj({
    Type: 'Annot', Subtype: 'Text', Rect: [x, y, x + 24, y + 24],
    Contents: content, T: title, Name: 'Comment', Open: false,
    F: 4, DA: `/Helv 10 Tf`, C: [1, 1, 0]
  });
  pdfPage.node.addAnnot(pdfPage.doc.context.register(icon));
  font; // embedded so Contents render in some viewers
  return doc.save();
}

/** Add a free text box drawn on the page. */
async function addFreeText(bytes, { page, x, y, size = 12, text = '', color = [0, 0, 0] }) {
  const doc = await loadDoc(bytes);
  const pdfPage = doc.getPage(page - 1);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pdfPage.drawText(text, { x, y, size, font, color: rgb(...color) });
  return doc.save();
}

/** Highlight a rectangle region (x, y, w, h in PDF points, page 1-based). */
async function addHighlight(bytes, { page, x, y, w, h, color = [1, 0.9, 0.3] }) {
  const doc = await loadDoc(bytes);
  const pdfPage = doc.getPage(page - 1);
  pdfPage.drawRectangle({ x, y, width: w, height: h, color: rgb(...color), opacity: 0.4 });
  return doc.save();
}

/** Draw a polyline (ink annotation) from array of [x, y] points. */
async function addInk(bytes, { page, points, thickness = 2, color = [0, 0, 1] }) {
  const doc = await loadDoc(bytes);
  const pdfPage = doc.getPage(page - 1);
  for (let i = 1; i < points.length; i++) {
    pdfPage.drawLine({
      start: { x: points[i - 1][0], y: points[i - 1][1] },
      end: { x: points[i][0], y: points[i][1] },
      thickness, color: rgb(...color)
    });
  }
  return doc.save();
}

/** Draw a rectangle outline (shape tool). */
async function addRectangle(bytes, { page, x, y, w, h, thickness = 1.5, color = [1, 0, 0] }) {
  const doc = await loadDoc(bytes);
  doc.getPage(page - 1).drawRectangle({ x, y, width: w, height: h, borderColor: rgb(...color), borderWidth: thickness });
  return doc.save();
}

/** Strike-through / underline a rect: returns helper drawing thin line. */
async function addStrikeLine(bytes, { page, x, y, w, color = [1, 0, 0], thickness = 1 }) {
  const doc = await loadDoc(bytes);
  doc.getPage(page - 1).drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color: rgb(...color) });
  return doc.save();
}

/** Redact: cover region with black box (v1 visual; content-removal in T008). */
async function addRedactionBox(bytes, { page, x, y, w, h }) {
  const doc = await loadDoc(bytes);
  doc.getPage(page - 1).drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) });
  return doc.save();
}

/** Flatten form fields to static content. */
async function flattenForm(bytes) {
  const doc = await loadDoc(bytes);
  doc.getForm().flatten();
  return doc.save();
}

/** Fill a text field. */
async function fillTextField(bytes, { name, value }) {
  const doc = await loadDoc(bytes);
  doc.getForm().getTextField(name).setText(value);
  return doc.save();
}

/** List form field names with types. */
async function listFormFields(bytes) {
  const doc = await loadDoc(bytes);
  return doc.getForm().getFields().map((f) => ({ name: f.getName(), type: f.constructor.name }));
}

module.exports = { addNote, addFreeText, addHighlight, addInk, addRectangle, addStrikeLine, addRedactionBox, flattenForm, fillTextField, listFormFields };
