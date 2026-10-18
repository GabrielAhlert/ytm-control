const ACTIONS = {
  like: 'Curtir / descurtir',
  dislike: 'Não gostei',
  'pick-playlist': 'Abrir seletor de playlist',
  'add-to-playlist': 'Adicionar à playlist…',
  'remove-from-playlist': 'Remover da playlist…',
  'play-pause': 'Tocar / pausar',
  next: 'Próxima',
  previous: 'Anterior',
};
const NEEDS_PLAYLIST = new Set(['add-to-playlist', 'remove-from-playlist']);
const DEFAULT_BINDINGS = [
  { combo: 'Alt+L', action: 'like' },
  { combo: 'Alt+Shift+L', action: 'dislike' },
  { combo: 'Alt+P', action: 'pick-playlist' },
];

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};

let bindings = [];
let slots = [];
let playlists = [];

function comboFromEvent(e) {
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(e.key)) return null;
  const key = e.code.startsWith('Key') ? e.code.slice(3)
    : e.code.startsWith('Digit') ? e.code.slice(5)
    : e.code === 'Space' ? 'Space'
    : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta', key].filter(Boolean).join('+');
}

// Select de playlist; mantém a opção salva mesmo se a lista ainda não foi carregada.
function playlistSelect(current, onChange) {
  const sel = el('select', {}, el('option', { value: '', textContent: '— escolha —' }));
  const known = [...playlists];
  if (current && !known.some((p) => p.id === current.id)) known.push(current);
  for (const p of known) sel.append(el('option', { value: p.id, textContent: p.title, selected: p.id === current?.id }));
  sel.addEventListener('change', () => {
    const p = known.find((x) => x.id === sel.value);
    onChange(p ? { id: p.id, title: p.title } : null);
  });
  return sel;
}

const save = () => chrome.storage.sync.set({ bindings, slots });

function renderBindings() {
  $('bindings').replaceChildren(
    ...bindings.map((b, i) => {
      const comboBtn = el('button', { className: 'combo', textContent: b.combo || 'definir…' });
      comboBtn.addEventListener('click', () => {
        comboBtn.classList.add('rec');
        comboBtn.textContent = 'pressione…';
        const onKey = (e) => {
          e.preventDefault();
          if (e.key === 'Escape') return done();
          const combo = comboFromEvent(e);
          if (!combo) return;
          b.combo = combo;
          save();
          done();
        };
        const done = () => {
          window.removeEventListener('keydown', onKey, true);
          renderBindings();
        };
        window.addEventListener('keydown', onKey, true);
      });

      const actionSel = el('select');
      for (const [value, label] of Object.entries(ACTIONS)) actionSel.append(el('option', { value, textContent: label, selected: value === b.action }));
      actionSel.addEventListener('change', () => {
        b.action = actionSel.value;
        if (!NEEDS_PLAYLIST.has(b.action)) delete b.playlist;
        save();
        renderBindings();
      });

      const plCell = el('td');
      if (NEEDS_PLAYLIST.has(b.action)) plCell.append(playlistSelect(b.playlist, (p) => ((b.playlist = p), save())));

      const del = el('button', { textContent: '✕', title: 'Remover' });
      del.addEventListener('click', () => (bindings.splice(i, 1), save(), renderBindings()));

      return el('tr', {}, el('td', {}, comboBtn), el('td', {}, actionSel), plCell, el('td', {}, del));
    }),
  );
}

function renderSlots() {
  $('slots').replaceChildren(
    ...[0, 1, 2].map((i) =>
      el('label', {}, el('span', { textContent: `Playlist rápida ${i + 1}` }), playlistSelect(slots[i], (p) => ((slots[i] = p), save()))),
    ),
  );
}

async function loadPlaylists() {
  $('load-status').textContent = 'Carregando…';
  const res = await chrome.runtime.sendMessage({ type: 'ytmc-run', action: 'playlists' });
  if (!res.ok) {
    $('load-status').textContent = `⚠️ ${res.error}`;
    return;
  }
  playlists = res.result.playlists.map(({ id, title }) => ({ id, title }));
  await chrome.storage.local.set({ playlists });
  $('load-status').textContent = `${playlists.length} playlists carregadas`;
  renderBindings();
  renderSlots();
}

async function refreshBridge(reconnect = false) {
  const s = await chrome.runtime.sendMessage({ type: 'ytmc-bridge', reconnect });
  const out = $('bridge-status');
  out.className = s.connected ? 'ok' : 'bad';
  out.textContent = s.connected
    ? 'conectada'
    : /not found/i.test(s.error || '') ? 'não instalada (rode o install.sh)' : s.error || 'desconectada';
}

$('load').addEventListener('click', loadPlaylists);
$('add-binding').addEventListener('click', () => (bindings.push({ combo: '', action: 'like' }), renderBindings()));
$('open-shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
$('reconnect').addEventListener('click', () => (refreshBridge(true), setTimeout(refreshBridge, 1000)));

(async () => {
  const stored = await chrome.storage.sync.get(['bindings', 'slots']);
  bindings = stored.bindings ?? DEFAULT_BINDINGS;
  slots = stored.slots ?? [];
  playlists = (await chrome.storage.local.get('playlists')).playlists ?? [];
  if (playlists.length) $('load-status').textContent = `${playlists.length} playlists (salvas)`;
  renderBindings();
  renderSlots();
  refreshBridge();
})();
