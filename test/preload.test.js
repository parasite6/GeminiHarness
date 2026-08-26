const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const preloadSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'preload.js'),
  'utf8',
);

describe('sandboxed title-bar preload', () => {
  it('only requires electron — relative files are unavailable in the sandbox', () => {
    assert.match(preloadSrc, /require\(['"]electron['"]\)/);
    assert.doesNotMatch(preloadSrc, /require\(['"]\.\//);
  });

  it('sends the same reload channel the main process listens on', () => {
    const { TITLEBAR_RELOAD_CHANNEL } = require('../src/main/titlebar-inset');
    assert.match(
      preloadSrc,
      new RegExp(
        `ipcRenderer\\.send\\(['"]${TITLEBAR_RELOAD_CHANNEL}['"]\\)`,
      ),
    );
  });
});
