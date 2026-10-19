'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findSignatures, verifySignatures, structuralCheck } = require('../src/core/signature.js');

const hasOpenSSL = (() => {
  try { execFileSync('openssl', ['version'], { stdio: 'pipe' }); return true; } catch { return false; }
})();

/** Build an incrementally-updated PDF signed with a self-signed cert (adbe.pkcs7.detached). */
function makeSignedPdf(dir) {
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  const pdfPath = path.join(dir, 'doc.pdf');
  fs.writeFileSync(pdfPath, pdf, 'latin1');

  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', path.join(dir, 'k.pem'),
    '-out', path.join(dir, 'c.pem'), '-days', '2', '-nodes', '-subj', '/CN=Test Signer'], { stdio: 'pipe' });

  
  // Append sig object + new trailer with ByteRange/Contents placeholder
  const maxObj = 3;
  const updateStr = `xref\n0 0\ntrailer<</Root 1 0 R/_OpenAdobeSig ${maxObj + 2} 0 R>>\n%%EOF\n`;
  const body = `${maxObj + 2} 0 obj\n<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange [0 ${'0'.repeat(10)} ${'0'.repeat(10)} ${'0'.repeat(10)}]/Contents<${'0'.repeat(6000)}>>\nendobj\n`;
  fs.appendFileSync(pdfPath, body + updateStr, 'latin1');

  // Now fill real ByteRange: find /ByteRange and /Contents positions
  let buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');
  const brIdx = s.indexOf('/ByteRange [');
  const brMatch = s.slice(brIdx).match(/^\/ByteRange \[(\d+) (\d{10}) (\d{10}) (\d{10})\]/);
  const contentsIdx = s.indexOf('/Contents<', brIdx) + '/Contents<'.length;
  // Layout: [0, brIdx) + gap + [contentsIdx+64, EOF)
  const o1 = 0, l1 = brIdx;
  const gapStart = contentsIdx, gapLen = 6000;
  const o2 = gapStart + gapLen, l2 = buf.length - o2;
  const brStr = `/ByteRange [${o1} ${String(l1).padStart(10, '0')} ${String(o2).padStart(10, '0')} ${String(l2).padStart(10, '0')}]`;
  buf = Buffer.concat([
    buf.subarray(0, brIdx),
    Buffer.from(brStr.padEnd(brMatch[0].length + (s.slice(brIdx).indexOf('>>') === -1 ? 0 : 0), ' '), 'latin1').subarray(0, brMatch[0].length),
    buf.subarray(brIdx + brMatch[0].length)
  ]);
  fs.writeFileSync(pdfPath, buf);

  const covered1 = buf.subarray(0, o1 + l1);
  const covered2 = buf.subarray(o2, o2 + l2);
  fs.writeFileSync(path.join(dir, 'covered.bin'), Buffer.concat([covered1, covered2]));

  execFileSync('openssl', ['cms', '-sign', '-binary', '-nosmimecap',
    '-signer', path.join(dir, 'c.pem'), '-inkey', path.join(dir, 'k.pem'),
    '-in', path.join(dir, 'covered.bin'), '-outform', 'DER', '-out', path.join(dir, 'sig.der'),
    '-md', 'sha256'], { stdio: 'pipe' });

  const der = fs.readFileSync(path.join(dir, 'sig.der'));
  const hex = der.toString('hex').toUpperCase();
  assert.ok(hex.length <= gapLen * 2, 'PKCS7 must fit placeholder gap; increase placeholder size if this fails');
  let buf2 = fs.readFileSync(pdfPath);
  const s2 = buf2.toString('latin1');
  const cIdx = s2.indexOf('/Contents<', brIdx) + '/Contents<'.length;
  buf2 = Buffer.concat([
    buf2.subarray(0, cIdx),
    Buffer.from(hex.padEnd(gapLen, '0'), 'latin1'),
    buf2.subarray(cIdx + gapLen)
  ]);
  fs.writeFileSync(pdfPath, buf2);
  return fs.readFileSync(pdfPath);
}

test('findSignatures + structuralCheck on fabricated ByteRange', () => {
  const sig = { byteRange: [0, 10, 15, 10], gapStart: 10, gapLen: 5 };
  const buf = Buffer.alloc(25, 0x41);
  assert.equal(structuralCheck(buf, sig).ok, true);
  const found = findSignatures(Buffer.from('/ByteRange [0 10 15 10]'));
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].byteRange, [0, 10, 15, 10]);
  assert.equal(structuralCheck(Buffer.alloc(20), sig).ok, false); // short file
});

test('verifySignatures validates an openssl-signed incremental update', { skip: !hasOpenSSL && 'openssl not available' }, async () => {
  const dir = process.env.SIGDBG_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "sigtest-"));
  try {
    const bytes = makeSignedPdf(dir);
    const results = await verifySignatures(bytes);
    assert.equal(results.length, 1);
    assert.equal(results[0].structural.ok, true, JSON.stringify(results[0].structural));
    assert.equal(results[0].crypto.ok, true, JSON.stringify(results[0].crypto));
    assert.equal(results[0].digestAlg, 'sha256');
    assert.match(results[0].signer.subject, /Test Signer/);

    // Tamper with covered content → digest mismatch
    const tampered = Buffer.from(bytes);
    tampered[5] = tampered[5] ^ 0xff;
    const r2 = await verifySignatures(tampered);
    assert.equal(r2[0].crypto.ok, false);
  } finally {
    if (!process.env.SIGDBG_DIR) fs.rmSync(dir, { recursive: true, force: true });
  }
});
