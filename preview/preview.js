const FRAME_PRESETS = DP_FRAME_PRESETS;

function kindOf(d) {
  return (FRAME_PRESETS[d.frame] || FRAME_PRESETS.punch).kind;
}

// Celular e tablet: os aparelhos que se usam com o dedo e cujo teclado é o da
// tela. Notebook e TV têm mouse/controle e teclado físico.
function isHandheld() {
  if (!device) return false;
  const kind = kindOf(device);
  return kind === 'phone' || kind === 'tablet';
}

function brandOf(d) {
  if (d.frame === 'tv') return 'tv';
  if (d.frame === 'laptop') return d.platform === 'macOS' ? 'macbook' : 'laptop';
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
    case 'tv': case 'macbook': case 'laptop': return 'none';
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
  browser: true,
  touch: true
};

const $ = (id) => document.getElementById(id);
const els = {
  select: $('deviceSelect'), rotate: $('rotateBtn'),
  frameless: $('framelessBtn'), stretch: $('stretchBtn'), browser: $('browserBtn'),
  touch: $('touchBtn'),
  bbHostTop: $('bbHostTop'), bbHostBot: $('bbHostBot'),
  bdHost: $('bdHost'), bdTab: $('bdTab'),
  back: $('backBtn'), reload: $('reloadBtn'), address: $('addressInput'), go: $('goBtn'),
  zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'), zoomFit: $('zoomFitBtn'), zoomLabel: $('zoomLabel'),
  theme: $('themeBtn'), iconMoon: $('iconMoon'), iconSun: $('iconSun'), shot: $('shotBtn'),
  report: $('reportBtn'),
  fps: $('fpsBtn'), fpsMeter: $('fpsMeter'), fpsValue: $('fpsValue'), fpsDetail: $('fpsDetail'),
  exit: $('exitBtn'),
  stage: $('stage'), zoomBox: $('zoomBox'), mockup: $('mockup'),
  viewport: $('viewport'), sbTime: $('sbTime'),
  vkb: $('vkb'), vkbKeys: $('vkbKeys'),
  infoName: $('infoName'), infoViewport: $('infoViewport'), infoDpr: $('infoDpr'),
  infoPhysical: $('infoPhysical'), infoUa: $('infoUa'), toast: $('toast'),
  reviewPrompt: $('reviewPrompt'), reviewLater: $('reviewLater'),
  reviewNever: $('reviewNever'), reviewGo: $('reviewGo')
};

let lastFpsStats = null;

const hasExtensionApis =
  typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.runtime && chrome.runtime.id);

async function init() {
  applyI18n();
  bindUiEvents();
  startClock();

  if (!hasExtensionApis) {
    toast(t('toastOpenViaExt'));
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
    // Só http(s) entra no iframe: um javascript:/data:/file: vindo da query ou
    // de um lastState corrompido deixaria a prévia em branco e ainda seria
    // regravado no storage na próxima troca de aparelho.
    state.currentUrl = [params.get('url'), last.url].find(dpIsHttpUrl) ||
      'https://www.wikipedia.org/';

    if (last.zoom === 'fit' ||
        (typeof last.zoom === 'number' && isFinite(last.zoom) &&
         last.zoom >= ZOOM_MIN && last.zoom <= ZOOM_MAX)) {
      state.zoom = last.zoom;
    }
    const keepOrientation = deviceId === last.deviceId ? last.orientation : null;

    state.touch = last.touch !== false;
    await setDevice(deviceId, { navigate: true, orientation: keepOrientation });
    setBrowserUi(last.browser !== false, false);
    setFrameless(!!last.frameless, false);
    if (last.stretch) setStretch(true, false);

    bumpOpenAndMaybeReview();
  } catch (e) {
    toast(t('toastInitError', [(e && e.message) || String(e)]));
  }
}

