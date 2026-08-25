const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldShowWindowOnSecondInstance,
  shouldOpenWindowOnReady,
  shouldQuitHiddenWithoutTray,
} = require('../src/main/startup');

describe('shouldOpenWindowOnReady', () => {
  it('skips createWindow on --hidden launches', () => {
    assert.equal(shouldOpenWindowOnReady({ hidden: true }), false);
    assert.equal(shouldOpenWindowOnReady({ hidden: false }), true);
  });
});

describe('shouldShowWindowOnSecondInstance', () => {
  it('does not show a window before ready', () => {
    assert.equal(
      shouldShowWindowOnSecondInstance({
        isReady: false,
        commandLine: ['electron', '.'],
      }),
      false,
    );
  });

  it('does not show a window when the second launch requested --hidden', () => {
    assert.equal(
      shouldShowWindowOnSecondInstance({
        isReady: true,
        commandLine: [
          '/opt/GeminiHarness/geminiharness',
          '--ozone-platform=x11',
          '--hidden',
        ],
      }),
      false,
    );
  });

  it('shows a window for a second launch that is not hidden', () => {
    assert.equal(
      shouldShowWindowOnSecondInstance({
        isReady: true,
        commandLine: ['/opt/GeminiHarness/geminiharness'],
      }),
      true,
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
