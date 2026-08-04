const DP_FRAME_PRESETS = {
  'notch':      { padTop: 16, padSide: 16, padBottom: 16, radius: 63, screenRadius: 47, sb: 40, kind: 'phone' },
  'island':     { padTop: 14, padSide: 14, padBottom: 14, radius: 69, screenRadius: 55, sb: 54, kind: 'phone' },
  'punch':      { padTop: 11, padSide: 11, padBottom: 13, radius: 47, screenRadius: 36, sb: 30, kind: 'phone' },
  'punch-left': { padTop: 11, padSide: 11, padBottom: 13, radius: 51, screenRadius: 40, sb: 30, kind: 'phone' },
  'drop':       { padTop: 12, padSide: 12, padBottom: 20, radius: 38, screenRadius: 26, sb: 28, kind: 'phone' },
  'home':       { padTop: 80, padSide: 18, padBottom: 86, radius: 56, screenRadius: 4,  sb: 22, kind: 'phone' },
  'tablet':     { padTop: 32, padSide: 32, padBottom: 32, radius: 36, screenRadius: 12, sb: 26, kind: 'tablet' },
  'laptop':     { padTop: 15, padSide: 11, padBottom: 26, radius: 16, screenRadius: 4,  sb: 0,  kind: 'laptop' },
  // padBottom 6 = bisel CSS + .tv-chin; a arte 9-slice usa inset [10,10,36,10]
  // (queixo embutido) em DP_FRAME_IMAGES — os dois caminhos não misturam.
  'tv':         { padTop: 10, padSide: 10, padBottom: 6,  radius: 12, screenRadius: 3,  sb: 0,  kind: 'tv' }
};

// Moldura por imagem: a arte em frames/ (gerada por tools/make_frames.py, ver
// frames/README.md) entra como border-image de 9 fatias no anel ::after — os
// quatro cantos ficam intactos e só as faixas do meio esticam, então a mesma
// arte serve para qualquer viewport sem deformar o aparelho. `scale` é a razão
// px da imagem por px CSS usada na geração. Notebook não gira, então dispensa a
// variante .rot; a TV ganha queixo embutido na arte.
const DP_FRAME_IMAGES = {
  'notch':          { scale: 2, corner: 'squircle' },
  'island':         { scale: 2, corner: 'squircle' },
  'punch':          { scale: 2, corner: 'round' },
  'punch-left':     { scale: 2, corner: 'round' },
  'drop':           { scale: 2, corner: 'round' },
  'home':           { scale: 2, corner: 'round' },
  'tablet':         { scale: 2, corner: 'squircle' },
  'laptop':         { scale: 1.5, rot: false, corner: 'round' },
  'laptop-macbook': { scale: 1.5, rot: false, corner: 'round' },
  // inset com queixo de 36px (logo+LED na arte); o preset CSS continua com
  // padBottom 6 + .tv-chin para o fallback sem WebP.
  'tv':             { scale: 1, inset: [10, 10, 36, 10], corner: 'round' }
};

const DP_FRAME_VIEWPORTS = {
  'notch':          [390, 844],
  'island':         [393, 852],
  'punch':          [384, 854],
  'punch-left':     [412, 915],
  'drop':           [360, 800],
  'home':           [320, 568],
  'tablet':         [820, 1180],
  'laptop':         [1920, 1080],
  'laptop-macbook': [1440, 900],
  'tv':             [1920, 1080]
};
