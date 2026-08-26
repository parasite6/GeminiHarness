const { Menu, Tray, screen, app, dialog } = require('electron');
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
const { isHotkeyEnabled, setHotkeyEnabled } = require('./hotkey');
const {
  AUTOSTART_MENU_SYNC_MS,
  attachTrayMenuRefresh,
  refreshTrayContextMenu,
  shouldRebuildAutostartMenu,
  readAlwaysOnTopChecked,
  readSizeLockedChecked,
} = require('./tray-menu');

let tray = null;
let autostartWatcher = null;
let autostartSyncTimer = null;
let showWindowRef = null;
let isAlwaysOnTopRef = () => false;
let setAlwaysOnTopRef = () => {};
let isSizeLockedRef = () => false;
let setSizeLockedRef = () => {};
let lastAutostartChecked = null;

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

function resolveHotkeyCommand() {
  return resolveCurrentExecLine({
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: app.getAppPath(),
    includeHidden: false,
  });
}

function readHotkeyEnabledSafe() {
  try {
    return isHotkeyEnabled();
  } catch (error) {
    console.error('Failed to read hotkey state:', error);
    return false;
  }
}

function refreshTrayMenu() {
  if (!showWindowRef) {
    return false;
  }
  const checked = isAutostartEnabled();
  lastAutostartChecked = checked;
  return refreshTrayContextMenu(tray, () =>
    buildTrayMenu({
      showWindow: showWindowRef,
      checked,
      hotkeyChecked: readHotkeyEnabledSafe(),
      alwaysOnTopChecked: readAlwaysOnTopChecked({
        isAlwaysOnTop: isAlwaysOnTopRef,
      }),
      sizeLockedChecked: readSizeLockedChecked({
        isSizeLocked: isSizeLockedRef,
      }),
    }),
  );
}

function syncAutostartMenuIfChanged() {
  const checked = isAutostartEnabled();
  if (!shouldRebuildAutostartMenu(lastAutostartChecked, checked)) {
    return false;
  }
  return refreshTrayMenu();
}

function watchAutostartDir() {
  if (autostartWatcher) {
    return;
  }
  const dir = autostartDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
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

function startAutostartMenuSync() {
  if (autostartSyncTimer) {
    return;
  }
  autostartSyncTimer = setInterval(() => {
    syncAutostartMenuIfChanged();
  }, AUTOSTART_MENU_SYNC_MS);
  if (typeof autostartSyncTimer.unref === 'function') {
    autostartSyncTimer.unref();
  }
}

function confirmEnableHotkey() {
  const result = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Enable', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    title: 'GeminiHarness',
    message: 'Enable Super+G as a global shortcut?',
    detail:
      'Super+G will show or hide GeminiHarness. Existing GNOME shortcuts are left alone; this is only written after you confirm.',
  });
  return result === 0;
}

function buildTrayMenu({
  showWindow,
  checked = isAutostartEnabled(),
  hotkeyChecked = readHotkeyEnabledSafe(),
  alwaysOnTopChecked = readAlwaysOnTopChecked({
    isAlwaysOnTop: isAlwaysOnTopRef,
  }),
  sizeLockedChecked = readSizeLockedChecked({
    isSizeLocked: isSizeLockedRef,
  }),
}) {
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
      checked,
      click: (item) => {
        try {
          setAutostartEnabled(item.checked, resolveAutostartExec);
        } catch (error) {
          console.error('Failed to update autostart:', error);
          dialog.showErrorBox(
            'GeminiHarness',
            `Could not update Start on Login.\n\n${error.message || error}`,
          );
        }
        watchAutostartDir();
        refreshTrayMenu();
      },
    },
    {
      label: 'Keyboard shortcut (Super+G)',
      type: 'checkbox',
      checked: hotkeyChecked,
      click: (item) => {
        try {
          if (item.checked) {
            if (!confirmEnableHotkey()) {
              refreshTrayMenu();
              return;
            }
            setHotkeyEnabled(true, resolveHotkeyCommand);
          } else {
            setHotkeyEnabled(false, resolveHotkeyCommand);
          }
        } catch (error) {
          console.error('Failed to update hotkey:', error);
          dialog.showErrorBox(
            'GeminiHarness',
            `Could not update the keyboard shortcut.\n\n${error.message || error}`,
          );
        }
        refreshTrayMenu();
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: alwaysOnTopChecked,
      click: (item) => {
        setAlwaysOnTopRef(item.checked);
        refreshTrayMenu();
      },
    },
    {
      label: 'Lock Window Size',
      type: 'checkbox',
      checked: sizeLockedChecked,
      click: (item) => {
        setSizeLockedRef(item.checked);
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

function createTray({
  showWindow,
  isAlwaysOnTop,
  setAlwaysOnTop,
  isSizeLocked,
  setSizeLocked,
}) {
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
  isAlwaysOnTopRef =
    typeof isAlwaysOnTop === 'function' ? isAlwaysOnTop : () => false;
  setAlwaysOnTopRef =
    typeof setAlwaysOnTop === 'function' ? setAlwaysOnTop : () => {};
  isSizeLockedRef =
    typeof isSizeLocked === 'function' ? isSizeLocked : () => false;
  setSizeLockedRef =
    typeof setSizeLocked === 'function' ? setSizeLocked : () => {};
  tray.setToolTip('GeminiHarness');
  refreshTrayMenu();
  attachTrayMenuRefresh(tray, refreshTrayMenu);
  watchAutostartDir();
  startAutostartMenuSync();

  return tray;
}

function getTray() {
  return tray;
}

module.exports = {
  createTray,
  getTray,
};
