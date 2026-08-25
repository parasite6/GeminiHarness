const { spawnSync } = require('node:child_process');

const PARENT_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const CUSTOM_SCHEMA =
  'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding';
const HOTKEY_PATH =
  '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/geminiharness/';
const HOTKEY_NAME = 'GeminiHarness';
const HOTKEY_BINDING = '<Super>g';

const BUILTIN_SCHEMAS = ['org.gnome.desktop.wm.keybindings'];

function superGBinding() {
  return HOTKEY_BINDING;
}

function parseGsettingsStringArray(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text === '[]' || text === '@as []') {
    return [];
  }
  const matches = text.match(/'([^']*)'/g);
  if (!matches) {
    return [];
  }
  return matches.map((entry) => entry.slice(1, -1));
}

function formatGsettingsStringArray(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return '@as []';
  }
  return `[${paths.map((path) => `'${path}'`).join(', ')}]`;
}

function appendCustomKeybindingPath(paths, pathToAdd) {
  const list = Array.isArray(paths) ? [...paths] : [];
  if (list.includes(pathToAdd)) {
    return list;
  }
  list.push(pathToAdd);
  return list;
}

function removeCustomKeybindingPath(paths, pathToRemove) {
  return (Array.isArray(paths) ? paths : []).filter(
    (path) => path !== pathToRemove,
  );
}

function normalizeBinding(binding) {
  return String(binding ?? '')
    .trim()
    .replace(/^'|'$/g, '');
}

function bindingsEqual(a, b) {
  const left = normalizeBinding(a).toLowerCase();
  const right = normalizeBinding(b).toLowerCase();
  return left.length > 0 && left === right;
}

function bindingListContains(rawList, binding) {
  const values = parseGsettingsStringArray(rawList);
  if (values.length === 0) {
    // Single string values from gsettings look like '<Super>g'
    return bindingsEqual(rawList, binding);
  }
  return values.some((value) => bindingsEqual(value, binding));
}

function findBindingCollision({
  entries = [],
  binding,
  ownPath,
  builtinBindingValues = [],
} = {}) {
  for (const entry of entries) {
    if (!entry || entry.path === ownPath) {
      continue;
    }
    if (bindingsEqual(entry.binding, binding)) {
      return entry.name || entry.path || 'another shortcut';
    }
  }
  for (const raw of builtinBindingValues) {
    if (bindingListContains(raw, binding)) {
      return 'a built-in GNOME shortcut';
    }
  }
  return null;
}

function isHotkeyEnabledFromPaths(paths) {
  return (Array.isArray(paths) ? paths : []).includes(HOTKEY_PATH);
}

function defaultRunGsettings(args) {
  const result = spawnSync('gsettings', args, {
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      detail || `gsettings ${args.join(' ')} failed with status ${result.status}`,
    );
  }
  return String(result.stdout || '').trim();
}

function customSchemaFor(path) {
  return `${CUSTOM_SCHEMA}:${path}`;
}

function quoteGsettingsString(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function readParentPaths(runGsettings) {
  return parseGsettingsStringArray(
    runGsettings(['get', PARENT_SCHEMA, 'custom-keybindings']),
  );
}

function writeParentPaths(paths, runGsettings) {
  runGsettings([
    'set',
    PARENT_SCHEMA,
    'custom-keybindings',
    formatGsettingsStringArray(paths),
  ]);
}

function readCustomEntry(path, runGsettings) {
  const schema = customSchemaFor(path);
  return {
    path,
    name: normalizeBinding(runGsettings(['get', schema, 'name'])),
    binding: normalizeBinding(runGsettings(['get', schema, 'binding'])),
    command: normalizeBinding(runGsettings(['get', schema, 'command'])),
  };
}

function listBuiltinBindingValues(runGsettings) {
  const values = [];
  for (const schema of BUILTIN_SCHEMAS) {
    let keys = '';
    try {
      keys = runGsettings(['list-keys', schema]);
    } catch {
      continue;
    }
    for (const key of String(keys)
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)) {
      try {
        values.push(runGsettings(['get', schema, key]));
      } catch {
        // Skip unreadable keys.
      }
    }
  }
  return values;
}

