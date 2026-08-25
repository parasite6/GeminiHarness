const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  HOTKEY_BINDING,
  HOTKEY_NAME,
  HOTKEY_PATH,
  parseGsettingsStringArray,
  formatGsettingsStringArray,
  appendCustomKeybindingPath,
  removeCustomKeybindingPath,
  bindingsEqual,
  findBindingCollision,
  superGBinding,
  isHotkeyEnabledFromPaths,
} = require('../src/main/hotkey');
const { buildExecLine } = require('../src/main/autostart');

describe('hotkey binding helpers', () => {
  it('uses Super+G as the default binding string', () => {
    assert.equal(superGBinding(), '<Super>g');
    assert.equal(HOTKEY_BINDING, '<Super>g');
    assert.equal(HOTKEY_NAME, 'GeminiHarness');
    assert.equal(
      HOTKEY_PATH,
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/geminiharness/',
    );
  });

  it('parses and formats gsettings string arrays', () => {
    const paths = parseGsettingsStringArray(
      "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/', '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/']",
    );
    assert.deepEqual(paths, [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
    ]);
    assert.equal(
      formatGsettingsStringArray(paths),
      "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/', '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/']",
    );
    assert.deepEqual(parseGsettingsStringArray('@as []'), []);
    assert.deepEqual(parseGsettingsStringArray('[]'), []);
  });

  it('appends the named path without clobbering existing entries', () => {
    const existing = [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
    ];
    const next = appendCustomKeybindingPath(existing, HOTKEY_PATH);
    assert.deepEqual(next, [...existing, HOTKEY_PATH]);
    assert.deepEqual(
      appendCustomKeybindingPath(next, HOTKEY_PATH),
      next,
    );
  });

  it('removes only the geminiharness path', () => {
    const paths = [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      HOTKEY_PATH,
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
    ];
    assert.deepEqual(removeCustomKeybindingPath(paths, HOTKEY_PATH), [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
    ]);
  });

  it('treats Super+g bindings as equal regardless of letter case', () => {
    assert.equal(bindingsEqual('<Super>g', '<Super>g'), true);
    assert.equal(bindingsEqual('<Super>g', '<Super>G'), true);
    assert.equal(bindingsEqual('<Super>g', '<Shift><Super>s'), false);
  });

  it('detects Super+G collisions in custom bindings', () => {
    const collision = findBindingCollision({
      entries: [
        {
          path: '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
          name: 'OST Copier',
          binding: '<Shift><Super>s',
        },
        {
          path: '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
          name: 'Other',
          binding: '<Super>g',
        },
      ],
      binding: HOTKEY_BINDING,
      ownPath: HOTKEY_PATH,
    });
    assert.equal(collision, 'Other');

    assert.equal(
      findBindingCollision({
        entries: [
          {
            path: '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
            name: 'OST Copier',
            binding: '<Shift><Super>s',
          },
          {
            path: HOTKEY_PATH,
            name: HOTKEY_NAME,
            binding: '<Super>g',
          },
        ],
        binding: HOTKEY_BINDING,
        ownPath: HOTKEY_PATH,
      }),
      null,
    );
  });

  it('detects Super+G in built-in binding value lists', () => {
    const collision = findBindingCollision({
      entries: [],
      binding: HOTKEY_BINDING,
      ownPath: HOTKEY_PATH,
      builtinBindingValues: ["['<Super>g']", "['<Alt>F2']"],
    });
    assert.equal(collision, 'a built-in GNOME shortcut');
  });

  it('reports enabled when the named path is in the parent array', () => {
    assert.equal(
      isHotkeyEnabledFromPaths([
        '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
        HOTKEY_PATH,
      ]),
      true,
    );
    assert.equal(
      isHotkeyEnabledFromPaths([
        '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      ]),
      false,
    );
  });
});

describe('hotkey enable/disable via mocked gsettings', () => {
  it('enables with RMW parent array and verifies binding', () => {
    const {
      enableHotkey,
      disableHotkey,
      isHotkeyEnabled,
    } = require('../src/main/hotkey');

    const store = {
      parent:
        "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/', '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/']",
      keys: {},
      builtins: {
        'org.gnome.desktop.wm.keybindings': {
          'switch-applications': "['<Super>Tab']",
        },
      },
    };

    function runGsettings(args) {
      if (args[0] === 'get' && args[1] === 'org.gnome.settings-daemon.plugins.media-keys' && args[2] === 'custom-keybindings') {
        return store.parent;
      }
      if (args[0] === 'set' && args[1] === 'org.gnome.settings-daemon.plugins.media-keys' && args[2] === 'custom-keybindings') {
        store.parent = args[3];
        return '';
      }
      const schemaPath = args[1];
      if (schemaPath.startsWith('org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:')) {
        const path = schemaPath.split(':')[1];
        const key = args[2];
        if (args[0] === 'set') {
          store.keys[path] = store.keys[path] || {};
          store.keys[path][key] = args[3].replace(/^'|'$/g, '');
          return '';
        }
        if (args[0] === 'get') {
          return `'${store.keys[path]?.[key] ?? ''}'`;
        }
        if (args[0] === 'reset') {
          if (store.keys[path]) {
            delete store.keys[path][key];
          }
          return '';
        }
      }
      if (args[0] === 'list-keys' && store.builtins[args[1]]) {
        return Object.keys(store.builtins[args[1]]).join('\n');
      }
      if (args[0] === 'get' && store.builtins[args[1]]) {
        return store.builtins[args[1]][args[2]] || '@as []';
      }
      throw new Error(`unexpected gsettings ${args.join(' ')}`);
    }

    enableHotkey({
      command: '/opt/GeminiHarness/geminiharness --ozone-platform=x11',
      runGsettings: runGsettings,
    });

    const paths = parseGsettingsStringArray(store.parent);
    assert.deepEqual(paths, [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
      HOTKEY_PATH,
    ]);
    assert.equal(store.keys[HOTKEY_PATH].name, HOTKEY_NAME);
    assert.equal(store.keys[HOTKEY_PATH].binding, HOTKEY_BINDING);
    assert.equal(
      store.keys[HOTKEY_PATH].command,
      '/opt/GeminiHarness/geminiharness --ozone-platform=x11',
    );
    assert.equal(isHotkeyEnabled({ runGsettings }), true);

    disableHotkey({ runGsettings });
    assert.deepEqual(parseGsettingsStringArray(store.parent), [
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/',
      '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom1/',
    ]);
    assert.equal(isHotkeyEnabled({ runGsettings }), false);
  });

  it('refuses to enable when Super+G is already taken', () => {
    const { enableHotkey } = require('../src/main/hotkey');
    const store = {
      parent:
        "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/']",
      keys: {
        '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/': {
          name: 'Taken',
          binding: '<Super>g',
          command: 'echo hi',
        },
      },
    };

    function runGsettings(args) {
      if (args[0] === 'get' && args[2] === 'custom-keybindings') {
        return store.parent;
      }
      if (
        args[0] === 'get' &&
        args[1].includes('custom-keybinding:')
      ) {
        const path = args[1].split(':')[1];
        return `'${store.keys[path]?.[args[2]] ?? ''}'`;
      }
      if (args[0] === 'list-keys') {
        return '';
      }
      throw new Error(`unexpected ${args.join(' ')}`);
    }

    assert.throws(
      () =>
        enableHotkey({
          command: '/opt/GeminiHarness/geminiharness',
          runGsettings,
        }),
      /Taken|already|collision|in use/i,
    );
  });
});

describe('hotkey launch command', () => {
  it('builds an Exec line without --hidden', () => {
    const line = buildExecLine({
      execPath: '/opt/GeminiHarness/geminiharness',
      appPath: '/tmp/app',
      isPackaged: true,
      includeHidden: false,
    });
    assert.match(line, /--ozone-platform=x11/);
    assert.equal(line.includes('--hidden'), false);
  });
});
