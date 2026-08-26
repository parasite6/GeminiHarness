const { contextBridge, ipcRenderer } = require('electron');

// Channel string is inlined: sandboxed preload cannot require() sibling files.
contextBridge.exposeInMainWorld('geminiHarness', {
  reload() {
    ipcRenderer.send('geminiharness:reload');
  },
});
