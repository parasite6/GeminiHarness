const path = require('node:path');
const { resolveAppRoot } = require('./asset-path');

const START_URL = 'https://gemini.google.com';
const OFFLINE_RETRY_MS = 7000;
const REACHABILITY_TIMEOUT_MS = 5000;

function isGeminiStartUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname === 'gemini.google.com'
    );
  } catch {
    return false;
  }
}

function shouldOfferOfflineGate({ gateActive }) {
  return gateActive === true;
}

function shouldClearOfflineGate({ gateActive, isMainFrame, url }) {
  return gateActive === true && isMainFrame === true && isGeminiStartUrl(url);
}

function interpretReachabilityResponse(response) {
  if (!response) {
    return false;
  }
  if (response.ok) {
    return true;
  }
  const status = Number(response.status);
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308 || status === 405;
}

function offlinePagePath(appRoot = resolveAppRoot()) {
  return path.join(appRoot, 'assets', 'offline', 'offline.html');
}

function isHarnessOfflinePage(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return false;
    }
    const normalized = decodeURIComponent(parsed.pathname).replace(/\\/g, '/');
    return normalized.endsWith('/assets/offline/offline.html');
  } catch {
    return false;
  }
}

/**
 * Probe Gemini with Chromium's network stack. Does not read response bodies
 * beyond status — AbortSignal bounds the wait.
 */
async function canReachGemini({
  fetchImpl,
  isOnline = () => true,
  url = START_URL,
  timeoutMs = REACHABILITY_TIMEOUT_MS,
} = {}) {
  if (typeof isOnline === 'function' && !isOnline()) {
    return false;
  }
  if (typeof fetchImpl !== 'function') {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    return interpretReachabilityResponse(response);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  START_URL,
  OFFLINE_RETRY_MS,
  REACHABILITY_TIMEOUT_MS,
  isGeminiStartUrl,
  shouldOfferOfflineGate,
  shouldClearOfflineGate,
  interpretReachabilityResponse,
  offlinePagePath,
  isHarnessOfflinePage,
  canReachGemini,
};
