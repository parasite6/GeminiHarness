const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

describe('linux packaging desktop entry', () => {
  it('ships a scalable SVG icon under build/ for electron-builder', () => {
    const iconPath = path.join(root, 'build', 'icon.svg');
    assert.equal(fs.existsSync(iconPath), true);
    const body = fs.readFileSync(iconPath, 'utf8');
    assert.match(body, /<svg[\s>]/);
    assert.equal(
      body,
      fs.readFileSync(path.join(root, 'gemini-logo.svg'), 'utf8'),
    );
  });

  it('configures geminiharness.desktop naming and hicolor Icon base name', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    assert.equal(pkg.name, 'geminiharness');
    assert.equal(pkg.productName, 'GeminiHarness');

    const yml = fs.readFileSync(
      path.join(root, 'electron-builder.yml'),
      'utf8',
    );
    assert.match(yml, /^appId:\s*app\.geminiharness$/m);
    assert.match(yml, /^productName:\s*GeminiHarness$/m);
    assert.match(yml, /^\s+executableName:\s*geminiharness$/m);
    assert.match(yml, /^\s+icon:\s*build\/icon\.svg$/m);
    assert.match(yml, /^\s+syncDesktopName:\s*true$/m);
    assert.match(yml, /^\s+category:\s*Network$/m);
    assert.equal(pkg.desktopName, 'geminiharness.desktop');
    assert.match(yml, /^\s+Name:\s*GeminiHarness$/m);
    assert.match(yml, /^\s+Icon:\s*geminiharness$/m);
    assert.match(yml, /^\s+Categories:\s*Network;$/m);
    assert.match(yml, /^\s+Comment:.*gemini\.google\.com/m);
    assert.match(yml, /^\s+StartupWMClass:\s*GeminiHarness$/m);
  });

  it('ships AppStream metainfo for GNOME Software', () => {
    const { spawnSync } = require('node:child_process');
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const file = path.join(
      root,
      'io.github.parasite6.geminiharness.metainfo.xml',
    );
    assert.equal(fs.existsSync(file), true);
    const body = fs.readFileSync(file, 'utf8');
    assert.match(body, /<component type="desktop-application">/);
    assert.match(
      body,
      /<id>io\.github\.parasite6\.geminiharness<\/id>/,
    );
    assert.match(
      body,
      /<launchable type="desktop-id">geminiharness\.desktop<\/launchable>/,
    );
    assert.match(body, /<metadata_license>CC0-1\.0<\/metadata_license>/);
    assert.match(body, /<project_license>MIT<\/project_license>/);
    assert.match(
      body,
      new RegExp(`<release version="${pkg.version}"`),
    );

    const cli = spawnSync(
      'appstreamcli',
      ['validate', '--pedantic', file],
      { encoding: 'utf8' },
    );
    if (cli.error && cli.error.code === 'ENOENT') {
      return;
    }
    assert.equal(cli.status, 0, `${cli.stdout}${cli.stderr}`);
  });
});
