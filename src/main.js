'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const pages = require('./core/pages.js');
const annotations = require('./core/annotations.js');
const redact = require('./core/redact.js');
const ocr = require('./core/ocr.js');
const signatures = require('./core/signature.js');
const exporters = require('./core/export.js');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Open PDF Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Open PDF…', accelerator: 'CmdOrCtrl+O', click: () => openPdfDialog() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }
  ]);
  Menu.setApplicationMenu(menu);
}

async function openPdfDialog() {
  const res = await dialog.showOpenDialog(win, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile']
  });
  if (!res.canceled && res.filePaths[0]) await loadPdfFile(res.filePaths[0]);
}

async function loadPdfFile(filePath) {
  const data = fs.readFileSync(filePath);
  win.webContents.send('pdf:loaded', { path: filePath, data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
}

app.whenReady().then(() => {
  createWindow();
  // Auto-update: the ONLY allowed network feature (GitHub Releases). Disabled in dev.
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify().catch((e) => console.error('update check failed:', e.message));
    } catch (e) { console.error('updater unavailable:', e.message); }
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('pdf:openDialog', async () => { await openPdfDialog(); return true; });
ipcMain.handle('pdf:readFile', async (_e, filePath) => {
  const data = fs.readFileSync(filePath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});
ipcMain.handle('pdf:writeFile', async (_e, filePath, bytes) => {
  fs.writeFileSync(filePath, Buffer.from(bytes));
  return true;
});
ipcMain.handle('pdf:saveAs', async (_e, bytes, suggestedName) => {
  const res = await dialog.showSaveDialog(win, { defaultPath: suggestedName || 'document.pdf' });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, Buffer.from(bytes));
  return res.filePath;
});

// ---- unified op dispatch: op(bytes, payload) → bytes | data ----
let pdfjsLib = null;
async function getPdfjs() {
  if (!pdfjsLib) pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLib;
}

async function opDispatch(op, bytes, payload) {
  switch (op) {
    case 'rotate': return pages.rotatePages(bytes, payload.pages, payload.deg);
    case 'deletePages': return pages.deletePages(bytes, payload.pages);
    case 'extract': return pages.extractPages(bytes, payload.from, payload.to);
    case 'reorder': return pages.reorderPages(bytes, payload.order);
    case 'merge': {
      const res = await dialog.showOpenDialog(win, { filters: [{ name: 'PDF', extensions: ['pdf'] }], properties: ['openFile', 'multiSelections'] });
      if (res.canceled || !res.filePaths.length) return null;
      const docs = [bytes, ...res.filePaths.map((p) => fs.readFileSync(p))];
      return pages.merge(docs);
    }
    case 'split': {
      const parts = await pages.split(bytes);
      const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
      if (res.canceled || !res.filePaths[0]) return null;
      parts.forEach((p, i) => fs.writeFileSync(path.join(res.filePaths[0], `part-${String(i + 1).padStart(3, '0')}.pdf`), Buffer.from(p)));
      return parts.length;
    }
    case 'redact': {
      const { page, regions } = payload;
      return redact.redactRegions(await getPdfjs(), bytes, { page, regions });
    }
    case 'addFreeText': return annotations.addFreeText(bytes, payload);
    case 'addHighlight': return annotations.addHighlight(bytes, payload);
    case 'addInk': return annotations.addInk(bytes, payload);
    case 'addRectangle': return annotations.addRectangle(bytes, payload);
    case 'addRedactionBox': return annotations.addRedactionBox(bytes, payload);
    case 'flattenForm': return annotations.flattenForm(bytes);
    case 'fillTextField': return annotations.fillTextField(bytes, payload);
    case 'listFormFields': return annotations.listFormFields(bytes);
    case 'ocr': {
      const words = await ocr.ocrImage(require('tesseract.js'), Buffer.from(payload.pngBytes), { lang: payload.lang || 'eng' });
      const pdfWords = ocr.wordsToPdfPoints(words, payload.pointsPerPixel, payload.pageHeightPx);
      return ocr.addInvisibleTextLayer(bytes, { page: payload.page, words: pdfWords });
    }
    case 'verifySignatures': return signatures.verifySignatures(bytes);
    case 'listSignatures': return signatures.listSignatures(bytes);
    case 'compress': return exporters.compress(bytes);
    case 'pageToPdf': return exporters.pageToPdfBytes(bytes, payload.page);
    default: throw new Error('unknown op: ' + op);
  }
}

ipcMain.handle('pdf:op', async (_e, op, bytes, payload) => {
  try {
    const result = await opDispatch(op, Buffer.from(bytes), payload || {});
    if (result === null || result === undefined) return { ok: false, canceled: true };
    if (result instanceof Uint8Array || Buffer.isBuffer(result)) {
      return { ok: true, bytes: result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) };
    }
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});