function populateSelect() {
  for (const cat of categories) {
    const group = document.createElement('optgroup');
    group.label = catLabel(cat.id, cat.name);
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
    pushDeviceCfg();
    toast(state.orientation === 'portrait' ? t('toastPortrait') : t('toastLandscape'));
    saveState();
  });

  els.frameless.addEventListener('click', () => setFrameless(!state.frameless, true));
  els.stretch.addEventListener('click', () => setStretch(!state.stretch, true));
  els.browser.addEventListener('click', () => setBrowserUi(!state.browser, true));
  els.touch.addEventListener('click', () => setTouch(!state.touch, true));

  els.back.addEventListener('click', () => {
    if (frameNavs < 1) return;

    frameNavs--;
    updateBackButton();
    history.back();
  });

  els.reload.addEventListener('click', () => {
    if (state.currentUrl) loadViewport(state.currentUrl);
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
  if (els.report) els.report.addEventListener('click', exportReport);
  els.fps.addEventListener('click', () => setFpsMeter(!fpsOn));
  els.exit.addEventListener('click', exitPreview);

  if (els.reviewLater) els.reviewLater.addEventListener('click', () => snoozeReview(7));
  if (els.reviewNever) els.reviewNever.addEventListener('click', dismissReviewForever);
  if (els.reviewGo) els.reviewGo.addEventListener('click', openStoreReview);

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

  // Só as navegações que o próprio site faz (clique em link, troca de hash)
  // empilham entrada no histórico da aba — o Chrome as marca como
  // `manual_subframe`. As que a prévia provoca ao recriar o iframe chegam como
  // `auto_subframe` e substituem a entrada atual. Contar as duas habilitava o
  // botão sem haver o que desfazer, e aí o history.back() desfazia a navegação
  // da própria aba: a prévia fechava e voltava para o site original.
  const onNav = (details, stacks) => {
    if (details.tabId !== myTabId || details.frameId === 0 || details.parentFrameId !== 0) return;
    if (details.url === 'about:blank') return;

    const goingBack = (details.transitionQualifiers || []).includes('forward_back');
    if (stacks && !goingBack) {
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
    onNav(details, details.transitionType === 'manual_subframe');
  };
  chrome.webNavigation.onCommitted.addListener(onCommitted);
  // replaceState também cai em onHistoryStateUpdated e não empilha nada; na
  // dúvida o botão fica desligado, que é o lado seguro do erro.
  chrome.webNavigation.onHistoryStateUpdated.addListener((d) => onNav(d, false));
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((d) => onNav(d, true));

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
  document.title = `${t('appTitle')} — ${device.name}`;

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
        toast(t('toastUaFail', [(res && res.error) || t('errNoResponse')]));
      } else {
        appliedUa = device.ua;
        appliedPlatform = device.platform;
        appliedMobile = device.mobile;
      }
    } catch (e) {
      toast(t('toastUaFail', [e.message]));
    }
  }

  // Recarrega o site apenas quando o UA mudou (o request precisa ser refeito) ou quando o
  // destino difere do que já está no iframe. Só redesenhar a moldura não exige recarregar.
  if (doNavigate && state.currentUrl &&
      (uaChanged || state.currentUrl !== lastNavigatedUrl)) {
    loadViewport(state.currentUrl);
    els.address.value = state.currentUrl;
    lastNavigatedUrl = state.currentUrl;
    renderBrowserHost();
  }

  // Acerta o botão e, quando o site não foi recarregado, entrega as medidas do
  // novo aparelho à sonda que já está rodando dentro dele.
  setTouch(state.touch, false);
  saveState();
}

function browserBarKind() {
  const preset = FRAME_PRESETS[device.frame] || FRAME_PRESETS.punch;
  if (preset.kind === 'tv') return 'none';
  if (preset.kind === 'laptop') return 'desktop';
  if (device.platform === 'iOS') {
    const topBar = preset.kind === 'tablet' || device.frame === 'home' ||
                   state.orientation === 'landscape';
    return topBar ? 'safari-top' : 'safari-bottom';
  }
  return 'chrome';
}

const FRAME_IMAGES = DP_FRAME_IMAGES;

