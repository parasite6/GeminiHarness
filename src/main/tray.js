const { Menu, Tray, screen, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { resolveAppRoot } = require('./asset-path');
const {
  isAutostartEnabled,
  setAutostartEnabled,
  resolveCurrentExecLine,
} = require('./autostart');

let tray = null;

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

function buildTrayMenu({ showWindow }) {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Window',
      click: () => {
        showWindow();
      },
    },
    {
      label: 'Start on Login',
      type: 'checkbox',
      // Re-read on each build; menu-will-show also refreshes below so the
      // checkmark tracks the on-disk .desktop file, not a stale cache.
      checked: isAutostartEnabled(),
      click: (item) => {
        try {
          setAutostartEnabled(item.checked, resolveAutostartExec);
        } catch (error) {
          console.error('Failed to update autostart:', error);
        }
        if (tray && !tray.isDestroyed()) {
          tray.setContextMenu(buildTrayMenu({ showWindow }));
        }
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

  menu.on('menu-will-show', () => {
    const item = menu.items.find((entry) => entry.label === 'Start on Login');
    if (item) {
      item.checked = isAutostartEnabled();
    }
  });

  return menu;
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

  tray.setToolTip('GeminiHarness');
  tray.setContextMenu(buildTrayMenu({ showWindow }));

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
