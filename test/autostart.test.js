const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DESKTOP_FILENAME,
  HIDDEN_FLAG,
  autostartDir,
  autostartDesktopPath,
  isAutostartEnabled,
  parseAutostartDesktopEnabled,
  buildDesktopEntry,
  buildExecLine,
  enableAutostart,
  disableAutostart,
  wantsHiddenLaunch,
  resolveCurrentExecLine,
  setAutostartEnabled,
  shouldWatchAutostartFilename,
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

  it('falls back to ~/.config/autostart when XDG_CONFIG_HOME is unset', () => {
    const homedir = () => '/home/tester';
    assert.equal(
      autostartDir({ env: {}, homedir }),
      path.join('/home/tester', '.config', 'autostart'),
    );
    assert.equal(
      autostartDesktopPath({ env: { XDG_CONFIG_HOME: '' }, homedir }),
      path.join('/home/tester', '.config', 'autostart', DESKTOP_FILENAME),
    );
  });

  it('reports disabled when the desktop file is missing', () => {
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('reports disabled when GNOME sets Hidden=true without deleting the file', () => {
    const desktop = autostartDesktopPath({ env });
    fs.mkdirSync(path.dirname(desktop), { recursive: true });
    fs.writeFileSync(
      desktop,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=GeminiHarness',
        'Exec=/opt/GeminiHarness/geminiharness --hidden',
        'Hidden=true',
        'X-GNOME-Autostart-enabled=true',
        '',
      ].join('\n'),
    );
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('reports disabled when X-GNOME-Autostart-enabled=false', () => {
    const desktop = autostartDesktopPath({ env });
    fs.mkdirSync(path.dirname(desktop), { recursive: true });
    fs.writeFileSync(
      desktop,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=GeminiHarness',
        'Exec=/opt/GeminiHarness/geminiharness --hidden',
        'X-GNOME-Autostart-enabled=false',
        '',
      ].join('\n'),
    );
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('reports enabled for a normal autostart entry', () => {
    const text = buildDesktopEntry({
      name: 'GeminiHarness',
      exec: '/opt/GeminiHarness/geminiharness --hidden',
    });
    assert.equal(parseAutostartDesktopEnabled(text), true);
    enableAutostart({
      env,
      exec: '/opt/GeminiHarness/geminiharness --hidden',
    });
    assert.equal(isAutostartEnabled({ env }), true);
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

  it('resolveCurrentExecLine matches packaged vs unpackaged Exec lines', () => {
    assert.equal(
      resolveCurrentExecLine({
        isPackaged: true,
        execPath: '/opt/GeminiHarness/geminiharness',
        appPath: '/opt/GeminiHarness/resources/app.asar',
      }),
      '/opt/GeminiHarness/geminiharness --ozone-platform=x11 --hidden',
    );
    assert.equal(
      resolveCurrentExecLine({
        isPackaged: false,
        execPath: '/usr/bin/electron',
        appPath: '/home/dev/GeminiHarness',
      }),
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
    assert.match(text, /\nHidden=false\n/);
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

  it('setAutostartEnabled writes and removes the entry', () => {
    const exec =
      '/opt/GeminiHarness/geminiharness --ozone-platform=x11 --hidden';
    setAutostartEnabled(true, () => exec, { env });
    assert.equal(isAutostartEnabled({ env }), true);
    setAutostartEnabled(false, () => exec, { env });
    assert.equal(isAutostartEnabled({ env }), false);
  });

  it('disable is a no-op when the file is already gone', () => {
    assert.doesNotThrow(() => disableAutostart({ env }));
  });

  it('wantsHiddenLaunch follows --hidden on argv', () => {
    assert.equal(wantsHiddenLaunch(['node', 'app', '--hidden']), true);
    assert.equal(wantsHiddenLaunch(['node', 'app']), false);
    assert.equal(
      wantsHiddenLaunch(['geminiharness', '--ozone-platform=x11', '--hidden']),
      true,
    );
  });

  it('shouldWatchAutostartFilename ignores unrelated files', () => {
    assert.equal(shouldWatchAutostartFilename(DESKTOP_FILENAME), true);
    assert.equal(shouldWatchAutostartFilename(null), true);
    assert.equal(shouldWatchAutostartFilename('other.desktop'), false);
  });
});
