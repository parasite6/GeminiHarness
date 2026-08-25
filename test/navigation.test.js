const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseHttpUrl,
  isGeminiHost,
  isGoogleAuthHost,
  shouldStayInApp,
  canOpenExternally,
  openExternalSafe,
  handleTopLevelNavigation,
} = require('../src/main/navigation');

describe('parseHttpUrl', () => {
  it('parses https URLs', () => {
    const parsed = parseHttpUrl('https://gemini.google.com/app');
    assert.equal(parsed.hostname, 'gemini.google.com');
    assert.equal(parsed.protocol, 'https:');
  });

  it('parses http URLs', () => {
    const parsed = parseHttpUrl('http://example.com/');
    assert.equal(parsed.hostname, 'example.com');
  });

  it('rejects file URLs', () => {
    assert.equal(parseHttpUrl('file:///home/user/notes.txt'), null);
  });

  it('rejects javascript URLs', () => {
    assert.equal(parseHttpUrl('javascript:alert(1)'), null);
  });

  it('rejects data URLs', () => {
    assert.equal(parseHttpUrl('data:text/html,hello'), null);
  });

  it('rejects malformed URLs', () => {
    assert.equal(parseHttpUrl('not a url'), null);
  });
});

describe('isGeminiHost', () => {
  it('matches gemini.google.com exactly', () => {
    assert.equal(isGeminiHost('gemini.google.com'), true);
  });

  it('does not match a suffix or subdomain', () => {
    assert.equal(isGeminiHost('www.gemini.google.com'), false);
    assert.equal(isGeminiHost('notgemini.google.com'), false);
  });
});

describe('isGoogleAuthHost', () => {
  it('matches accounts.google.com and accounts.youtube.com exactly', () => {
    assert.equal(isGoogleAuthHost('accounts.google.com'), true);
    assert.equal(isGoogleAuthHost('accounts.youtube.com'), true);
  });

  it('does not treat other Google properties as auth hosts', () => {
    assert.equal(isGoogleAuthHost('www.google.com'), false);
    assert.equal(isGoogleAuthHost('google.com'), false);
    assert.equal(isGoogleAuthHost('mail.google.com'), false);
    assert.equal(isGoogleAuthHost('drive.google.com'), false);
    assert.equal(isGoogleAuthHost('maps.google.com'), false);
    assert.equal(isGoogleAuthHost('consent.google.com'), false);
    assert.equal(isGoogleAuthHost('myaccount.google.com'), false);
    assert.equal(isGoogleAuthHost('youtube.com'), false);
    assert.equal(isGoogleAuthHost('www.youtube.com'), false);
  });
});

describe('shouldStayInApp', () => {
  it('keeps Gemini app URLs in-app', () => {
    assert.equal(shouldStayInApp('https://gemini.google.com/app'), true);
    assert.equal(
      shouldStayInApp('https://gemini.google.com/u/1/app'),
      true,
    );
  });

  it('keeps accounts.google.com in-app', () => {
    assert.equal(
      shouldStayInApp('https://accounts.google.com/ServiceLogin'),
      true,
    );
  });

  it('keeps accounts.youtube.com SetSID in-app', () => {
    assert.equal(
      shouldStayInApp(
        'https://accounts.youtube.com/accounts/SetSID?ssdc=1&continue=https://gemini.google.com/app',
      ),
      true,
    );
  });

  it('does not keep Sources-style Google Search links in-app', () => {
    assert.equal(
      shouldStayInApp('https://www.google.com/search?q=electron+docs'),
      false,
    );
  });

  it('does not keep other Google properties in-app', () => {
    assert.equal(shouldStayInApp('https://mail.google.com/'), false);
    assert.equal(shouldStayInApp('https://drive.google.com/'), false);
    assert.equal(shouldStayInApp('https://maps.google.com/'), false);
  });

  it('does not keep third-party source URLs in-app', () => {
    assert.equal(shouldStayInApp('https://en.wikipedia.org/wiki/Electron'), false);
    assert.equal(shouldStayInApp('https://github.com/electron/electron'), false);
  });

  it('does not keep file or javascript URLs in-app', () => {
    assert.equal(shouldStayInApp('file:///tmp/drop.html'), false);
    assert.equal(shouldStayInApp('javascript:void(0)'), false);
  });
});

describe('canOpenExternally / openExternalSafe', () => {
  it('allows http and https', () => {
    assert.equal(canOpenExternally('https://en.wikipedia.org/wiki/Test'), true);
    assert.equal(canOpenExternally('http://example.com/'), true);
  });

  it('rejects file and javascript', () => {
    assert.equal(canOpenExternally('file:///etc/passwd'), false);
    assert.equal(canOpenExternally('javascript:alert(1)'), false);
  });

  it('opens only http(s) URLs via the opener', () => {
    const opened = [];
    const opener = (url) => opened.push(url);

    assert.equal(openExternalSafe('https://github.com/', opener), true);
    assert.equal(openExternalSafe('file:///tmp/x', opener), false);
    assert.equal(openExternalSafe('javascript:alert(1)', opener), false);
    assert.deepEqual(opened, ['https://github.com/']);
  });
});

describe('handleTopLevelNavigation', () => {
  it('allows the harness offline page and blocks other file URLs', () => {
    const { pathToFileURL } = require('node:url');
    const path = require('node:path');
    const appRoot = path.join(__dirname, '..');
    const offlineUrl = pathToFileURL(
      path.join(appRoot, 'assets', 'offline', 'offline.html'),
    ).href;

    const allowed = { preventDefaultCalls: 0, isMainFrame: true };
    handleTopLevelNavigation(allowed, offlineUrl, () => {});
    assert.equal(allowed.preventDefaultCalls, 0);

    const blocked = {
      preventDefaultCalls: 0,
      isMainFrame: true,
      preventDefault() {
        this.preventDefaultCalls += 1;
      },
    };
    const opened = [];
    handleTopLevelNavigation(blocked, 'file:///tmp/other.html', (url) => {
      opened.push(url);
    });
    // file: is not http(s), so openExternalSafe rejects — still preventDefault
    assert.equal(blocked.preventDefaultCalls, 1);
    assert.deepEqual(opened, []);
  });
});
