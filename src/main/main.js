const { app } = require('electron');
const {
  createWindow,
  getMainWindow,
  showMainWindow,
  flushWindowState,
  setAppQuitting,
} = require('./window');
const { attachNavigationHandlers } = require('./navigation');
const { createTray, getTray } = require('./tray');

app.setName('GeminiHarness');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  showMainWindow();
});

app.on('web-contents-created', (_event, contents) => {
  attachNavigationHandlers(contents);
});

app.whenReady().then(() => {
  createWindow();
  createTray({ showWindow: showMainWindow });
  // Future: globalShortcut.
});

app.on('before-quit', () => {
  setAppQuitting(true);
  flushWindowState();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return;
  }
  // Keep running in the tray. If the tray never came up, quit so the
  // process cannot linger with no window and no indicator.
  if (!getTray()) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!getMainWindow()) {
    createWindow();
  } else {
    showMainWindow();
  }
});
