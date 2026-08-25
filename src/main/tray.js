const { Menu, Tray, screen, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { resolveAppRoot } = require('./asset-path');
const {
  autostartDir,
  isAutostartEnabled,
  setAutostartEnabled,
  resolveCurrentExecLine,
  shouldWatchAutostartFilename,
} = require('./autostart');
const {
  attachTrayMenuRefresh,
  refreshTrayContextMenu,
} = require('./tray-menu');

let tray = null;
let autostartWatcher = null;
let showWindowRef = null;

function resolveTrayIconPath() {
  const iconDir = path.join(resolveAppRoot(), 'assets', 'tray');
  const scale = screen.getPrimaryDisplay().scaleFactor;
  const preferred = scale >= 1.5 ? 'icon@2x.png' : 'icon.png';
  const preferredPath = path.resolve(iconDir, preferred);
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }
  return path.resolve(iconDir, 'icon.png');
}

function resolveAutostartExec() {
  return resolveCurrentExecLine({
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: app.getAppPath(),
  });
}

function refreshTrayMenu() {
  if (!showWindowRef) {
    return false;
  }
  return refreshTrayContextMenu(tray, () =>
    buildTrayMenu({ showWindow: showWindowRef }),
  );
}

function watchAutostartDir() {
  if (autostartWatcher) {
    return;
  }
  const dir = autostartDir();
  if (!fs.existsSync(dir)) {
    return;
  }
  try {
    autostartWatcher = fs.watch(dir, (_event, filename) => {
      if (!shouldWatchAutostartFilename(filename)) {
        return;
      }
      refreshTrayMenu();
    });
  } catch (error) {
    console.error('Failed to watch autostart directory:', error);
  }
}

function buildTrayMenu({ showWindow }) {
  return Menu.buildFromTemplate([
    {
      label: 'Open Window',
      click: () => {
        showWindow();
      },
    },
    {
      label: 'Start on Login',
      type: 'checkbox',
      checked: isAutostartEnabled(),
      click: (item) => {
        try {
          setAutostartEnabled(item.checked, resolveAutostartExec);
        } catch (error) {
          console.error('Failed to update autostart:', error);
        }
        watchAutostartDir();
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Gemini',
      click: () => {
        app.quit();
      },
    },
  ]);
}

function createTray({ showWindow }) {
  if (tray) {
    return tray;
  }

  const iconPath = resolveTrayIconPath();
  if (!fs.existsSync(iconPath)) {
    console.error('Tray icon file is missing:', iconPath);
    return null;
  }

  try {
    // Pass a filesystem path (not a NativeImage). Electron 43.3–44 also
    // break GNOME AppIndicator via a Chromium SNI multiplexer; we pin
    // electron@43.2.0 until that is fixed (electron#52674).
    tray = new Tray(iconPath);
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    return null;
  }

  showWindowRef = showWindow;
  tray.setToolTip('GeminiHarness');
  refreshTrayMenu();
  attachTrayMenuRefresh(tray, refreshTrayMenu);
  watchAutostartDir();

  return tray;
}

function getTray() {
  return tray;
}

module.exports = {
  createTray,
  getTray,
  resolveTrayIconPath,
  buildTrayMenu,
};
