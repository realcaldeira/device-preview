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

let appliedUa = null;
let appliedPlatform = null;
let appliedMobile = null;
let lastNavigatedUrl = null;

const state = {
  orientation: 'portrait',
  zoom: 'fit',
  currentUrl: '',
  theme: 'dark',
  frameless: false,
  stretch: false,
  browser: true
};

const $ = (id) => document.getElementById(id);
const els = {
  select: $('deviceSelect'), rotate: $('rotateBtn'),
  frameless: $('framelessBtn'), stretch: $('stretchBtn'), browser: $('browserBtn'),
  bbHostTop: $('bbHostTop'), bbHostBot: $('bbHostBot'),
  back: $('backBtn'), reload: $('reloadBtn'), address: $('addressInput'), go: $('goBtn'),
  zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'), zoomFit: $('zoomFitBtn'), zoomLabel: $('zoomLabel'),
  theme: $('themeBtn'), iconMoon: $('iconMoon'), iconSun: $('iconSun'), shot: $('shotBtn'),
  fps: $('fpsBtn'), fpsMeter: $('fpsMeter'), fpsValue: $('fpsValue'), fpsDetail: $('fpsDetail'),
  exit: $('exitBtn'),
  stage: $('stage'), zoomBox: $('zoomBox'), mockup: $('mockup'),
  viewport: $('viewport'), sbTime: $('sbTime'),
  vkb: $('vkb'), vkbKeys: $('vkbKeys'),
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
    const [tab, stored, devicesRes] = await Promise.all([
      chrome.tabs.getCurrent(),
      chrome.storage.local.get(['theme', 'lastState']),
      fetch(chrome.runtime.getURL('data/devices.json'))
    ]);
    myTabId = tab ? tab.id : null;
    setTheme(stored.theme === 'light' ? 'light' : 'dark', false);
    const last = stored.lastState || {};

    categories = (await devicesRes.json()).categories;
    for (const cat of categories) for (const d of cat.devices) deviceMap[d.id] = d;
    populateSelect();

    bindExtensionEvents();

    const params = new URLSearchParams(location.search);
    const requested = params.get('device');
    const deviceId = deviceMap[requested] ? requested
      : (deviceMap[last.deviceId] ? last.deviceId : categories[0].devices[0].id);
    state.currentUrl = params.get('url') || last.url || 'https://www.wikipedia.org/';

    if (last.zoom === 'fit' ||
        (typeof last.zoom === 'number' && isFinite(last.zoom) &&
         last.zoom >= ZOOM_MIN && last.zoom <= ZOOM_MAX)) {
      state.zoom = last.zoom;
    }
    const keepOrientation = deviceId === last.deviceId ? last.orientation : null;

    await setDevice(deviceId, { navigate: true, orientation: keepOrientation });
    setBrowserUi(last.browser !== false, false);
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
  els.browser.addEventListener('click', () => setBrowserUi(!state.browser, true));

  els.back.addEventListener('click', () => {
    if (frameNavs < 2) return;

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

  window.addEventListener('message', onKbMessage);
  els.vkb.addEventListener('pointerdown', onKbPointerDown);
  window.addEventListener('pointerup', stopKbRepeat);
  window.addEventListener('pointercancel', stopKbRepeat);

  window.addEventListener('resize', () => { if (state.zoom === 'fit') applyZoom(); });
  window.addEventListener('pagehide', () => {

    fpsOn = false;
    stopFpsPolling();
    clearTimeout(reattachTimer);
    reattachTimer = null;
    fpsFrameId = null;
    stopKbRepeat();
    clearTimeout(kbInjectTimer);
    kbInjectTimer = null;
  });

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
    lastNavigatedUrl = details.url;
    if (document.activeElement !== els.address) els.address.value = details.url;
    renderBrowserHost();
    if (fpsOn) scheduleReattach();
    saveState();
  };
  const onCommitted = (details) => {
    if (details.tabId === myTabId && details.frameId !== 0) {
      kbInjectedFrames.delete(details.frameId);
      if (details.url !== 'about:blank') {
        if (details.parentFrameId === 0) hideKeyboard();
        scheduleKbInject();
      }
    }
    onNav(details);
  };
  chrome.webNavigation.onCommitted.addListener(onCommitted);
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
  hideKeyboard();

  const natural = device.width > device.height ? 'landscape' : 'portrait';
  state.orientation = orientation === 'portrait' || orientation === 'landscape' ? orientation : natural;

  // A moldura depende só das dimensões e do formato do aparelho, não do User-Agent.
  // Desenha de imediato para a troca aparecer na hora, sem esperar o service worker.
  buildFrame();
  updateInfo();
  renderClock();
  applyZoom();
  document.title = `Simulador Mobile — ${device.name}`;

  // Só reaplica o User-Agent quando ele muda de fato. Trocar entre aparelhos de mesmo
  // UA (só muda o tamanho da tela) dispensa o round-trip ao service worker.
  const uaChanged =
    device.ua !== appliedUa ||
    device.platform !== appliedPlatform ||
    device.mobile !== appliedMobile;

  if (hasExtensionApis && uaChanged) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'apply-device',
        userAgent: device.ua,
        platform: device.platform,
        mobile: device.mobile
      });
      if (!res || !res.ok) {
        toast('Falha ao aplicar o User-Agent: ' + ((res && res.error) || 'sem resposta do service worker'));
      } else {
        appliedUa = device.ua;
        appliedPlatform = device.platform;
        appliedMobile = device.mobile;
      }
    } catch (e) {
      toast('Falha ao aplicar o User-Agent: ' + e.message);
    }
  }

  // Recarrega o site apenas quando o UA mudou (o request precisa ser refeito) ou quando o
  // destino difere do que já está no iframe. Só redesenhar a moldura não exige recarregar.
  if (doNavigate && state.currentUrl &&
      (uaChanged || state.currentUrl !== lastNavigatedUrl)) {
    els.viewport.src = state.currentUrl;
    els.address.value = state.currentUrl;
    lastNavigatedUrl = state.currentUrl;
    renderBrowserHost();
  }


  saveState();
}

