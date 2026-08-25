const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { unpackAsarRoot } = require('../src/main/asset-path');

describe('unpackAsarRoot', () => {
  it('rewrites app.asar roots to app.asar.unpacked', () => {
    const packed = path.join('/opt', 'GeminiHarness', 'resources', 'app.asar');
    const expected = path.join(
      '/opt',
      'GeminiHarness',
      'resources',
      'app.asar.unpacked',
    );
    assert.equal(unpackAsarRoot(packed), expected);
  });

  it('rewrites paths nested under app.asar', () => {
    const packed = path.join(
      '/opt',
      'GeminiHarness',
      'resources',
      'app.asar',
      'assets',
      'tray',
    );
    const expected = path.join(
      '/opt',
      'GeminiHarness',
      'resources',
      'app.asar.unpacked',
      'assets',
      'tray',
    );
    assert.equal(unpackAsarRoot(packed), expected);
  });

  it('leaves non-asar paths unchanged', () => {
    const dev = path.join('/home', 'dev', 'GeminiHarness');
    assert.equal(unpackAsarRoot(dev), dev);
  });

  it('does not rewrite app.asar.unpacked again', () => {
    const unpacked = path.join(
      '/opt',
      'GeminiHarness',
      'resources',
      'app.asar.unpacked',
      'assets',
    );
    assert.equal(unpackAsarRoot(unpacked), unpacked);
  });
});
