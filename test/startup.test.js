const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifySecondInstance,
  shouldOpenWindowOnReady,
  shouldQuitHiddenWithoutTray,
  HIDDEN_LAUNCH_GRACE_MS,
} = require('../src/main/startup');

describe('shouldOpenWindowOnReady', () => {
  it('skips createWindow on --hidden launches', () => {
    assert.equal(shouldOpenWindowOnReady({ hidden: true }), false);
    assert.equal(shouldOpenWindowOnReady({ hidden: false }), true);
  });
});

describe('classifySecondInstance', () => {
  it('ignores a second launch that requested --hidden', () => {
    assert.equal(
      classifySecondInstance({
        isReady: true,
        commandLine: ['app', '--hidden'],
        primaryLaunchedHidden: false,
        windowEverShown: false,
        hiddenLaunchAt: null,
        now: 1000,
      }),
      'ignore',
    );
  });

  it('queues a non-hidden second launch that arrives before ready', () => {
    assert.equal(
      classifySecondInstance({
        isReady: false,
        commandLine: ['app'],
        primaryLaunchedHidden: false,
        windowEverShown: false,
        hiddenLaunchAt: null,
        now: 1000,
      }),
      'queue',
    );
  });

  it('ignores --hidden before ready (do not queue a show)', () => {
    assert.equal(
      classifySecondInstance({
        isReady: false,
        commandLine: ['app', '--hidden'],
        primaryLaunchedHidden: true,
        windowEverShown: false,
        hiddenLaunchAt: 0,
        now: 1000,
      }),
      'ignore',
    );
  });

  it('swallows non-hidden launches during the hidden-start grace window', () => {
    assert.equal(
      classifySecondInstance({
        isReady: true,
        commandLine: ['app'],
        primaryLaunchedHidden: true,
        windowEverShown: false,
        hiddenLaunchAt: 1000,
        now: 1000 + HIDDEN_LAUNCH_GRACE_MS - 1,
      }),
      'ignore',
    );
  });

  it('toggles after the grace window even if still tray-only', () => {
    assert.equal(
      classifySecondInstance({
        isReady: true,
        commandLine: ['app'],
        primaryLaunchedHidden: true,
        windowEverShown: false,
        hiddenLaunchAt: 1000,
        now: 1000 + HIDDEN_LAUNCH_GRACE_MS,
      }),
      'toggle',
    );
  });

  it('toggles during grace if the user already opened a window', () => {
    assert.equal(
      classifySecondInstance({
        isReady: true,
        commandLine: ['app'],
        primaryLaunchedHidden: true,
        windowEverShown: true,
        hiddenLaunchAt: 1000,
        now: 1000 + 1,
      }),
      'toggle',
    );
  });

  it('toggles a normal second launch when the primary was not hidden', () => {
    assert.equal(
      classifySecondInstance({
        isReady: true,
        commandLine: ['app'],
        primaryLaunchedHidden: false,
        windowEverShown: false,
        hiddenLaunchAt: null,
        now: 5000,
      }),
      'toggle',
    );
  });
});

describe('shouldQuitHiddenWithoutTray', () => {
  it('quits a --hidden launch when tray creation failed', () => {
    assert.equal(
      shouldQuitHiddenWithoutTray({ hidden: true, tray: null }),
      true,
    );
  });

  it('keeps running when hidden launch got a tray', () => {
    assert.equal(
      shouldQuitHiddenWithoutTray({ hidden: true, tray: { id: 1 } }),
      false,
    );
  });

  it('does not quit a visible launch just because tray failed', () => {
    assert.equal(
      shouldQuitHiddenWithoutTray({ hidden: false, tray: null }),
      false,
    );
  });
});
