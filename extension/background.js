// Service worker: encaminha ações (atalhos do Chrome, página, opções)
// para a aba do YouTube Music.
const YTM_URL = 'https://music.youtube.com/*';

async function findTab(preferred) {
  if (preferred) return preferred;
  const tabs = await chrome.tabs.query({ url: YTM_URL });
  if (!tabs.length) throw new Error('YouTube Music não está aberto no Chrome');
  return (tabs.find((t) => t.audible) || tabs.find((t) => t.active) || tabs[0]).id;
}

// "slot N" vira "adicionar à playlist rápida N" configurada nas opções.
async function resolve(action, args) {
  if (action !== 'slot') return [action, args];
  const { slots = [] } = await chrome.storage.sync.get('slots');
  const slot = slots[Number(args.slot) - 1];
  if (!slot?.id) throw new Error(`Playlist rápida ${args.slot} não configurada (veja as opções da extensão)`);
  return ['add-to-playlist', { playlist: slot.id }];
}

async function sendToTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // Aba aberta antes da extensão ser instalada/recarregada: injeta os scripts e tenta de novo.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['page.js'], world: 'MAIN' });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tabId, msg);
  }
}

async function runAction(action, args = {}, tabId) {
  [action, args] = await resolve(action, args);
  const res = await sendToTab(await findTab(tabId), { type: 'ytmc-action', action, args });
  if (!res) throw new Error('A aba do YouTube Music não respondeu');
  if (!res.ok) throw new Error(res.error);
  return res.result;
}

// ---------- Atalhos do Chrome (chrome://extensions/shortcuts) ----------

const SILENT = new Set(['play-pause', 'next', 'previous', 'pick-playlist']);

// Com a aba do YouTube Music à vista, o aviso na página basta; senão, notificação do sistema.
async function notify(tabId, message, error = false) {
  if (tabId) {
    const tab = await chrome.tabs.get(tabId);
    const win = await chrome.windows.get(tab.windowId);
    if (tab.active && win.focused) return;
  }
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: error ? 'YTM Control' : 'YouTube Music', message });
}

chrome.commands.onCommand.addListener(async (command) => {
  const slot = /^slot-(\d+)$/.exec(command);
  const action = slot ? 'slot' : command;
  let tabId;
  try {
    tabId = await findTab();
    const result = await runAction(action, slot ? { slot: slot[1] } : {}, tabId);
    if (!SILENT.has(action) && result?.message) await notify(tabId, result.message);
  } catch (e) {
    await notify(tabId, `⚠️ ${e.message}`, true);
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ---------- Mensagens da página e das opções ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'ytmc-run') {
    // Pedido vindo da própria aba do YouTube Music: executa nela. Das opções (que também
    // abrem numa aba): procura a aba do YouTube Music.
    const fromYtm = sender.url?.startsWith('https://music.youtube.com/');
    runAction(msg.action, msg.args, fromYtm ? sender.tab?.id : undefined).then(
      (result) => sendResponse({ ok: true, result }),
      (e) => sendResponse({ ok: false, error: e.message }),
    );
    return true;
  }
});
