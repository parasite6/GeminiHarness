const path = require('node:path');

/**
 * Map an app.asar path to app.asar.unpacked so StatusNotifierItem can read
 * tray PNGs from disk (they cannot load from inside the archive).
 */
function unpackAsarRoot(root) {
  const asarMarker = `${path.sep}app.asar`;
  const asarIndex = root.indexOf(asarMarker);
  if (asarIndex === -1) {
    return root;
  }
  const after = root.slice(asarIndex + asarMarker.length);
  if (after !== '' && !after.startsWith(path.sep)) {
    // e.g. ".../app.asar.unpacked/..." — already unpacked or different suffix
    return root;
  }
  return `${root.slice(0, asarIndex)}${path.sep}app.asar.unpacked${after}`;
}

function resolveAppRoot(fromDir = path.join(__dirname, '..', '..')) {
  return unpackAsarRoot(fromDir);
}

module.exports = {
  unpackAsarRoot,
  resolveAppRoot,
};
