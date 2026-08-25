const TRAY_MENU_REFRESH_EVENTS = ['click', 'right-click', 'double-click'];

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

module.exports = {
  TRAY_MENU_REFRESH_EVENTS,
  refreshTrayContextMenu,
  attachTrayMenuRefresh,
};
