const { BrowserWindow, session } = require('electron');

const PARTITION = 'persist:gemini';
const START_URL = 'https://gemini.google.com';

let mainWindow = null;

function createWindow() {
  const geminiSession = session.fromPartition(PARTITION);

  const win = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 640,
    minHeight: 500,
    show: false,
    title: 'GeminiHarness',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: geminiSession,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.loadURL(START_URL);
  mainWindow = win;
  return win;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createWindow,
  getMainWindow,
  PARTITION,
  START_URL,
};