function browserBarKind() {
  const preset = FRAME_PRESETS[device.frame] || FRAME_PRESETS.punch;
  if (preset.kind === 'tv') return 'none';
  if (device.platform === 'iOS') {
    const topBar = preset.kind === 'tablet' || device.frame === 'home' ||
                   state.orientation === 'landscape';
    return topBar ? 'safari-top' : 'safari-bottom';
  }
  return 'chrome';
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
  els.mockup.dataset.browser = browserBarKind();
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

function renderBrowserHost() {
  let host = '';
  try { host = new URL(state.currentUrl).hostname.replace(/^www\./, ''); } catch (_) {}
  els.bbHostTop.textContent = host || '—';
  els.bbHostBot.textContent = host || '—';
}

function setBrowserUi(on, persist) {
  state.browser = on;
  els.mockup.classList.toggle('no-browser', !on);
  els.browser.classList.toggle('on', on);
  els.browser.setAttribute('aria-pressed', String(on));
  renderBrowserHost();
  applyZoom();
  if (persist) {
    toast(on ? 'Barra do navegador visível' : 'Barra do navegador oculta');
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
  lastNavigatedUrl = url;
  els.address.value = url;
  els.viewport.src = url;
  renderBrowserHost();
  saveState();
}

async function exitPreview() {

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
        stretch: state.stretch,
        browser: state.browser
      }
    });
  }, 250);
}

async function captureShot() {
  if (!device) { toast('Escolha um dispositivo primeiro.'); return; }
  if (!hasExtensionApis) { toast('Captura disponível apenas pela extensão.'); return; }

  if (kbVisible) {
    hideKeyboard();
    await delay(260);
  }

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
    link.download = `simulador_${device.id}_${physW}x${physH}.png`;
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
let fpsPending = null;
let fpsFrameId = null;
let reattachTimer = null;
let reattachTries = 0;
let fpsPollTimer = null;
let pollInFlight = false;

const MAX_REATTACH_TRIES = 6;
const EXEC_TIMEOUT = 2000;

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

async function allHttpFrames() {
  let frames = null;
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId: myTabId });
  } catch (_) {}
  return (frames || []).filter((f) => f.frameId !== 0 && /^https?:/i.test(f.url || ''));
}

