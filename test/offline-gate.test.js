const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  OFFLINE_RETRY_MS,
  ERR_ABORTED,
  isGeminiStartUrl,
  shouldOfferOfflineGate,
  shouldClearOfflineGate,
  shouldShowOfflineOnFail,
  shouldResumeOfflineRetry,
  canBeginOfflineAttempt,
  interpretReachabilityResponse,
  offlinePagePath,
  isHarnessOfflinePage,
  canReachGemini,
} = require('../src/main/offline-gate');

describe('offline-gate helpers', () => {
  it('uses a multi-second auto-retry interval', () => {
    assert.ok(OFFLINE_RETRY_MS >= 5000);
    assert.ok(OFFLINE_RETRY_MS <= 10000);
  });

  it('recognizes Gemini start URLs', () => {
    assert.equal(isGeminiStartUrl('https://gemini.google.com/'), true);
    assert.equal(isGeminiStartUrl('https://gemini.google.com/app'), true);
    assert.equal(isGeminiStartUrl('https://accounts.google.com/'), false);
    assert.equal(isGeminiStartUrl('file:///tmp/offline.html'), false);
  });

  it('only offers the gate before the first successful Gemini load', () => {
    assert.equal(shouldOfferOfflineGate({ gateActive: true }), true);
    assert.equal(shouldOfferOfflineGate({ gateActive: false }), false);
  });

  it('clears the gate once Gemini or auth hosts load in the main frame', () => {
    assert.equal(
      shouldClearOfflineGate({
        gateActive: true,
        isMainFrame: true,
        url: 'https://gemini.google.com/app',
      }),
      true,
    );
    assert.equal(
      shouldClearOfflineGate({
        gateActive: true,
        isMainFrame: true,
        url: 'https://accounts.google.com/ServiceLogin',
      }),
      true,
    );
    assert.equal(
      shouldClearOfflineGate({
        gateActive: true,
        isMainFrame: true,
        url: 'https://accounts.youtube.com/accounts/SetSID',
      }),
      true,
    );
    assert.equal(
      shouldClearOfflineGate({
        gateActive: true,
        isMainFrame: false,
        url: 'https://gemini.google.com/app',
      }),
      false,
    );
    assert.equal(
      shouldClearOfflineGate({
        gateActive: false,
        isMainFrame: true,
        url: 'https://gemini.google.com/app',
      }),
      false,
    );
  });

  it('ignores ERR_ABORTED and auth-chain failures for the offline page', () => {
    assert.equal(ERR_ABORTED, -3);
    assert.equal(
      shouldShowOfflineOnFail({
        gateActive: true,
        isMainFrame: true,
        errorCode: ERR_ABORTED,
        validatedURL: 'https://gemini.google.com/',
      }),
      false,
    );
    assert.equal(
      shouldShowOfflineOnFail({
        gateActive: true,
        isMainFrame: true,
        errorCode: -105,
        validatedURL: 'https://accounts.google.com/ServiceLogin',
      }),
      false,
    );
    assert.equal(
      shouldShowOfflineOnFail({
        gateActive: true,
        isMainFrame: true,
        errorCode: -105,
        validatedURL: 'https://gemini.google.com/',
      }),
      true,
    );
    assert.equal(
      shouldShowOfflineOnFail({
        gateActive: true,
        isMainFrame: true,
        errorCode: -105,
        validatedURL: 'file:///opt/GeminiHarness/assets/offline/offline.html',
      }),
      false,
    );
    assert.equal(
      shouldShowOfflineOnFail({
        gateActive: false,
        isMainFrame: true,
        errorCode: -105,
        validatedURL: 'https://gemini.google.com/',
      }),
      false,
    );
  });

  it('blocks overlapping offline attempts with an in-flight guard', () => {
    assert.equal(canBeginOfflineAttempt(false), true);
    assert.equal(canBeginOfflineAttempt(true), false);
  });

  it('resumes retry only while the gate is still active', () => {
    assert.equal(shouldResumeOfflineRetry({ gateActive: true }), true);
    assert.equal(shouldResumeOfflineRetry({ gateActive: false }), false);
  });

  it('treats common success and redirect statuses as reachable', () => {
    assert.equal(interpretReachabilityResponse({ ok: true, status: 200 }), true);
    assert.equal(interpretReachabilityResponse({ ok: false, status: 301 }), true);
    assert.equal(interpretReachabilityResponse({ ok: false, status: 302 }), true);
    assert.equal(interpretReachabilityResponse({ ok: false, status: 405 }), true);
    assert.equal(interpretReachabilityResponse({ ok: false, status: 500 }), false);
  });

  it('resolves the packaged offline page under assets/offline', () => {
    const page = offlinePagePath('/opt/GeminiHarness');
    assert.equal(
      page,
      path.join('/opt/GeminiHarness', 'assets', 'offline', 'offline.html'),
    );
  });

  it('keeps app.asar paths (loadFile works from asar; do not unpack)', () => {
    const { unpackAsarRoot } = require('../src/main/asset-path');
    const asarRoot = path.join(
      '/opt',
      'GeminiHarness',
      'resources',
      'app.asar',
    );
    const page = offlinePagePath(asarRoot);
    assert.equal(
      page,
      path.join(asarRoot, 'assets', 'offline', 'offline.html'),
    );
    assert.equal(page.includes('app.asar.unpacked'), false);
    assert.notEqual(
      page,
      path.join(
        unpackAsarRoot(asarRoot),
        'assets',
        'offline',
        'offline.html',
      ),
    );
  });

  it('probes with HEAD and cancels any response body', async () => {
    let seenMethod;
    let bodyCancelled = false;
    assert.equal(
      await canReachGemini({
        isOnline: () => true,
        fetchImpl: async (_url, init) => {
          seenMethod = init.method;
          return {
            ok: true,
            status: 200,
            body: {
              cancel() {
                bodyCancelled = true;
              },
            },
          };
        },
      }),
      true,
    );
    assert.equal(seenMethod, 'HEAD');
    assert.equal(bodyCancelled, true);
  });

  it('canReachGemini respects offline and fetch failures', async () => {
    assert.equal(
      await canReachGemini({
        isOnline: () => false,
        fetchImpl: async () => ({ ok: true, status: 200 }),
      }),
      false,
    );
    assert.equal(
      await canReachGemini({
        isOnline: () => true,
        fetchImpl: async () => {
          throw new Error('network down');
        },
      }),
      false,
    );
    assert.equal(
      await canReachGemini({
        isOnline: () => true,
        fetchImpl: async () => ({ ok: true, status: 200 }),
      }),
      true,
    );
  });

  it('matches only the exact packaged offline page path', () => {
    const appRoot = '/opt/GeminiHarness';
    const exact = pathToFileURL(
      path.join(appRoot, 'assets', 'offline', 'offline.html'),
    ).href;
    assert.equal(isHarnessOfflinePage(exact, appRoot), true);
    assert.equal(
      isHarnessOfflinePage(
        'file:///tmp/evil/assets/offline/offline.html',
        appRoot,
      ),
      false,
    );
    assert.equal(isHarnessOfflinePage('file:///tmp/other.html', appRoot), false);
    assert.equal(isHarnessOfflinePage('https://gemini.google.com/', appRoot), false);
  });
});
