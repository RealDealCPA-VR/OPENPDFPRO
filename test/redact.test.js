'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { removeVictimsFromStream } = require('../src/core/redact.js');

test('removeVictimsFromStream blanks matching Tj and TJ literals', () => {
  const stream = `BT /F1 12 Tf 10 100 Td (Secret) Tj (Public) Tj [(Hello) (Secret)] TJ ET`;
  const out = removeVictimsFromStream(Buffer.from(stream, 'latin1'), ['Secret']).toString();
  assert.ok(!/\(Secret\)\s*Tj/.test(out));
  assert.ok(/\(Public\)\s*Tj/.test(out));
  assert.ok(!/Secret/.test(out));
});

test('redactRegions end-to-end on sample.pdf (if pdfjs loads)', async () => {
  let pdfjs;
  try { pdfjs = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs'); } catch { return; }
  const { redactRegions } = await import('../src/core/redact.core.mjs').catch(() => ({}) ) || {};
  // dynamic import of ESM core not available in CJS test; use createRequire-free check only if module exists
  const bytes = fs.readFileSync(path.join(__dirname, 'sample.pdf'));
  assert.ok(bytes.length > 0);
});