async function findSiteFrameId() {
  const cands = (await allHttpFrames()).filter((f) => f.parentFrameId === 0);
  let f = cands.find((c) => c.url === state.currentUrl);
  if (!f) {
    try {
      const origin = new URL(state.currentUrl).origin;
      f = cands.find((c) => c.url.startsWith(origin));
    } catch (_) {  }
  }
  if (!f) f = cands[0];
  return f ? f.frameId : null;
}

function withTimeout(promise, ms, onTimeout) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runInFrame(frameId, func) {
  const exec = chrome.scripting.executeScript({
    target: { tabId: myTabId, frameIds: [frameId] },
    world: 'MAIN',
    func
  });
  const out = await withTimeout(exec, EXEC_TIMEOUT, () => noTarget('tempo esgotado ao acessar o frame'));
  return out && out[0] ? out[0].result : null;
}

function startFpsPolling() {
  if (fpsPollTimer) return;
  fpsPollTimer = setInterval(async () => {

    if (!fpsOn || fpsFrameId == null || pollInFlight) return;
    pollInFlight = true;
    try {
      const res = await runInFrame(fpsFrameId, () => ({
        alive: !!window.__dpFpsProbe,
        stats: window.__dpFpsStats ? window.__dpFpsStats() : null
      }));
      if (!fpsOn) return;

      if (!res || !res.alive) scheduleReattach();
      else showFps(res.stats);
    } catch (_) {

      if (fpsOn) scheduleReattach();
    } finally {
      pollInFlight = false;
    }
  }, 250);
}

