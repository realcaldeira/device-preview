// Silhuetas SVG dos dispositivos, indexadas pelo tipo de moldura ("frame").
// Usadas no side panel e disponíveis para qualquer página da extensão.
const DP_ICONS = {
  'punch':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/>' +
    '<circle cx="12" cy="5" r="0.9" fill="currentColor" stroke="none"/></svg>',

  'punch-left':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/>' +
    '<circle cx="9.2" cy="5" r="0.9" fill="currentColor" stroke="none"/></svg>',

  'drop':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/>' +
    '<path d="M10.6 3.2h2.8a1.4 1.4 0 0 1-2.8 0Z" fill="currentColor" stroke="none"/></svg>',

  'notch':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/>' +
    '<path d="M9 2.7h6v0.9a1.3 1.3 0 0 1-1.3 1.3H10.3A1.3 1.3 0 0 1 9 3.6Z" fill="currentColor" stroke="none"/></svg>',

  'island':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/>' +
    '<rect x="9.8" y="4" width="4.4" height="1.6" rx="0.8" fill="currentColor" stroke="none"/></svg>',

  'home':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="6.5" y="2" width="11" height="20" rx="2.2"/>' +
    '<circle cx="12" cy="19.4" r="1.1"/>' +
    '<path d="M10.5 4.4h3" stroke-linecap="round"/></svg>',

  'tablet':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="4" y="2.5" width="16" height="19" rx="2.2"/>' +
    '<path d="M10.8 18.8h2.4" stroke-linecap="round"/></svg>',

  'tv':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="2.5" y="4" width="19" height="12.5" rx="1.6"/>' +
    '<path d="M12 16.5v2.5M8 21h8" stroke-linecap="round"/></svg>'
};
