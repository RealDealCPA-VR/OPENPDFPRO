'use strict';
// Content-level redaction. Locates text under regions with pdfjs, then removes
// matching Tj/TJ text-showing operators from the page content stream and draws
// an opaque black box. Works on deflate-compressed streams (the common case).
const zlib = require('node:zlib');
const { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFDict, rgb } = require('pdf-lib');

/** Extract text-show operators from a decoded content stream, dropping victims. */
function removeVictimsFromStream(decoded, victims) {
  // victims: array of raw literal strings (as they'd appear escaped) — we match
  // loosely: remove any Tj whose literal contains a victim substring.
  let src = decoded.toString('latin1');
  for (const v of victims) {
    if (!v) continue;
    const esc = v.replace(/[\\()]/g, (c) => '\\' + c);
    // (string) Tj
    src = src.replace(new RegExp(`\\(${esc}\\)\\s*Tj`, 'g'), '() Tj');
    // hex strings <...> Tj
    const hex = Buffer.from(v, 'latin1').toString('hex');
    src = src.replace(new RegExp(`<${hex}>\\s*Tj`, 'gi'), '<> Tj');
    // arrays: [...(v)...] TJ → strip the literal element
    src = src.replace(new RegExp(`\\(([^)]*)${esc}([^)]*)\\)`, 'g'), '($1$2)');
  }
  return Buffer.from(src, 'latin1');
}

/**
 * redactRegions(pdfjs, bytes, { page, regions }) — page 1-based.
 * regions: [{x,y,w,h}] in PDF points, origin bottom-left.
 */
async function redactRegions(pdfjs, bytes, { page, regions }) {
  // 1) Locate victim strings via pdfjs text positions
  const pdoc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  const ppage = await pdoc.getPage(page);
  const tc = await ppage.getTextContent();
  const victims = [];
  for (const it of tc.items) {
    const [, , , , e, f] = it.transform;
    const x = e, y = f, w = it.width, hh = it.height || 0;
    for (const r of regions) {
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + hh > r.y) { victims.push(it.str); break; }
    }
  }
  pdoc.destroy();

  // 2) Edit content streams with pdf-lib low-level API
  const lib = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const target = lib.getPage(page - 1);
  const contents = target.node.get(PDFName.of('Contents'));
  const streamRefs = contents instanceof PDFArray
    ? contents.asArray()
    : [contents];

  for (const ref of streamRefs) {
    const stream = lib.context.lookup(ref);
    if (!(stream instanceof PDFRawStream) && !(stream && stream.contents)) continue;
    const raw = stream instanceof PDFRawStream ? stream.contents : null;
    if (!raw) continue;
    const filter = stream.dict.get(PDFName.of('Filter'));
    const isFlate = filter && filter.toString().includes('FlateDecode');
    let decoded;
    try {
      decoded = isFlate ? zlib.inflateSync(Buffer.from(raw)) : Buffer.from(raw);
    } catch { continue; }
    const edited = removeVictimsFromStream(decoded, victims);
    const deflated = zlib.deflateSync(edited);
    // Replace stream bytes + length
    stream.contents = new Uint8Array(deflated);
    if (stream.dict) {
      stream.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      stream.dict.set(PDFName.of('Length'), deflated.length);
    }
  }

  // 3) Draw opaque boxes over regions
  for (const r of regions) {
    target.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(0, 0, 0) });
  }
  return lib.save();
}

module.exports = { redactRegions, removeVictimsFromStream };
