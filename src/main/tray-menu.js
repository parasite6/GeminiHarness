const TRAY_MENU_REFRESH_EVENTS = ['click', 'right-click', 'double-click'];
// AppIndicator often never emits click/menu-will-show; poll so GNOME
// Startup Applications edits still update the checkbox before the next open.
const AUTOSTART_MENU_SYNC_MS = 1000;

function refreshTrayContextMenu(tray, buildMenu) {
  if (!tray || (typeof tray.isDestroyed === 'function' && tray.isDestroyed())) {
    return false;
  }
  tray.setContextMenu(buildMenu());
  return true;
}

function attachTrayMenuRefresh(tray, refresh) {
  for (const event of TRAY_MENU_REFRESH_EVENTS) {
    tray.on(event, refresh);
  }
}

function shouldRebuildAutostartMenu(previousChecked, nextChecked) {
  return previousChecked !== nextChecked;
}

function readAlwaysOnTopChecked({ isAlwaysOnTop } = {}) {
  if (typeof isAlwaysOnTop !== 'function') {
    return false;
  }
  try {
    return isAlwaysOnTop() === true;
  } catch {
    return false;
  }
}

module.exports = {
  TRAY_MENU_REFRESH_EVENTS,
  AUTOSTART_MENU_SYNC_MS,
  refreshTrayContextMenu,
  attachTrayMenuRefresh,
  shouldRebuildAutostartMenu,
  readAlwaysOnTopChecked,
};