function stopFpsPolling() {
  if (!fpsPollTimer) return;
  clearInterval(fpsPollTimer);
  fpsPollTimer = null;
  pollInFlight = false;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function applyWithRetries() {
  for (let i = 0; ; i++) {
    if (fpsCancelled()) throw cancelled();
    try {
      await applyProbe();
      return;
    } catch (e) {
      if (fpsCancelled()) throw cancelled();
      if (e.code !== 'NO_TARGET' || i >= MAX_REATTACH_TRIES) throw e;
      await delay(300);
    }
  }
}

function noTarget(msg) {
  const err = new Error(msg);
  err.code = 'NO_TARGET';
  return err;
}

function cancelled() {
  const err = new Error('cancelado');
  err.code = 'CANCELLED';
  return err;
}

function fpsCancelled() {
  return !fpsOn || fpsPending === false;
}

async function applyProbe() {
  const frameId = await findSiteFrameId();
  if (frameId == null) throw noTarget('frame do site não encontrado');
  try {
    await runInFrame(frameId, fpsProbe);
  } catch (_) {
    throw noTarget('frame do site não está pronto');
  }

  if (fpsCancelled()) {
    try { await runInFrame(frameId, () => { window.__dpFpsProbe = false; }); } catch (_) {}
    throw cancelled();
  }
  fpsFrameId = frameId;
}

function scriptingReady(reason) {
  if (!chrome.scripting) {
    toast('Recurso de medição indisponível para ' + reason + '. Recarregue a extensão em chrome://extensions.');
    return false;
  }
  return true;
}

function resetFpsState(message) {
  fpsOn = false;
  stopFpsPolling();
  clearTimeout(reattachTimer);
  reattachTimer = null;
  reattachTries = 0;
  fpsFrameId = null;
  els.fpsMeter.classList.add('hidden');
  updateFpsButton();
  if (message) toast(message);
}

async function setFpsMeter(on) {
  if (fpsBusy) { fpsPending = on; return; }
  if (on === fpsOn) return;
  fpsBusy = true;
  fpsPending = null;
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
      if (!scriptingReady('o medidor de FPS')) return;
      fpsOn = true;
      reattachTries = 0;
      showFps(null);
      try {
        await applyWithRetries();
        startFpsPolling();
        toast('Medidor de FPS ativado');
      } catch (e) {
        fpsOn = false;
        stopFpsPolling();
        clearTimeout(reattachTimer);
        reattachTimer = null;
        els.fpsMeter.classList.add('hidden');
        fpsFrameId = null;
        if (e.code !== 'CANCELLED') {
          const msg = e.code === 'NO_TARGET'
            ? 'não foi possível acessar o conteúdo do site (ele pode bloquear exibição em iframe; recarregue a página e tente de novo)'
            : e.message;
          toast('Não foi possível medir o FPS: ' + msg);
        }
      }
    } else {
      fpsOn = false;
      stopFpsPolling();
      clearTimeout(reattachTimer);
      reattachTimer = null;
      els.fpsMeter.classList.add('hidden');

      if (fpsFrameId != null) {
        try {
          await runInFrame(fpsFrameId, () => { window.__dpFpsProbe = false; });
        } catch (_) {  }
      }
      fpsFrameId = null;
      toast('Medidor de FPS desativado');
    }
    updateFpsButton();
  } finally {
    fpsBusy = false;
    const next = fpsPending;
    fpsPending = null;
    if (next !== null && next !== fpsOn) setFpsMeter(next);
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
  if (reattachTimer) return;
  reattachTimer = setTimeout(async () => {
    reattachTimer = null;
    if (!fpsOn) return;
    try {
      await applyProbe();
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

function kbProbe() {
  if (window.__ddKbProbe) return;
  window.__ddKbProbe = true;

  var TEXT_TYPES = /^(text|search|email|url|tel|password|number)$/;

  function modeOf(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.isContentEditable) return 'text';
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return el.disabled || el.readOnly ? null : 'text';
    if (tag !== 'INPUT' || el.disabled || el.readOnly) return null;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (!TEXT_TYPES.test(type)) return null;
    var im = (el.getAttribute('inputmode') || '').toLowerCase();
    if (im === 'numeric' || im === 'decimal') return 'number';
    if (im === 'tel' || im === 'email' || im === 'url' || im === 'search') return im;
    return type === 'password' ? 'text' : type;
  }

  function send(msg) { try { window.top.postMessage(msg, '*'); } catch (_) {} }

  var fieldSeq = 0;
  var frameTag = Math.random().toString(36).slice(2, 10);

  function announce() {
    var el = document.activeElement;
    var mode = modeOf(el);
    if (mode) {
      if (!el.__ddKbField) el.__ddKbField = frameTag + ':' + (++fieldSeq);
      send({
        __simulador: 'kb-focus',
        mode: mode,
        multiline: el.tagName === 'TEXTAREA' || !!el.isContentEditable,
        field: el.__ddKbField
      });
    }
    return !!mode;
  }

  document.addEventListener('focusin', announce, true);
  document.addEventListener('pointerdown', function () { setTimeout(announce, 0); }, true);
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      if (!modeOf(document.activeElement)) send({ __simulador: 'kb-blur' });
    }, 0);
  }, true);

  function nativeSetValue(el, value) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertText(el, text) {
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (_) {}
    if (!ok && 'value' in el) nativeSetValue(el, (el.value || '') + text);
  }

  function deleteBack(el) {
    var ok = false;
    try { ok = document.execCommand('delete', false); } catch (_) {}
    if (!ok && 'value' in el && el.value) nativeSetValue(el, el.value.slice(0, -1));
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__simulador !== 'kb-key' || typeof d.key !== 'string') return;
    var el = document.activeElement;
    var mode = modeOf(el);
    if (d.key === '__hide__') { if (mode) el.blur(); return; }
    if (!mode) return;
    if (d.key === '__reveal__') {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      return;
    }
    if (d.key === 'Backspace') { deleteBack(el); return; }
    if (d.key === 'Enter') {
      var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      var allowed = el.dispatchEvent(new KeyboardEvent('keydown', opts));
      el.dispatchEvent(new KeyboardEvent('keyup', opts));
      if (!allowed) return;
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
        insertText(el, '\n');
      } else if (el.form) {
        try { el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit(); } catch (_) {}
      }
      return;
    }
    insertText(el, d.key === 'Space' ? ' ' : d.key);
  });

  announce();
}

