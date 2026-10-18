'use strict';
// Core PDF page/document operations built on pdf-lib. Pure functions: bytes in, bytes out.
const { PDFDocument, degrees } = require('pdf-lib');

async function loadDoc(bytes) {
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

/** Merge multiple PDFs (array of Uint8Array/Buffer) into one. */
async function merge(documents) {
  const out = await PDFDocument.create();
  for (const d of documents) {
    const src = await loadDoc(d);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Extract a page range (1-based, inclusive) into a new PDF. */
async function extractPages(bytes, from, to) {
  const src = await loadDoc(bytes);
  const out = await PDFDocument.create();
  const indices = [];
  for (let i = from; i <= Math.min(to, src.getPageCount()); i++) indices.push(i - 1);
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

/** Delete pages (1-based numbers array). */
async function deletePages(bytes, pageNumbers) {
  const doc = await loadDoc(bytes);
  const remove = new Set(pageNumbers.map((n) => n - 1));
  const keep = doc.getPageIndices().filter((i) => !remove.has(i));
  return rebuildSubset(doc, keep);
}

/** Reorder pages: newOrder is 1-based page numbers in desired sequence. */
async function reorderPages(bytes, newOrder) {
  const doc = await loadDoc(bytes);
  return rebuildSubset(doc, newOrder.map((n) => n - 1));
}

async function rebuildSubset(doc, indices0based) {
  const src = doc;
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices0based);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

/** Rotate pages (1-based numbers) by degrees (must be multiple of 90). */
async function rotatePages(bytes, pageNumbers, deg) {
  const doc = await loadDoc(bytes);
  for (const n of pageNumbers) {
    const page = doc.getPage(n - 1);
    page.setRotation(degrees((page.getRotation().angle + deg + 360) % 360));
  }
  return doc.save();
}

/** Split into single-page PDFs. Returns array of Uint8Array. */
async function split(bytes) {
  const doc = await loadDoc(bytes);
  const out = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [p] = await single.copyPages(doc, [i]);
    single.addPage(p);
    out.push(await single.save());
  }
  return out;
}

/** Append `extra` bytes after `bytes`. */
async function append(bytes, extra) {
  return merge([bytes, extra]);
}

module.exports = { merge, extractPages, deletePages, reorderPages, rotatePages, split, append, loadDoc };
