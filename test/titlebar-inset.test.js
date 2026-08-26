const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  overlayInsetCssPx,
  buildTitleBarInsetCss,
} = require('../src/main/titlebar-inset');

describe('overlayInsetCssPx', () => {
  it('keeps overlay DIP height at zoom 1', () => {
    assert.equal(overlayInsetCssPx(36, 1), 36);
  });

  it('shrinks CSS px as page zoom grows so DIP inset stays constant', () => {
    assert.equal(overlayInsetCssPx(36, 2), 18);
    assert.equal(overlayInsetCssPx(36, 0.5), 72);
  });

  it('treats invalid zoom as 1', () => {
    assert.equal(overlayInsetCssPx(36, 0), 36);
    assert.equal(overlayInsetCssPx(36, Number.NaN), 36);
  });
});

describe('buildTitleBarInsetCss', () => {
  it('writes the zoom-scaled body translate and viewport drag strip', () => {
    const css = buildTitleBarInsetCss({
      overlayHeight: 36,
      zoomFactor: 2,
      color: '#131314',
    });
    assert.match(css, /body\s*\{[^}]*transform:\s*translateY\(18px\)/s);
    assert.doesNotMatch(css, /html\s*\{[^}]*transform:/s);
    assert.match(css, /height: calc\(100% - 18px\)/);
    assert.match(css, /top: 0;/);
    assert.match(css, /height: 18px;/);
    assert.match(css, /background-color: #131314/);
  });
});
