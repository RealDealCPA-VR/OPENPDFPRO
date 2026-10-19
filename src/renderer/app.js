import * as pdfjsLib from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';

const state = { doc: null, bytes: null, path: null, scale: 1.0, rotation: 0, pageNum: 1 };
const $ = (id) => document.getElementById(id);
const viewer = $('viewer');
const sidebar = $('sidebar');

export async function loadDocument(data, name, path = null) {
  state.doc = await pdfjsLib.getDocument({ data }).promise;
  state.bytes = data; state.path = name;
  $('doc-name').textContent = name;
  state.pageNum = 1; state.scale = 1.0; state.rotation = 0;
  await renderAll();
  await renderSidebar();
  await renderOutline();
}

async function renderAll() {
  viewer.innerHTML = '';
  for (let i = 1; i <= state.doc.numPages; i++) await renderPage(i);
  updateIndicator();
}

async function renderPage(num) {
  const page = await state.doc.getPage(num);
  const vp = page.getViewport({ scale: state.scale, rotation: (page.rotate + state.rotation) % 360 });
  const wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.dataset.pageNum = num;
  const canvas = document.createElement('canvas');
  canvas.height = vp.height; canvas.width = vp.width;
  wrap.appendChild(canvas);
  viewer.appendChild(wrap);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

async function rerender() {
  const scroll = viewer.scrollTop;
  await renderAll();
  viewer.scrollTop = scroll;
  if (state.highlightPage) await highlightSearch(state.lastQuery || '');
}

async function renderSidebar() {
  sidebar.innerHTML = '';
  for (let i = 1; i <= state.doc.numPages; i++) {
    const page = await state.doc.getPage(i);
    const vp = page.getViewport({ scale: 0.15, rotation: (page.rotate + state.rotation) % 360 });
    const c = document.createElement('canvas');
    c.height = vp.height; c.width = vp.width;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    c.onclick = () => scrollToPage(i);
    sidebar.appendChild(c);
  }
}

async function renderOutline() {
  let outline = null;
  try { outline = await state.doc.getOutline(); } catch { /* none */ }
  if (!outline || !outline.length) return;
  const box = document.createElement('div');
  box.id = 'outline';
  const h = document.createElement('h3'); h.textContent = 'Bookmarks'; box.appendChild(h);
  for (const item of outline) {
    const a = document.createElement('a');
    a.textContent = item.title;
    a.href = '#';
    a.onclick = async (e) => {
      e.preventDefault();
      let dest = item.dest;
      if (typeof dest === 'string') dest = await state.doc.getDestination(dest);
      if (!dest) return;
      const idx = await state.doc.getPageIndex(dest[0]);
      scrollToPage(idx + 1);
    };
    box.appendChild(a);
  }
  sidebar.appendChild(box);
}

function scrollToPage(n) {
  state.pageNum = n;
  const wrap = viewer.querySelector(`.page[data-page-num="${n}"]`);
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateIndicator();
}

viewer.addEventListener('scroll', () => {
  if (!state.doc) return;
  const wraps = [...viewer.querySelectorAll('.page')];
  for (const w of wraps) {
    const r = w.getBoundingClientRect();
    if (r.bottom > 120) { state.pageNum = +w.dataset.pageNum; break; }
  }
  updateIndicator();
});

function updateIndicator() { $('page-indicator').textContent = `${state.pageNum} / ${state.doc ? state.doc.numPages : 0}`; }

// ---- search with highlight overlay ----
async function highlightSearch(query) {
  document.querySelectorAll('.hl').forEach((n) => n.remove());
  state.highlightPage = 0;
  if (!query || !state.doc) return { pages: [] };
  const pages = [];
  for (let p = 1; p <= state.doc.numPages; p++) {
    const page = await state.doc.getPage(p);
    const tc = await page.getTextContent();
    const hits = tc.items.filter((it) => it.str.toLowerCase().includes(query.toLowerCase()));
    if (!hits.length) continue;
    pages.push(p);
    const vp = page.getViewport({ scale: state.scale, rotation: (page.rotate + state.rotation) % 360 });
    const wrap = viewer.querySelector(`.page[data-page-num="${p}"]`);
    if (!wrap) continue;
    for (const it of hits) {
      const rect = vp.convertToViewportRectangle([it.transform[4], it.transform[5], it.transform[4] + it.width, it.transform[5] + it.height]);
      const l = Math.min(rect[0], rect[2]), t = Math.min(rect[1], rect[3]);
      const w = Math.abs(rect[2] - rect[0]), hh = Math.abs(rect[3] - rect[1]);
      const div = document.createElement('div');
      div.className = 'hl';
      div.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${hh}px;`;
      wrap.appendChild(div);
    }
  }
  return { pages };
}

$('search-input').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || !state.doc) return;
  const q = ($('search-input').value || '').trim();
  state.lastQuery = q;
  const { pages } = await highlightSearch(q);
  $('search-count').textContent = q ? (pages.length ? `${pages.length} page(s)` : 'no matches') : '';
  if (pages[0]) scrollToPage(pages[0]);
});

$('btn-open').onclick = () => window.pdfpro.openDialog();
$('btn-save').onclick = async () => { if (state.bytes) await window.pdfpro.saveAs(state.bytes, state.path || 'document.pdf'); };
$('btn-prev').onclick = () => state.pageNum > 1 && scrollToPage(state.pageNum - 1);
$('btn-next').onclick = () => state.doc && state.pageNum < state.doc.numPages && scrollToPage(state.pageNum + 1);
$('btn-zoom-in').onclick = () => { state.scale = Math.min(4, state.scale * 1.2); $('zoom-label').textContent = Math.round(state.scale * 100) + '%'; state.doc && rerender(); };
$('btn-zoom-out').onclick = () => { state.scale = Math.max(0.25, state.scale / 1.2); $('zoom-label').textContent = Math.round(state.scale * 100) + '%'; state.doc && rerender(); };
$('btn-rotate').onclick = () => { state.rotation = (state.rotation + 90) % 360; state.doc && (rerender(), renderSidebar()); };

window.pdfpro.onPdfLoaded(({ data, path }) => loadDocument(data, path.split(/[\\/]/).pop(), path));

// ---- ops toolbar (core via IPC) ----
async function runOp(op, payload) {
  if (!state.bytes) return null;
  const res = await window.pdfpro.op(op, state.bytes, payload || {});
  if (!res.ok) {
    if (!res.canceled) alert('Operation failed: ' + (res.error || 'unknown'));
    return null;
  }
  if (res.bytes) await loadDocument(new Uint8Array(res.bytes), state.path);
  return res;
}

function num(v, dflt = 0) { const n = parseFloat(v); return Number.isFinite(n) ? n : dflt; }
function curPage() { return state.pageNum; }

$('btn-delete-page').onclick = async () => {
  if (!confirm(`Delete page ${curPage()}?`)) return;
  await runOp('deletePages', { pages: [curPage()] });
};
$('btn-extract').onclick = async () => {
  const range = prompt('Extract pages (from-to, e.g. 2-5):', `${curPage()}-${curPage()}`);
  if (!range) return;
  const [a, b] = range.split('-').map((x) => parseInt(x, 10));
  const res = await runOp('extract', { from: a, to: b || a });
  if (res && res.bytes) await window.pdfpro.saveAs(res.bytes, 'extract.pdf');
};
$('btn-merge').onclick = () => runOp('merge');
$('btn-split').onclick = () => runOp('split');
$('btn-reorder').onclick = async () => {
  const order = prompt('New page order (comma-separated):', '1,2,3');
  if (!order) return;
  await runOp('reorder', { order: order.split(',').map((x) => parseInt(x.trim(), 10)).filter(Number.isFinite) });
};
$('btn-rotate').onclick = async () => { await runOp('rotate', { pages: [curPage()], deg: 90 }); if (state.doc) { state.rotation = (state.rotation + 90) % 360; rerender(); renderSidebar(); } };
$('btn-redact').onclick = async () => {
  const spec = prompt('Redact regions on page (x,y,w,h per region; semicolon-separated):', '50,50,100,30');
  if (!spec) return;
  const regions = spec.split(';').map((s) => { const [x, y, w, h] = s.split(',').map(num); return { x, y, w, h }; });
  await runOp('redact', { page: curPage(), regions });
};
$('btn-freetext').onclick = async () => {
  const text = prompt('Free text:');
  if (text === null) return;
  await runOp('addFreeText', { page: curPage(), x: 50, y: 700, size: 14, text });
};
$('btn-rect').onclick = async () => {
  const spec = prompt('Rectangle x,y,w,h:', '50,600,120,60');
  if (!spec) return;
  const [x, y, w, h] = spec.split(',').map(num);
  await runOp('addRectangle', { page: curPage(), x, y, w, h });
};
$('btn-flatten').onclick = () => runOp('flattenForm');
$('btn-compress').onclick = () => runOp('compress');
$('btn-verify-sig').onclick = async () => {
  const res = await runOp('verifySignatures');
  if (res && res.data) {
    const lines = res.data.map((r) => `ByteRange ${JSON.stringify(r.byteRange)}: structure=${r.structural.ok ? 'OK' : 'BROKEN'} signature=${r.crypto.ok ? 'VALID' : 'INVALID'}${r.crypto.reason ? ' (' + r.crypto.reason + ')' : ''}${r.signer ? '\n  signer: ' + r.signer.subject : ''}`);
    alert(lines.length ? lines.join('\n') : 'No signatures found.');
  }
};
$('btn-ocr').onclick = async () => {
  if (!state.doc) return;
  const btn = $('btn-ocr'); btn.textContent = 'OCR…'; btn.disabled = true;
  try {
    const page = await state.doc.getPage(curPage());
    const dpi = 300, scale = dpi / 72;
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const pngBytes = new Uint8Array(await blob.arrayBuffer());
    const res = await window.pdfpro.op('ocr', state.bytes, {
      pngBytes, page: curPage(), pointsPerPixel: 72 / dpi, pageHeightPx: vp.height, lang: 'eng'
    });
    if (res.ok && res.bytes) await loadDocument(new Uint8Array(res.bytes), state.path);
    else if (!res.ok && !res.canceled) alert('OCR failed: ' + res.error);
  } finally { btn.textContent = 'OCR'; btn.disabled = false; }
};
$('btn-export-png').onclick = async () => {
  if (!state.doc) return;
  const page = await state.doc.getPage(curPage());
  const vp = page.getViewport({ scale: 2 });
  const c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await window.pdfpro.saveAs(bytes, `page-${curPage()}.png`);
};
