const GEMINI_HOST = 'gemini.google.com';
const AUTH_HOSTS = new Set([
  'accounts.google.com',
  // Post-auth SID sync after 2FA (CheckCookie → SetSID); not a Sources link.
  'accounts.youtube.com',
]);

function parseHttpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isGeminiHost(hostname) {
  return hostname === GEMINI_HOST;
}

function isGoogleAuthHost(hostname) {
  return AUTH_HOSTS.has(hostname);
}

function shouldStayInApp(url) {
  const parsed = parseHttpUrl(url);
  if (!parsed) {
    return false;
  }
  return isGeminiHost(parsed.hostname) || isGoogleAuthHost(parsed.hostname);
}

function canOpenExternally(url) {
  return parseHttpUrl(url) !== null;
}

function defaultOpenExternal(url) {
  const { shell } = require('electron');
  return shell.openExternal(url);
}

function openExternalSafe(url, openExternal = defaultOpenExternal) {
  if (!canOpenExternally(url)) {
    return false;
  }
  openExternal(url);
  return true;
}

function targetUrlFromNavEvent(event, url) {
  return typeof url === 'string' ? url : event.url;
}

function handleTopLevelNavigation(event, url, openExternal) {
  if (event.isMainFrame === false) {
    return;
  }

  const targetUrl = targetUrlFromNavEvent(event, url);
  if (shouldStayInApp(targetUrl)) {
    return;
  }

  event.preventDefault();
  openExternalSafe(targetUrl, openExternal);
}

function attachNavigationHandlers(contents, options = {}) {
  const openExternal = options.openExternal || defaultOpenExternal;

  contents.setWindowOpenHandler(({ url }) => {
    if (shouldStayInApp(url)) {
      contents.loadURL(url);
    } else {
      openExternalSafe(url, openExternal);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    handleTopLevelNavigation(event, url, openExternal);
  });

  contents.on('will-redirect', (event, url) => {
    handleTopLevelNavigation(event, url, openExternal);
  });
}

module.exports = {
  parseHttpUrl,
  isGeminiHost,
  isGoogleAuthHost,
  shouldStayInApp,
  canOpenExternally,
  openExternalSafe,
  attachNavigationHandlers,
};