function collectCustomEntries(paths, runGsettings) {
  const entries = [];
  for (const path of paths) {
    try {
      entries.push(readCustomEntry(path, runGsettings));
    } catch {
      // Skip broken/missing relocatable paths.
    }
  }
  return entries;
}

function assertNoCollision(runGsettings) {
  const paths = readParentPaths(runGsettings);
  const collision = findBindingCollision({
    entries: collectCustomEntries(paths, runGsettings),
    binding: HOTKEY_BINDING,
    ownPath: HOTKEY_PATH,
    builtinBindingValues: listBuiltinBindingValues(runGsettings),
  });
  if (collision) {
    throw new Error(
      `Super+G is already in use by ${collision}. Enable was cancelled.`,
    );
  }
}

function writeHotkeyKeys(command, runGsettings) {
  const schema = customSchemaFor(HOTKEY_PATH);
  runGsettings(['set', schema, 'name', quoteGsettingsString(HOTKEY_NAME)]);
  runGsettings(['set', schema, 'command', quoteGsettingsString(command)]);
  runGsettings([
    'set',
    schema,
    'binding',
    quoteGsettingsString(HOTKEY_BINDING),
  ]);
}

function resetHotkeyKeys(runGsettings) {
  const schema = customSchemaFor(HOTKEY_PATH);
  for (const key of ['name', 'command', 'binding']) {
    try {
      runGsettings(['reset', schema, key]);
    } catch {
      // Best-effort cleanup.
    }
  }
}

function verifyBinding(runGsettings) {
  const stored = normalizeBinding(
    runGsettings(['get', customSchemaFor(HOTKEY_PATH), 'binding']),
  );
  if (!bindingsEqual(stored, HOTKEY_BINDING)) {
    throw new Error(
      `Hotkey binding verification failed (got ${stored || '(empty)'}, expected ${HOTKEY_BINDING})`,
    );
  }
}

function isHotkeyEnabled({ runGsettings = defaultRunGsettings } = {}) {
  return isHotkeyEnabledFromPaths(readParentPaths(runGsettings));
}

function enableHotkey({
  command,
  runGsettings = defaultRunGsettings,
} = {}) {
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error('enableHotkey requires a non-empty command');
  }

  assertNoCollision(runGsettings);

  const previous = readParentPaths(runGsettings);
  writeHotkeyKeys(command, runGsettings);
  const next = appendCustomKeybindingPath(previous, HOTKEY_PATH);
  writeParentPaths(next, runGsettings);

  try {
    verifyBinding(runGsettings);
  } catch (error) {
    writeParentPaths(previous, runGsettings);
    resetHotkeyKeys(runGsettings);
    throw error;
  }
}

function disableHotkey({ runGsettings = defaultRunGsettings } = {}) {
  const previous = readParentPaths(runGsettings);
  const next = removeCustomKeybindingPath(previous, HOTKEY_PATH);
  writeParentPaths(next, runGsettings);
  resetHotkeyKeys(runGsettings);
}

function setHotkeyEnabled(enabled, resolveCommand, options = {}) {
  if (enabled) {
    enableHotkey({ ...options, command: resolveCommand() });
  } else {
    disableHotkey(options);
  }
}

module.exports = {
  PARENT_SCHEMA,
  CUSTOM_SCHEMA,
  HOTKEY_PATH,
  HOTKEY_NAME,
  HOTKEY_BINDING,
  superGBinding,
  parseGsettingsStringArray,
  formatGsettingsStringArray,
  appendCustomKeybindingPath,
  removeCustomKeybindingPath,
  bindingsEqual,
  findBindingCollision,
  isHotkeyEnabledFromPaths,
  isHotkeyEnabled,
  enableHotkey,
  disableHotkey,
  setHotkeyEnabled,
};
