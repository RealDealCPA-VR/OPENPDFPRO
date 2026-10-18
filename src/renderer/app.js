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
