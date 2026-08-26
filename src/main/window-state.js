const fs = require('node:fs');
const path = require('node:path');

const STATE_FILENAME = 'window-state.json';
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 750;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 500;
const MIN_VISIBLE_WIDTH = 100;
const MIN_VISIBLE_HEIGHT = 50;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;

function defaultState() {
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    isMaximized: false,
    zoomFactor: 1,
    alwaysOnTop: false,
  };
}

function stateFilePath(userData) {
  return path.join(userData, STATE_FILENAME);
}

function toInt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value);
}

function clamp(value, min, max) {
  if (max < min) {
    return max;
  }
  return Math.min(Math.max(value, min), max);
}

function sanitizeState(raw) {
  const defaults = defaultState();
  const source = raw && typeof raw === 'object' ? raw : {};

  const width = toInt(source.width);
  const height = toInt(source.height);
  const x = toInt(source.x);
  const y = toInt(source.y);

  let zoomFactor = 1;
  if (typeof source.zoomFactor === 'number' && Number.isFinite(source.zoomFactor)) {
    zoomFactor = clamp(source.zoomFactor, MIN_ZOOM, MAX_ZOOM);
  }

  const state = {
    width: width === null ? defaults.width : Math.max(width, MIN_WIDTH),
    height: height === null ? defaults.height : Math.max(height, MIN_HEIGHT),
    isMaximized: source.isMaximized === true,
    zoomFactor,
    alwaysOnTop: source.alwaysOnTop === true,
  };

  if (x !== null && y !== null) {
    state.x = x;
    state.y = y;
  }

  return state;
}

function rectIntersection(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: left, y: top, width, height };
}

function displayWorkArea(display) {
  return display.workArea || display.bounds;
}

function isReachable(bounds, displays) {
  if (!displays || displays.length === 0) {
    return false;
  }
  return displays.some((display) => {
    const area = displayWorkArea(display);
    if (!area) {
      return false;
    }
    const hit = rectIntersection(bounds, area);
    return (
      hit !== null &&
      hit.width >= MIN_VISIBLE_WIDTH &&
      hit.height >= MIN_VISIBLE_HEIGHT
    );
  });
}

function primaryDisplay(displays) {
  return displays.find((display) => display.primary) || displays[0];
}

function withoutPosition(state) {
  const next = { ...state };
  delete next.x;
  delete next.y;
  return next;
}

function clampSizeToWorkArea(state, workArea) {
  const maxWidth = workArea.width;
  const maxHeight = workArea.height;
  return {
    ...state,
    width: clamp(state.width, MIN_WIDTH, maxWidth),
    height: clamp(state.height, MIN_HEIGHT, maxHeight),
  };
}

function clampBoundsToDisplays(raw, displays) {
  const state = sanitizeState(raw);
  if (!displays || displays.length === 0) {
    return withoutPosition(state);
  }

  const primary = primaryDisplay(displays);
  const workArea = displayWorkArea(primary);
  const sized = clampSizeToWorkArea(state, workArea);

  const hasPosition = Number.isInteger(sized.x) && Number.isInteger(sized.y);
  if (!hasPosition) {
    return withoutPosition(sized);
  }

  const windowRect = {
    x: sized.x,
    y: sized.y,
    width: sized.width,
    height: sized.height,
  };

  if (isReachable(windowRect, displays)) {
    return sized;
  }

  return withoutPosition(sized);
}

function load(filePath, displays, fsModule = fs) {
  try {
    const raw = fsModule.readFileSync(filePath, 'utf8');
    return clampBoundsToDisplays(JSON.parse(raw), displays);
  } catch {
    return clampBoundsToDisplays(defaultState(), displays);
  }
}

function save(filePath, state, fsModule = fs) {
  try {
    const dir = path.dirname(filePath);
    fsModule.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    const payload = `${JSON.stringify(sanitizeState(state), null, 2)}\n`;
    fsModule.writeFileSync(tmpPath, payload);
    fsModule.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  MIN_WIDTH,
  MIN_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  defaultState,
  stateFilePath,
  sanitizeState,
  clampBoundsToDisplays,
  load,
  save,
};
