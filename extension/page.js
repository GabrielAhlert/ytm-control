// Roda no "mundo" da própria página (MAIN) para ter acesso ao player e ao ytcfg.
// Recebe pedidos do content.js via postMessage e executa as ações.
(() => {
  if (window.__ytmControlPage) return;
  window.__ytmControlPage = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (o) => o?.simpleText ?? o?.runs?.map((r) => r.text).join('') ?? '';
  const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

  // ---------- Player ----------

  const player = () => document.getElementById('movie_player');
  const bar = () => document.querySelector('ytmusic-player-bar');

  function currentVideoId() {
    return player()?.getVideoData?.()?.video_id || new URL(location.href).searchParams.get('v') || null;
  }

  function songInfo() {
    const md = navigator.mediaSession?.metadata;
    const b = bar();
    return {
      videoId: currentVideoId(),
      title: md?.title || b?.querySelector('.title')?.textContent?.trim() || null,
      artist: md?.artist || b?.querySelector('.byline')?.textContent?.split('•')[0]?.trim() || null,
      likeStatus: b?.querySelector('ytmusic-like-button-renderer')?.getAttribute('like-status') || null,
      playing: player()?.getPlayerState?.() === 1,
    };
  }

  function requireSong() {
    const song = songInfo();
    if (!song.videoId) throw new Error('Nenhuma música tocando');
    return song;
  }

  function findButton(selectors) {
    const root = bar() || document;
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  const BUTTONS = {
    like: ['#button-shape-like button', '#button-shape-like', '.like'],
    dislike: ['#button-shape-dislike button', '#button-shape-dislike', '.dislike'],
    playPause: ['#play-pause-button'],
    next: ['.next-button'],
    previous: ['.previous-button'],
  };

  function clickOrFallback(name, fallback) {
    const btn = findButton(BUTTONS[name]);
    if (btn) btn.click();
    else if (fallback) fallback();
    else throw new Error(`Botão "${name}" não encontrado na página`);
  }

  // ---------- InnerTube (API interna do YouTube Music) ----------

  const cfg = (k) => window.ytcfg?.get?.(k) ?? window.ytcfg?.data_?.[k];

  function cookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function sha1(str) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function authHeader() {
    const ts = Math.floor(Date.now() / 1000);
    const parts = [];
    for (const [name, prefix] of [
      ['SAPISID', 'SAPISIDHASH'],
      ['__Secure-1PAPISID', 'SAPISID1PHASH'],
      ['__Secure-3PAPISID', 'SAPISID3PHASH'],
    ]) {
      const v = cookie(name);
      if (v) parts.push(`${prefix} ${ts}_${await sha1(`${ts} ${v} ${location.origin}`)}`);
    }
    if (!parts.length) throw new Error('Você não está logado no YouTube Music');
    return parts.join(' ');
  }

  async function innertube(endpoint, body) {
    const context = cfg('INNERTUBE_CONTEXT');
    if (!context) throw new Error('Configuração do YouTube Music (ytcfg) indisponível');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
      'X-Origin': location.origin,
      'X-Goog-AuthUser': String(cfg('SESSION_INDEX') ?? 0),
      'X-Youtube-Client-Name': String(cfg('INNERTUBE_CONTEXT_CLIENT_NAME') ?? 67),
      'X-Youtube-Client-Version': cfg('INNERTUBE_CLIENT_VERSION') ?? context.client?.clientVersion,
    };
    const pageId = cfg('DELEGATED_SESSION_ID');
    if (pageId) headers['X-Goog-PageId'] = pageId;
    const key = cfg('INNERTUBE_API_KEY');
    const url = `/youtubei/v1/${endpoint}?prettyPrint=false${key ? `&key=${key}` : ''}`;
    const res = await fetch(url, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ context, ...body }) });
    if (!res.ok) throw new Error(`YouTube Music recusou ${endpoint} (HTTP ${res.status})`);
    return res.json();
  }

  // Procura recursivamente todos os objetos guardados sob `key` na resposta.
  function collect(node, key, out = []) {
    if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === key) out.push(v);
        else collect(v, key, out);
      }
    }
    return out;
  }

  // ---------- Playlists ----------

  async function getPlaylists(videoId) {
    const data = await innertube('playlist/get_add_to_playlist', { videoIds: [videoId], excludeWatchLater: true });
    return collect(data, 'playlistAddToOptionRenderer').map((r) => ({
      id: r.playlistId,
      title: text(r.title),
      contains: r.containsSelectedVideos === 'ALL',
    }));
  }

  function resolvePlaylist(query, list) {
    if (!query) throw new Error('Informe a playlist');
    const byId = list.find((p) => p.id === query);
    if (byId) return byId;
    const q = norm(query);
    for (const match of [(t) => t === q, (t) => t.startsWith(q), (t) => t.includes(q)]) {
      const found = list.filter((p) => match(norm(p.title)));
      if (found.length === 1) return found[0];
      if (found.length > 1) throw new Error(`"${query}" é ambíguo: ${found.map((p) => p.title).join(', ')}`);
    }
    throw new Error(`Playlist "${query}" não encontrada`);
  }

  async function editPlaylist(playlistId, action) {
    const r = await innertube('browse/edit_playlist', { playlistId, actions: [action] });
    if (r.status && r.status !== 'STATUS_SUCCEEDED') throw new Error(`Falha ao editar a playlist (${r.status})`);
  }

  // ---------- Ações ----------

  async function toggleRating(kind) {
    const song = requireSong();
    clickOrFallback(kind);
    await sleep(400);
    const status = songInfo().likeStatus;
    const on = status === (kind === 'like' ? 'LIKE' : 'DISLIKE');
    const label = kind === 'like' ? (on ? '❤️ Curtida' : '🤍 Curtida removida') : on ? '👎 Não gostei' : '"Não gostei" removido';
    return { ...song, likeStatus: status, message: `${label}: ${song.title ?? ''}` };
  }

  const actions = {
    status: () => songInfo(),

    'play-pause': () => {
      const p = player();
      clickOrFallback('playPause', () => (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo()));
      return {};
    },
    next: () => (clickOrFallback('next', () => player().nextVideo()), {}),
    previous: () => (clickOrFallback('previous', () => player().previousVideo()), {}),

    like: () => toggleRating('like'),
    dislike: () => toggleRating('dislike'),

    playlists: async () => {
      const song = requireSong();
      return { song, playlists: await getPlaylists(song.videoId) };
    },

    'add-to-playlist': async ({ playlist }) => {
      const song = requireSong();
      const pl = resolvePlaylist(playlist, await getPlaylists(song.videoId));
      if (pl.contains) return { ...song, playlist: pl.title, already: true, message: `Já está em "${pl.title}"` };
      await editPlaylist(pl.id, { action: 'ACTION_ADD_VIDEO', addedVideoId: song.videoId, dedupeOption: 'DEDUPE_OPTION_SKIP' });
      return { ...song, playlist: pl.title, message: `➕ ${song.title ?? 'Música'} → "${pl.title}"` };
    },

    'remove-from-playlist': async ({ playlist }) => {
      const song = requireSong();
      const pl = resolvePlaylist(playlist, await getPlaylists(song.videoId));
      if (!pl.contains) return { ...song, playlist: pl.title, message: `Não está em "${pl.title}"` };
      await editPlaylist(pl.id, { action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: song.videoId });
      return { ...song, playlist: pl.title, message: `➖ ${song.title ?? 'Música'} removida de "${pl.title}"` };
    },
  };

  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.source !== 'ytmc-req') return;
    const { id, action, args } = e.data;
    let reply;
    try {
      const fn = actions[action];
      if (!fn) throw new Error(`Ação desconhecida: ${action}`);
      reply = { ok: true, result: await fn(args || {}) };
    } catch (err) {
      reply = { ok: false, error: String(err?.message || err) };
    }
    window.postMessage({ source: 'ytmc-res', id, ...reply }, location.origin);
  });
})();
