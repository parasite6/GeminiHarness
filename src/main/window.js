const { app, BrowserWindow, session, screen, net } = require('electron');
const {
  load,
  save,
  stateFilePath,
  MIN_WIDTH,
  MIN_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} = require('./window-state');
const { buildTitleBarInsetCss } = require('./titlebar-inset');
const {
  START_URL,
  OFFLINE_RETRY_MS,
  shouldOfferOfflineGate,
  shouldClearOfflineGate,
  shouldShowOfflineOnFail,
  shouldResumeOfflineRetry,
  canBeginOfflineAttempt,
  isHarnessOfflinePage,
  offlinePagePath,
  canReachGemini,
} = require('./offline-gate');

const PARTITION = 'persist:gemini';
const SAVE_DEBOUNCE_MS = 400;
const TITLE_BAR_OVERLAY_HEIGHT = 36;
const TITLE_BAR_OVERLAY_COLOR = '#131314';

let mainWindow = null;
let saveTimer = null;
let persistedPath = null;
let appIsQuitting = false;
let titleBarInsetCssKey = null;
let titleBarInsetChain = Promise.resolve();
let windowEverShown = false;
let offlineGateActive = false;
let offlineRetryTimer = null;
let offlineAttemptInFlight = false;

async function applyTitleBarInsetOnce(contents) {
  if (!contents || contents.isDestroyed()) {
    return;
  }
  const css = buildTitleBarInsetCss({
    overlayHeight: TITLE_BAR_OVERLAY_HEIGHT,
    zoomFactor: contents.getZoomFactor(),
    color: TITLE_BAR_OVERLAY_COLOR,
  });
  try {
    if (titleBarInsetCssKey) {
      await contents.removeInsertedCSS(titleBarInsetCssKey);
      titleBarInsetCssKey = null;
    }
    titleBarInsetCssKey = await contents.insertCSS(css);
  } catch (error) {
    console.error('Failed to inset page for title bar overlay:', error);
  }
}

function applyTitleBarInset(contents) {
  titleBarInsetChain = titleBarInsetChain
    .then(() => applyTitleBarInsetOnce(contents))
    .catch((error) => {
      console.error('Failed to inset page for title bar overlay:', error);
    });
  return titleBarInsetChain;
}

function markWindowEverShown() {
  windowEverShown = true;
}

function hasWindowEverShown() {
  return windowEverShown;
}

function setAppQuitting(value) {
  appIsQuitting = Boolean(value);
}

function currentDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display) => ({
    primary: display.id === primaryId,
    bounds: display.bounds,
    workArea: display.workArea,
  }));
}

function clampZoom(factor) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, factor));
}

function collectWindowState(win) {
  const bounds = win.getNormalBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized(),
    zoomFactor: win.webContents.getZoomFactor(),
  };
}

function persist() {
  const win = mainWindow;
  if (!win || win.isDestroyed() || !persistedPath) {
    return;
  }
  save(persistedPath, collectWindowState(win));
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, SAVE_DEBOUNCE_MS);
}

function flushWindowState() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persist();
}

function isZoomInKey(input) {
  return input.key === '+' || input.key === '=' || input.key === 'Add';
}

function isZoomOutKey(input) {
  return input.key === '-' || input.key === '_' || input.key === 'Subtract';
}

function isZoomResetKey(input) {
  return input.key === '0' || input.key === 'NumPad0';
}

function attachZoomShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return;
    }
    if (!input.control && !input.meta) {
      return;
    }
    if (input.alt) {
      return;
    }

    if (isZoomInKey(input)) {
      event.preventDefault();
      win.webContents.setZoomFactor(
        clampZoom(win.webContents.getZoomFactor() * ZOOM_STEP),
      );
      applyTitleBarInset(win.webContents);
      scheduleSave();
      return;
    }

    if (isZoomOutKey(input)) {
      event.preventDefault();
      win.webContents.setZoomFactor(
        clampZoom(win.webContents.getZoomFactor() / ZOOM_STEP),
      );
      applyTitleBarInset(win.webContents);
      scheduleSave();
      return;
    }

    if (isZoomResetKey(input)) {
      event.preventDefault();
      win.webContents.setZoomFactor(1);
      applyTitleBarInset(win.webContents);
      scheduleSave();
    }
  });

  win.webContents.on('zoom-changed', () => {
    applyTitleBarInset(win.webContents);
    scheduleSave();
  });
}

