const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TRAY_MENU_REFRESH_EVENTS,
  AUTOSTART_MENU_SYNC_MS,
  attachTrayMenuRefresh,
  refreshTrayContextMenu,
  shouldRebuildAutostartMenu,
} = require('../src/main/tray-menu');

function fakeTray() {
  const handlers = {};
  return {
    handlers,
    destroyed: false,
    menus: [],
    isDestroyed() {
      return this.destroyed;
    },
    on(event, handler) {
      handlers[event] = handler;
    },
    setContextMenu(menu) {
      this.menus.push(menu);
    },
  };
}

describe('tray menu refresh', () => {
  it('rebuilds via setContextMenu rather than mutating MenuItem.checked', () => {
    const tray = fakeTray();
    const menus = [{ id: 'fresh' }];
    const ok = refreshTrayContextMenu(tray, () => menus[0]);
    assert.equal(ok, true);
    assert.deepEqual(tray.menus, [menus[0]]);
  });

  it('skips rebuild when the tray is gone', () => {
    const tray = fakeTray();
    tray.destroyed = true;
    assert.equal(
      refreshTrayContextMenu(tray, () => ({})),
      false,
    );
    assert.deepEqual(tray.menus, []);
    assert.equal(refreshTrayContextMenu(null, () => ({})), false);
  });

  it('attaches rebuild to click/right-click/double-click, not only menu-will-show', () => {
    assert.deepEqual(TRAY_MENU_REFRESH_EVENTS, [
      'click',
      'right-click',
      'double-click',
    ]);
    assert.ok(AUTOSTART_MENU_SYNC_MS >= 500);
    const tray = fakeTray();
    let builds = 0;
    const refresh = () => {
      builds += 1;
      refreshTrayContextMenu(tray, () => ({ builds }));
    };
    attachTrayMenuRefresh(tray, refresh);
    for (const event of TRAY_MENU_REFRESH_EVENTS) {
      assert.equal(typeof tray.handlers[event], 'function');
      tray.handlers[event]();
    }
    assert.equal(builds, 3);
    assert.equal(tray.menus.length, 3);
    assert.equal('menu-will-show' in tray.handlers, false);
  });

  it('rebuilds the menu only when autostart checked state changes', () => {
    assert.equal(shouldRebuildAutostartMenu(true, true), false);
    assert.equal(shouldRebuildAutostartMenu(false, false), false);
    assert.equal(shouldRebuildAutostartMenu(true, false), true);
    assert.equal(shouldRebuildAutostartMenu(false, true), true);
    assert.equal(shouldRebuildAutostartMenu(null, false), true);
  });
});
