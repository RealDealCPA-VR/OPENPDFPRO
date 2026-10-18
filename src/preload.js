'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfpro', {
  openDialog: () => ipcRenderer.invoke('pdf:openDialog'),
  readFile: (p) => ipcRenderer.invoke('pdf:readFile', p),
  writeFile: (p, bytes) => ipcRenderer.invoke('pdf:writeFile', p, bytes),
  saveAs: (bytes, name) => ipcRenderer.invoke('pdf:saveAs', bytes, name),
  onPdfLoaded: (cb) => ipcRenderer.on('pdf:loaded', (_e, payload) => cb(payload))
});