let frameImageToken = 0;

function clearFrameImage(style) {
  delete els.mockup.dataset.frameImage;
  for (const p of ['--frame-img', '--frame-slice', '--frame-bw', '--frame-corner']) {
    style.removeProperty(p);
  }
}

function frameImageSpec(preset, rotated) {
  // Arte própria por aparelho (devices.json > frameImage) tem precedência e
  // vale como está — quem a define responde pela orientação (ver frames/README.md).
  const custom = device.frameImage;
  if (custom && custom.src && Array.isArray(custom.slice)) {
    const inset = Array.isArray(custom.inset) ? custom.inset
      : [preset.padTop, preset.padSide, preset.padBottom, preset.padSide];
    return {
      src: custom.src,
      slice: custom.slice,
      inset,
      width: Array.isArray(custom.width) ? custom.width : inset,
      corner: custom.corner === 'squircle' ? 'squircle' : 'round'
    };
  }

  let key = device.frame;
  if (key === 'laptop' && brandOf(device) === 'macbook') key = 'laptop-macbook';
  const cfg = FRAME_IMAGES[key];
  if (!cfg) return null;

  const base = cfg.inset || [preset.padTop, preset.padSide, preset.padBottom, preset.padSide];
  const useRot = rotated && cfg.rot !== false;
  // Girado, o que era a borda de cima vai para a esquerda — mesma convenção
  // dos pads e dos recortes no CSS.
  const inset = useRot ? [base[1], base[2], base[3], base[0]] : base;
  const width = inset.map((v) => Math.max(v, preset.radius));
  return {
    src: `frames/${key}${useRot ? '.rot' : ''}.webp`,
    slice: width.map((v) => Math.max(1, Math.round(v * cfg.scale))),
    inset,
    width,
    corner: cfg.corner || 'round'
  };
}

function setPadVars(style, pads) {
  style.setProperty('--pad-top', pads.top + 'px');
  style.setProperty('--pad-right', pads.right + 'px');
  style.setProperty('--pad-bottom', pads.bottom + 'px');
  style.setProperty('--pad-left', pads.left + 'px');
}

function applyFrameImage(pads, preset, rotated) {
  const spec = frameImageSpec(preset, rotated);
  const s = els.mockup.style;
  const token = ++frameImageToken;

  if (!spec) {
    clearFrameImage(s);
    return pads;
  }

  // Precisa ser absoluta: url() dentro de custom property resolve em relação à
  // folha de estilo, não ao documento.
  const url = hasExtensionApis
    ? chrome.runtime.getURL(spec.src)
    : new URL('../' + spec.src, location.href).href;

  // Enquanto a arte não carrega (ou se falhar), o bisel CSS continua — sem
  // data-frame-image o ::before metálico e o queixo da TV não são desligados.
  clearFrameImage(s);

  const [top, right, bottom, left] = spec.inset;
  const imagePads = { top, right, bottom, left };

  const img = new Image();
  img.onload = () => {
    if (token !== frameImageToken) return;
    els.mockup.dataset.frameImage = 'on';
    s.setProperty('--frame-img', `url("${url}")`);
    s.setProperty('--frame-slice', spec.slice.join(' '));
    s.setProperty('--frame-bw', spec.width.map((v) => v + 'px').join(' '));
    s.setProperty('--frame-corner', spec.corner);
    setPadVars(s, imagePads);
  };
  img.onerror = () => {
    if (token !== frameImageToken) return;
    clearFrameImage(s);
    setPadVars(s, pads);
  };
  img.src = url;

  // A espessura da moldura na arte vira o padding do mockup; sem isso a tela
  // não cairia no recorte da imagem. Se o load falhar, onerror restaura `pads`.
  return imagePads;
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
    device.platform === 'Windows' ? 'windows' :
    device.platform === 'macOS' ? 'macos' : 'tv';

  const natural = device.width > device.height ? 'landscape' : 'portrait';
  const rotated = state.orientation !== natural;
  const pads = applyFrameImage(rotated
    ? { top: preset.padSide, right: preset.padBottom, bottom: preset.padSide, left: preset.padTop }
    : { top: preset.padTop, right: preset.padSide, bottom: preset.padBottom, left: preset.padSide },
    preset, rotated);

  // Notebook não se gira: a tampa tem lado certo.
  els.rotate.disabled = preset.kind === 'laptop';

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
  els.back.disabled = frameNavs < 1;
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
    toast(on ? t('toastFramelessOn') : t('toastFramelessOff'));
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
    toast(on ? t('toastStretchOn') : t('toastStretchOff'));
    saveState();
  }
}

