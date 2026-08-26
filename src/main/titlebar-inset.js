function overlayInsetCssPx(overlayHeight, zoomFactor) {
  const zoom = Number(zoomFactor);
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return overlayHeight / factor;
}

function buildTitleBarInsetCss({ overlayHeight, zoomFactor, color }) {
  const px = overlayInsetCssPx(overlayHeight, zoomFactor);
  // Transform body — not html. Angular CDK BlockScrollStrategy locks scroll by
  // setting position:fixed and top: -getBoundingClientRect().top on <html>.
  // A translateY on html makes that rect.top equal the inset, so CDK writes
  // style.top to +inset and stacks with our transform (double gap under WCO
  // whenever a Material dialog opens). Body transform still shifts Gemini's
  // position:fixed chrome below the overlay without poisoning that measurement.
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
/* Native WCO drag is covered by page content; recreate a strip in the gap.
   html is not transformed, so top:0 is the viewport (under the overlay). */
html::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: env(titlebar-area-width, calc(100% - 148px));
  height: ${px}px;
  -webkit-app-region: drag;
  app-region: drag;
}
`;
}

module.exports = {
  overlayInsetCssPx,
  buildTitleBarInsetCss,
};
