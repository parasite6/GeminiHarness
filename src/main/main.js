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
const { wantsHiddenLaunch } = require('./autostart');
const {
  shouldOpenWindowOnReady,
  shouldShowWindowOnSecondInstance,
  shouldQuitHiddenWithoutTray,
} = require('./startup');

// Force X11/XWayland so BrowserWindow x/y can be set and restored.
// Native Wayland (xdg-shell) forbids client-side window placement; Electron
// 38+ defaults to Wayland in Wayland sessions. ELECTRON_OZONE_PLATFORM_HINT
// was removed — use --ozone-platform=x11 (also set in package.json start and
// electron-builder linux.executableArgs so it applies before Chromium boots).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

app.setName('GeminiHarness');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

app.on('second-instance', (_event, commandLine) => {
  // If the second launch arrives before whenReady, do not create a window
  // here — whenReady owns first creation. After ready, focus/show only
  // when that launch did not request --hidden (autostart / session restore).
  if (
    !shouldShowWindowOnSecondInstance({
      isReady: app.isReady(),
      commandLine,
    })
  ) {
    return;
  }
  showMainWindow();
});

app.on('web-contents-created', (_event, contents) => {
  attachNavigationHandlers(contents);
});

app.whenReady().then(() => {
  // Autostart launches with --hidden: tray only, no window until the user
  // opens one via the menu (or a future hotkey).
  const hidden = wantsHiddenLaunch();
  const trayIcon = createTray({ showWindow: showMainWindow });
  if (shouldQuitHiddenWithoutTray({ hidden, tray: trayIcon })) {
    console.error(
      'Tray icon failed during --hidden launch; quitting so the process cannot linger unseen.',
    );
    app.quit();
    return;
  }
  if (!shouldOpenWindowOnReady({ hidden })) {
    return;
  }
  if (!getMainWindow()) {
    createWindow();
  } else {
    showMainWindow();
  }
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
  showMainWindow();
});