function renderBrowserHost() {
  let host = '';
  try { host = new URL(state.currentUrl).hostname.replace(/^www\./, ''); } catch (_) {}
  els.bbHostTop.textContent = host || '—';
  els.bbHostBot.textContent = host || '—';
  els.bdHost.textContent = state.currentUrl || '—';
  els.bdTab.textContent = host || t('browserNewTab');
}

function setBrowserUi(on, persist) {
  state.browser = on;
  els.mockup.classList.toggle('no-browser', !on);
  els.browser.classList.toggle('on', on);
  els.browser.setAttribute('aria-pressed', String(on));
  renderBrowserHost();
  applyZoom();
  if (persist) {
    toast(on ? t('toastBrowserOn') : t('toastBrowserOff'));
    saveState();
  }
}

// A sonda de content/device-probe.js só age no frame que carrega esta marca em
// window.name — e a configuração viaja junto porque ela precisa ser lida antes
// do primeiro script do site rodar.
const DEVICE_TAG = '__sim_dev__';

// O que o JavaScript do site espera ver em cada sistema: navigator.platform
// (herança), o valor de User-Agent Client Hints e o fabricante do navegador.
const PLATFORMS = {
  iOS:     { nav: 'iPhone',        ua: 'iOS',     vendor: 'Apple Computer, Inc.' },
  macOS:   { nav: 'MacIntel',      ua: 'macOS',   vendor: 'Apple Computer, Inc.' },
  Android: { nav: 'Linux armv8l',  ua: 'Android', vendor: 'Google Inc.' },
  Windows: { nav: 'Win32',         ua: 'Windows', vendor: 'Google Inc.' },
  Linux:   { nav: 'Linux armv7l',  ua: 'Linux',   vendor: 'Google Inc.' }
};

function deviceCfg() {
  const { w, h } = dims();
  const p = PLATFORMS[device.platform] || PLATFORMS.Linux;
  return {
    origin: location.origin,
    ua: device.ua,
    navPlatform: device.platform === 'iOS' && kindOf(device) === 'tablet' ? 'iPad' : p.nav,
    uaPlatform: p.ua,
    vendor: p.vendor,
    mobile: !!device.mobile,
    handheld: isHandheld(),
    touch: state.touch && isHandheld(),
    sw: w,
    sh: h,
    dpr: device.dpr,
    landscape: state.orientation === 'landscape'
  };
}

// O nome só entra no browsing context quando ele é criado: trocar o atributo de
// um iframe já carregado não muda o window.name que a sonda lê. Por isso cada
// navegação nasce em um elemento novo, já nomeado.
function loadViewport(url) {
  const old = els.viewport;
  const next = old.cloneNode(false);
  if (device) next.name = DEVICE_TAG + JSON.stringify(deviceCfg());
  next.src = url;
  old.replaceWith(next);
  els.viewport = next;
  // Browsing context novo: o que o site tinha empilhado antes não é mais
  // alcançável por este iframe.
  frameNavs = 0;
  updateBackButton();
}

// Atualização a quente: girar a tela ou trocar de aparelho de mesmo User-Agent
// não recarrega o site, então a sonda recebe a configuração nova por mensagem.
function pushDeviceCfg() {
  if (!device) return;
  frameBroadcast({ __simulador: 'dev-cfg', cfg: deviceCfg() });
}

