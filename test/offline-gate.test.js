const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  OFFLINE_RETRY_MS,
  isGeminiStartUrl,
  shouldOfferOfflineGate,
  shouldClearOfflineGate,
  interpretReachabilityResponse,
  offlinePagePath,
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

  it('clears the gate once Gemini has loaded in the main frame', () => {
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

  it('recognizes the local offline page file URL', () => {
    const { isHarnessOfflinePage } = require('../src/main/offline-gate');
    assert.equal(
      isHarnessOfflinePage(
        'file:///opt/GeminiHarness/assets/offline/offline.html',
      ),
      true,
    );
    assert.equal(isHarnessOfflinePage('file:///tmp/other.html'), false);
    assert.equal(isHarnessOfflinePage('https://gemini.google.com/'), false);
  });
});
