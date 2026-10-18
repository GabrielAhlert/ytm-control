// Content script (mundo isolado): atalhos de teclado na página, aviso na tela,
// seletor de playlist e ponte entre o background e o page.js.
(() => {
  if (window.__ytmControlContent) return;
  window.__ytmControlContent = true;

  // ---------- Conversa com o page.js ----------

  const pending = new Map();
  let nextId = 1;

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.source !== 'ytmc-res') return;
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error));
  });

  function callPage(action, args = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      window.postMessage({ source: 'ytmc-req', id, action, args }, location.origin);
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error('A página não respondeu (recarregue a aba do YouTube Music)'));
      }, 15000);
    });
  }

  // Ações pedidas pelo background (atalhos do Chrome, ponte nativa, atalhos desta página).
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'ytmc-action') return;
    (async () => {
      if (msg.action === 'pick-playlist') {
        openPicker();
        return { message: 'Seletor de playlist aberto' };
      }
      return callPage(msg.action, msg.args);
    })().then(
      (result) => {
        if (result?.message && msg.action !== 'pick-playlist') toast(result.message);
        sendResponse({ ok: true, result });
      },
      (err) => {
        toast(`⚠️ ${err.message}`, true);
        sendResponse({ ok: false, error: err.message });
      },
    );
    return true;
  });

  const run = (action, args = {}) => chrome.runtime.sendMessage({ type: 'ytmc-run', action, args });

  // ---------- Atalhos de teclado ----------

  let bindings = [];
  const loadBindings = () => chrome.storage.sync.get('bindings').then((s) => (bindings = s.bindings ?? DEFAULT_BINDINGS));
  const DEFAULT_BINDINGS = [
    { combo: 'Alt+L', action: 'like' },
    { combo: 'Alt+Shift+L', action: 'dislike' },
    { combo: 'Alt+P', action: 'pick-playlist' },
  ];
  loadBindings();
  chrome.storage.onChanged.addListener((changes) => changes.bindings && loadBindings());

  function comboFromEvent(e) {
    if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(e.key)) return null;
    const key = e.code.startsWith('Key') ? e.code.slice(3)
      : e.code.startsWith('Digit') ? e.code.slice(5)
      : e.code === 'Space' ? 'Space'
      : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta', key].filter(Boolean).join('+');
  }

  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  window.addEventListener('keydown', (e) => {
    if (e.repeat || pickerOpen()) return;
    const combo = comboFromEvent(e);
    const binding = combo && bindings.find((b) => b.combo === combo);
    if (!binding) return;
    // Na caixa de busca, só atalhos com Ctrl/Alt valem (para não atrapalhar a digitação).
    if (isTyping(document.activeElement) && !e.ctrlKey && !e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    run(binding.action, binding.playlist ? { playlist: binding.playlist.id } : {});
  }, true);

  // ---------- Interface (aviso + seletor) ----------

  const host = document.createElement('div');
  host.id = 'ytm-control-ui';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .toast { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 2147483647;
      background: #212121; color: #fff; font: 500 14px/1.4 Roboto, system-ui, sans-serif; padding: 10px 18px;
      border-radius: 8px; box-shadow: 0 4px 16px #0008; opacity: 0; transition: opacity .2s; pointer-events: none; max-width: 80vw; }
    .toast.show { opacity: 1; }
    .toast.error { background: #8b1a1a; }
    .backdrop { position: fixed; inset: 0; background: #0007; z-index: 2147483646; display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
    .picker { width: min(440px, 92vw); background: #212121; color: #fff; border-radius: 12px; box-shadow: 0 8px 32px #000a;
      font: 14px/1.4 Roboto, system-ui, sans-serif; overflow: hidden; }
    .head { padding: 14px 16px 6px; color: #aaa; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    input { box-sizing: border-box; width: calc(100% - 24px); margin: 6px 12px 10px; padding: 10px 12px; border-radius: 8px;
      border: 1px solid #444; background: #121212; color: #fff; font: inherit; outline: none; }
    input:focus { border-color: #f33; }
    ul { list-style: none; margin: 0; padding: 0 0 8px; max-height: 50vh; overflow-y: auto; }
    li { padding: 9px 16px; cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
    li.sel { background: #3a3a3a; }
    li .tag { color: #8c8; font-size: 12px; }
    .empty { padding: 12px 16px; color: #aaa; }
    .hint { padding: 8px 16px; border-top: 1px solid #333; color: #888; font-size: 12px; }
  `;
  shadow.append(style);
  const mount = () => document.body && !host.isConnected && document.body.append(host);

  let toastEl, toastTimer;
  function toast(message, error = false) {
    mount();
    toastEl ??= shadow.appendChild(Object.assign(document.createElement('div'), { className: 'toast' }));
    toastEl.textContent = message;
    toastEl.classList.toggle('error', error);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  let picker = null;
  const pickerOpen = () => !!picker;

  function closePicker() {
    picker?.remove();
    picker = null;
  }

  async function openPicker() {
    if (picker) return;
    mount();
    const el = (tag, props = {}, ...children) => {
      const n = Object.assign(document.createElement(tag), props);
      n.append(...children);
      return n;
    };
    const head = el('div', { className: 'head', textContent: 'Carregando playlists…' });
    const input = el('input', { placeholder: 'Adicionar à playlist…' });
    const list = el('ul');
    const hint = el('div', { className: 'hint', textContent: '↑↓ escolher · Enter adicionar · Esc fechar' });
    picker = el('div', { className: 'backdrop' }, el('div', { className: 'picker' }, head, input, list, hint));
    picker.addEventListener('mousedown', (e) => e.target === picker && closePicker());
    shadow.append(picker);
    input.focus();

    let all = [];
    let shown = [];
    let sel = 0;
    const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    function render() {
      const q = norm(input.value.trim());
      shown = all.filter((p) => norm(p.title).includes(q));
      sel = Math.min(sel, Math.max(shown.length - 1, 0));
      list.replaceChildren(
        ...(shown.length
          ? shown.map((p, i) => {
              const li = el('li', { className: i === sel ? 'sel' : '' }, el('span', { textContent: p.title }));
              if (p.contains) li.append(el('span', { className: 'tag', textContent: '✓ já está' }));
              li.addEventListener('click', () => choose(p));
              return li;
            })
          : [el('li', { className: 'empty', textContent: all.length ? 'Nenhuma playlist com esse nome' : '' })]),
      );
      list.children[sel]?.scrollIntoView({ block: 'nearest' });
    }

    function choose(p) {
      closePicker();
      if (p.contains) return toast(`Já está em "${p.title}"`);
      run('add-to-playlist', { playlist: p.id });
    }

    input.addEventListener('input', () => ((sel = 0), render()));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') closePicker();
      else if (e.key === 'ArrowDown') (sel = Math.min(sel + 1, shown.length - 1)), render(), e.preventDefault();
      else if (e.key === 'ArrowUp') (sel = Math.max(sel - 1, 0)), render(), e.preventDefault();
      else if (e.key === 'Enter' && shown[sel]) choose(shown[sel]);
    });

    try {
      const { song, playlists } = await callPage('playlists');
      head.textContent = [song.title, song.artist].filter(Boolean).join(' — ');
      all = playlists;
      render();
    } catch (err) {
      closePicker();
      toast(`⚠️ ${err.message}`, true);
    }
  }
})();
