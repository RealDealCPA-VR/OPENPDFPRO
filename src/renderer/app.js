import * as pdfjsLib from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';

const state = { doc: null, scale: 1.0, rotation: 0, pageNum: 1, matches: [] };
const $ = (id) => document.getElementById(id);
const viewer = $('viewer');
const sidebar = $('sidebar');

export async function loadDocument(data, name) {
  state.doc = await pdfjsLib.getDocument({ data }).promise;
  $('doc-name').textContent = name;
  state.pageNum = 1;
  state.scale = 1.0; state.rotation = 0;
  await renderAll();
  await renderSidebar();
}

async function renderAll() {
  viewer.innerHTML = '';
  for (let i = 1; i <= state.doc.numPages; i++) await renderPage(i);
  updateIndicator();
}

async function renderPage(num) {
  const page = await state.doc.getPage(num);
  const vp = page.getViewport({ scale: state.scale, rotation: (page.rotate + state.rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.dataset.pageNum = num;
  canvas.height = vp.height; canvas.width = vp.width;
  viewer.appendChild(canvas);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}

async function rerender() {
  const scroll = viewer.scrollTop;
  await renderAll();
  viewer.scrollTop = scroll;
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

function scrollToPage(n) {
  state.pageNum = n;
  const canvas = viewer.querySelector(`canvas[data-page-num="${n}"]`);
  if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateIndicator();
}

function updateIndicator() { $('page-indicator').textContent = `${state.pageNum} / ${state.doc ? state.doc.numPages : 0}`; }

$('btn-open').onclick = () => window.pdfpro.openDialog();
$('btn-prev').onclick = () => state.pageNum > 1 && scrollToPage(state.pageNum - 1);
$('btn-next').onclick = () => state.doc && state.pageNum < state.doc.numPages && scrollToPage(state.pageNum + 1);
$('btn-zoom-in').onclick = () => { state.scale = Math.min(4, state.scale * 1.2); $('zoom-label').textContent = Math.round(state.scale * 100) + '%'; state.doc && rerender(); };
$('btn-zoom-out').onclick = () => { state.scale = Math.max(0.25, state.scale / 1.2); $('zoom-label').textContent = Math.round(state.scale * 100) + '%'; state.doc && rerender(); };
$('btn-rotate').onclick = () => { state.rotation = (state.rotation + 90) % 360; state.doc && rerender() && renderSidebar(); };

$('search-input').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || !state.doc) return;
  const query = $('search-input').value;
  if (!query) return;
  state.matches = [];
  for (let p = 1; p <= state.doc.numPages; p++) {
    const page = await state.doc.getPage(p);
    const tc = await page.getTextContent();
    if (tc.items.some((it) => it.str.toLowerCase().includes(query.toLowerCase()))) state.matches.push(p);
  }
  $('search-count').textContent = state.matches.length ? `${state.matches.length} page(s)` : 'no matches';
  if (state.matches[0]) scrollToPage(state.matches[0]);
});

window.pdfpro.onPdfLoaded(({ data, path }) => loadDocument(data, path.split(/[\\/]/).pop()));
