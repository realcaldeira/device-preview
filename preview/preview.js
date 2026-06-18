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

let frameNavs = 0;

const state = {
  orientation: 'portrait',
  zoom: 'fit',
  currentUrl: '',
  theme: 'dark',
  frameless: false,
  stretch: false
};

const $ = (id) => document.getElementById(id);
const els = {
  select: $('deviceSelect'), rotate: $('rotateBtn'),
  frameless: $('framelessBtn'), stretch: $('stretchBtn'),
  back: $('backBtn'), reload: $('reloadBtn'), address: $('addressInput'), go: $('goBtn'),
  zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'), zoomFit: $('zoomFitBtn'), zoomLabel: $('zoomLabel'),
  theme: $('themeBtn'), iconMoon: $('iconMoon'), iconSun: $('iconSun'), shot: $('shotBtn'),
  fps: $('fpsBtn'), fpsMeter: $('fpsMeter'), fpsValue: $('fpsValue'), fpsDetail: $('fpsDetail'),
  exit: $('exitBtn'),
  stage: $('stage'), zoomBox: $('zoomBox'), mockup: $('mockup'),
  viewport: $('viewport'), sbTime: $('sbTime'),
  infoName: $('infoName'), infoViewport: $('infoViewport'), infoDpr: $('infoDpr'),
  infoPhysical: $('infoPhysical'), infoUa: $('infoUa'), toast: $('toast')
};

const hasExtensionApis =
  typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.runtime && chrome.runtime.id);

async function init() {

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

    const params = new URLSearchParams(location.search);
    const requested = params.get('device');
    const deviceId = deviceMap[requested] ? requested
      : (deviceMap[last.deviceId] ? last.deviceId : categories[0].devices[0].id);
    state.currentUrl = params.get('url') || last.url || 'https://www.wikipedia.org/';

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

function bindUiEvents() {
  els.select.addEventListener('change', () => {
    if (deviceMap[els.select.value]) setDevice(els.select.value, { navigate: true });
  });

  els.rotate.addEventListener('click', () => {
    if (!device) return;
    state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
    buildFrame();
    applyZoom();
    toast(state.orientation === 'portrait' ? 'Retrato' : 'Paisagem');
    saveState();
  });

  els.frameless.addEventListener('click', () => setFrameless(!state.frameless, true));
  els.stretch.addEventListener('click', () => setStretch(!state.stretch, true));

  els.back.addEventListener('click', () => {
    if (frameNavs < 2) return;
    // history.back() reabre uma navegação no iframe, que o onNav abaixo vai
    // recontar (frameNavs++). Descontamos 2 aqui para o saldo líquido ser -1.
    frameNavs -= 2;
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
  els.fps.addEventListener('click', () => setFpsMeter(!fpsOn));
  els.exit.addEventListener('click', exitPreview);

  window.addEventListener('resize', () => { if (state.zoom === 'fit') applyZoom(); });
  window.addEventListener('pagehide', () => {
    stopFpsPolling();
    clearTimeout(reattachTimer);
    if (dbgTarget) { try { chrome.debugger.detach(dbgTarget); } catch (_) {} dbgTarget = null; }
  });

  // Não desperdiça leituras de FPS com a aba da prévia em segundo plano.
  document.addEventListener('visibilitychange', () => {
    if (!fpsOn) return;
    if (document.hidden) stopFpsPolling();
    else startFpsPolling();
  });
}

function bindExtensionEvents() {

  const onNav = (details) => {
    if (details.tabId !== myTabId || details.frameId === 0 || details.parentFrameId !== 0) return;
    if (details.url === 'about:blank') return;

    if (details.transitionType !== 'reload') {
      frameNavs++;
      updateBackButton();
    }
    state.currentUrl = details.url;
    if (document.activeElement !== els.address) els.address.value = details.url;
    if (fpsOn) scheduleReattach();
    saveState();
  };
  chrome.webNavigation.onCommitted.addListener(onNav);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onNav);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(onNav);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'set-device' && msg.tabId === myTabId) {
      if (msg.url) {
        state.currentUrl = msg.url;
        els.address.value = msg.url;
      }
      setDevice(msg.deviceId, { navigate: true });
      sendResponse({ ok: true });
    }
  });

  ensureDebuggerListeners();
}

let debuggerListenersReady = false;
function ensureDebuggerListeners() {
  if (debuggerListenersReady) return;
  if (!chrome.debugger || !chrome.debugger.onDetach) return;
  debuggerListenersReady = true;

  chrome.debugger.onDetach.addListener((source, reason) => {
    if (!dbgTarget || source.targetId !== dbgTarget.targetId) return;
    if (reason === 'canceled_by_user') {
      resetFpsState('Medição encerrada pelo aviso do Chrome');
    } else if (fpsOn) {
      // A sessão caiu (ex.: o iframe navegou). Esquece o alvo para a
      // re-anexação refazer attach/enable do zero, sem reusar a sessão morta.
      dbgTarget = null;
      showFps(null);
      scheduleReattach();
    }
  });
}

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

  const natural = device.width > device.height ? 'landscape' : 'portrait';
  state.orientation = orientation === 'portrait' || orientation === 'landscape' ? orientation : natural;

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

