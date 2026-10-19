'use strict';
// Digital signature verification (clean-room, ISO 32000 §12.8 + RFC 5652).
//  1. Structural: /ByteRange ranges must tile the file exactly around the
//     /Contents gap; the gap must hold a "<hex>" PKCS#7 payload.
//  2. Cryptographic: minimal DER parse of CMS SignedData; hash the covered
//     bytes, compare to the signed messageDigest attribute when present, and
//     verify the signature with the embedded X.509 public key (node:crypto).
const crypto = require('node:crypto');

// ---- minimal DER reader ----
function tlv(buf, pos) {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let hlen = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    hlen = 2 + n;
  }
  return { tag, start: pos + hlen, end: pos + hlen + len, hlen, next: pos + hlen + len };
}
function kids(buf, from) {
  const out = [];
  let p = from.start;
  while (p < from.end) { const t = tlv(buf, p); out.push(t); p = t.next; }
  return out;
}
const raw = (buf, t) => buf.subarray(t.start, t.end);

function oidStr(buf, t) {
  const b = raw(buf, t);
  let s = `${Math.floor(b[0] / 40)}.${b[0] % 40}`;
  let acc = 0;
  for (let i = 1; i < b.length; i++) {
    acc = acc * 128 + (b[i] & 0x7f);
    if (!(b[i] & 0x80)) { s += '.' + acc; acc = 0; }
  }
  return s;
}

const DIGESTS = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512'
};
const OID_CMS = '1.2.840.113549.1.7.2';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';

/** Locate signatures: [{ byteRange:[o1,l1,o2,l2], gapStart, gapLen }] */
function findSignatures(bytes) {
  const s = bytes.toString('latin1');
  const out = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m;
  while ((m = re.exec(s))) {
    const byteRange = [+m[1], +m[2], +m[3], +m[4]];
    out.push({ byteRange, gapStart: byteRange[0] + byteRange[1], gapLen: byteRange[2] - (byteRange[0] + byteRange[1]) });
  }
  return out;
}

function extractPKCS7(bytes, sig) {
  const gap = bytes.subarray(sig.gapStart, sig.gapStart + sig.gapLen).toString('latin1');
  const a = gap.indexOf('<');
  const b = gap.indexOf('>', a + 1);
  const hex = (b === -1 ? gap.slice(a + 1) : gap.slice(a + 1, b)).replace(/\s+/g, '');
  if (!hex.length) return null;
  return Buffer.from(hex, 'hex');
}

function coveredBytes(bytes, byteRange) {
  const parts = [];
  for (let i = 0; i < byteRange.length; i += 2) {
    parts.push(bytes.subarray(byteRange[i], byteRange[i] + byteRange[i + 1]));
  }
  return Buffer.concat(parts);
}

function structuralCheck(bytes, sig) {
  const issues = [];
  const [o1, l1, o2, l2] = sig.byteRange;
  if (o1 !== 0) issues.push('first range must start at 0');
  if (o1 + l1 !== sig.gapStart) issues.push('range1 does not end at gap');
  if (o2 !== sig.gapStart + sig.gapLen) issues.push('range2 does not start after gap');
  if (o2 + l2 !== bytes.length) issues.push('range2 does not reach EOF');
  return { ok: issues.length === 0, issues };
}

