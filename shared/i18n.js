/** chrome.i18n helpers with safe fallbacks. */
function t(key, substitutions) {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    }
  } catch (_) {}
  return key;
}

function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = t(key);
    if (!msg || msg === key) return;
    if (el.tagName === 'TITLE') {
      document.title = msg;
      return;
    }
    el.textContent = msg;
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n-placeholder'));
    if (msg) el.placeholder = msg;
  });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n-title'));
    if (msg) el.title = msg;
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n-aria'));
    if (msg) el.setAttribute('aria-label', msg);
  });
  try {
    if (chrome.i18n && chrome.i18n.getUILanguage) {
      document.documentElement.lang = chrome.i18n.getUILanguage();
    }
  } catch (_) {}
}

function catLabel(catId, fallback) {
  const key = 'cat_' + catId;
  const msg = t(key);
  return msg && msg !== key ? msg : (fallback || catId);
}
