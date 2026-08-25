const { app } = require('electron');
const { createWindow, getMainWindow } = require('./window');
const { attachNavigationHandlers } = require('./navigation');

app.setName('GeminiHarness');

// Future: app.requestSingleInstanceLock() before whenReady, and focus the
// existing window on second-instance. Not implemented in this step.

app.on('web-contents-created', (_event, contents) => {
  attachNavigationHandlers(contents);
});

app.whenReady().then(() => {
  createWindow();
  // Future: tray icon / AppIndicator, globalShortcut.
});

app.on('window-all-closed', () => {
  // Future: hide-to-tray instead of quitting on Linux.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!getMainWindow()) {
    createWindow();
  }
});
