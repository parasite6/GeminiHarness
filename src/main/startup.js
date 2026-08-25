const { wantsHiddenLaunch } = require('./autostart');

// Absorb GNOME session-restore relaunches that race a --hidden autostart
// (restore typically has no --hidden and would force a window open).
const HIDDEN_LAUNCH_GRACE_MS = 15_000;

function shouldOpenWindowOnReady({ hidden }) {
  return !hidden;
}

/**
 * @returns {'ignore' | 'queue' | 'show'}
 */
function classifySecondInstance({
  isReady,
  commandLine,
  primaryLaunchedHidden,
  windowEverShown,
  hiddenLaunchAt,
  now = Date.now(),
  graceMs = HIDDEN_LAUNCH_GRACE_MS,
}) {
  if (wantsHiddenLaunch(commandLine)) {
    return 'ignore';
  }
  if (!isReady) {
    return 'queue';
  }
  if (
    primaryLaunchedHidden &&
    !windowEverShown &&
    Number.isFinite(hiddenLaunchAt) &&
    now - hiddenLaunchAt < graceMs
  ) {
    return 'ignore';
  }
  return 'show';
}

/** @deprecated use classifySecondInstance */
function shouldShowWindowOnSecondInstance(args) {
  return classifySecondInstance(args) === 'show';
}

function shouldQuitHiddenWithoutTray({ hidden, tray }) {
  return Boolean(hidden) && !tray;
}

module.exports = {
  HIDDEN_LAUNCH_GRACE_MS,
  shouldOpenWindowOnReady,
  classifySecondInstance,
  shouldShowWindowOnSecondInstance,
  shouldQuitHiddenWithoutTray,
};