function attachStatePersistence(win) {
  const persistSoon = () => scheduleSave();
  win.on('resize', persistSoon);
  win.on('move', persistSoon);
  win.on('maximize', persistSoon);
  win.on('unmaximize', persistSoon);
  win.on('close', (event) => {
    flushWindowState();
    if (!appIsQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  attachZoomShortcuts(win);
}

function stopOfflineRetry() {
  if (offlineRetryTimer) {
    clearInterval(offlineRetryTimer);
    offlineRetryTimer = null;
  }
}

function probeGemini(win) {
  const ses = win.webContents.session;
  return canReachGemini({
    // Match the BrowserWindow partition (persist:gemini), not the default session.
    fetchImpl: (url, init) => ses.fetch(url, init),
    isOnline: () => net.isOnline(),
  });
}

async function showOfflinePage(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  offlineGateActive = true;
  try {
    await win.loadFile(offlinePagePath());
  } catch (error) {
    console.error('Failed to load offline page:', error);
  }
}

function startOfflineRetry(win) {
  stopOfflineRetry();
  offlineRetryTimer = setInterval(() => {
    attemptGeminiLoad(win, { fromRetry: true });
  }, OFFLINE_RETRY_MS);
  if (typeof offlineRetryTimer.unref === 'function') {
    offlineRetryTimer.unref();
  }
}

function resumeOfflineGateIfNeeded(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  if (!shouldResumeOfflineRetry({ gateActive: offlineGateActive })) {
    return;
  }
  startOfflineRetry(win);
  attemptGeminiLoad(win, { fromRetry: true });
}

async function attemptGeminiLoad(win, { fromRetry = false } = {}) {
  if (!win || win.isDestroyed()) {
    return;
  }
  if (fromRetry && !shouldOfferOfflineGate({ gateActive: offlineGateActive })) {
    return;
  }
  if (!canBeginOfflineAttempt(offlineAttemptInFlight)) {
    return;
  }

  offlineAttemptInFlight = true;
  try {
    if (!(await probeGemini(win))) {
      const currentUrl = win.webContents.getURL();
      if (!isHarnessOfflinePage(currentUrl)) {
        await showOfflinePage(win);
      } else {
        offlineGateActive = true;
      }
      if (win.isVisible()) {
        startOfflineRetry(win);
      }
      return;
    }

    // Keep the gate active until Gemini (or auth) actually finishes loading
    // so a failed first navigation still gets the custom offline page.
    stopOfflineRetry();
    win.loadURL(START_URL);
  } finally {
    offlineAttemptInFlight = false;
  }
}

function attachOfflineGate(win) {
  offlineGateActive = true;

  win.on('hide', () => {
    stopOfflineRetry();
  });

  win.on('show', () => {
    resumeOfflineGateIfNeeded(win);
  });

  win.webContents.on('did-finish-load', () => {
    const url = win.webContents.getURL();
    if (
      shouldClearOfflineGate({
        gateActive: offlineGateActive,
        isMainFrame: true,
        url,
      })
    ) {
      offlineGateActive = false;
      stopOfflineRetry();
      return;
    }
    // "Try again" reloads our offline page; re-check connectivity then.
    if (offlineGateActive && isHarnessOfflinePage(url)) {
      attemptGeminiLoad(win, { fromRetry: true });
    }
  });

  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, _desc, validatedURL, isMainFrame) => {
      if (
        !shouldShowOfflineOnFail({
          gateActive: offlineGateActive,
          isMainFrame,
          errorCode,
          validatedURL,
        })
      ) {
        return;
      }
      showOfflinePage(win).then(() => {
        if (win.isVisible()) {
          startOfflineRetry(win);
        }
      });
    },
  );
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return showMainWindow();
  }

  persistedPath = stateFilePath(app.getPath('userData'));
  const state = load(persistedPath, currentDisplays());
  const geminiSession = session.fromPartition(PARTITION);

  const options = {
    width: state.width,
    height: state.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'GeminiHarness',
    backgroundColor: TITLE_BAR_OVERLAY_COLOR,
    autoHideMenuBar: true,
    // Hide the GTK/Chromium title bar; Linux still needs the overlay so
    // native min/max/close remain available (see Electron custom title bar).
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: TITLE_BAR_OVERLAY_COLOR,
      symbolColor: '#e3e3e3',
      height: TITLE_BAR_OVERLAY_HEIGHT,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: geminiSession,
    },
  };

  if (Number.isInteger(state.x) && Number.isInteger(state.y)) {
    options.x = state.x;
    options.y = state.y;
  }

  const win = new BrowserWindow(options);

  win.webContents.on('dom-ready', () => {
    // Replace inset via removeInsertedCSS inside applyTitleBarInset —
    // do not clear titleBarInsetCssKey here or stacked translates accumulate.
    applyTitleBarInset(win.webContents);
  });

  attachStatePersistence(win);
  attachOfflineGate(win);

  win.once('ready-to-show', () => {
    // setZoomFactor before the blink widget exists logs
    // "Message 0 rejected by interface blink.mojom.WidgetHost".
    if (state.zoomFactor !== 1) {
      win.webContents.setZoomFactor(state.zoomFactor);
      applyTitleBarInset(win.webContents);
    }
    if (state.isMaximized) {
      win.maximize();
    }
    markWindowEverShown();
    win.show();
  });

  win.on('closed', () => {
    stopOfflineRetry();
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  attemptGeminiLoad(win);
  mainWindow = win;
  return win;
}

function getMainWindow() {
  return mainWindow;
}

function showMainWindow() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) {
    return createWindow();
  }
  if (win.isMinimized()) {
    win.restore();
  }
  markWindowEverShown();
  win.show();
  win.focus();
  resumeOfflineGateIfNeeded(win);
  return win;
}

function toggleMainWindow() {
  const win = mainWindow;
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.hide();
    return win;
  }
  return showMainWindow();
}

module.exports = {
  createWindow,
  getMainWindow,
  showMainWindow,
  toggleMainWindow,
  flushWindowState,
  setAppQuitting,
  markWindowEverShown,
  hasWindowEverShown,
};
