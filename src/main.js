'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

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
