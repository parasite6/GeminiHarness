function overlayInsetCssPx(overlayHeight, zoomFactor) {
  const zoom = Number(zoomFactor);
  const factor = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return overlayHeight / factor;
}

function buildTitleBarInsetCss({ overlayHeight, zoomFactor, color }) {
  const px = overlayInsetCssPx(overlayHeight, zoomFactor);
  return `
html {
  transform: translateY(${px}px);
  height: calc(100% - ${px}px) !important;
}
html, body {
  background-color: ${color};
}
/* Transformed html sits below the overlay, so native WCO drag is gone.
   Re-create a drag strip in the gap; leave the right side for min/max/close. */
html::before {
  content: '';
  position: fixed;
  top: -${px}px;
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
