const TITLEBAR_RELOAD_BUTTON_ID = 'geminiharness-titlebar-reload';
const TITLEBAR_RELOAD_CHANNEL = 'geminiharness:reload';
const { parseHttpUrl, isGoogleAuthHost } = require('./navigation');

function shouldHonorTitleBarReloadIpc({ isMainFrame } = {}) {
  return isMainFrame === true;
}

function isTitleBarReloadAuthUrl(url) {
  const parsed = parseHttpUrl(url);
  return Boolean(parsed && isGoogleAuthHost(parsed.hostname));
}

function overlayInsetCssPx(overlayHeight, zoomFactor) {
  const zoom = Number(zoomFactor);
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return overlayHeight / factor;
}

function reloadIconDataUri() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e3e3e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3.2-6.8"/><polyline points="21 3 21 9 15 9"/></svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildTitleBarInsetCss({ overlayHeight, zoomFactor, color }) {
  const px = overlayInsetCssPx(overlayHeight, zoomFactor);
  const iconPx = Math.max(12, Math.round((px * 16) / 36));
  // Transform body — not html. Angular CDK BlockScrollStrategy locks scroll by
  // setting position:fixed and top: -getBoundingClientRect().top on <html>.
  // A translateY on html makes that rect.top equal the inset, so CDK writes
  // style.top to +inset and stacks with our transform (double gap under WCO
  // whenever a Material dialog opens). Body transform still shifts Gemini's
  // position:fixed chrome below the overlay without poisoning that measurement.
  // The reload control is an html child (not under body), so it stays in the
  // overlay strip when CDK scroll-locks html.
  return `
html {
  height: 100%;
  background-color: ${color};
}
body {
  transform: translateY(${px}px);
  height: calc(100% - ${px}px) !important;
  background-color: ${color};
}
@keyframes geminiharness-titlebar-breathe {
  from { background-position: 0 0, 0% 0; }
  to { background-position: 0 0, 100% 0; }
}
/* Visual-only strip. pointer-events:none so drag + reload keep working.
   Native WCO is transparent so this CSS paints the bar. Fade lives inside
   the overlay height — no extra slab below the chrome. */
html::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: ${px}px;
  z-index: 1;
  pointer-events: none;
  background-color: ${color};
  background-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      transparent 18%,
      ${color} 100%
    ),
    linear-gradient(
      90deg,
      rgba(30, 90, 196, 0.42) 0%,
      rgba(92, 48, 168, 0.4) 35%,
      rgba(168, 48, 120, 0.38) 50%,
      rgba(92, 48, 168, 0.4) 65%,
      rgba(30, 90, 196, 0.42) 100%
    );
  background-size: 100% 100%, 240% 100%;
  background-repeat: no-repeat;
  animation: geminiharness-titlebar-breathe 16s ease-in-out infinite alternate;
  will-change: background-position;
}
/* Native WCO drag is covered by page content; recreate a strip in the gap.
   html is not transformed, so top:0 is the viewport (under the overlay). */
html::before {
  content: '';
  position: fixed;
  top: 0;
  left: ${px}px;
  z-index: 2;
  width: calc(env(titlebar-area-width, calc(100% - 148px)) - ${px}px);
  height: ${px}px;
  -webkit-app-region: drag;
  app-region: drag;
}
#${TITLEBAR_RELOAD_BUTTON_ID} {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  box-sizing: border-box;
  width: ${px}px;
  height: ${px}px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  appearance: none;
  background-color: transparent;
  background-image: url("${reloadIconDataUri()}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: ${iconPx}px ${iconPx}px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
#${TITLEBAR_RELOAD_BUTTON_ID}:hover {
  background-color: rgba(227, 227, 227, 0.08);
}
`;
}

function buildTitleBarReloadScript() {
  const id = TITLEBAR_RELOAD_BUTTON_ID;
  return `(() => {
    const id = ${JSON.stringify(id)};
    if (document.getElementById(id)) {
      return;
    }
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.setAttribute('aria-label', 'Reload');
    button.title = 'Reload';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const api = window.geminiHarness;
      if (api && typeof api.reload === 'function') {
        window.geminiHarness.reload();
      }
    });
    document.documentElement.appendChild(button);
  })()`;
}

module.exports = {
  overlayInsetCssPx,
  buildTitleBarInsetCss,
  buildTitleBarReloadScript,
  TITLEBAR_RELOAD_BUTTON_ID,
  TITLEBAR_RELOAD_CHANNEL,
  shouldHonorTitleBarReloadIpc,
  isTitleBarReloadAuthUrl,
};
