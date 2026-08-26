const path = require('node:path');
const { fileURLToPath } = require('node:url');

const START_URL = 'https://gemini.google.com';
const OFFLINE_RETRY_MS = 7000;
const REACHABILITY_TIMEOUT_MS = 5000;
const ERR_ABORTED = -3;

const AUTH_CHAIN_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
]);

// Stay inside app.asar when packaged. loadFile/img work from asar; tray
// icons need asarUnpack + resolveAppRoot, but offline assets must not.
function packagedAppRoot(fromDir = path.join(__dirname, '..', '..')) {
  return fromDir;
}

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

function isAuthChainUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      AUTH_CHAIN_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function shouldOfferOfflineGate({ gateActive }) {
  return gateActive === true;
}

function shouldClearOfflineGate({ gateActive, isMainFrame, url }) {
  return (
    gateActive === true &&
    isMainFrame === true &&
    (isGeminiStartUrl(url) || isAuthChainUrl(url))
  );
}

function isIgnorableLoadFailure(errorCode) {
  return Number(errorCode) === ERR_ABORTED;
}

function shouldShowOfflineOnFail({
  gateActive,
  isMainFrame,
  errorCode,
  validatedURL,
}) {
  if (gateActive !== true || isMainFrame !== true) {
    return false;
  }
  if (isIgnorableLoadFailure(errorCode)) {
    return false;
  }
  if (typeof validatedURL === 'string') {
    if (validatedURL.startsWith('file:')) {
      return false;
    }
    if (isAuthChainUrl(validatedURL)) {
      return false;
    }
  }
  return true;
}

function canBeginOfflineAttempt(inFlight) {
  return inFlight !== true;
}

function decideTitleBarReload({
  inFlight,
  gateActive,
  isOfflinePage,
  isAuthHost,
}) {
  if (!canBeginOfflineAttempt(inFlight)) {
    return 'noop';
  }
  if (isAuthHost === true) {
    return 'reload-current';
  }
  if (gateActive === true || isOfflinePage === true) {
    return 'gated-load';
  }
  return 'probe-then-reload';
}

function shouldResumeOfflineRetry({ gateActive }) {
  return gateActive === true;
}

function interpretReachabilityResponse(response) {
  if (!response) {
    return false;
  }
  if (response.ok) {
    return true;
  }
  const status = Number(response.status);
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308 ||
    status === 405
  );
}

function offlinePagePath(appRoot = packagedAppRoot()) {
  return path.join(appRoot, 'assets', 'offline', 'offline.html');
}

function isHarnessOfflinePage(url, appRoot = packagedAppRoot()) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return false;
    }
    const actual = path.resolve(fileURLToPath(parsed));
    const expected = path.resolve(offlinePagePath(appRoot));
    return actual === expected;
  } catch {
    return false;
  }
}

function cancelResponseBody(response) {
  try {
    if (response && response.body && typeof response.body.cancel === 'function') {
      response.body.cancel();
    }
  } catch {
    // Best-effort; status is already available.
  }
}

/**
 * Probe Gemini with Chromium's network stack. HEAD avoids downloading the
 * SPA document; any body is cancelled. AbortSignal bounds the wait.
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
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
    cancelResponseBody(response);
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
  ERR_ABORTED,
  isGeminiStartUrl,
  isAuthChainUrl,
  shouldOfferOfflineGate,
  shouldClearOfflineGate,
  shouldShowOfflineOnFail,
  shouldResumeOfflineRetry,
  canBeginOfflineAttempt,
  decideTitleBarReload,
  interpretReachabilityResponse,
  offlinePagePath,
  isHarnessOfflinePage,
  canReachGemini,
};