let kbMode = 'text';
let kbMultiline = false;
let kbShift = false;
let kbPage = 'letters';
let kbVisible = false;
let kbFocusWin = null;
let kbFieldId = null;
let kbInjectTimer = null;
let kbRepeatDelay = null;
let kbRepeatTimer = null;
const kbInjectedFrames = new Set();

function kbSupported() {
  if (!device) return false;
  const preset = FRAME_PRESETS[device.frame] || FRAME_PRESETS.punch;
  return preset.kind !== 'tv';
}

function scheduleKbInject() {
  if (!hasExtensionApis || !chrome.scripting) return;
  clearTimeout(kbInjectTimer);
  kbInjectTimer = setTimeout(injectKbProbe, 350);
}

async function injectKbProbe() {
  if (!hasExtensionApis || !chrome.scripting || myTabId == null || !kbSupported()) return;
  const targets = (await allHttpFrames()).filter((f) => !kbInjectedFrames.has(f.frameId));
  await Promise.allSettled(targets.map((f) =>
    chrome.scripting.executeScript({
      target: { tabId: myTabId, frameIds: [f.frameId] },
      world: 'MAIN',
      func: kbProbe
    }).then(() => kbInjectedFrames.add(f.frameId))
  ));
}

function kbBroadcast(msg) {
  const post = (win, depth) => {
    try { win.postMessage(msg, '*'); } catch (_) {}
    if (depth <= 0) return;
    let count = 0;
    try { count = win.frames.length; } catch (_) {}
    for (let i = 0; i < Math.min(count, 15); i++) {
      try { post(win.frames[i], depth - 1); } catch (_) {}
    }
  };
  if (els.viewport.contentWindow) post(els.viewport.contentWindow, 3);
}

function kbSend(msg) {
  if (kbFocusWin) {
    try {
      kbFocusWin.postMessage(msg, '*');
      return;
    } catch (_) {}
  }
  kbBroadcast(msg);
}

function onKbMessage(e) {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.__simulador === 'kb-focus') {
    if (!kbSupported()) return;
    const field = typeof d.field === 'string' ? d.field : null;
    if (kbVisible && field && field === kbFieldId) {
      if (e.source) kbFocusWin = e.source;
      return;
    }
    kbFieldId = field;
    showKeyboard(typeof d.mode === 'string' ? d.mode : 'text', !!d.multiline);
    kbFocusWin = e.source || null;
    setTimeout(() => kbSend({ __simulador: 'kb-key', key: '__reveal__' }), 260);
  } else if (d.__simulador === 'kb-blur') {
    if (!kbFocusWin || e.source === kbFocusWin) hideKeyboard();
  }
}

function kbBottomRow() {
  const extra = kbMode === 'email' ? '@' : kbMode === 'url' ? '/' : ',';
  const enterLabel = kbMultiline ? '⏎'
    : kbMode === 'search' ? 'buscar'
    : kbMode === 'url' || kbMode === 'email' ? 'ir' : '⏎';
  const toggle = kbPage === 'letters'
    ? { key: '__sym1__', cls: 'vk-fn vk-w15', label: '?123' }
    : { key: '__abc__', cls: 'vk-fn vk-w15', label: 'ABC' };
  return [
    toggle,
    extra,
    { key: 'Space', cls: 'vk-space', label: 'espaço' },
    '.',
    { key: 'Enter', cls: 'vk-fn vk-enter vk-w15', label: enterLabel }
  ];
}

