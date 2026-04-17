const { ipcRenderer, clipboard } = require('electron');
const path = require('path');
const { t, setLang } = require('../i18n');

const assetsDir = path.join(__dirname, '..', '..', 'assets');

// --- Symbol definitions ---
const SYMBOLS = [
  { id: 0, name: 'Circle',   img: path.join(assetsDir, 'circle.png'),   color: '#4FC3F7' },
  { id: 1, name: 'Triangle', img: path.join(assetsDir, 'triangle.png'), color: '#9C6FE4' },
  { id: 2, name: 'Diamond',  img: path.join(assetsDir, 'diamond.png'),  color: '#5C7AEA' },
  { id: 3, name: 'T',        img: path.join(assetsDir, 'T.png'),        color: '#4FC3F7' },
  { id: 4, name: 'X',        img: path.join(assetsDir, 'x.png'),        color: '#4FC3F7' },
];

// --- State (received from main process) ---
let session = { sessionId: null, isLeader: false, playerCount: 0, sequence: [] };

const $ = (id) => document.getElementById(id);

function init() {
  renderSymbolPicker();
  setupControls();

  ipcRenderer.on('state-update', (_event, state) => {
    session = state.session;
    updateUI();
  });

  ipcRenderer.send('get-state');

  ipcRenderer.on('set-scale', (_event, scale) => {
    document.body.style.zoom = `${scale}`;
  });

  ipcRenderer.on('lang-changed', (_event, lang) => {
    setLang(lang);
    applyTranslations();
    updateUI();
  });

  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function renderSymbolPicker() {
  const picker = $('symbolPicker');

  SYMBOLS.forEach((sym) => {
    const btn = document.createElement('div');
    btn.className = 'pick-btn';
    btn.dataset.symbolId = String(sym.id);
    btn.innerHTML = `
      <img class="icon-img" src="${sym.img}" alt="${sym.name}" draggable="false" />
      <span class="label">${sym.name}</span>
    `;

    btn.addEventListener('click', () => {
      if (session.isLeader && session.sessionId) {
        const newSeq = [...session.sequence, sym.id];
        ipcRenderer.send('socket-update-sequence', newSeq);
      }
    });

    picker.appendChild(btn);
  });
}

function setupControls() {
  $('undoBtn').addEventListener('click', () => {
    if (!session.isLeader) return;
    const newSeq = session.sequence.slice(0, -1);
    ipcRenderer.send('socket-update-sequence', newSeq);
  });

  $('clearBtn').addEventListener('click', () => {
    if (!session.isLeader) return;
    ipcRenderer.send('socket-clear-sequence');
  });

  $('sessionBadge').addEventListener('click', () => {
    if (session.sessionId) {
      clipboard.writeText(session.sessionId);
      $('sessionBadge').textContent = t('copied');
      setTimeout(() => updateUI(), 1200);
    }
  });
}

function updateUI() {
  const hasSession = !!session.sessionId;

  $('noSessionMsg').classList.toggle('hidden', hasSession);
  $('symbolArea').classList.toggle('hidden', !hasSession);
  $('leaderControls').classList.toggle('hidden', !session.isLeader);

  $('sessionBadge').textContent = session.sessionId || '------';
  $('overlayPlayerCount').textContent = String(session.playerCount);

  // Picker clickable state
  document.querySelectorAll('.pick-btn').forEach((btn) => {
    btn.classList.toggle('clickable', session.isLeader);
  });

  // Update semicircle display slots (slot 0 = rightmost = first symbol)
  const seq = session.sequence;

  // Show picker + label only for leader
  $('pickerLabel').classList.toggle('hidden', !session.isLeader);
  $('symbolPicker').classList.toggle('hidden', !session.isLeader);

  for (let slot = 0; slot < 5; slot++) {
    const slotEl = document.querySelector(`[data-slot="${slot}"]`);
    const iconEl = slotEl.querySelector('.slot-icon');
    const numEl = slotEl.querySelector('.slot-num');
    const labelEl = slotEl.querySelector('.slot-label');

    if (slot < seq.length) {
      const sym = SYMBOLS[seq[slot]];
      if (!sym) continue;

      slotEl.classList.add('filled');
      slotEl.style.borderColor = sym.color;
      iconEl.innerHTML = `<img src="${sym.img}" alt="${sym.name}" draggable="false" style="width:54px;height:54px;border-radius:50%;" />`;
      numEl.textContent = String(slot + 1);
      numEl.style.background = sym.color;
      numEl.classList.add('visible');
      labelEl.textContent = sym.name;
      labelEl.style.color = sym.color;
    } else {
      slotEl.classList.remove('filled');
      slotEl.style.borderColor = '';
      iconEl.innerHTML = '';
      numEl.textContent = '';
      numEl.classList.remove('visible');
      numEl.style.background = '';
      const ordinals = ['1.', '2.', '3.', '4.', '5.'];
      labelEl.textContent = ordinals[slot];
      labelEl.style.color = '';
    }
  }

}

init();
