importScripts('/shared/url.js');

const PREVIEW_PATH = 'preview/preview.html';
const previewBase = () => chrome.runtime.getURL(PREVIEW_PATH);

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function ruleIds(tabId) {
  const base = (tabId % 100000000) * 10;
  return { ua: base + 1, frame: base + 2 };
}

const RULE_TABS_KEY = 'ruleTabs';

async function getRuleTabs() {
  const data = await chrome.storage.session.get(RULE_TABS_KEY);
  return new Set(Array.isArray(data[RULE_TABS_KEY]) ? data[RULE_TABS_KEY] : []);
}

async function rememberRuleTab(tabId) {
  const set = await getRuleTabs();
  if (set.has(tabId)) return;
  set.add(tabId);
  await chrome.storage.session.set({ [RULE_TABS_KEY]: [...set] });
}

async function applyDevice(tabId, { userAgent, platform = 'Android', mobile = true }) {
  const ids = ruleIds(tabId);
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
  await rememberRuleTab(tabId);
}

async function clearRules(tabId) {
  const set = await getRuleTabs();
  if (!set.delete(tabId)) return;
  const ids = ruleIds(tabId);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ids.ua, ids.frame]
    });
  } catch (_) {  }
  await chrome.storage.session.set({ [RULE_TABS_KEY]: [...set] });
}

async function openPreview(deviceId) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  const activeIsPreview = !!(active && active.url && active.url.startsWith(previewBase()));
  let siteUrl = null;
  if (active && active.url && dpIsHttpUrl(active.url) && !activeIsPreview) {
    siteUrl = active.url;
  }

  const existing = await chrome.tabs.query({ url: previewBase() + '*' });
  if (existing.length) {
    const tab = existing[0];
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

  const url = siteUrl || 'https://www.wikipedia.org/';
  const previewUrl =
    `${previewBase()}?device=${encodeURIComponent(deviceId)}&url=${encodeURIComponent(url)}`;

  if (active && typeof active.id === 'number' && !activeIsPreview) {
    await chrome.tabs.update(active.id, { url: previewUrl });
  } else {
    await chrome.tabs.create({ url: previewUrl });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg && msg.type) {
        case 'open-preview':
          await openPreview(msg.deviceId);
          sendResponse({ ok: true });
          break;
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
        default:
          sendResponse({ ok: false, error: 'mensagem desconhecida' });
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
