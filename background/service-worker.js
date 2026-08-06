importScripts('/shared/url.js', '/shared/growth.js');

const PREVIEW_PATH = 'preview/preview.html';
const SIDEPANEL_PATH = 'sidepanel/sidepanel.html';
const previewBase = () => chrome.runtime.getURL(PREVIEW_PATH);

chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});

function enablePanel(tabId) {
  return chrome.sidePanel.setOptions({
    tabId,
    path: SIDEPANEL_PATH,
    enabled: true
  }).catch(() => {});
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.runtime.setUninstallURL(DP_UNINSTALL_URL).catch(() => {});
  if (details.reason === 'install') {
    chrome.storage.local.set({
      [DP_ONBOARDING_KEY]: false,
      [DP_REVIEW_KEY]: { captures: 0, opens: 0, dismissed: false, snoozeUntil: 0 }
    }).catch(() => {});
  } else if (details.reason === 'update') {
    // Usuários antigos não devem ver o tour de primeira instalação.
    chrome.storage.local.get([DP_ONBOARDING_KEY]).then((data) => {
      if (data[DP_ONBOARDING_KEY] === undefined) {
        return chrome.storage.local.set({ [DP_ONBOARDING_KEY]: true });
      }
    }).catch(() => {});
  }
});

chrome.runtime.setUninstallURL(DP_UNINSTALL_URL).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  enablePanel(tab.id);
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  bumpWeekSession();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'reopen-last-preview') reopenLastPreview().catch(() => {});
});

async function bumpWeekSession() {
  try {
    const data = await chrome.storage.local.get([DP_SESSIONS_KEY]);
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let rec = data[DP_SESSIONS_KEY] || { weekStart: now, count: 0 };
    if (!rec.weekStart || now - rec.weekStart > weekMs) {
      rec = { weekStart: now, count: 0 };
    }
    rec.count += 1;
    await chrome.storage.local.set({ [DP_SESSIONS_KEY]: rec });
  } catch (_) {}
}

// O id de regra do declarativeNetRequest é um int32: derivá-lo do tabId estoura
// o limite assim que o Chrome entrega uma aba com id alto (eles passam da casa
// do bilhão em perfis de uso contínuo) e a chamada inteira falha. Por isso cada
// aba recebe uma vaga pequena, guardada na sessão para sobreviver ao service
// worker dormir.
const RULE_TABS_KEY = 'ruleTabs';

function idsForSlot(slot) {
  return { ua: slot * 2 - 1, frame: slot * 2 };
}

async function getRuleSlots() {
  const data = await chrome.storage.session.get(RULE_TABS_KEY);
  const map = data[RULE_TABS_KEY];
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

// Alocar vaga é ler-modificar-gravar: duas abas aplicando ao mesmo tempo
// pegariam a mesma se as chamadas se cruzassem.
let slotQueue = Promise.resolve();

function serialize(task) {
  const next = slotQueue.then(task, task);
  slotQueue = next.catch(() => {});
  return next;
}

function takeRuleSlot(tabId) {
  return serialize(async () => {
    const map = await getRuleSlots();
    if (map[tabId]) return idsForSlot(map[tabId]);
    const used = new Set(Object.values(map));
    let slot = 1;
    while (used.has(slot)) slot++;
    map[tabId] = slot;
    await chrome.storage.session.set({ [RULE_TABS_KEY]: map });
    return idsForSlot(slot);
  });
}

function dropRuleSlot(tabId) {
  return serialize(async () => {
    const map = await getRuleSlots();
    const slot = map[tabId];
    if (!slot) return null;
    delete map[tabId];
    await chrome.storage.session.set({ [RULE_TABS_KEY]: map });
    return idsForSlot(slot);
  });
}

async function applyDevice(tabId, { userAgent, platform = 'Android', mobile = true }) {
  const ids = await takeRuleSlot(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ids.ua, ids.frame],
    addRules: [
      {
        id: ids.ua,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: userAgent },
            { header: 'sec-ch-ua', operation: 'remove' },
            { header: 'sec-ch-ua-mobile', operation: 'set', value: mobile ? '?1' : '?0' },
            { header: 'sec-ch-ua-platform', operation: 'set', value: `"${platform}"` }
          ]
        },
        condition: {
          tabIds: [tabId],
          resourceTypes: [
            'sub_frame', 'stylesheet', 'script', 'image', 'font',
            'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
          ]
        }
      },
      {
        id: ids.frame,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'X-Frame-Options', operation: 'remove' },
            { header: 'Content-Security-Policy', operation: 'remove' },
            { header: 'Content-Security-Policy-Report-Only', operation: 'remove' }
          ]
        },
        condition: {
          tabIds: [tabId],
          resourceTypes: ['sub_frame']
        }
      }
    ]
  });
}

async function clearRules(tabId) {
  const ids = await dropRuleSlot(tabId);
  if (!ids) return;
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ids.ua, ids.frame]
    });
  } catch (_) {}
}

async function pushHistory(deviceId, url) {
  if (!deviceId) return;
  try {
    const data = await chrome.storage.local.get([DP_HISTORY_KEY]);
    const list = Array.isArray(data[DP_HISTORY_KEY]) ? data[DP_HISTORY_KEY] : [];
    const next = [
      { deviceId, url: url || '', at: Date.now() },
      ...list.filter((e) => !(e.deviceId === deviceId && e.url === (url || '')))
    ].slice(0, DP_HISTORY_MAX);
    await chrome.storage.local.set({ [DP_HISTORY_KEY]: next });
  } catch (_) {}
}