function setTouch(on, persist) {
  state.touch = on;
  const supported = isHandheld();
  els.touch.disabled = !supported;
  els.touch.classList.toggle('on', on && supported);
  els.touch.setAttribute('aria-pressed', String(on && supported));
  pushDeviceCfg();
  if (persist) {
    toast(!supported
      ? t('toastTouchDesktop')
      : on
        ? t('toastTouchOn')
        : t('toastTouchOff'));
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
  loadViewport(url);
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
    els.zoomLabel.title = t('toastZoomStretch');
    return;
  }

  const scale = currentScale();
  els.mockup.style.transform = `scale(${scale})`;
  els.zoomBox.style.width = mw * scale + 'px';
  els.zoomBox.style.height = mh * scale + 'px';
  els.zoomLabel.textContent = Math.round(scale * 100) + '%';
  els.zoomLabel.title = state.zoom === 'fit' ? t('btnZoomFit') : t('zoomLabel');
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
        browser: state.browser,
        touch: state.touch
      }
    });
  }, 250);
}

async function captureShot() {
  if (!device) { toast(t('toastPickDevice')); return; }
  if (!hasExtensionApis) { toast(t('toastCaptureExtOnly')); return; }

  if (kbVisible) {
    hideKeyboard();
    await delay(260);
  }

  const before = els.mockup.getBoundingClientRect();
  const fits = before.top >= 0 && before.left >= 0 &&
               before.bottom <= window.innerHeight && before.right <= window.innerWidth;

  // O medidor de FPS fica sobreposto à tela do dispositivo, dentro da área que será
  // recortada. Esconde durante a captura (e trava o polling, que senão o reexibiria
  // no próximo tick) para que não apareça na imagem.
  const fpsWasVisible = !els.fpsMeter.classList.contains('hidden');
  if (fpsWasVisible) {
    suppressFpsRender = true;
    els.fpsMeter.classList.add('hidden');
  }

  let restoreZoom = null;
  if (!fits) {
    restoreZoom = state.zoom;
    state.zoom = 'fit';
    applyZoom();
    els.stage.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 180));
  } else if (fpsWasVisible) {
    // garante um repaint sem o medidor antes de capturar o quadro
    await new Promise((r) => setTimeout(r, 50));
  }

  try {
    const res = await chrome.runtime.sendMessage({ type: 'capture' });
    if (!res || !res.ok) throw new Error((res && res.error) || t('errNoResponse'));

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
    toast(t('toastCaptureSaved', [String(outW), String(outH)]));
    await bumpCaptureAndMaybeReview();
  } catch (e) {
    toast(t('toastCaptureError', [e.message]));
  } finally {
    if (fpsWasVisible) {
      suppressFpsRender = false;
      // Só reexibe se o medidor ainda estiver ligado (o usuário pode tê-lo
      // desligado durante a captura).
      if (fpsOn) els.fpsMeter.classList.remove('hidden');
    }
    if (restoreZoom !== null) {
      state.zoom = restoreZoom;
      applyZoom();
    }
  }
}

let fpsOn = false;
let suppressFpsRender = false;
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