function setFrameless(on, persist) {
  state.frameless = on;
  els.mockup.classList.toggle('frameless', on);
  document.body.classList.toggle('frameless', on);
  els.frameless.classList.toggle('on', on);
  els.frameless.setAttribute('aria-pressed', String(on));

  if (!on && state.stretch) disableStretch(true);
  applyZoom();
  if (persist) {
    toast(on ? 'Tela cheia: só a tela do dispositivo' : 'Moldura do dispositivo visível');
    saveState();
  }
}

function applyStretchState(on) {
  state.stretch = on;
  document.body.classList.toggle('stretch', on);
  els.stretch.classList.toggle('on', on);
  els.stretch.setAttribute('aria-pressed', String(on));
}

let zoomBeforeStretch = null;

function disableStretch(restoreZoom) {
  applyStretchState(false);
  if (restoreZoom && zoomBeforeStretch !== null) state.zoom = zoomBeforeStretch;
  zoomBeforeStretch = null;
}

function setStretch(on, persist) {
  if (on && !state.frameless) setFrameless(true, false);
  if (on) {
    if (state.zoom !== 'fit') zoomBeforeStretch = state.zoom;
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

function schemeFor(value) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?=[:/?#]|$)/i.test(value) ||
         /^[\w-]+(\.[\w-]+)*\.local(?=[:/?#]|$)/i.test(value)
    ? 'http://' : 'https://';
}

function normalizeUrl(input) {
  const value = (input || '').trim();
  if (!value) return null;
  if (dpIsHttpUrl(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(value) || value.startsWith('localhost')) {
    return schemeFor(value) + value;
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

async function exitPreview() {
  // Limpa as regras de User-Agent deste tab antes de sair (para o site abrir com
  // o UA normal). O debugger, se ativo, é desanexado pelo handler de 'pagehide'.
  if (hasExtensionApis) {
    try { await chrome.runtime.sendMessage({ type: 'reset-tab' }); } catch (_) {}
  }
  const url = state.currentUrl;
  if (dpIsHttpUrl(url)) {
    window.location.href = url;
  } else if (hasExtensionApis && myTabId != null) {
    try { await chrome.tabs.remove(myTabId); } catch (_) { try { window.close(); } catch (__) {} }
  } else {
    try { window.close(); } catch (_) {}
  }
}

function currentScale() {
  if (state.zoom !== 'fit') return state.zoom / 100;
  const mw = els.mockup.offsetWidth;
  const mh = els.mockup.offsetHeight;
  if (!mw || !mh) return 1;

  const margin = state.frameless ? 16 : 48;
  const maxScale = state.frameless ? 6 : 1;
  const availW = els.stage.clientWidth - margin;
  const availH = els.stage.clientHeight - margin;
  return Math.max(Math.min(availW / mw, availH / mh, maxScale), 0.04);
}

function applyZoom() {
  const mw = els.mockup.offsetWidth;
  const mh = els.mockup.offsetHeight;

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

function setTheme(theme, persist) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  els.iconMoon.classList.toggle('hidden', theme === 'light');
  els.iconSun.classList.toggle('hidden', theme === 'dark');
  if (persist && hasExtensionApis) chrome.storage.local.set({ theme });
}

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

async function captureShot() {
  if (!device) { toast('Escolha um dispositivo primeiro.'); return; }
  if (!hasExtensionApis) { toast('Captura disponível apenas pela extensão.'); return; }

  const before = els.mockup.getBoundingClientRect();
  const fits = before.top >= 0 && before.left >= 0 &&
               before.bottom <= window.innerHeight && before.right <= window.innerWidth;

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

    const ratio = img.width / window.innerWidth;
    const r = els.mockup.getBoundingClientRect();
    const sx = Math.max(r.left, 0) * ratio;
    const sy = Math.max(r.top, 0) * ratio;
    const sw = Math.min(r.width, window.innerWidth - Math.max(r.left, 0)) * ratio;
    const sh = Math.min(r.height, window.innerHeight - Math.max(r.top, 0)) * ratio;

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

let fpsOn = false;
let fpsBusy = false;
let dbgTarget = null;
let reattachTimer = null;
let reattachTries = 0;
let fpsPollTimer = null;

// Limite de re-anexações automáticas antes de desistir e avisar o usuário.
const MAX_REATTACH_TRIES = 6;

// Sonda injetada no contexto real do site embutido: registra o tempo de cada
// quadro (delta do requestAnimationFrame) e expõe window.__dpFpsStats(), que
// calcula FPS, 1% low e tempo de quadro JÁ no site — o painel lê só 3 números
// por polling, sem transferir o buffer inteiro a cada leitura. Escrita como
// função (injetada via toString) para ter realce/lint em vez de string solta.
function fpsProbe() {
  if (window.__dpFpsProbe) return;
  window.__dpFpsProbe = true;
  var buf = [];
  var last = performance.now();

  function loop(now) {
    if (!window.__dpFpsProbe) { window.__dpFpsStats = null; return; }
    var dt = now - last;
    last = now;
    if (dt > 0 && dt < 1000) { buf.push(dt); if (buf.length > 360) buf.shift(); }
    requestAnimationFrame(loop);
  }

  /* Janela curta (~500 ms) para o número "ao vivo"; janela longa (~3 s) para o
     1% low — média dos ~1% piores quadros, que revela travadas que a média esconde. */
  window.__dpFpsStats = function () {
    if (!buf.length) return null;
    var sum = 0, n = 0;
    for (var i = buf.length - 1; i >= 0 && sum < 500; i--) { sum += buf[i]; n++; }
    var avgMs = sum / n;
    var lsum = 0, ln = 0;
    for (var j = buf.length - 1; j >= 0 && lsum < 3000; j--) { lsum += buf[j]; ln++; }
    var recent = buf.slice(buf.length - ln).sort(function (a, b) { return b - a; });
    var worstN = Math.max(1, Math.round(recent.length * 0.01));
    var wsum = 0;
    for (var k = 0; k < worstN; k++) wsum += recent[k];
    return {
      fps: Math.round(1000 / avgMs),
      low1: Math.round(1000 / (wsum / worstN)),
      ms: Math.round(avgMs * 10) / 10
    };
  };

  requestAnimationFrame(loop);
}

const FPS_PROBE_SRC = '(' + fpsProbe.toString() + ')();';

function sendCdp(cmd, params) {
  return chrome.debugger.sendCommand(dbgTarget, cmd, params || {});
}

async function findFrameTarget() {
  const targets = await chrome.debugger.getTargets();
  // Só iframes: o site embutido é sempre cross-origin com a extensão, logo é um
  // OOPIF com target próprio. Filtrar por 'iframe' evita casar workers/outros
  // alvos de mesma origem no fallback. (Subframes same-origin do site não viram
  // target separado por site-isolation, então não há ambiguidade aqui.)
  const frames = targets.filter((x) => x.type === 'iframe' && x.url);
  let t = frames.find((x) => x.url === state.currentUrl);
  if (!t) {
    try {
      const origin = new URL(state.currentUrl).origin;
      t = frames.find((x) => x.url.startsWith(origin));
    } catch (_) {  }
  }
  return t || null;
}

function startFpsPolling() {
  if (fpsPollTimer) return;
  fpsPollTimer = setInterval(async () => {
    if (!fpsOn || !dbgTarget) return;
    try {
      const res = await sendCdp('Runtime.evaluate', {
        expression: 'window.__dpFpsStats ? window.__dpFpsStats() : null',
        returnByValue: true
      });
      const stats = res && res.result ? res.result.value : null;
      if (fpsOn) showFps(stats);
    } catch (_) {  }
  }, 250);
}

function stopFpsPolling() {
  if (!fpsPollTimer) return;
  clearInterval(fpsPollTimer);
  fpsPollTimer = null;
}

// Anexa o debugger ao iframe e injeta a sonda de FPS. Em re-anexações ao mesmo
// alvo (ex.: SPA navegando), só re-injeta no documento atual — sem repetir o
// enable nem o registro, que de outra forma se acumulariam no protocolo.
async function attachAndApply() {
  const target = await findFrameTarget();
  if (!target) {
    throw new Error('alvo do iframe não encontrado (aguarde o site carregar e tente de novo)');
  }
  const sameSession = !!(dbgTarget && dbgTarget.targetId === target.id);
  dbgTarget = { targetId: target.id };
  if (!sameSession) {
    try {
      if (!target.attached) await chrome.debugger.attach(dbgTarget, '1.3');
      await sendCdp('Runtime.enable');
      await sendCdp('Page.enable');
      // Garante a sonda em navegações futuras deste alvo (registrado uma única vez).
      try { await sendCdp('Page.addScriptToEvaluateOnNewDocument', { source: FPS_PROBE_SRC }); } catch (_) {}
    } catch (_) {
      // target.attached costuma significar DevTools/outra extensão já depurando:
      // o attach é pulado e os comandos seguintes rejeitam. Reporta com clareza.
      dbgTarget = null;
      throw new Error('não foi possível depurar o site (feche o DevTools desta aba e tente de novo)');
    }
  }
  // Injeta no documento atual (idempotente: a sonda se autoignora se já existe).
  try { await sendCdp('Runtime.evaluate', { expression: FPS_PROBE_SRC }); } catch (_) {}
}

async function detachDebugger() {
  if (!dbgTarget) return;
  try { await chrome.debugger.detach(dbgTarget); } catch (_) {}
  dbgTarget = null;
}

// "debugger" precisa ser uma permissão obrigatória (o Chrome não permite
// torná-la opcional). Como já vem concedida na instalação, basta checar a API.
function debuggerReady(reason) {
  if (!chrome.debugger) {
    toast('Recurso de depuração indisponível para ' + reason + '. Recarregue a extensão em chrome://extensions.');
    return false;
  }
  return true;
}

// Desfaz todo o estado do medidor (timers, alvo, UI) num só lugar. Usado pelos
// caminhos de falha/desligamento involuntário; não tenta falar com o debugger
// (nesses casos a sessão já caiu).
function resetFpsState(message) {
  fpsOn = false;
  stopFpsPolling();
  clearTimeout(reattachTimer);
  reattachTimer = null;
  reattachTries = 0;
  dbgTarget = null;
  els.fpsMeter.classList.add('hidden');
  updateFpsButton();
  if (message) toast(message);
}

async function setFpsMeter(on) {
  // fpsBusy serializa as transições: sem isso, um on→off durante o await do
  // attach deixaria um setInterval órfão rodando com o botão em "off".
  if (on === fpsOn || fpsBusy) return;
  fpsBusy = true;
  try {
    if (on) {
      if (!hasExtensionApis) {
        toast('Medidor de FPS disponível apenas pela extensão.');
        return;
      }
      if (!device || !state.currentUrl) {
        toast('Carregue um site antes de medir o FPS.');
        return;
      }
      if (!debuggerReady('o medidor de FPS')) return;
      ensureDebuggerListeners();
      fpsOn = true;
      reattachTries = 0;
      showFps(null);
      try {
        await attachAndApply();
        startFpsPolling();
        toast('Medidor de FPS ativado');
      } catch (e) {
        fpsOn = false;
        stopFpsPolling();
        clearTimeout(reattachTimer);
        els.fpsMeter.classList.add('hidden');
        await detachDebugger();
        toast('Não foi possível medir o FPS: ' + e.message);
      }
    } else {
      fpsOn = false;
      stopFpsPolling();
      clearTimeout(reattachTimer);
      els.fpsMeter.classList.add('hidden');
      // Para o loop da sonda dentro do site antes de soltar o debugger.
      try { await sendCdp('Runtime.evaluate', { expression: 'window.__dpFpsProbe=false' }); } catch (_) {}
      await detachDebugger();
      toast('Medidor de FPS desativado');
    }
    updateFpsButton();
  } finally {
    fpsBusy = false;
  }
}

function updateFpsButton() {
  els.fps.classList.toggle('on', fpsOn);
  els.fps.setAttribute('aria-pressed', String(fpsOn));
}

function fpsLevel(fps) {
  return fps >= 50 ? 'good' : fps >= 30 ? 'ok' : 'bad';
}

function showFps(stats) {
  if (!stats) {
    els.fpsValue.textContent = '··· FPS';
    els.fpsDetail.textContent = '';
    els.fpsMeter.removeAttribute('data-level');
  } else {
    els.fpsValue.textContent = stats.fps + ' FPS';
    els.fpsDetail.textContent = '1% ' + stats.low1 + '  ·  ' + stats.ms + ' ms';
    els.fpsMeter.dataset.level = fpsLevel(stats.fps);
  }
  els.fpsMeter.classList.remove('hidden');
}

function scheduleReattach() {
  clearTimeout(reattachTimer);
  reattachTimer = setTimeout(async () => {
    if (!fpsOn) return;
    try {
      await attachAndApply();
      reattachTries = 0;
    } catch (_) {
      if (!fpsOn) return;
      if (++reattachTries >= MAX_REATTACH_TRIES) {
        resetFpsState('Medição de FPS interrompida: não foi possível reconectar ao site.');
      } else {
        scheduleReattach();
      }
    }
  }, 350);
}

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

async function updateBattery() {
  let level = 1;
  try {
    if (navigator.getBattery) level = (await navigator.getBattery()).level;
  } catch (_) {  }
  const fillIos = document.getElementById('battFillIos');
  const fillAnd = document.getElementById('battFillAnd');
  const pct = document.getElementById('battPct');
  if (fillIos) fillIos.setAttribute('width', String(Math.max(2, Math.round(18 * level))));
  if (fillAnd) fillAnd.setAttribute('width', String(Math.max(2, Math.round(16 * level))));
  if (pct) pct.textContent = Math.round(level * 100) + '%';
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

init();