async function bumpReviewOpens() {
  try {
    const data = await chrome.storage.local.get([DP_REVIEW_KEY]);
    const r = data[DP_REVIEW_KEY] || { captures: 0, opens: 0, dismissed: false, snoozeUntil: 0 };
    r.opens = (r.opens || 0) + 1;
    await chrome.storage.local.set({ [DP_REVIEW_KEY]: r });
  } catch (_) {}
}

async function openPreview(deviceId, forcedUrl) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  const activeIsPreview = !!(active && active.url && active.url.startsWith(previewBase()));
  let siteUrl = forcedUrl || null;
  if (!siteUrl && active && active.url && dpIsHttpUrl(active.url) && !activeIsPreview) {
    siteUrl = active.url;
  }

  await pushHistory(deviceId, siteUrl);
  await bumpReviewOpens();
  bumpWeekSession();

  const existing = await chrome.tabs.query({ url: previewBase() + '*' });
  if (existing.length) {
    const tab = existing[0];
    await enablePanel(tab.id);
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    try {
      await chrome.runtime.sendMessage({ type: 'set-device', deviceId, tabId: tab.id, url: siteUrl });
    } catch (_) {
      const query = `device=${encodeURIComponent(deviceId)}` +
        (siteUrl ? `&url=${encodeURIComponent(siteUrl)}` : '');
      await chrome.tabs.update(tab.id, { url: `${previewBase()}?${query}` });
    }
    return;
  }

  const url = siteUrl || DP_DEMO_URL;
  const previewUrl =
    `${previewBase()}?device=${encodeURIComponent(deviceId)}&url=${encodeURIComponent(url)}`;

  if (active && typeof active.id === 'number' && !activeIsPreview) {
    await chrome.tabs.update(active.id, { url: previewUrl });
    await enablePanel(active.id);
  } else {
    const created = await chrome.tabs.create({ url: previewUrl });
    if (created && typeof created.id === 'number') await enablePanel(created.id);
  }
}

async function reopenLastPreview() {
  const data = await chrome.storage.local.get(['lastState', DP_HISTORY_KEY]);
  const last = data.lastState || {};
  const hist = Array.isArray(data[DP_HISTORY_KEY]) ? data[DP_HISTORY_KEY] : [];
  const deviceId = last.deviceId || (hist[0] && hist[0].deviceId);
  if (!deviceId) {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active && typeof active.id === 'number') {
      await enablePanel(active.id);
      await chrome.sidePanel.open({ tabId: active.id }).catch(() => {});
    }
    return;
  }
  const url = last.url || (hist[0] && hist[0].url) || null;
  await openPreview(deviceId, url && dpIsHttpUrl(url) ? url : null);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const needsTab = ['apply-device', 'capture', 'reset-tab'];
    if (msg && needsTab.includes(msg.type) && !(sender.tab && typeof sender.tab.id === 'number')) {
      sendResponse({ ok: false, error: 'esta ação só vale para a aba da prévia' });
      return;
    }
    try {
      switch (msg && msg.type) {
        case 'open-preview':
          await openPreview(msg.deviceId, msg.url || null);
          sendResponse({ ok: true });
          break;
        case 'open-preset': {
          const preset = DP_PRESETS.find((p) => p.id === msg.presetId);
          if (!preset) {
            sendResponse({ ok: false, error: 'preset desconhecido' });
            break;
          }
          const stored = await chrome.storage.local.get(['favorites']);
          const favs = new Set(Array.isArray(stored.favorites) ? stored.favorites : []);
          for (const id of preset.devices) favs.add(id);
          await chrome.storage.local.set({ favorites: [...favs] });
          await openPreview(preset.devices[0], msg.url || null);
          sendResponse({ ok: true, favorites: [...favs] });
          break;
        }
        case 'apply-device':
          await applyDevice(sender.tab.id, msg);
          sendResponse({ ok: true });
          break;
        case 'capture': {
          const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
          sendResponse({ ok: true, dataUrl });
          break;
        }
        case 'reset-tab':
          await clearRules(sender.tab.id);
          sendResponse({ ok: true });
          break;
        case 'get-growth-urls':
          sendResponse({
            ok: true,
            store: DP_STORE_URL,
            review: DP_REVIEW_URL,
            faq: DP_FAQ_URL,
            landing: DP_LANDING_URL
          });
          break;
        default:
          // Acontece quando o service worker em memória é de uma versão anterior
          // à das páginas (extensão editada sem recarregar): o painel novo pede
          // algo que este código ainda não conhece. Nomear a mensagem e a versão
          // evita o diagnóstico às cegas.
          sendResponse({
            ok: false,
            error: `mensagem desconhecida "${(msg && msg.type) || '—'}" ` +
              `(service worker ${chrome.runtime.getManifest().version}; ` +
              'recarregue a extensão em chrome://extensions)'
          });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => { clearRules(tabId); });
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url && !info.url.startsWith(previewBase())) clearRules(tabId);
});
