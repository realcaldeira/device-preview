// Sonda de dispositivo — roda em document_start, no mundo MAIN de cada frame.
//
// As regras de declarativeNetRequest trocam só o cabeçalho HTTP User-Agent: o
// JavaScript do site continua enxergando um desktop (navigator.userAgent, tela,
// DPR, ausência de toque). Esta sonda fecha essa lacuna do lado do cliente e
// sintetiza eventos de toque a partir do mouse, para o site se comportar como
// no aparelho de verdade.
//
// Ela só age no iframe do simulador: a página do preview marca o frame com
// window.name = '__sim_dev__' + JSON da configuração. Qualquer outro frame sai
// na primeira linha. O nome é lido de forma síncrona, antes do primeiro script
// do site rodar — por isso a configuração viaja ali e não por postMessage.
(function () {
  'use strict';

  var TAG = '__sim_dev__';

  var raw = '';
  try { raw = window.name || ''; } catch (_) { return; }
  if (raw.lastIndexOf(TAG, 0) !== 0) return;

  var cfg = null;
  try { cfg = JSON.parse(raw.slice(TAG.length)); } catch (_) { return; }
  if (!cfg || typeof cfg !== 'object') return;

  // Reinjeção (troca de dispositivo sem recarregar): atualiza e sai.
  if (window.__simDeviceProbe) {
    window.__simDeviceProbe(cfg);
    return;
  }

  var win = window;
  var doc = document;

  // ---------------------------------------------------------------- identidade

  var MAX_TOUCH_POINTS = 5;

  function def(obj, prop, getter) {
    try {
      Object.defineProperty(obj, prop, { configurable: true, enumerable: true, get: getter });
    } catch (_) {}
  }

  var realUad = null;
  try { realUad = navigator.userAgentData || null; } catch (_) {}

  var fakeUad = realUad && {
    get brands() { return realUad.brands; },
    get mobile() { return !!cfg.mobile; },
    get platform() { return cfg.uaPlatform; },
    getHighEntropyValues: function (hints) {
      return realUad.getHighEntropyValues(hints).then(function (values) {
        values.mobile = !!cfg.mobile;
        values.platform = cfg.uaPlatform;
        return values;
      });
    },
    toJSON: function () {
      return { brands: realUad.brands, mobile: !!cfg.mobile, platform: cfg.uaPlatform };
    }
  };

  def(navigator, 'userAgent', function () { return cfg.ua; });
  def(navigator, 'appVersion', function () { return cfg.ua.replace(/^Mozilla\//, ''); });
  def(navigator, 'platform', function () { return cfg.navPlatform; });
  def(navigator, 'vendor', function () { return cfg.vendor; });
  def(navigator, 'maxTouchPoints', function () { return cfg.touch ? MAX_TOUCH_POINTS : 0; });

  // Safari (iOS/iPadOS) não expõe User-Agent Client Hints; manter o objeto do
  // Chrome desktop entregaria o disfarce na hora.
  if (cfg.uaPlatform === 'iOS') {
    def(navigator, 'userAgentData', function () { return undefined; });
  } else if (fakeUad) {
    def(navigator, 'userAgentData', function () { return fakeUad; });
  }

  // -------------------------------------------------------------------- tela

  def(win, 'devicePixelRatio', function () { return cfg.dpr; });

  def(screen, 'width', function () { return cfg.sw; });
  def(screen, 'height', function () { return cfg.sh; });
  def(screen, 'availWidth', function () { return cfg.sw; });
  def(screen, 'availHeight', function () { return cfg.sh; });

  if (cfg.handheld) {
    def(win, 'orientation', function () { return cfg.landscape ? 90 : 0; });
  }

  try {
    if (screen.orientation) {
      def(screen.orientation, 'type', function () {
        return cfg.landscape ? 'landscape-primary' : 'portrait-primary';
      });
      def(screen.orientation, 'angle', function () { return cfg.landscape ? 90 : 0; });
    }
  } catch (_) {}

  // ------------------------------------------------------- media queries (JS)
  //
  // Cobre matchMedia. Regras @media escritas na folha de estilo do site
  // continuam sendo avaliadas pelo Chrome com os valores reais do desktop —
  // só o protocolo de depuração (CDP) muda isso, e ele deixa a faixa amarela
  // de "navegador sendo depurado" na aba.

  var ALWAYS = '(min-width: 0px)';
  var NEVER = '(min-width: 2147483647px)';

  var MEDIA_SWAPS = [
    [/\(\s*any-pointer\s*:\s*coarse\s*\)/gi, ALWAYS],
    [/\(\s*any-pointer\s*:\s*fine\s*\)/gi, NEVER],
    [/\(\s*pointer\s*:\s*coarse\s*\)/gi, ALWAYS],
    [/\(\s*pointer\s*:\s*fine\s*\)/gi, NEVER],
    [/\(\s*any-hover\s*:\s*hover\s*\)/gi, NEVER],
    [/\(\s*any-hover\s*:\s*none\s*\)/gi, ALWAYS],
    [/\(\s*hover\s*:\s*hover\s*\)/gi, NEVER],
    [/\(\s*hover\s*:\s*none\s*\)/gi, ALWAYS]
  ];

  var nativeMatchMedia = win.matchMedia;
  if (typeof nativeMatchMedia === 'function') {
    win.matchMedia = function (query) {
      var text = String(query);
      var rewritten = text;
      if (cfg.touch) {
        for (var i = 0; i < MEDIA_SWAPS.length; i++) {
          rewritten = rewritten.replace(MEDIA_SWAPS[i][0], MEDIA_SWAPS[i][1]);
        }
      }
      var mql = nativeMatchMedia.call(win, rewritten);
      if (rewritten !== text) {
        try { Object.defineProperty(mql, 'media', { configurable: true, value: text }); } catch (_) {}
      }
      return mql;
    };
  }

  // ------------------------------------------------------------------- toque

  // Um Chrome de desktop sem tela sensível ao toque não expõe Touch/TouchEvent.
  // Onde eles existem usamos os nativos; onde não, montamos objetos com a mesma
  // forma — é o que o código dos sites lê (e.touches[0].clientX e afins).
  var NATIVE_TOUCH = typeof win.Touch === 'function' && typeof win.TouchEvent === 'function';

  function markTouchApi(on) {
    try {
      if (on) {
        if (!('ontouchstart' in win)) {
          Object.defineProperty(win, 'ontouchstart', { configurable: true, writable: true, value: null });
          Object.defineProperty(doc, 'ontouchstart', { configurable: true, writable: true, value: null });
        }
      } else if (Object.getOwnPropertyDescriptor(win, 'ontouchstart')) {
        delete win.ontouchstart;
        delete doc.ontouchstart;
      }
    } catch (_) {}
  }

  var TOUCH_ID = 1;
  var gesture = null;      // gesto em andamento
  var swallowClick = false; // arrastou: o clique que o Chrome geraria não deve valer
  var glide = null;         // inércia pós-arraste

  function makeTouch(target, e) {
    var init = {
      identifier: TOUCH_ID,
      target: target,
      clientX: e.clientX, clientY: e.clientY,
      screenX: e.screenX, screenY: e.screenY,
      pageX: e.pageX, pageY: e.pageY,
      radiusX: 11.5, radiusY: 11.5, rotationAngle: 0, force: 1
    };
    if (NATIVE_TOUCH) {
      try { return new win.Touch(init); } catch (_) {}
    }
    return init;
  }

  function touchList(items) {
    items.item = function (i) { return this[i] || null; };
    return items;
  }

  // Retorna false quando o site chamou preventDefault (ou seja: assumiu o gesto).
  function fireTouch(type, target, e) {
    var ending = type === 'touchend' || type === 'touchcancel';
    var changed = [makeTouch(target, e)];
    var active = ending ? [] : changed.slice();
    var ev;
    if (NATIVE_TOUCH) {
      try {
        ev = new win.TouchEvent(type, {
          bubbles: true, cancelable: true, composed: true, view: win,
          touches: active, targetTouches: active, changedTouches: changed
        });
      } catch (_) {}
    }
    if (!ev) {
      ev = new win.Event(type, { bubbles: true, cancelable: true, composed: true });
      ev.touches = ev.targetTouches = touchList(active);
      ev.changedTouches = touchList(changed);
      ev.altKey = ev.ctrlKey = ev.metaKey = ev.shiftKey = false;
    }
    return target.dispatchEvent(ev);
  }

  function firePointer(type, target, e, extra) {
    var init = {
      bubbles: true, cancelable: type !== 'pointercancel', composed: true, view: win,
      pointerId: TOUCH_ID, pointerType: 'touch', isPrimary: true,
      clientX: e.clientX, clientY: e.clientY,
      screenX: e.screenX, screenY: e.screenY,
      width: 23, height: 23,
      pressure: extra && extra.up ? 0 : 0.5,
      button: extra && extra.move ? -1 : 0,
      buttons: extra && extra.up ? 0 : 1
    };
    try { return target.dispatchEvent(new win.PointerEvent(type, init)); } catch (_) { return true; }
  }

  // ---- rolagem por arraste (o dedo arrasta a página; o mouse não faz isso)

  function canScroll(el, dx, dy) {
    if (!el || el === doc || el === doc.documentElement || el === doc.body) return false;
    var style;
    try { style = win.getComputedStyle(el); } catch (_) { return false; }
    var oy = style.overflowY, ox = style.overflowX;
    var scrollableY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    var scrollableX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    if (dy && scrollableY && !atEdge(el, 'top', dy)) return true;
    if (dx && scrollableX && !atEdge(el, 'left', dx)) return true;
    return false;
  }

  function atEdge(el, axis, delta) {
    if (axis === 'top') {
      var max = el.scrollHeight - el.clientHeight;
      return (delta > 0 && el.scrollTop <= 0) || (delta < 0 && el.scrollTop >= max - 1);
    }
    var maxX = el.scrollWidth - el.clientWidth;
    return (delta > 0 && el.scrollLeft <= 0) || (delta < 0 && el.scrollLeft >= maxX - 1);
  }

  function scrollTargetFor(node, dx, dy) {
    var el = node;
    while (el && el.nodeType === 1) {
      if (canScroll(el, dx, dy)) return el;
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
    }
    return doc.scrollingElement || doc.documentElement;
  }

  function scrollBy(el, dx, dy) {
    if (!el) return;
    if (el === doc.scrollingElement || el === doc.documentElement || el === doc.body) {
      win.scrollBy(-dx, -dy);
    } else {
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
    }
  }

  function stopGlide() {
    if (glide) { win.cancelAnimationFrame(glide.raf); glide = null; }
  }

  function startGlide(el, vx, vy) {
    stopGlide();
    if (Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15) return;
    glide = { el: el, vx: vx, vy: vy, raf: 0 };
    var step = function () {
      if (!glide) return;
      glide.vx *= 0.94;
      glide.vy *= 0.94;
      scrollBy(glide.el, glide.vx * 16, glide.vy * 16);
      if (Math.abs(glide.vx) < 0.05 && Math.abs(glide.vy) < 0.05) { glide = null; return; }
      glide.raf = win.requestAnimationFrame(step);
    };
    glide.raf = win.requestAnimationFrame(step);
  }

  // ---- ponta do dedo: no lugar da seta do mouse, um círculo como o de um toque

  var cursorEl = null;

  function ensureCursor() {
    if (cursorEl && cursorEl.parentNode) return true;
    if (!doc.documentElement) return false;
    cursorEl = doc.createElement('div');
    cursorEl.setAttribute('data-sim-touch', '');
    cursorEl.style.cssText =
      'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;' +
      'border-radius:50%;pointer-events:none;opacity:0;z-index:2147483647;' +
      'background:radial-gradient(circle at 38% 32%,rgba(255,255,255,0.5),rgba(40,50,70,0.32) 70%);' +
      'border:1.5px solid rgba(30,40,60,0.45);box-shadow:0 1px 4px rgba(0,0,0,0.28);' +
      'transition:opacity .12s linear,transform .09s ease-out,box-shadow .12s ease-out;';
    doc.documentElement.appendChild(cursorEl);
    return true;
  }

  function moveCursor(e) {
    if (!ensureCursor()) return;
    cursorEl.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    cursorEl.style.opacity = '1';
  }

  // Halo enquanto o dedo está encostado.
  function pressCursor(down) {
    if (!cursorEl) return;
    cursorEl.style.boxShadow = down
      ? '0 1px 4px rgba(0,0,0,0.28),0 0 0 7px rgba(120,170,255,0.3)'
      : '0 1px 4px rgba(0,0,0,0.28)';
  }

  function hideCursor() {
    if (cursorEl) cursorEl.style.opacity = '0';
  }

  // ---- interceptação dos eventos de mouse

  var MOUSE_EVENTS = [
    'mousedown', 'mouseup', 'mousemove',
    'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
    'pointerdown', 'pointerup', 'pointercancel', 'pointermove',
    'pointerover', 'pointerout', 'pointerenter', 'pointerleave'
  ];

  function isMouse(e) {
    return !e.pointerType || e.pointerType === 'mouse';
  }

  function onDown(e) {
    if (e.button !== 0) return;
    stopGlide();
    var target = e.target;
    gesture = {
      target: target,
      startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastY: e.clientY,
      lastAt: e.timeStamp,
      vx: 0, vy: 0,
      moved: false,
      scroller: null,
      handledBySite: false
    };
    swallowClick = false;
    pressCursor(true);
    firePointer('pointerdown', target, e);
    gesture.handledBySite = !fireTouch('touchstart', target, e);
  }

  function onMove(e) {
    if (!gesture) return;
    var dx = e.clientX - gesture.lastX;
    var dy = e.clientY - gesture.lastY;
    var dt = Math.max(e.timeStamp - gesture.lastAt, 1);

    if (!gesture.moved &&
        Math.abs(e.clientX - gesture.startX) + Math.abs(e.clientY - gesture.startY) > 8) {
      gesture.moved = true;
      swallowClick = true;
      // Arrastar com o dedo rola a página; no desktop selecionaria texto.
      try { doc.documentElement.style.userSelect = 'none'; } catch (_) {}
      try { var sel = win.getSelection(); if (sel) sel.removeAllRanges(); } catch (_) {}
    }

    firePointer('pointermove', gesture.target, e, { move: true });
    var free = fireTouch('touchmove', gesture.target, e);
    if (!free) gesture.handledBySite = true;

    if (gesture.moved && !gesture.handledBySite) {
      if (!gesture.scroller) gesture.scroller = scrollTargetFor(gesture.target, dx, dy);
      scrollBy(gesture.scroller, dx, dy);
      gesture.vx = dx / dt;
      gesture.vy = dy / dt;
    }

    gesture.lastX = e.clientX;
    gesture.lastY = e.clientY;
    gesture.lastAt = e.timeStamp;
  }

  function onUp(e) {
    if (!gesture) return;
    var g = gesture;
    gesture = null;
    pressCursor(false);
    try { doc.documentElement.style.userSelect = ''; } catch (_) {}
    fireTouch('touchend', g.target, e);
    firePointer('pointerup', g.target, e, { up: true });
    // Parou antes de soltar: o dedo segurou a página, não a arremessou.
    if (e.timeStamp - g.lastAt > 80) { g.vx = 0; g.vy = 0; }
    if (g.moved && !g.handledBySite) startGlide(g.scroller, g.vx, g.vy);
  }

  function onClick(e) {
    if (!cfg.touch || !e.isTrusted) return;
    if (swallowClick) {
      swallowClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }

  // Um único ponto de entrada: quem engole o evento precisa ser o mesmo que o
  // traduz, senão o stopImmediatePropagation derrubaria os handlers seguintes.
  //
  // Só a propagação é interrompida — o comportamento nativo do Chrome (focar
  // campos, ativar links, gerar o click) continua valendo. O site apenas não vê
  // os eventos de mouse, e recebe os de toque no lugar.
  function route(e) {
    if (!cfg.touch || !e.isTrusted || !isMouse(e)) return;
    if (e.type === 'pointerdown') onDown(e);
    else if (e.type === 'pointermove') { moveCursor(e); onMove(e); }
    else if (e.type === 'pointerup' || e.type === 'pointercancel') onUp(e);
    else if (e.type === 'pointerout' && !e.relatedTarget) hideCursor();
    e.stopImmediatePropagation();
  }

  for (var i = 0; i < MOUSE_EVENTS.length; i++) {
    win.addEventListener(MOUSE_EVENTS[i], route, true);
  }
  win.addEventListener('click', onClick, true);

  // Arrastar sobre uma imagem ou link dispara o drag-and-drop do desktop, que no
  // celular não existe e impediria a rolagem pelo gesto.
  win.addEventListener('dragstart', function (e) {
    if (cfg.touch && e.isTrusted) e.preventDefault();
  }, true);

  // Só o blur da janela cancela o gesto: com captura, o blur de um campo ao
  // tocar em outro elemento zeraria o arraste em andamento.
  win.addEventListener('blur', function () {
    gesture = null;
    stopGlide();
  });

  // ------------------------------------------- barras de rolagem e destaque

  var styleEl = null;

  function applyChrome() {
    if (!cfg.touch) {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
      hideCursor();
      return;
    }
    if (styleEl && styleEl.parentNode) return;
    var head = doc.head || doc.documentElement;
    if (!head) return;
    styleEl = doc.createElement('style');
    styleEl.setAttribute('data-sim-touch', '');
    // Celulares usam barra de rolagem sobreposta: manter a do desktop rouba
    // largura do conteúdo e denuncia o ambiente. E no lugar da seta do mouse
    // fica o círculo do dedo, desenhado por moveCursor().
    styleEl.textContent =
      'html{scrollbar-width:none;-webkit-tap-highlight-color:rgba(0,0,0,0.12)}' +
      'html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0}' +
      'html,html *{cursor:none!important}';
    head.appendChild(styleEl);
  }

  if (doc.documentElement) applyChrome();
  doc.addEventListener('DOMContentLoaded', applyChrome);

  // ------------------------------------------------- atualização a quente

  markTouchApi(!!cfg.touch);

  win.__simDeviceProbe = function (next) {
    if (!next || typeof next !== 'object') return;
    var wasTouch = cfg.touch;
    cfg = next;
    markTouchApi(!!cfg.touch);
    applyChrome();
    if (!cfg.touch && wasTouch) {
      gesture = null;
      stopGlide();
    }
    try {
      win.dispatchEvent(new Event('resize'));
      if (cfg.handheld) win.dispatchEvent(new Event('orientationchange'));
    } catch (_) {}
  };

  win.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.__simulador === 'dev-cfg' && d.cfg) win.__simDeviceProbe(d.cfg);
  });
})();
