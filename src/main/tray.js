const { Menu, Tray, screen, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { resolveAppRoot } = require('./asset-path');

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
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Window',
        click: () => {
          showWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Gemini',
        click: () => {
          app.quit();
        },
      },
    ]),
  );

  return tray;
}

function getTray() {
  return tray;
}

module.exports = {
  createTray,
  getTray,
  resolveTrayIconPath,
};
