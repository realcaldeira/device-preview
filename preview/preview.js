// Página de prévia: renderiza o mockup com moldura realista e controla
// navegação, orientação, zoom, tema e captura de tela.

// Parâmetros visuais da moldura por tipo de recorte.
const FRAME_PRESETS = {
  'notch':      { padTop: 16, padSide: 16, padBottom: 16, radius: 54, screenRadius: 40, sb: 40, kind: 'phone' },
  'island':     { padTop: 14, padSide: 14, padBottom: 14, radius: 56, screenRadius: 44, sb: 54, kind: 'phone' },
  'punch':      { padTop: 11, padSide: 11, padBottom: 13, radius: 38, screenRadius: 26, sb: 30, kind: 'phone' },
  'punch-left': { padTop: 11, padSide: 11, padBottom: 13, radius: 38, screenRadius: 26, sb: 30, kind: 'phone' },
  'drop':       { padTop: 12, padSide: 12, padBottom: 20, radius: 34, screenRadius: 22, sb: 28, kind: 'phone' },
  'home':       { padTop: 80, padSide: 18, padBottom: 86, radius: 56, screenRadius: 4,  sb: 22, kind: 'phone' },
  'tablet':     { padTop: 32, padSide: 32, padBottom: 32, radius: 36, screenRadius: 12, sb: 26, kind: 'tablet' },
  'tv':         { padTop: 10, padSide: 10, padBottom: 6,  radius: 12, screenRadius: 3,  sb: 0,  kind: 'tv' }
};

// Marca (para acabamento da moldura) e layout dos botões físicos.
function brandOf(d) {
  if (d.frame === 'tv') return 'tv';
  if (d.platform === 'iOS') return d.frame === 'tablet' ? 'ipad' : 'iphone';
  if (d.platform === 'Windows') return 'surface';
  const prefix = d.id.split('-')[0];
  return ['galaxy', 'pixel', 'xiaomi', 'huawei', 'oppo', 'oneplus'].includes(prefix) ? prefix : 'android';
}

function buttonLayout(brand) {
  switch (brand) {
    case 'iphone': return 'iphone';
    case 'pixel': return 'pixel';
    case 'ipad': return 'ipad';
    case 'surface': return 'top';
    case 'tv': return 'none';
    default: return 'right';
  }
}

const ZOOM_MIN = 10;
const ZOOM_MAX = 300;
const ZOOM_STEP = 10;

let categories = [];
let deviceMap = {};
let device = null;
let myTabId = null;
// Profundidade aproximada do histórico de navegação do iframe; o "Voltar"
// só é habilitado quando há para onde voltar DENTRO do iframe, para nunca
// sair da página de prévia.
let frameNavs = 0;

const state = {
  orientation: 'portrait',
  zoom: 'fit',        // 'fit' ou número (porcentagem)
  currentUrl: '',
  theme: 'dark',
  frameless: false,   // tela cheia: só o iframe, sem a moldura do aparelho
  stretch: false      // esticar: preenche a janela distorcendo a proporção
};

const $ = (id) => document.getElementById(id);
const els = {
  select: $('deviceSelect'), rotate: $('rotateBtn'),
  frameless: $('framelessBtn'), stretch: $('stretchBtn'),
  back: $('backBtn'), reload: $('reloadBtn'), address: $('addressInput'), go: $('goBtn'),
  zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'), zoomFit: $('zoomFitBtn'), zoomLabel: $('zoomLabel'),
  theme: $('themeBtn'), iconMoon: $('iconMoon'), iconSun: $('iconSun'), shot: $('shotBtn'),
  deep: $('deepBtn'),
  stage: $('stage'), zoomBox: $('zoomBox'), mockup: $('mockup'), frame: $('frame'),
  viewport: $('viewport'), sbTime: $('sbTime'),
  infoName: $('infoName'), infoViewport: $('infoViewport'), infoDpr: $('infoDpr'),
  infoPhysical: $('infoPhysical'), infoUa: $('infoUa'), toast: $('toast')
};

// A página só tem acesso às APIs quando aberta como página da extensão
// (chrome-extension://...), não como arquivo local.
const hasExtensionApis =
  typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.runtime && chrome.runtime.id);