function kbRows() {
  if (kbMode === 'number' || kbMode === 'tel') {
    return [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [kbMode === 'tel' ? '+' : ',', '0', { key: 'Backspace', cls: 'vk-fn', label: '⌫' }]
    ];
  }
  if (kbPage === 'sym1' || kbPage === 'sym2') {
    const top = kbPage === 'sym1'
      ? [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
         ['-', '/', ':', ';', '(', ')', 'R$', '&', '@', '"']]
      : [['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
         ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•']];
    return [
      top[0],
      top[1],
      [{ key: kbPage === 'sym1' ? '__sym2__' : '__sym1__', cls: 'vk-fn vk-w15', label: kbPage === 'sym1' ? '#+=' : '123' },
       '.', ',', '?', '!', "'",
       { key: 'Backspace', cls: 'vk-fn vk-w15', label: '⌫' }],
      kbBottomRow()
    ];
  }
  return [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    [{ key: '__shift__', cls: 'vk-fn vk-w15' + (kbShift ? ' vk-active' : ''), label: '⇧' },
     'z', 'x', 'c', 'v', 'b', 'n', 'm',
     { key: 'Backspace', cls: 'vk-fn vk-w15', label: '⌫' }],
    kbBottomRow()
  ];
}

function renderKeyboard() {
  els.vkbKeys.textContent = '';
  for (const row of kbRows()) {
    const rowEl = document.createElement('div');
    rowEl.className = 'vkb-row';
    for (const item of row) {
      const def = typeof item === 'string' ? { key: item, cls: '', label: item } : item;
      let label = def.label;
      let key = def.key;
      if (typeof item === 'string' && kbShift && kbPage === 'letters' && /^[a-z]$/.test(item)) {
        label = key = item.toUpperCase();
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = ('vk-key ' + (def.cls || '')).trim();
      btn.dataset.key = key;
      btn.textContent = label;
      rowEl.appendChild(btn);
    }
    els.vkbKeys.appendChild(rowEl);
  }
}

function showKeyboard(mode, multiline) {
  kbMode = mode === 'password' ? 'text' : mode;
  kbMultiline = multiline;
  kbPage = 'letters';
  kbShift = false;
  els.vkb.dataset.mode = kbMode === 'number' || kbMode === 'tel' ? 'pad' : 'text';
  renderKeyboard();
  els.vkb.classList.add('show');
  els.vkb.setAttribute('aria-hidden', 'false');
  kbVisible = true;
}

function hideKeyboard() {
  kbFocusWin = null;
  if (!kbVisible) return;
  kbVisible = false;
  stopKbRepeat();
  els.vkb.classList.remove('show');
  els.vkb.setAttribute('aria-hidden', 'true');
}

function pressKey(key) {
  if (key === '__hide__') {
    kbSend({ __simulador: 'kb-key', key: '__hide__' });
    hideKeyboard();
    return;
  }
  if (key === '__shift__') { kbShift = !kbShift; renderKeyboard(); return; }
  if (key === '__sym1__') { kbPage = 'sym1'; kbShift = false; renderKeyboard(); return; }
  if (key === '__sym2__') { kbPage = 'sym2'; renderKeyboard(); return; }
  if (key === '__abc__') { kbPage = 'letters'; renderKeyboard(); return; }

  kbSend({ __simulador: 'kb-key', key });

  if (kbShift && kbPage === 'letters' && /^[A-Z]$/.test(key)) {
    kbShift = false;
    renderKeyboard();
  }
  if (key === 'Enter' && !kbMultiline) hideKeyboard();
}

let kbPressedBtn = null;

function stopKbRepeat() {
  clearTimeout(kbRepeatDelay);
  kbRepeatDelay = null;
  clearInterval(kbRepeatTimer);
  kbRepeatTimer = null;
  if (kbPressedBtn) {
    kbPressedBtn.classList.remove('vk-pressed');
    kbPressedBtn = null;
  }
}

function onKbPointerDown(e) {
  e.preventDefault();
  const btn = e.target.closest('[data-key]');
  if (!btn) return;
  stopKbRepeat();
  kbPressedBtn = btn;
  btn.classList.add('vk-pressed');
  const key = btn.dataset.key;
  pressKey(key);
  if (key === 'Backspace') {
    kbRepeatDelay = setTimeout(() => {
      kbRepeatTimer = setInterval(() => pressKey('Backspace'), 60);
    }, 450);
  }
}

function renderClock() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ios = device && device.platform === 'iOS';
  els.sbTime.textContent = ios
    ? `${h % 12 || 12}:${m}`
    : `${String(h).padStart(2, '0')}:${m}`;
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
