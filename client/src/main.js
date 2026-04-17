const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let socket = null;

const OVERLAY_WIDTH = 380;
const OVERLAY_HEIGHT = 400;
const DEFAULT_HOTKEY = 'CommandOrControl+Shift+O';
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// --- Settings ---
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch {}
}

let currentHotkey = loadSettings().hotkey || DEFAULT_HOTKEY;
let hotkeyError = null;
let currentLang = loadSettings().lang || 'cs';

const trayLabels = {
  cs: { show: 'Zobrazit hlavn\u00ed okno', toggle: 'P\u0159epnout overlay', quit: 'Ukon\u010dit' },
  en: { show: 'Show main window', toggle: 'Toggle overlay', quit: 'Quit' },
};

function registerHotkey(hotkey) {
  globalShortcut.unregisterAll();
  hotkeyError = null;

  const ok = globalShortcut.register(hotkey, () => toggleOverlay());
  if (ok) {
    currentHotkey = hotkey;
    const settings = loadSettings();
    settings.hotkey = hotkey;
    saveSettings(settings);
    console.log(`[hotkey] registered: ${hotkey}`);
  } else {
    hotkeyError = `Klávesová zkratka "${hotkey}" je obsazená jiným programem.`;
    console.log(`[hotkey] FAILED: ${hotkey}`);
  }

  broadcastHotkeyState();
}

function broadcastHotkeyState() {
  const state = { hotkey: currentHotkey, error: hotkeyError };
  mainWindow?.webContents?.send('hotkey-state', state);
}

// --- Shared state ---
let connectionState = 'disconnected';
let session = { sessionId: null, isLeader: false, playerCount: 0, players: [], sequence: [] };
let lastJoinInfo = null; // { sessionId, playerName, isLeader } for auto-rejoin
const config = require('./config');
let serverUrl = config.defaultServerUrl;

function broadcastState() {
  const state = { connectionState, session };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state-update', state);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('state-update', state);
  }
}

// --- Socket management (single connection in main process) ---
function connectSocket(url) {
  if (url) serverUrl = url;
  disconnectSocket();

  connectionState = 'connecting';
  broadcastState();

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    connectionState = 'connected';
    // Auto-rejoin session after reconnect
    if (lastJoinInfo) {
      socket.emit('join-session', lastJoinInfo);
    }
    broadcastState();
  });

  socket.on('disconnect', () => {
    connectionState = 'disconnected';
    // Keep lastJoinInfo so we can rejoin, but clear UI state
    session = { sessionId: null, isLeader: false, playerCount: 0, players: [], sequence: [] };
    broadcastState();
  });

  socket.on('session-created', ({ sessionId }) => {
    session.sessionId = sessionId;
    if (lastJoinInfo) {
      lastJoinInfo.sessionId = sessionId;
    }
    broadcastState();
  });

  socket.on('session-joined', (data) => {
    session = { sessionId: data.sessionId, isLeader: data.isLeader, playerCount: data.playerCount, players: data.players || [], sequence: data.sequence };
    broadcastState();
  });

  socket.on('session-error', ({ message }) => {
    mainWindow?.webContents?.send('session-error', message);
  });

  socket.on('sequence-updated', ({ sequence }) => {
    session.sequence = sequence;
    broadcastState();
  });

  socket.on('sequence-cleared', () => {
    session.sequence = [];
    broadcastState();
  });

  socket.on('players-updated', ({ count, players }) => {
    session.playerCount = count;
    session.players = players;
    broadcastState();
  });

  socket.on('leader-changed', ({ isLeader }) => {
    session.isLeader = isLeader;
    broadcastState();
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionState = 'disconnected';
  session = { sessionId: null, isLeader: false, playerCount: 0, players: [], sequence: [] };
}

// --- Windows ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: false,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'desktop.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('init', { serverUrl });
    broadcastState();
    broadcastHotkeyState();
  });

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;
  const scaleFactor = display.scaleFactor || 1;
  const scaledWidth = Math.round(OVERLAY_WIDTH * scaleFactor);
  const scaledHeight = Math.round(OVERLAY_HEIGHT * scaleFactor);

  overlayWindow = new BrowserWindow({
    width: scaledWidth,
    height: scaledHeight,
    x: screenW - scaledWidth - 20,
    y: 100,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('set-scale', scaleFactor);
    broadcastState();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createTray() {
  if (!tray) {
    tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
    tray.setToolTip('Lura Symbol Helper');
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  }

  const labels = trayLabels[currentLang] || trayLabels.cs;
  const contextMenu = Menu.buildFromTemplate([
    { label: labels.show, click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: labels.toggle, click: () => toggleOverlay() },
    { type: 'separator' },
    { label: labels.quit, click: () => { tray = null; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

function toggleOverlay() {
  if (!overlayWindow) {
    createOverlayWindow();
  } else if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
  }
}

// --- App lifecycle ---
app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  createTray();

  // Register hotkey from settings
  registerHotkey(currentHotkey);

  // Auto-connect
  connectSocket(serverUrl);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  disconnectSocket();
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

// --- IPC handlers ---
ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on('toggle-overlay', () => toggleOverlay());

// Socket commands from renderers
ipcMain.on('socket-connect', (_event, url) => {
  connectSocket(url);
});

ipcMain.on('socket-create-session', (_event, { playerName, isLeader }) => {
  lastJoinInfo = { playerName, isLeader };
  socket?.emit('create-session', { playerName, isLeader });
});

ipcMain.on('socket-join-session', (_event, { sessionId, playerName, isLeader }) => {
  lastJoinInfo = { sessionId, playerName, isLeader };
  socket?.emit('join-session', { sessionId, playerName, isLeader });
});

ipcMain.on('socket-leave-session', () => {
  lastJoinInfo = null;
  socket?.emit('leave-session');
  session = { sessionId: null, isLeader: false, playerCount: 0, players: [], sequence: [] };
  broadcastState();
});

ipcMain.on('socket-update-sequence', (_event, sequence) => {
  if (!session.isLeader) return;
  session.sequence = sequence;
  socket?.emit('update-sequence', { sequence });
  broadcastState();
});

ipcMain.on('socket-clear-sequence', () => {
  if (!session.isLeader) return;
  session.sequence = [];
  socket?.emit('clear-sequence');
  broadcastState();
});

ipcMain.on('get-state', (event) => {
  event.sender.send('state-update', { connectionState, session });
});

ipcMain.on('set-hotkey', (_event, hotkey) => {
  registerHotkey(hotkey);
});

ipcMain.on('get-hotkey-state', (event) => {
  event.sender.send('hotkey-state', { hotkey: currentHotkey, error: hotkeyError });
});

ipcMain.on('set-lang', (_event, lang) => {
  currentLang = lang;
  const settings = loadSettings();
  settings.lang = lang;
  saveSettings(settings);
  createTray();
  // Notify all windows
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('lang-changed', lang);
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('lang-changed', lang);
});