/* ---------- Inicialização ---------- */

async function init() {
  // Eventos de UI primeiro: os botões funcionam mesmo se algo falhar adiante.
  bindUiEvents();
  startClock();

  if (!hasExtensionApis) {
    toast('Abra esta página pela extensão (ícone na barra do Chrome), não como arquivo local.');
    return;
  }

  try {
    const tab = await chrome.tabs.getCurrent();
    myTabId = tab ? tab.id : null;

    const stored = await chrome.storage.local.get(['theme', 'lastState']);
    setTheme(stored.theme === 'light' ? 'light' : 'dark', false);
    const last = stored.lastState || {};

    const res = await fetch(chrome.runtime.getURL('data/devices.json'));
    categories = (await res.json()).categories;
    for (const cat of categories) for (const d of cat.devices) deviceMap[d.id] = d;
    populateSelect();

    bindExtensionEvents();

    // Parâmetros da URL (abertura pelo painel) têm prioridade; na ausência
    // deles, retoma o último estado salvo.
    const params = new URLSearchParams(location.search);
    const requested = params.get('device');
    const deviceId = deviceMap[requested] ? requested
      : (deviceMap[last.deviceId] ? last.deviceId : categories[0].devices[0].id);
    state.currentUrl = params.get('url') || last.url || 'https://www.wikipedia.org/';

    // Zoom independe do aparelho; a orientação só é retomada para o mesmo
    // aparelho do último uso (cada modelo tem sua orientação natural).
    if (last.zoom === 'fit' || typeof last.zoom === 'number') state.zoom = last.zoom;
    const keepOrientation = deviceId === last.deviceId ? last.orientation : null;

    await setDevice(deviceId, { navigate: true, orientation: keepOrientation });
    setFrameless(!!last.frameless, false);
    if (last.stretch) setStretch(true, false);
  } catch (e) {
    toast('Erro ao iniciar a prévia: ' + ((e && e.message) || e));
  }
}