function parseSignerInfo(pkcs7) {
  const contentInfo = tlv(pkcs7, 0);
  const ciFields = kids(pkcs7, contentInfo);
  if (ciFields[0].tag !== 0x06 || oidStr(pkcs7, ciFields[0]) !== OID_CMS) throw new Error('not PKCS#7 signedData');
  const sdExplicit = ciFields[1];
  const signedData = kids(pkcs7, sdExplicit)[0];
  const fields = kids(pkcs7, signedData);
  let i = 1; // 0: version
  i++; // digestAlgorithms SET
  if (fields[i].tag !== 0x30) throw new Error('unexpected SignedData layout');
  i++; // encapContentInfo
  let certs = null, signerInfos = null;
  while (i < fields.length) {
    if (fields[i].tag === 0xa0) certs = fields[i];
    else if (fields[i].tag === 0x31 || fields[i].tag === 0xa1) signerInfos = fields[i];
    i++;
  }
  if (!signerInfos) throw new Error('no signerInfos');
  const si = kids(pkcs7, signerInfos)[0];
  let digestAlgOid = null, signedAttrs = null, signedAttrsPos = null, signature = null;
  for (const f of kids(pkcs7, si)) {
    if (f.tag === 0x30 && digestAlgOid === null && signature === null) {
      const inner = kids(pkcs7, f);
      if (inner[0].tag === 0x06) { digestAlgOid = oidStr(pkcs7, inner[0]); continue; }
    }
    if (f.tag === 0xa0) { signedAttrs = f; signedAttrsPos = f.start - f.hlen; continue; }
    if (f.tag === 0x04 && signature === null) { signature = Buffer.from(raw(pkcs7, f)); }
  }
  const certDERs = certs ? kids(pkcs7, certs).filter((c) => c.tag === 0x30).map((c) => Buffer.from(pkcs7.subarray(c.start - c.hlen, c.end))) : [];
  return { digestAlgOid, signedAttrs, signedAttrsPos, signature, certDERs };
}

/** Re-encode [0] IMPLICIT SET as SET OF (tag 0x31) — the signedAttrs digest input. */
function signedAttrsDER(pkcs7, pos) {
  const t = tlv(pkcs7, pos);
  return Buffer.concat([Buffer.from([0x31]), pkcs7.subarray(pos + 1, t.end)]);
}

function findMessageDigest(pkcs7, signedAttrs) {
  for (const a of kids(pkcs7, signedAttrs)) {
    const seq = kids(pkcs7, a);
    if (seq[0].tag === 0x06 && oidStr(pkcs7, seq[0]) === OID_MESSAGE_DIGEST) {
      let v = seq[1];
      if (v.tag === 0x31) v = kids(pkcs7, v)[0]; // SET OF OCTET STRING
      return Buffer.from(pkcs7.subarray(v.start, v.end));
    }
  }
  return null;
}

/**
 * verifySignatures(bytes) → [{ byteRange, structural:{ok,issues},
 *   crypto:{ok,reason}, signer, digestAlg }]
 */
async function verifySignatures(bytes) {
  const results = [];
  for (const sig of findSignatures(bytes)) {
    const res = { byteRange: sig.byteRange };
    res.structural = structuralCheck(bytes, sig);
    const p7 = extractPKCS7(bytes, sig);
    if (!p7) { res.crypto = { ok: false, reason: 'no PKCS#7 payload in /Contents gap' }; results.push(res); continue; }
    try {
      const si = parseSignerInfo(p7);
      const digestAlg = DIGESTS[si.digestAlgOid];
      if (!digestAlg) throw new Error('unsupported digest algorithm ' + si.digestAlgOid);
      if (!si.certDERs.length) throw new Error('no certificate in SignedData');
      const cert = new crypto.X509Certificate(si.certDERs[0]);
      const covered = coveredBytes(bytes, sig.byteRange);
      let ok, reason = '';
      if (si.signedAttrs) {
        const md = findMessageDigest(p7, si.signedAttrs);
        const computed = crypto.createHash(digestAlg).update(covered).digest();
        if (!md || !md.equals(computed)) { ok = false; reason = 'messageDigest mismatch'; }
        else {
          ok = crypto.verify(digestAlg, signedAttrsDER(p7, si.signedAttrsPos), cert.publicKey, si.signature);
          if (!ok) reason = 'signature over signedAttrs invalid';
        }
      } else {
        ok = crypto.verify(digestAlg, covered, cert.publicKey, si.signature);
        if (!ok) reason = 'signature over content invalid';
      }
      res.crypto = { ok, reason };
      res.signer = { subject: cert.subject, issuer: cert.issuer, validTo: cert.validTo };
      res.digestAlg = digestAlg;
    } catch (e) {
      res.crypto = { ok: false, reason: e.message };
    }
    results.push(res);
  }
  return results;
}

function listSignatures(bytes) {
  return findSignatures(bytes).map((s) => ({ byteRange: s.byteRange, ...structuralCheck(bytes, s) }));
}

module.exports = { findSignatures, verifySignatures, listSignatures, extractPKCS7, coveredBytes, structuralCheck, signedAttrsDER, parseSignerInfo };
