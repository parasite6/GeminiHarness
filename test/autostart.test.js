const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DESKTOP_FILENAME,
  HIDDEN_FLAG,
  autostartDesktopPath,
  isAutostartEnabled,
  buildDesktopEntry,
  buildExecLine,
  enableAutostart,
  disableAutostart,
  wantsHiddenLaunch,
} = require('../src/main/autostart');

describe('autostart (XDG .desktop)', () => {
  let tmpHome;
  let env;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'geminiharness-autostart-'));
    env = { XDG_CONFIG_HOME: path.join(tmpHome, 'config') };
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('resolves the desktop path under XDG_CONFIG_HOME/autostart', () => {
    assert.equal(
      autostartDesktopPath({ env }),
      path.join(env.XDG_CONFIG_HOME, 'autostart', DESKTOP_FILENAME),
    );
  });

  it('reports disabled when the desktop file is missing', () => {
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('buildExecLine quotes spaces and always ends with --hidden', () => {
    const line = buildExecLine({
      execPath: '/opt/My Apps/GeminiHarness',
      appPath: '/home/dev/GeminiHarness',
      isPackaged: true,
      extraArgs: ['--ozone-platform=x11'],
    });
    assert.equal(
      line,
      '"/opt/My Apps/GeminiHarness" --ozone-platform=x11 --hidden',
    );
    assert.ok(line.endsWith(HIDDEN_FLAG));
  });

  it('buildExecLine includes the app path when unpackaged', () => {
    const line = buildExecLine({
      execPath: '/usr/bin/electron',
      appPath: '/home/dev/GeminiHarness',
      isPackaged: false,
      extraArgs: ['--ozone-platform=x11'],
    });
    assert.equal(
      line,
      '/usr/bin/electron /home/dev/GeminiHarness --ozone-platform=x11 --hidden',
    );
  });

  it('buildDesktopEntry is a standard XDG Application entry', () => {
    const text = buildDesktopEntry({
      name: 'GeminiHarness',
      exec: '/opt/GeminiHarness/geminiharness --ozone-platform=x11 --hidden',
    });
    assert.match(text, /^\[Desktop Entry\]\n/);
    assert.match(text, /\nType=Application\n/);
    assert.match(text, /\nName=GeminiHarness\n/);
    assert.match(
      text,
      /\nExec=\/opt\/GeminiHarness\/geminiharness --ozone-platform=x11 --hidden\n/,
    );
    assert.match(text, /\nTerminal=false\n/);
    assert.match(text, /\nX-GNOME-Autostart-enabled=true\n/);
  });

  it('enable writes the desktop file; disable removes it', () => {
    const exec =
      '/opt/GeminiHarness/geminiharness --ozone-platform=x11 --hidden';
    enableAutostart({ env, exec });
    const desktop = autostartDesktopPath({ env });
    assert.equal(fs.existsSync(desktop), true);
    assert.equal(isAutostartEnabled({ env }), true);
    const body = fs.readFileSync(desktop, 'utf8');
    assert.match(body, /Exec=\/opt\/GeminiHarness\/geminiharness/);
    assert.match(body, /--hidden/);

    disableAutostart({ env });
    assert.equal(fs.existsSync(desktop), false);
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('disable is a no-op when the file is already gone', () => {
    assert.doesNotThrow(() => disableAutostart({ env }));
  });

  it('wantsHiddenLaunch follows --hidden on argv', () => {
    assert.equal(wantsHiddenLaunch(['node', 'app', '--hidden']), true);
    assert.equal(wantsHiddenLaunch(['node', 'app']), false);
  });
});