function populateSelect() {
  for (const cat of categories) {
    const group = document.createElement('optgroup');
    group.label = cat.name;
    for (const d of cat.devices) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} — ${d.width}×${d.height}`;
      group.appendChild(opt);
    }
    els.select.appendChild(group);
  }
}

/* ---------- Eventos ---------- */

// Eventos que dependem só do DOM: registrados incondicionalmente.
function bindUiEvents() {
  els.select.addEventListener('change', () => {
    if (deviceMap[els.select.value]) setDevice(els.select.value, { navigate: true });
  });

  els.rotate.addEventListener('click', () => {
    if (!device) return;
    state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
    buildFrame();
    applyZoom();
    if (deepOn && deepTarget) applyDeepOverrides().catch(() => {});
    toast(state.orientation === 'portrait' ? 'Retrato' : 'Paisagem');
    saveState();
  });

  els.frameless.addEventListener('click', () => setFrameless(!state.frameless, true));
  els.stretch.addEventListener('click', () => setStretch(!state.stretch, true));

  els.back.addEventListener('click', () => {
    if (frameNavs < 2) return;
    frameNavs -= 2; // a navegação de volta re-incrementa no onNav
    updateBackButton();
    history.back();
  });

  els.reload.addEventListener('click', () => {
    if (state.currentUrl) els.viewport.src = state.currentUrl;
  });

  els.go.addEventListener('click', () => navigate(els.address.value));
  els.address.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(els.address.value);
  });

  els.zoomIn.addEventListener('click', () => stepZoom(ZOOM_STEP));
  els.zoomOut.addEventListener('click', () => stepZoom(-ZOOM_STEP));
  els.zoomFit.addEventListener('click', () => { state.zoom = 'fit'; applyZoom(); saveState(); });

  els.theme.addEventListener('click', () =>
    setTheme(state.theme === 'dark' ? 'light' : 'dark', true));

  els.shot.addEventListener('click', captureShot);
  els.deep.addEventListener('click', () => setDeepEmu(!deepOn));

  window.addEventListener('resize', () => { if (state.zoom === 'fit') applyZoom(); });
  window.addEventListener('pagehide', () => {
    if (deepTarget) { try { chrome.debugger.detach(deepTarget); } catch (_) {} }
  });
}

// Eventos que dependem das APIs da extensão.
function bindExtensionEvents() {
  // Acompanha a navegação dentro do iframe para manter a barra de endereço correta.
  const onNav = (details) => {
    if (details.tabId !== myTabId || details.frameId === 0 || details.parentFrameId !== 0) return;
    if (details.url === 'about:blank') return;
    // Recarregamentos não criam entrada nova no histórico.
    if (details.transitionType !== 'reload') {
      frameNavs++;
      updateBackButton();
    }
    state.currentUrl = details.url;
    if (document.activeElement !== els.address) els.address.value = details.url;
    if (deepOn) scheduleDeepReattach();
    saveState();
  };
  chrome.webNavigation.onCommitted.addListener(onNav);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onNav);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(onNav);

  // Permite que o side panel troque o dispositivo sem recarregar a página.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'set-device' && msg.tabId === myTabId) {
      setDevice(msg.deviceId, { navigate: true });
      sendResponse({ ok: true });
    }
  });

  // Emulação profunda: reage ao desanexo do depurador (aviso do Chrome
  // cancelado pelo usuário, ou alvo destruído por navegação).
  if (chrome.debugger && chrome.debugger.onDetach) {
    chrome.debugger.onDetach.addListener((source, reason) => {
      if (!deepTarget || source.targetId !== deepTarget.targetId) return;
      if (reason === 'canceled_by_user') {
        deepOn = false;
        deepTarget = null;
        deepOrigin = null;
        updateDeepButton();
        toast('Emulação profunda desativada pelo aviso do Chrome');
      } else if (deepOn) {
        // Alvo destruído (navegação para outro site): re-anexa ao novo alvo.
        scheduleDeepReattach();
      }
    });
  }
}

/* ---------- Dispositivo e moldura ---------- */

function dims() {
  const small = Math.min(device.width, device.height);
  const large = Math.max(device.width, device.height);
  return state.orientation === 'portrait' ? { w: small, h: large } : { w: large, h: small };
}

async function setDevice(id, { navigate: doNavigate = false, orientation = null } = {}) {
  const next = deviceMap[id];
  if (!next) return;
  device = next;
  els.select.value = id;

  // TVs nascem em paisagem; demais dispositivos, em retrato — salvo quando uma
  // orientação lembrada do último uso deste aparelho é informada.
  const natural = device.width > device.height ? 'landscape' : 'portrait';
  state.orientation = orientation === 'portrait' || orientation === 'landscape' ? orientation : natural;

  // Aplica UA + liberação de iframe ANTES de carregar o site.
  if (hasExtensionApis) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'apply-device',
        userAgent: device.ua,
        platform: device.platform,
        mobile: device.mobile
      });
      if (!res || !res.ok) {
        toast('Falha ao aplicar o User-Agent: ' + ((res && res.error) || 'sem resposta do service worker'));
      }
    } catch (e) {
      toast('Falha ao aplicar o User-Agent: ' + e.message);
    }
  }

  buildFrame();
  updateInfo();
  renderClock();
  applyZoom();

  if (doNavigate && state.currentUrl) {
    els.viewport.src = state.currentUrl;
    els.address.value = state.currentUrl;
  }

  document.title = `Device Preview — ${device.name}`;
  saveState();
}

function buildFrame() {
  const preset = FRAME_PRESETS[device.frame] || FRAME_PRESETS.punch;
  const { w, h } = dims();

  const brand = brandOf(device);
  els.mockup.dataset.cutout = device.frame;
  els.mockup.dataset.kind = preset.kind;
  els.mockup.dataset.orientation = state.orientation;
  els.mockup.dataset.brand = brand;
  els.mockup.dataset.buttons = buttonLayout(brand);
  els.mockup.dataset.platform =
    device.platform === 'iOS' ? 'ios' :
    device.platform === 'Android' ? 'android' :
    device.platform === 'Windows' ? 'windows' : 'tv';

  // Quando o aparelho está girado em relação à orientação natural,
  // os bezels giram junto: topo → esquerda, base → direita.
  const natural = device.width > device.height ? 'landscape' : 'portrait';
  const rotated = state.orientation !== natural;
  const pads = rotated
    ? { top: preset.padSide, right: preset.padBottom, bottom: preset.padSide, left: preset.padTop }
    : { top: preset.padTop, right: preset.padSide, bottom: preset.padBottom, left: preset.padSide };

  const s = els.mockup.style;
  s.setProperty('--vw', w + 'px');
  s.setProperty('--vh', h + 'px');
  s.setProperty('--sb-h', preset.sb + 'px');
  s.setProperty('--pad-top', pads.top + 'px');
  s.setProperty('--pad-right', pads.right + 'px');
  s.setProperty('--pad-bottom', pads.bottom + 'px');
  s.setProperty('--pad-left', pads.left + 'px');
  s.setProperty('--frame-radius', preset.radius + 'px');
  s.setProperty('--screen-radius', preset.screenRadius + 'px');
}

function updateInfo() {
  const { w, h } = dims();
  els.infoName.textContent = device.name;
  els.infoViewport.textContent = `${w} × ${h} px (CSS)`;
  els.infoDpr.textContent = `DPR ${device.dpr}`;
  els.infoPhysical.textContent = `físico ${device.physical} px`;
  els.infoUa.textContent = 'UA: ' + device.ua;
  els.infoUa.title = device.ua;
}

function updateBackButton() {
  els.back.disabled = frameNavs < 2;
}

// Tela cheia: alterna a exibição apenas do iframe (sem moldura), preservando
// a resolução do dispositivo. O zoom é reaplicado porque o mockup muda de tamanho.
function setFrameless(on, persist) {
  state.frameless = on;
  els.mockup.classList.toggle('frameless', on);
  document.body.classList.toggle('frameless', on);
  els.frameless.classList.toggle('on', on);
  els.frameless.setAttribute('aria-pressed', String(on));
  // Esticar só existe dentro da tela cheia: ao sair dela, também sai do esticar
  // (restaurando o zoom manual anterior, se houver).
  if (!on && state.stretch) disableStretch(true);
  applyZoom();
  if (persist) {
    toast(on ? 'Tela cheia: só a tela do dispositivo' : 'Moldura do dispositivo visível');
    saveState();
  }
}

// Atualiza apenas o estado/visual do esticar (sem reaplicar o zoom).
function applyStretchState(on) {
  state.stretch = on;
  document.body.classList.toggle('stretch', on);
  els.stretch.classList.toggle('on', on);
  els.stretch.setAttribute('aria-pressed', String(on));
}

let zoomBeforeStretch = null;   // zoom manual salvo ao entrar no esticar

// Desliga o esticar; opcionalmente restaura o zoom manual que havia antes.
function disableStretch(restoreZoom) {
  applyStretchState(false);
  if (restoreZoom && zoomBeforeStretch !== null) state.zoom = zoomBeforeStretch;
  zoomBeforeStretch = null;
}

// Esticar: preenche toda a janela distorcendo a proporção. Exige a tela cheia
// (ligá-lo ativa a tela cheia) e opera sempre no modo "ajustar à janela".
function setStretch(on, persist) {
  if (on && !state.frameless) setFrameless(true, false);
  if (on) {
    if (state.zoom !== 'fit') zoomBeforeStretch = state.zoom; // lembra o zoom manual
    state.zoom = 'fit';
    applyStretchState(true);
  } else {
    disableStretch(true);
  }
  applyZoom();
  if (persist) {
    toast(on ? 'Esticado: preenche a janela (distorce a proporção)' : 'Proporção do dispositivo restaurada');
    saveState();
  }
}

/* ---------- Navegação ---------- */

function normalizeUrl(input) {
  const value = (input || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(value) || value.startsWith('localhost')) {
    return 'https://' + value;
  }
  return 'https://www.google.com/search?q=' + encodeURIComponent(value);
}

function navigate(input) {
  const url = normalizeUrl(input);
  if (!url) return;
  state.currentUrl = url;
  els.address.value = url;
  els.viewport.src = url;
  saveState();
}

/* ---------- Zoom ---------- */

function currentScale() {
  if (state.zoom !== 'fit') return state.zoom / 100;
  const mw = els.mockup.offsetWidth;
  const mh = els.mockup.offsetHeight;
  if (!mw || !mh) return 1;
  // Tela cheia: folga mínima e permite ampliar acima de 100% para preencher
  // o palco; com moldura, mantém a folga e o teto de 100%.
  const margin = state.frameless ? 16 : 48;
  const maxScale = state.frameless ? 6 : 1;
  const availW = els.stage.clientWidth - margin;
  const availH = els.stage.clientHeight - margin;
  return Math.max(Math.min(availW / mw, availH / mh, maxScale), 0.04);
}

function applyZoom() {
  const mw = els.mockup.offsetWidth;
  const mh = els.mockup.offsetHeight;

  // Esticar: escala não-uniforme que preenche a área disponível em ambos os
  // eixos (distorce a proporção). Só no modo tela cheia + ajustar à janela.
  if (state.frameless && state.stretch && state.zoom === 'fit' && mw && mh) {
    const margin = 16;
    const sx = Math.max((els.stage.clientWidth - margin) / mw, 0.04);
    const sy = Math.max((els.stage.clientHeight - margin) / mh, 0.04);
    els.mockup.style.transform = `scale(${sx}, ${sy})`;
    els.zoomBox.style.width = mw * sx + 'px';
    els.zoomBox.style.height = mh * sy + 'px';
    els.zoomLabel.textContent = `${Math.round(sx * 100)}×${Math.round(sy * 100)}`;
    els.zoomLabel.title = 'Esticado para preencher a janela';
    return;
  }

  const scale = currentScale();
  els.mockup.style.transform = `scale(${scale})`;
  els.zoomBox.style.width = mw * scale + 'px';
  els.zoomBox.style.height = mh * scale + 'px';
  els.zoomLabel.textContent = Math.round(scale * 100) + '%';
  els.zoomLabel.title = state.zoom === 'fit' ? 'Zoom ajustado à janela' : 'Zoom manual';
}

function stepZoom(delta) {
  let current;
  if (state.stretch) {
    // Zoom manual é incompatível com o esticar (escala não-uniforme). Sai do
    // esticar a partir do tamanho REALMENTE exibido, evitando um salto; o
    // usuário está ajustando, então não restaura o zoom anterior.
    const mw = els.mockup.offsetWidth;
    const rendered = els.mockup.getBoundingClientRect().width;
    current = mw ? Math.round((rendered / mw) * 100) : Math.round(currentScale() * 100);
    disableStretch(false);
  } else {
    current = Math.round(currentScale() * 100);
  }
  state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + delta));
  applyZoom();
  saveState();
}

/* ---------- Tema ---------- */

function setTheme(theme, persist) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  els.iconMoon.classList.toggle('hidden', theme === 'light');
  els.iconSun.classList.toggle('hidden', theme === 'dark');
  if (persist && hasExtensionApis) chrome.storage.local.set({ theme });
}

/* ---------- Persistência do último estado ---------- */

// Salva dispositivo, URL, orientação e zoom para retomar ao reabrir a prévia.
// Debounce evita gravações em rajada (ex.: navegações encadeadas).
let saveTimer = null;
function saveState() {
  if (!hasExtensionApis) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({
      lastState: {
        deviceId: device ? device.id : null,
        url: state.currentUrl,
        orientation: state.orientation,
        zoom: state.zoom,
        frameless: state.frameless,
        stretch: state.stretch
      }
    });
  }, 250);
}

/* ---------- Captura de tela ---------- */

async function captureShot() {
  if (!device) { toast('Escolha um dispositivo primeiro.'); return; }
  if (!hasExtensionApis) { toast('Captura disponível apenas pela extensão.'); return; }

  const before = els.mockup.getBoundingClientRect();
  const fits = before.top >= 0 && before.left >= 0 &&
               before.bottom <= window.innerHeight && before.right <= window.innerWidth;

  // Garante o mockup inteiro visível antes de capturar.
  let restoreZoom = null;
  if (!fits) {
    restoreZoom = state.zoom;
    state.zoom = 'fit';
    applyZoom();
    els.stage.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 180));
  }

  try {
    const res = await chrome.runtime.sendMessage({ type: 'capture' });
    if (!res || !res.ok) throw new Error((res && res.error) || 'falha na captura');

    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = res.dataUrl; });

    // Converte o retângulo do mockup (px CSS) para px da imagem capturada.
    const ratio = img.width / window.innerWidth;
    const r = els.mockup.getBoundingClientRect();
    const sx = Math.max(r.left, 0) * ratio;
    const sy = Math.max(r.top, 0) * ratio;
    const sw = Math.min(r.width, window.innerWidth - Math.max(r.left, 0)) * ratio;
    const sh = Math.min(r.height, window.innerHeight - Math.max(r.top, 0)) * ratio;

    // Saída sempre na resolução física do dispositivo (width×height × DPR),
    // limitada a 8192 px por lado. O drawImage mapeia a região capturada para
    // esse tamanho com eixos independentes, então a imagem sai na proporção
    // correta do aparelho mesmo quando a visualização está esticada.
    const { w, h } = dims();
    const physW = Math.round(w * device.dpr);
    const physH = Math.round(h * device.dpr);
    let outW = physW;
    let outH = physH;
    const MAX_DIM = 8192;
    if (outW > MAX_DIM || outH > MAX_DIM) {
      const clamp = Math.min(MAX_DIM / outW, MAX_DIM / outH);
      outW = Math.round(outW * clamp);
      outH = Math.round(outH * clamp);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const link = document.createElement('a');
    link.download = `device-preview_${device.id}_${physW}x${physH}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast(`Captura salva (${outW}×${outH} px)`);
  } catch (e) {
    toast('Erro na captura: ' + e.message);
  } finally {
    if (restoreZoom !== null) {
      state.zoom = restoreZoom;
      applyZoom();
    }
  }
}

