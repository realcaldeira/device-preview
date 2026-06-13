// Service worker do Device Preview.
// Responsável por: abrir a página de prévia, aplicar regras de rede por aba
// (User-Agent + remoção de cabeçalhos anti-iframe) e capturar screenshots.

const PREVIEW_PATH = 'preview/preview.html';
const previewBase = () => chrome.runtime.getURL(PREVIEW_PATH);

// Clicar no ícone da extensão abre o side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// IDs de regra determinísticos por aba (2 regras por aba de prévia).
function ruleIds(tabId) {
  const base = (tabId % 100000000) * 10;
  return { ua: base + 1, frame: base + 2 };
}

// Aplica o User-Agent do dispositivo e libera o carregamento em <iframe>
// apenas para a aba de prévia (regras de sessão com condição tabIds).
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
}

async function clearRules(tabId) {
  const ids = ruleIds(tabId);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ids.ua, ids.frame]
    });
  } catch (_) { /* aba sem regras */ }
}

// Abre a prévia com o dispositivo escolhido NA PRÓPRIA aba ativa (o site que
// está aberto), sem criar uma nova guia. Se já houver uma aba de prévia, ela é
// reaproveitada trocando apenas o dispositivo.
async function openPreview(deviceId) {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  // Já existe uma prévia aberta: reaproveita-a (sem abrir nada novo).
  const existing = await chrome.tabs.query({ url: previewBase() + '*' });
  if (existing.length) {
    const tab = existing[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    try {
      // Troca o dispositivo sem recarregar a página (preserva a URL navegada).
      await chrome.runtime.sendMessage({ type: 'set-device', deviceId, tabId: tab.id });
    } catch (_) {
      // Página de prévia ainda não está ouvindo: recarrega na própria aba
      // (o último estado salvo restaura a URL que estava sendo navegada).
      await chrome.tabs.update(tab.id, {
        url: `${previewBase()}?device=${encodeURIComponent(deviceId)}`
      });
    }
    return;
  }

  // Carrega o site da aba ativa dentro da moldura; sem URL utilizável, usa um padrão.
  let url = 'https://www.wikipedia.org/';
  if (active && active.url && /^https?:/i.test(active.url)) url = active.url;
  const previewUrl =
    `${previewBase()}?device=${encodeURIComponent(deviceId)}&url=${encodeURIComponent(url)}`;

  // Substitui o conteúdo da própria aba ativa pela prévia (sem nova guia).
  if (active && typeof active.id === 'number') {
    await chrome.tabs.update(active.id, { url: previewUrl });
  } else {
    // Caso raro sem aba ativa utilizável: cai para criar uma aba.
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
        default:
          sendResponse({ ok: false, error: 'mensagem desconhecida' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // resposta assíncrona
});

// Limpeza das regras quando a aba de prévia fecha ou navega para fora.
chrome.tabs.onRemoved.addListener((tabId) => { clearRules(tabId); });
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url && !info.url.startsWith(previewBase())) clearRules(tabId);
});
