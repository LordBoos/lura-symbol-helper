const { ipcRenderer, clipboard, shell } = require('electron');
const { t, getLang, setLang } = require('../i18n');

const GITHUB_URL = 'https://github.com/LordBoos/lura-symbol-helper';

let connectionState = 'disconnected';
let session = { sessionId: null, isLeader: false, playerCount: 0, players: [], sequence: [] };
let serverUrl = 'http://localhost:3000';

const STORAGE_KEY = 'lura_server_url';
const NAME_KEY = 'lura_player_name';

const $ = (id) => document.getElementById(id);

// --- i18n ---
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // How to use text with <br> - built safely via DOM API
  const howToEl = $('howToUseText');
  howToEl.textContent = '';
  const lines = t('howToUseText').split('\n');
  lines.forEach((line, i) => {
    howToEl.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) howToEl.appendChild(document.createElement('br'));
  });
  // Update lang buttons
  $('langCs').classList.toggle('active', getLang() === 'cs');
  $('langEn').classList.toggle('active', getLang() === 'en');
}

function switchLang(lang) {
  setLang(lang);
  ipcRenderer.send('set-lang', lang);
  applyTranslations();
  // Re-translate dynamic buttons
  $('leaveBtn').textContent = t('leaveSession');
  $('copyBtn').textContent = t('copyId');
  updateUI();
}
$('langCs').addEventListener('click', () => switchLang('cs'));
$('langEn').addEventListener('click', () => switchLang('en'));

// --- Init ---
const serverUrlInput = $('serverUrl');
const playerNameInput = $('playerName');
serverUrlInput.value = localStorage.getItem(STORAGE_KEY) || serverUrl;
playerNameInput.value = localStorage.getItem(NAME_KEY) || '';

$('minimizeBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
$('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));
$('ghLink').addEventListener('click', () => shell.openExternal(GITHUB_URL));

// --- IPC ---
ipcRenderer.on('state-update', (_event, state) => {
  connectionState = state.connectionState;
  session = state.session;
  updateUI();
});

ipcRenderer.on('init', (_event, data) => {
  if (data.serverUrl) {
    serverUrl = data.serverUrl;
    if (!localStorage.getItem(STORAGE_KEY)) {
      serverUrlInput.value = serverUrl;
    }
  }
});

ipcRenderer.on('session-error', (_event, message) => { alert(message); });

ipcRenderer.send('get-state');
ipcRenderer.send('get-hotkey-state');

// --- Events ---
$('connectBtn').addEventListener('click', () => {
  const url = serverUrlInput.value.trim();
  if (!url) return;
  localStorage.setItem(STORAGE_KEY, url);
  ipcRenderer.send('socket-connect', url);
});

const isLeaderCheck = $('isLeaderCheck');

$('createBtn').addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Player';
  localStorage.setItem(NAME_KEY, name);
  ipcRenderer.send('socket-create-session', { playerName: name, isLeader: isLeaderCheck.checked });
});

$('joinBtn').addEventListener('click', () => {
  const id = $('joinSessionId').value.trim().toUpperCase();
  const name = playerNameInput.value.trim() || 'Player';
  if (!id) return;
  localStorage.setItem(NAME_KEY, name);
  ipcRenderer.send('socket-join-session', { sessionId: id, playerName: name, isLeader: isLeaderCheck.checked });
});

$('joinSessionId').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

$('copyBtn').addEventListener('click', () => {
  if (session.sessionId) {
    clipboard.writeText(session.sessionId);
    $('copyBtn').textContent = t('copied');
    setTimeout(() => { $('copyBtn').textContent = t('copyId'); }, 1500);
  }
});

$('leaveBtn').addEventListener('click', () => { ipcRenderer.send('socket-leave-session'); });

// --- Hotkey ---
const hotkeyInput = $('hotkeyInput');
let pendingHotkey = null;

function electronAccelerator(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null;
  if (key.length === 1) parts.push(key.toUpperCase());
  else if (key.startsWith('F') && key.length <= 3) parts.push(key);
  else parts.push(key);
  return parts.join('+');
}

function displayName(accelerator) {
  return accelerator.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ');
}

hotkeyInput.addEventListener('keydown', (e) => {
  e.preventDefault();
  const accel = electronAccelerator(e);
  if (!accel) return;
  pendingHotkey = accel;
  hotkeyInput.value = displayName(accel);
  $('hotkeyError').classList.add('hidden');
  $('hotkeyOk').classList.add('hidden');
});

$('hotkeyBtn').addEventListener('click', () => {
  if (!pendingHotkey) return;
  ipcRenderer.send('set-hotkey', pendingHotkey);
});

ipcRenderer.on('hotkey-state', (_event, state) => {
  hotkeyInput.value = displayName(state.hotkey);
  pendingHotkey = null;
  if (state.error) {
    $('hotkeyError').textContent = state.error;
    $('hotkeyError').classList.remove('hidden');
    $('hotkeyOk').classList.add('hidden');
  } else {
    $('hotkeyError').classList.add('hidden');
    $('hotkeyOk').textContent = t('hotkeyOk');
    $('hotkeyOk').classList.remove('hidden');
    setTimeout(() => $('hotkeyOk').classList.add('hidden'), 3000);
  }
});

// --- UI ---
function updateUI() {
  // Connection
  $('statusDot').className = 'status-dot';
  if (connectionState === 'connected') {
    $('statusDot').classList.add('connected');
    $('statusText').textContent = t('connected');
    $('connectBtn').textContent = t('reconnect');
  } else if (connectionState === 'connecting') {
    $('statusDot').classList.add('connecting');
    $('statusText').textContent = t('connecting');
  } else {
    $('statusText').textContent = t('disconnected');
    $('connectBtn').textContent = t('connect');
  }
  $('connectBtn').disabled = connectionState === 'connecting';

  const isConnected = connectionState === 'connected';
  $('sessionSection').classList.toggle('hidden', !isConnected);

  const hasSession = !!session.sessionId;
  $('noSession').classList.toggle('hidden', hasSession);
  $('activeSession').classList.toggle('hidden', !hasSession);

  if (hasSession) {
    $('displaySessionId').textContent = session.sessionId;
    $('playerCount').textContent = String(session.playerCount);
    $('leaderHint').textContent = session.isLeader ? t('leaderHint') : t('viewerHint');

    const playerList = $('playerList');
    playerList.innerHTML = '';
    (session.players || []).forEach((p) => {
      const li = document.createElement('li');
      const icon = document.createElement('span');
      icon.className = 'leader-icon';
      icon.textContent = '\u2605';
      if (!p.isLeader) icon.style.visibility = 'hidden';
      li.appendChild(icon);

      const nameEl = document.createElement('span');
      nameEl.className = 'player-name';
      nameEl.textContent = String(p.name || '');
      li.appendChild(nameEl);

      if (p.isLeader) {
        const tag = document.createElement('span');
        tag.className = 'leader-tag';
        tag.textContent = t('leader');
        li.appendChild(tag);
      }
      playerList.appendChild(li);
    });
  }
}

applyTranslations();