/* ---------- Emulação profunda (chrome.debugger) ----------
   Anexa o protocolo de depuração ao alvo do PRÓPRIO IFRAME (sites em
   iframe cross-origin rodam em processo separado e aparecem como alvo
   individual), aplicando: User-Agent via JavaScript, devicePixelRatio
   real e emulação de toque. A interface da prévia não é afetada. */

let deepOn = false;
let deepTarget = null;   // { targetId }
let deepOrigin = null;   // último origin com overrides aplicados
let deepLastUa = null;   // último UA aplicado (força reload ao trocar de aparelho)
let deepTimer = null;

function uaPlatformFor(d) {
  if (d.platform === 'iOS') return d.frame === 'tablet' ? 'iPad' : 'iPhone';
  if (d.platform === 'Windows') return 'Win32';
  if (d.platform === 'Android') return 'Linux armv8l';
  return 'Linux';
}

// Client hints via JS (navigator.userAgentData): só para plataformas Chromium.
function uaMetadataFor(d) {
  if (d.platform !== 'Android' && d.platform !== 'Windows') return null;
  return {
    brands: [
      { brand: 'Chromium', version: '125' },
      { brand: 'Google Chrome', version: '125' },
      { brand: 'Not.A/Brand', version: '24' }
    ],
    fullVersion: '125.0.0.0',
    platform: d.platform,
    platformVersion: d.platform === 'Android' ? '14.0.0' : '10.0.0',
    architecture: d.platform === 'Android' ? '' : 'x86',
    model: '',
    mobile: !!d.mobile
  };
}

