const { wantsHiddenLaunch } = require('./autostart');

function shouldOpenWindowOnReady({ hidden }) {
  return !hidden;
}

function shouldShowWindowOnSecondInstance({ isReady, commandLine }) {
  if (!isReady) {
    return false;
  }
  if (wantsHiddenLaunch(commandLine)) {
    return false;
  }
  return true;
}

function shouldQuitHiddenWithoutTray({ hidden, tray }) {
  return Boolean(hidden) && !tray;
}

module.exports = {
  shouldOpenWindowOnReady,
  shouldShowWindowOnSecondInstance,
  shouldQuitHiddenWithoutTray,
};
