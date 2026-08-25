const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Electron's app.setLoginItemSettings() is macOS/Windows-only (no-op on
// Linux in Electron 43). Autostart here is a standard XDG .desktop file.

const DESKTOP_FILENAME = 'GeminiHarness.desktop';
const HIDDEN_FLAG = '--hidden';
const DEFAULT_EXTRA_ARGS = ['--ozone-platform=x11'];

function autostartDir({ env = process.env, homedir = os.homedir } = {}) {
  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0
      ? env.XDG_CONFIG_HOME
      : path.join(homedir(), '.config');
  return path.join(configHome, 'autostart');
}

function autostartDesktopPath(options = {}) {
  return path.join(autostartDir(options), DESKTOP_FILENAME);
}

function isAutostartEnabled(options = {}) {
  return fs.existsSync(autostartDesktopPath(options));
}

function quoteExecArg(arg) {
  if (/[\s"$`\\]/.test(arg)) {
    return `"${arg.replace(/(["$`\\])/g, '\\$1')}"`;
  }
  return arg;
}

function buildExecLine({
  execPath,
  appPath,
  isPackaged,
  extraArgs = DEFAULT_EXTRA_ARGS,
}) {
  const parts = isPackaged
    ? [execPath, ...extraArgs, HIDDEN_FLAG]
    : [execPath, appPath, ...extraArgs, HIDDEN_FLAG];
  return parts.map(quoteExecArg).join(' ');
}

function buildDesktopEntry({ name, exec }) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    `Name=${name}`,
    `Exec=${exec}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n');
}

function enableAutostart({ env, homedir, exec } = {}) {
  if (typeof exec !== 'string' || exec.length === 0) {
    throw new Error('enableAutostart requires a non-empty Exec line');
  }
  const dir = autostartDir({ env, homedir });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    autostartDesktopPath({ env, homedir }),
    buildDesktopEntry({ name: 'GeminiHarness', exec }),
    'utf8',
  );
}

function disableAutostart(options = {}) {
  const desktop = autostartDesktopPath(options);
  if (fs.existsSync(desktop)) {
    fs.unlinkSync(desktop);
  }
}

function wantsHiddenLaunch(argv = process.argv) {
  return argv.includes(HIDDEN_FLAG);
}

/**
 * Build the Exec line for the current process (packaged binary or electron .).
 * @param {{ isPackaged: boolean, execPath?: string, appPath: string }} opts
 */
function resolveCurrentExecLine({
  isPackaged,
  execPath = process.execPath,
  appPath,
  extraArgs = DEFAULT_EXTRA_ARGS,
}) {
  return buildExecLine({ execPath, appPath, isPackaged, extraArgs });
}

function setAutostartEnabled(enabled, resolveExec) {
  if (enabled) {
    enableAutostart({ exec: resolveExec() });
  } else {
    disableAutostart();
  }
}

module.exports = {
  DESKTOP_FILENAME,
  HIDDEN_FLAG,
  DEFAULT_EXTRA_ARGS,
  autostartDir,
  autostartDesktopPath,
  isAutostartEnabled,
  quoteExecArg,
  buildExecLine,
  buildDesktopEntry,
  enableAutostart,
  disableAutostart,
  wantsHiddenLaunch,
  resolveCurrentExecLine,
  setAutostartEnabled,
};
