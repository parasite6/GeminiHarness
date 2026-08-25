const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  defaultState,
  sanitizeState,
  clampBoundsToDisplays,
  load,
  save,
  stateFilePath,
} = require('../src/main/window-state');

const DISPLAY_1920 = {
  primary: true,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1048 },
};

describe('sanitizeState', () => {
  it('returns defaults for non-objects', () => {
    assert.deepEqual(sanitizeState(null), defaultState());
    assert.deepEqual(sanitizeState('nope'), defaultState());
  });

  it('falls back when width is not a number', () => {
    const state = sanitizeState({ width: 'foo', height: 800 });
    assert.equal(state.width, 1000);
    assert.equal(state.height, 800);
  });

  it('clamps zoomFactor 99 into range', () => {
    assert.equal(sanitizeState({ zoomFactor: 99 }).zoomFactor, 3);
    assert.equal(sanitizeState({ zoomFactor: 0.1 }).zoomFactor, 0.5);
  });

  it('treats invalid zoom as default', () => {
    assert.equal(sanitizeState({ zoomFactor: 'big' }).zoomFactor, 1);
  });

  it('omits x/y when missing', () => {
    const state = sanitizeState({ width: 1000, height: 750 });
    assert.equal('x' in state, false);
    assert.equal('y' in state, false);
  });
});

describe('clampBoundsToDisplays', () => {
  it('keeps an on-screen position', () => {
    const state = clampBoundsToDisplays(
      { x: 120, y: 80, width: 1000, height: 750 },
      [DISPLAY_1920],
    );
    assert.equal(state.x, 120);
    assert.equal(state.y, 80);
    assert.equal(state.width, 1000);
    assert.equal(state.height, 750);
  });

  it('drops x/y when saved position is off-screen', () => {
    const state = clampBoundsToDisplays(
      { x: 8000, y: 0, width: 1000, height: 750, isMaximized: true },
      [DISPLAY_1920],
    );
    assert.equal('x' in state, false);
    assert.equal('y' in state, false);
    assert.equal(state.width, 1000);
    assert.equal(state.height, 750);
    assert.equal(state.isMaximized, true);
  });

  it('keeps a position that still has a 100x50 grab area', () => {
    const state = clampBoundsToDisplays(
      { x: 1820, y: 0, width: 1000, height: 750 },
      [DISPLAY_1920],
    );
    assert.equal(state.x, 1820);
    assert.equal(state.y, 0);
  });

  it('drops x/y when no displays are given', () => {
    const state = clampBoundsToDisplays(
      { x: 10, y: 10, width: 1000, height: 750 },
      [],
    );
    assert.equal('x' in state, false);
    assert.equal('y' in state, false);
  });
});

describe('load / save', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geminiharness-state-'));
    file = path.join(dir, 'window-state.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips valid JSON', () => {
    const saved = {
      x: 40,
      y: 60,
      width: 1100,
      height: 800,
      isMaximized: true,
      zoomFactor: 1.2,
    };
    assert.equal(save(file, saved), true);
    const loaded = load(file, [DISPLAY_1920]);
    assert.equal(loaded.x, 40);
    assert.equal(loaded.y, 60);
    assert.equal(loaded.width, 1100);
    assert.equal(loaded.height, 800);
    assert.equal(loaded.isMaximized, true);
    assert.equal(loaded.zoomFactor, 1.2);
  });

  it('returns defaults for a missing file', () => {
    const loaded = load(file, [DISPLAY_1920]);
    assert.deepEqual(loaded, defaultState());
  });

  it('returns defaults for corrupt JSON', () => {
    fs.writeFileSync(file, '{not json');
    const loaded = load(file, [DISPLAY_1920]);
    assert.equal(loaded.width, 1000);
    assert.equal(loaded.height, 750);
    assert.equal('x' in loaded, false);
  });

  it('does not throw when the save path is unwritable', () => {
    const fsStub = {
      mkdirSync() {},
      writeFileSync() {
        throw new Error('EACCES');
      },
      renameSync() {},
    };
    assert.equal(save('/nope/window-state.json', defaultState(), fsStub), false);
  });

  it('builds a path under userData', () => {
    assert.equal(
      stateFilePath('/home/user/.config/GeminiHarness'),
      '/home/user/.config/GeminiHarness/window-state.json',
    );
  });
});