function sendCdp(cmd, params) {
  return chrome.debugger.sendCommand(deepTarget, cmd, params || {});
}

// Localiza o alvo de depuração do iframe (heurística por URL; o alvo de
// um subframe cross-origin não é do tipo 'page').
async function findFrameTarget() {
  const targets = await chrome.debugger.getTargets();
  let t = targets.find((x) => x.type !== 'page' && x.url === state.currentUrl);
  if (!t) {
    try {
      const origin = new URL(state.currentUrl).origin;
      t = targets.find((x) => x.type !== 'page' && x.url && x.url.startsWith(origin));
    } catch (_) { /* URL inválida */ }
  }
  return t || null;
}

async function applyDeepOverrides() {
  const { w, h } = dims();
  const params = {
    userAgent: device.ua,
    acceptLanguage: 'pt-BR,pt;q=0.9',
    platform: uaPlatformFor(device)
  };
  const md = uaMetadataFor(device);
  if (md) params.userAgentMetadata = md;
  await sendCdp('Emulation.setUserAgentOverride', params);
  deepLastUa = device.ua;

  // Métricas e toque podem não ser aceitos por todos os alvos;
  // o UA via JS continua valendo mesmo se falharem.
  try {
    await sendCdp('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: device.dpr,
      mobile: device.mobile !== false
    });
  } catch (_) {}
  try {
    await sendCdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sendCdp('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  } catch (_) {}
}

async function deepAttach({ reloadAfter = false } = {}) {
  const target = await findFrameTarget();
  if (!target) {
    throw new Error('alvo do iframe não encontrado (aguarde o site carregar e tente de novo)');
  }
  deepTarget = { targetId: target.id };
  if (!target.attached) await chrome.debugger.attach(deepTarget, '1.3');
  await applyDeepOverrides();
  if (reloadAfter) await sendCdp('Page.reload');
}

async function setDeepEmu(on) {
  if (on === deepOn) return;
  if (on) {
    if (!hasExtensionApis || !chrome.debugger) {
      toast('Emulação profunda disponível apenas pela extensão.');
      return;
    }
    if (!device || !state.currentUrl) {
      toast('Carregue um site antes de ativar a emulação profunda.');
      return;
    }
    try {
      await deepAttach({ reloadAfter: true });
      deepOn = true;
      try { deepOrigin = new URL(state.currentUrl).origin; } catch (_) { deepOrigin = null; }
      toast('Emulação profunda ativada: UA via JS, DPR e toque reais');
    } catch (e) {
      deepTarget = null;
      toast('Não foi possível ativar: ' + e.message);
    }
  } else {
    deepOn = false;
    deepOrigin = null;
    deepLastUa = null;
    if (deepTarget) {
      try { await chrome.debugger.detach(deepTarget); } catch (_) {}
    }
    deepTarget = null;
    if (state.currentUrl) els.viewport.src = state.currentUrl;
    toast('Emulação profunda desativada');
  }
  updateDeepButton();
}

function updateDeepButton() {
  els.deep.classList.toggle('on', deepOn);
  els.deep.setAttribute('aria-pressed', String(deepOn));
}

// Após cada navegação do iframe: re-anexa ao alvo (que pode ter sido
// recriado) e recarrega uma única vez quando o origin ou o UA mudou,
// para que os scripts da página vejam os valores certos desde o início.
function scheduleDeepReattach() {
  clearTimeout(deepTimer);
  deepTimer = setTimeout(async () => {
    if (!deepOn) return;
    let origin = null;
    try { origin = new URL(state.currentUrl).origin; } catch (_) {}
    const needsReload = origin !== deepOrigin || deepLastUa !== device.ua;
    try {
      await deepAttach({ reloadAfter: needsReload });
      deepOrigin = origin;
    } catch (_) { /* alvo ainda não existe; nova tentativa na próxima navegação */ }
  }, 350);
}

/* ---------- Relógio e bateria da status bar ---------- */

function renderClock() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ios = device && device.platform === 'iOS';
  els.sbTime.textContent = ios ? `${h}:${m}` : `${String(h).padStart(2, '0')}:${m}`;
}

function startClock() {
  renderClock();
  setInterval(renderClock, 15000);
  updateBattery();
}

// Reflete o nível real de bateria do computador nos ícones da status bar.
async function updateBattery() {
  let level = 1;
  try {
    if (navigator.getBattery) level = (await navigator.getBattery()).level;
  } catch (_) { /* API de bateria indisponível */ }
  const fillIos = document.getElementById('battFillIos');
  const fillAnd = document.getElementById('battFillAnd');
  const pct = document.getElementById('battPct');
  if (fillIos) fillIos.setAttribute('width', String(Math.max(2, Math.round(18 * level))));
  if (fillAnd) fillAnd.setAttribute('width', String(Math.max(2, Math.round(16 * level))));
  if (pct) pct.textContent = Math.round(level * 100) + '%';
}

/* ---------- Toast ---------- */

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

init();
