const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  overlayInsetCssPx,
  buildTitleBarInsetCss,
  TITLEBAR_RELOAD_BUTTON_ID,
  buildTitleBarReloadScript,
  shouldHonorTitleBarReloadIpc,
  isTitleBarReloadAuthUrl,
} = require('../src/main/titlebar-inset');
const { parseHttpUrl, isGoogleAuthHost } = require('../src/main/navigation');

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
    assert.match(css, /left: 18px;/);
    assert.match(css, /background-color: #131314/);
  });

  it('keeps the reload control inside the zoom-scaled overlay height', () => {
    const css = buildTitleBarInsetCss({
      overlayHeight: 36,
      zoomFactor: 0.5,
      color: '#131314',
    });
    assert.match(
      css,
      new RegExp(`#${TITLEBAR_RELOAD_BUTTON_ID}[^}]*height:\\s*72px`),
    );
    assert.match(
      css,
      new RegExp(`#${TITLEBAR_RELOAD_BUTTON_ID}[^}]*width:\\s*72px`),
    );
  });

  it('styles a no-drag reload control in the overlay strip, not on html transform', () => {
    const css = buildTitleBarInsetCss({
      overlayHeight: 36,
      zoomFactor: 2,
      color: '#131314',
    });
    const id = TITLEBAR_RELOAD_BUTTON_ID;
    assert.match(css, new RegExp(`#${id}\\s*\\{`));
    assert.match(css, new RegExp(`#${id}[^}]*-webkit-app-region:\\s*no-drag`));
    assert.match(css, new RegExp(`#${id}[^}]*top:\\s*0`));
    assert.match(css, new RegExp(`#${id}[^}]*height:\\s*18px`));
    assert.doesNotMatch(css, /html\s*\{[^}]*transform:/s);
  });

  it('paints a slow CSS-only breathing gradient that fades into the page', () => {
    const css = buildTitleBarInsetCss({
      overlayHeight: 36,
      zoomFactor: 1,
      color: '#131314',
    });
    assert.match(css, /html::after\s*\{/);
    assert.match(css, /@keyframes geminiharness-titlebar-breathe/);
    assert.match(css, /animation:[^;]*geminiharness-titlebar-breathe/);
    assert.match(css, /16s/);
    assert.match(css, /html::after[^}]*pointer-events:\s*none/s);
    assert.match(css, /html::after[^}]*height:\s*36px/s);
    assert.match(css, /linear-gradient\(\s*to bottom/);
    assert.match(css, /linear-gradient\(\s*90deg/);
    assert.doesNotMatch(css, /html\s*\{[^}]*transform:/s);
    assert.match(css, /body\s*\{[^}]*transform:\s*translateY\(36px\)/s);
  });
});

describe('buildTitleBarReloadScript', () => {
  it('appends a single html-level reload button that calls the preload bridge', () => {
    const script = buildTitleBarReloadScript();
    assert.match(script, new RegExp(TITLEBAR_RELOAD_BUTTON_ID));
    assert.match(script, /document\.documentElement\.appendChild/);
    assert.doesNotMatch(script, /document\.body\.appendChild/);
    assert.match(script, /geminiHarness\.reload/);
    assert.match(script, /getElementById/);
  });
});

describe('shouldHonorTitleBarReloadIpc', () => {
  it('accepts only the main frame and ignores every other frame', () => {
    assert.equal(shouldHonorTitleBarReloadIpc({ isMainFrame: true }), true);
    assert.equal(shouldHonorTitleBarReloadIpc({ isMainFrame: false }), false);
    assert.equal(shouldHonorTitleBarReloadIpc({}), false);
  });
});

describe('isTitleBarReloadAuthUrl', () => {
  it('reuses navigation.js auth hosts, not a second list', () => {
    const login = 'https://accounts.google.com/ServiceLogin';
    const setsid = 'https://accounts.youtube.com/accounts/SetSID';
    const gemini = 'https://gemini.google.com/app';
    assert.equal(
      isTitleBarReloadAuthUrl(login),
      isGoogleAuthHost(parseHttpUrl(login).hostname),
    );
    assert.equal(
      isTitleBarReloadAuthUrl(setsid),
      isGoogleAuthHost(parseHttpUrl(setsid).hostname),
    );
    assert.equal(isTitleBarReloadAuthUrl(gemini), false);
    assert.equal(isTitleBarReloadAuthUrl('https://mail.google.com/'), false);
  });
});
