const LANG_KEY = 'lura_language';

const translations = {
  cs: {
    // Desktop - titlebar
    appName: 'Lura Symbol Helper',
    // Desktop - server section
    server: 'Server',
    connected: 'P\u0159ipojeno',
    connecting: 'P\u0159ipojov\u00e1n\u00ed...',
    disconnected: 'Odpojeno',
    connect: 'P\u0159ipojit',
    reconnect: 'Znovu p\u0159ipojit',
    // Desktop - session section
    session: 'Relace',
    playerName: 'Jm\u00e9no hr\u00e1\u010de',
    iAmLeader: 'Jsem raid leader',
    createSession: 'Vytvo\u0159it relaci',
    sessionIdPlaceholder: 'ID relace (nap\u0159. A3X9K2)',
    join: 'P\u0159ipojit se',
    sessionId: 'ID RELACE',
    players: 'hr\u00e1\u010d\u016f',
    copyId: '\uD83D\uDCCB Kop\u00edrovat ID',
    copied: '\u2713 Zkop\u00edrov\u00e1no!',
    leaveSession: 'Opustit relaci',
    leaderHint: '\u2605 Jste raid leader \u2013 klikejte na symboly v overlay pro nastaven\u00ed sekvence',
    viewerHint: 'Zobrazuji sekvenci od raid leadera',
    connectedPlayers: 'P\u0159ipojen\u00ed hr\u00e1\u010di',
    leader: 'Leader',
    // Desktop - hotkey section
    hotkey: 'Kl\u00e1vesov\u00e1 zkratka',
    hotkeyDesc: 'Zkratka pro zobrazen\u00ed/skryt\u00ed overlay',
    hotkeyPlaceholder: 'Klikn\u011bte a stiskn\u011bte zkratku...',
    hotkeySet: 'Nastavit',
    hotkeyOk: '\u2713 Zkratka nastavena',
    // Desktop - how to use
    howToUse: 'Jak pou\u017e\u00edvat',
    howToUseText: '1. P\u0159ipojte se k serveru\n2. Vytvo\u0159te relaci nebo se p\u0159ipojte pomoc\u00ed ID\n3. Leader klik\u00e1 na symboly pro nastaven\u00ed sekvence\n4. V\u0161ichni hr\u00e1\u010di vid\u00ed sekvenci v re\u00e1ln\u00e9m \u010dase\n5. Stiskn\u011bte kl\u00e1vesovou zkratku pro zobrazen\u00ed/skryt\u00ed overlay\n6. WoW mus\u00ed b\u011b\u017eet v re\u017eimu Windowed Fullscreen',
    // Desktop - language
    language: 'Jazyk',
    // Overlay
    notConnected: 'Nep\u0159ipojeno k relaci.',
    useMainWindow: 'Pou\u017eijte hlavn\u00ed okno pro vytvo\u0159en\u00ed nebo p\u0159ipojen\u00ed k relaci.',
    clickSymbols: 'Klikn\u011bte na symboly pro nastaven\u00ed sekvence',
    undo: '\u21A9 Zp\u011bt',
    clear: '\u2715 Vymazat',
    // Tray
    trayShow: 'Zobrazit hlavn\u00ed okno',
    trayToggle: 'P\u0159epnout overlay',
    trayQuit: 'Ukon\u010dit',
  },
  en: {
    appName: 'Lura Symbol Helper',
    server: 'Server',
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    connect: 'Connect',
    reconnect: 'Reconnect',
    session: 'Session',
    playerName: 'Player name',
    iAmLeader: 'I am a raid leader',
    createSession: 'Create Session',
    sessionIdPlaceholder: 'Session ID (e.g. A3X9K2)',
    join: 'Join',
    sessionId: 'SESSION ID',
    players: 'players',
    copyId: '\uD83D\uDCCB Copy ID',
    copied: '\u2713 Copied!',
    leaveSession: 'Leave Session',
    leaderHint: '\u2605 You are the raid leader \u2013 click symbols in the overlay to set the sequence',
    viewerHint: 'Viewing sequence from raid leader',
    connectedPlayers: 'Connected players',
    leader: 'Leader',
    hotkey: 'Hotkey',
    hotkeyDesc: 'Shortcut to show/hide overlay',
    hotkeyPlaceholder: 'Click and press a shortcut...',
    hotkeySet: 'Set',
    hotkeyOk: '\u2713 Hotkey set',
    howToUse: 'How to use',
    howToUseText: '1. Connect to your server\n2. Create a session or join with a Session ID\n3. The leader clicks symbols to set the sequence\n4. All players see the sequence in real-time\n5. Press the hotkey to show/hide overlay\n6. WoW must run in Windowed Fullscreen mode',
    language: 'Language',
    notConnected: 'Not connected to a session.',
    useMainWindow: 'Use the main window to create or join a session.',
    clickSymbols: 'Click symbols to set sequence',
    undo: '\u21A9 Undo',
    clear: '\u2715 Clear',
    trayShow: 'Show main window',
    trayToggle: 'Toggle overlay',
    trayQuit: 'Quit',
  },
};

function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || 'cs';
  } catch {
    return 'cs';
  }
}

function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
}

function t(key) {
  const lang = getLang();
  return (translations[lang] && translations[lang][key]) || translations.cs[key] || key;
}

if (typeof module !== 'undefined') {
  module.exports = { translations, getLang, setLang, t, LANG_KEY };
}