async function runInFrame(frameId, func, args) {
  const exec = chrome.scripting.executeScript({
    target: { tabId: myTabId, frameIds: [frameId] },
    world: 'MAIN',
    func,
    args: args || []
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
    toast(t('toastFpsUnavailable', [reason]));
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
        toast(t('toastFpsExtOnly'));
        return;
      }
      if (!device || !state.currentUrl) {
        toast(t('toastFpsNeedSite'));
        return;
      }
      if (!scriptingReady('FPS')) return;
      fpsOn = true;
      reattachTries = 0;
      showFps(null);
      try {
        await applyWithRetries();
        startFpsPolling();
        toast(t('toastFpsOn'));
      } catch (e) {
        fpsOn = false;
        stopFpsPolling();
        clearTimeout(reattachTimer);
        reattachTimer = null;
        els.fpsMeter.classList.add('hidden');
        fpsFrameId = null;
        if (e.code !== 'CANCELLED') {
          const msg = e.code === 'NO_TARGET' ? t('fpsUnreachable') : e.message;
          toast(t('toastFpsFail', [msg]));
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
      toast(t('toastFpsOff'));
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
  if (suppressFpsRender) return;
  if (!stats) {
    els.fpsValue.textContent = '··· FPS';
    els.fpsDetail.textContent = '';
    els.fpsMeter.removeAttribute('data-level');
    lastFpsStats = null;
  } else {
    els.fpsValue.textContent = stats.fps + ' FPS';
    els.fpsDetail.textContent = '1% ' + stats.low1 + '  ·  ' + stats.ms + ' ms';
    els.fpsMeter.dataset.level = fpsLevel(stats.fps);
    lastFpsStats = stats;
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
        resetFpsState(t('toastFpsFail', [t('fpsReconnectFail')]));
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

  function focusInfo() {
    var el = document.activeElement;
    var mode = modeOf(el);
    if (!mode) return null;
    if (!el.__ddKbField) el.__ddKbField = frameTag + ':' + (++fieldSeq);
    return {
      mode: mode,
      multiline: el.tagName === 'TEXTAREA' || !!el.isContentEditable,
      field: el.__ddKbField
    };
  }

  function announce() {
    var info = focusInfo();
    if (info) {
      info.__simulador = 'kb-focus';
      send(info);
    }
    return !!info;
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

  window.__ddKbFocus = function () {
    return document.hasFocus() ? focusInfo() : null;
  };

  window.__ddKbApply = function (key) {
    if (typeof key !== 'string') return false;
    var el = document.activeElement;
    var mode = modeOf(el);
    if (key === '__hide__') { if (mode) el.blur(); return true; }
    if (!mode) return false;
    if (key === '__reveal__') {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      return true;
    }
    if (key === 'Backspace') { deleteBack(el); return true; }
    if (key === 'Enter') {
      var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      var allowed = el.dispatchEvent(new KeyboardEvent('keydown', opts));
      el.dispatchEvent(new KeyboardEvent('keyup', opts));
      if (!allowed) return true;
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
        insertText(el, '\n');
      } else if (el.form) {
        try { el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit(); } catch (_) {}
      }
      return true;
    }
    insertText(el, key === 'Space' ? ' ' : key);
    return true;
  };

  announce();
}

let kbMode = 'text';
let kbMultiline = false;
let kbShift = false;
let kbPage = 'letters';
let kbVisible = false;
let kbFrameId = null;
let kbFieldId = null;
let kbResolving = false;
let kbResolvePending = false;
let kbInjectTimer = null;
let kbRepeatDelay = null;
let kbRepeatTimer = null;
const kbInjectedFrames = new Set();

function scheduleKbInject() {
  if (!hasExtensionApis || !chrome.scripting) return;
  clearTimeout(kbInjectTimer);
  kbInjectTimer = setTimeout(injectKbProbe, 350);
}

async function injectKbProbe() {
  if (!hasExtensionApis || !chrome.scripting || myTabId == null || !isHandheld()) return;
  const targets = (await allHttpFrames()).filter((f) => !kbInjectedFrames.has(f.frameId));
  await Promise.allSettled(targets.map((f) =>
    chrome.scripting.executeScript({
      target: { tabId: myTabId, frameIds: [f.frameId] },
      world: 'MAIN',
      func: kbProbe
    }).then(() => kbInjectedFrames.add(f.frameId))
  ));
}

function frameBroadcast(msg) {
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

async function resolveKbFrame() {
  if (!hasExtensionApis || !chrome.scripting || myTabId == null) return null;
  const frames = await allHttpFrames();
  const answers = await Promise.all(frames.map((f) =>
    runInFrame(f.frameId, () => (window.__ddKbFocus ? window.__ddKbFocus() : null))
      .then((info) => (info ? { frameId: f.frameId, info } : null))
      .catch(() => null)
  ));
  return answers.find(Boolean) || null;
}

let kbQueue = Promise.resolve();

function kbApply(key) {
  if (kbFrameId == null || !hasExtensionApis || !chrome.scripting) return;
  const frameId = kbFrameId;
  kbQueue = kbQueue.then(() =>
    runInFrame(frameId, (k) => (window.__ddKbApply ? window.__ddKbApply(k) : false), [key])
      .catch(() => {}));
}

async function onKbMessage(e) {
  const d = e.data;
  if (!d || typeof d !== 'object' || typeof d.__simulador !== 'string') return;
  if (d.__simulador !== 'kb-focus' && d.__simulador !== 'kb-blur') return;
  if (!isHandheld()) return;
  if (kbResolving) { kbResolvePending = true; return; }

  kbResolving = true;
  let found = null;
  try {
    found = await resolveKbFrame();
  } finally {
    kbResolving = false;
    if (kbResolvePending) {
      kbResolvePending = false;
      setTimeout(() => onKbMessage(e), 0);
    }
  }

  if (!found) {
    if (kbVisible) hideKeyboard();
    return;
  }

  kbFrameId = found.frameId;
  if (kbVisible && found.info.field && found.info.field === kbFieldId) return;

  kbFieldId = found.info.field || null;
  showKeyboard(typeof found.info.mode === 'string' ? found.info.mode : 'text', !!found.info.multiline);
  setTimeout(() => kbApply('__reveal__'), 260);
}

function kbBottomRow() {
  const extra = kbMode === 'email' ? '@' : kbMode === 'url' ? '/' : ',';
  const enterLabel = kbMultiline ? '⏎'
    : kbMode === 'search' ? t('kbSearch')
    : kbMode === 'url' || kbMode === 'email' ? t('kbGo') : '⏎';
  const toggle = kbPage === 'letters'
    ? { key: '__sym1__', cls: 'vk-fn vk-w15', label: '?123' }
    : { key: '__abc__', cls: 'vk-fn vk-w15', label: 'ABC' };
  return [
    toggle,
    extra,
    { key: 'Space', cls: 'vk-space', label: t('kbSpace') },
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
         ['-', '/', ':', ';', '(', ')', t('kbCurrency'), '&', '@', '"']]
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
  kbFrameId = null;
  kbFieldId = null;
  if (!kbVisible) return;
  kbVisible = false;
  stopKbRepeat();
  els.vkb.classList.remove('show');
  els.vkb.setAttribute('aria-hidden', 'true');
}

function pressKey(key) {
  if (key === '__hide__') {
    kbApply('__hide__');
    hideKeyboard();
    return;
  }
  if (key === '__shift__') { kbShift = !kbShift; renderKeyboard(); return; }
  if (key === '__sym1__') { kbPage = 'sym1'; kbShift = false; renderKeyboard(); return; }
  if (key === '__sym2__') { kbPage = 'sym2'; renderKeyboard(); return; }
  if (key === '__abc__') { kbPage = 'letters'; renderKeyboard(); return; }

  kbApply(key);

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
  setInterval(() => { renderClock(); updateBattery(); }, 15000);
  updateBattery();
}

let batteryHooked = false;

async function updateBattery() {
  let level = 1;
  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery();
      level = bat.level;
      if (!batteryHooked) {
        batteryHooked = true;
        bat.addEventListener('levelchange', updateBattery);
      }
    }
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

const DP_REVIEW_DEFAULTS = {
  captures: 0, opens: 0, lastOpenDay: '', dismissed: false, snoozeUntil: 0
};
// Dias distintos com a prévia aberta antes de pedir avaliação.
const DP_REVIEW_MIN_DAYS = 3;
// Deixa o usuário usar a prévia antes de a faixa aparecer.
const DP_REVIEW_DELAY_MS = 15000;

function reviewDayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function loadReviewState() {
  const data = await chrome.storage.local.get([DP_REVIEW_KEY]);
  return Object.assign({}, DP_REVIEW_DEFAULTS, data[DP_REVIEW_KEY] || {});
}

async function saveReviewState(r) {
  await chrome.storage.local.set({ [DP_REVIEW_KEY]: r });
}

function reviewPromptAllowed(r) {
  if (r.dismissed) return false;
  if (r.snoozeUntil && Date.now() < r.snoozeUntil) return false;
  return true;
}

// Gatilho 1 — uso recorrente: a prévia foi aberta em N dias distintos.
// A maioria dos usuários nunca exporta PNG, então este é o caminho principal.
async function bumpOpenAndMaybeReview() {
  if (!hasExtensionApis) return;
  try {
    const r = await loadReviewState();
    const day = reviewDayKey();
    if (r.lastOpenDay !== day) {
      r.opens = (r.opens || 0) + 1;
      r.lastOpenDay = day;
      await saveReviewState(r);
    }
    if (!reviewPromptAllowed(r)) return;
    if (r.opens >= DP_REVIEW_MIN_DAYS) setTimeout(showReviewPrompt, DP_REVIEW_DELAY_MS);
  } catch (_) {}
}

// Gatilho 2 — momento de valor: 1ª captura PNG (ou reabertura após snooze).
async function bumpCaptureAndMaybeReview() {
  if (!hasExtensionApis) return;
  try {
    const r = await loadReviewState();
    r.captures = (r.captures || 0) + 1;
    await saveReviewState(r);
    if (!reviewPromptAllowed(r)) return;
    if (r.captures >= 1) showReviewPrompt();
  } catch (_) {}
}

function showReviewPrompt() {
  if (!els.reviewPrompt) return;
  els.reviewPrompt.classList.remove('hidden');
}

function hideReviewPrompt() {
  if (els.reviewPrompt) els.reviewPrompt.classList.add('hidden');
}

async function snoozeReview(days) {
  hideReviewPrompt();
  if (!hasExtensionApis) return;
  const r = await loadReviewState();
  r.snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  await saveReviewState(r);
}

async function dismissReviewForever() {
  hideReviewPrompt();
  if (!hasExtensionApis) return;
  const r = await loadReviewState();
  r.dismissed = true;
  await saveReviewState(r);
}

function openStoreReview() {
  hideReviewPrompt();
  dismissReviewForever();
  const url = typeof DP_REVIEW_URL !== 'undefined' ? DP_REVIEW_URL
    : 'https://chromewebstore.google.com/detail/ebnbfkejdddkbpkljbbcnchnlekombef/reviews';
  window.open(url, '_blank', 'noopener');
}

async function exportReport() {
  if (!device) { toast(t('toastPickDevice')); return; }
  if (!hasExtensionApis) { toast(t('toastOpenViaExt')); return; }
  const { w, h } = dims();
  const physW = Math.round(w * device.dpr);
  const physH = Math.round(h * device.dpr);
  const lines = [
    t('reportTitle'),
    '',
    `- **${t('reportDevice')}:** ${device.name} (\`${device.id}\`)`,
    `- **${t('reportViewport')}:** ${w} × ${h} CSS px`,
    `- **DPR:** ${device.dpr}`,
    `- **${t('reportPhysical')}:** ${physW} × ${physH} px`,
    `- **${t('reportOrientation')}:** ${state.orientation}`,
    `- **${t('reportPlatform')}:** ${device.platform || '—'}`,
    `- **URL:** ${state.currentUrl || '—'}`,
    `- **User-Agent:** \`${device.ua}\``
  ];
  if (lastFpsStats) {
    lines.push(
      `- **FPS:** ${lastFpsStats.fps} (1% low: ${lastFpsStats.low1}, frame: ${lastFpsStats.ms} ms)`
    );
  } else {
    lines.push(`- **FPS:** ${t('reportFpsMissing')}`);
  }
  lines.push('', t('reportGenerated', [chrome.runtime.getManifest().version]));
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast(t('toastReportCopied'));
  } catch (_) {
    toast(t('toastReportFail'));
    console.log(text);
  }
}

init();
