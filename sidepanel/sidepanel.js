const FAV_KEY = 'favorites';
let favorites = new Set();
const deviceById = {};
const deviceOrder = [];
let activeId = null;
let onboardingStep = 0;

const STAR_SVG =
  '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
  '<path d="M12 3.5l2.6 5.3 5.9.86-4.27 4.16 1.01 5.87L12 17.9l-5.25 2.79 1.01-5.87L3.5 9.66l5.9-.86z"/></svg>';

const ONBOARDING_STEPS = [
  { titleKey: 'ob1Title', bodyKey: 'ob1Body', suggest: ['iphone-16', 'pixel-8'] },
  { titleKey: 'ob2Title', bodyKey: 'ob2Body', suggest: [] },
  { titleKey: 'ob3Title', bodyKey: 'ob3Body', suggest: [] }
];

async function init() {
  applyI18n();
  const root = document.getElementById('groups');
  try {
    const stored = await chrome.storage.local.get([FAV_KEY, DP_ONBOARDING_KEY, DP_HISTORY_KEY]);
    favorites = new Set(Array.isArray(stored[FAV_KEY]) ? stored[FAV_KEY] : []);

    const res = await fetch(chrome.runtime.getURL('data/devices.json'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    for (const cat of data.categories) for (const d of cat.devices) {
      deviceById[d.id] = d;
      deviceOrder.push(d.id);
    }

    renderPresets();
    renderRecent(stored[DP_HISTORY_KEY]);
    root.appendChild(renderFavorites());
    for (const cat of data.categories) root.appendChild(renderCategory(cat));
    refreshFavorites();

    if (!stored[DP_ONBOARDING_KEY]) showOnboarding(0);
  } catch (e) {
    showError(t('errDevices', [e.message]));
    return;
  }
  document.getElementById('search').addEventListener('input', (e) => filter(e.target.value));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[FAV_KEY]) {
      favorites = new Set(Array.isArray(changes[FAV_KEY].newValue) ? changes[FAV_KEY].newValue : []);
      deviceOrder.forEach((id) => syncStars(id));
      refreshFavorites();
    }
    if (changes[DP_HISTORY_KEY]) renderRecent(changes[DP_HISTORY_KEY].newValue);
  });
}

function showError(message) {
  const box = document.getElementById('panelError');
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  document.getElementById('panelError').classList.add('hidden');
}

function renderPresets() {
  const list = document.getElementById('presetList');
  list.innerHTML = '';
  for (const p of DP_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.title = t('presetApplyTitle');
    const name = t(p.nameKey);
    const hint = t(p.hintKey);
    btn.innerHTML = `<span class="pn">${escapeHtml(name)}</span><span class="ph">${escapeHtml(hint)}</span>`;
    btn.addEventListener('click', () => runPreset(p.id));
    list.appendChild(btn);
  }
}

function runPreset(presetId) {
  chrome.runtime.sendMessage({ type: 'open-preset', presetId })
    .then((res) => {
      if (res && res.ok) {
        hideError();
        if (Array.isArray(res.favorites)) {
          favorites = new Set(res.favorites);
          deviceOrder.forEach((id) => syncStars(id));
          refreshFavorites();
        }
        const preset = DP_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          activeId = preset.devices[0];
          document.querySelectorAll('.device.active').forEach((el) => el.classList.remove('active'));
          document.querySelectorAll(`.device[data-id="${CSS.escape(activeId)}"]`)
            .forEach((el) => el.classList.add('active'));
        }
      } else {
        // Sem resposta o promise resolve `undefined` em vez de rejeitar, então
        // esse ramo também cobre o service worker que morreu no meio.
        showError(t('errPreset', [(res && res.error) || t('errNoResponse')]));
      }
    })
    .catch((e) => showError(t('errPreset', [e.message])));
}

function renderRecent(raw) {
  const section = document.getElementById('recentSection');
  const list = document.getElementById('recentList');
  const items = Array.isArray(raw) ? raw : [];
  list.innerHTML = '';
  const usable = items.filter((e) => e && deviceById[e.deviceId]);
  section.classList.toggle('hidden', usable.length === 0);
  for (const e of usable.slice(0, DP_HISTORY_MAX)) {
    const d = deviceById[e.deviceId];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-item';
    const host = hostOf(e.url);
    btn.innerHTML =
      `<span class="rn">${escapeHtml(d.name)}</span>` +
      `<span class="ru">${escapeHtml(host || t('urlOfTab'))}</span>`;
    btn.title = e.url || d.name;
    btn.addEventListener('click', () => openDevice(e.deviceId, e.url || null));
    list.appendChild(btn);
  }
}

function hostOf(url) {
  if (!url) return '';
  try { return new URL(url).hostname; } catch (_) { return url; }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFavorites() {
  const details = document.createElement('details');
  details.id = 'favGroup';
  details.open = true;
  details.dataset.cat = 'favorites';

  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = t('favorites');
  const count = document.createElement('span');
  count.className = 'count';
  summary.append(title, count);
  details.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'list';
  details.appendChild(list);

  return details;
}

function refreshFavorites() {
  const group = document.getElementById('favGroup');
  if (!group) return;
  const list = group.querySelector('.list');
  const count = group.querySelector('.count');

  const favDevices = deviceOrder.filter((id) => favorites.has(id)).map((id) => deviceById[id]);

  list.innerHTML = '';
  for (const d of favDevices) list.appendChild(renderDevice(d));
  count.textContent = favDevices.length;

  group.classList.toggle('hidden', favDevices.length === 0);

  const search = document.getElementById('search');
  if (search && search.value.trim()) filter(search.value);
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  chrome.storage.local.set({ [FAV_KEY]: [...favorites] });
  syncStars(id);
  refreshFavorites();
}

function syncStars(id) {
  const on = favorites.has(id);
  document.querySelectorAll(`.device[data-id="${CSS.escape(id)}"] .star`).forEach((star) => {
    star.classList.toggle('on', on);
    star.setAttribute('aria-pressed', String(on));
    star.title = on ? t('favRemove') : t('favAdd');
  });
}

function renderCategory(cat) {
  const details = document.createElement('details');
  details.open = true;
  details.dataset.cat = cat.id;

  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = catLabel(cat.id, cat.name);
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = cat.devices.length;
  summary.append(title, count);
  details.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'list';
  for (const d of cat.devices) list.appendChild(renderDevice(d));
  details.appendChild(list);

  return details;
}

function renderDevice(d) {
  const btn = document.createElement('div');
  btn.className = 'device';
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.dataset.id = d.id;
  btn.dataset.search = d.name.toLowerCase();
  btn.title = t('physicalRes', [d.physical]);
  if (d.id === activeId) btn.classList.add('active');

  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.innerHTML = DP_ICONS[d.frame] || DP_ICONS.punch;

  const info = document.createElement('span');
  info.className = 'info';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = d.name;

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${d.width} × ${d.height} · DPR ${d.dpr}`;

  info.append(name, meta);

  const fav = favorites.has(d.id);
  const star = document.createElement('span');
  star.className = 'star' + (fav ? ' on' : '');
  star.setAttribute('role', 'button');
  star.setAttribute('tabindex', '0');
  star.setAttribute('aria-pressed', String(fav));
  star.title = fav ? t('favRemove') : t('favAdd');
  star.innerHTML = STAR_SVG;

  const toggle = (e) => { e.stopPropagation(); e.preventDefault(); toggleFavorite(d.id); };
  star.addEventListener('click', toggle);
  star.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') toggle(e);
  });

  btn.append(icon, info, star);

  const open = () => openDevice(d.id);
  btn.addEventListener('click', open);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  return btn;
}

function openDevice(deviceId, url) {
  const msg = { type: 'open-preview', deviceId };
  if (url) msg.url = url;
  chrome.runtime.sendMessage(msg)
    .then((res) => {
      if (res && res.ok) hideError();
      else showError(t('errPreview', [(res && res.error) || t('errNoResponse')]));
    })
    .catch((e) => showError(t('errPreviewReload', [e.message])));
  activeId = deviceId;
  document.querySelectorAll('.device.active').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll(`.device[data-id="${CSS.escape(deviceId)}"]`)
    .forEach((el) => el.classList.add('active'));
}

function showOnboarding(step) {
  onboardingStep = step;
  const root = document.getElementById('onboarding');
  const s = ONBOARDING_STEPS[step];
  if (!s) { finishOnboarding(); return; }

  document.getElementById('obStepLabel').textContent =
    t('obStep', [String(step + 1), String(ONBOARDING_STEPS.length)]);
  document.getElementById('obTitle').textContent = t(s.titleKey);
  document.getElementById('obBody').textContent = t(s.bodyKey);

  const suggest = document.getElementById('obSuggest');
  suggest.innerHTML = '';
  for (const id of s.suggest) {
    const d = deviceById[id];
    if (!d) continue;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ob-chip';
    chip.textContent = d.name;
    chip.addEventListener('click', () => {
      finishOnboarding();
      openDevice(id);
    });
    suggest.appendChild(chip);
  }

  const next = document.getElementById('obNext');
  next.textContent = step >= ONBOARDING_STEPS.length - 1 ? t('obStart') : t('obNext');
  next.onclick = () => {
    if (onboardingStep >= ONBOARDING_STEPS.length - 1) finishOnboarding();
    else showOnboarding(onboardingStep + 1);
  };
  document.getElementById('obSkip').onclick = finishOnboarding;

  root.classList.remove('hidden');
}

function finishOnboarding() {
  document.getElementById('onboarding').classList.add('hidden');
  chrome.storage.local.set({ [DP_ONBOARDING_KEY]: true });
}

let openBeforeSearch = null;

function filter(query) {
  const q = query.trim().toLowerCase();
  const groups = document.querySelectorAll('#groups details');

  if (q && openBeforeSearch === null) {
    openBeforeSearch = new Map();
    groups.forEach((g) => openBeforeSearch.set(g, g.open));
  }

  groups.forEach((group) => {
    let visible = 0;
    group.querySelectorAll('.device').forEach((dev) => {
      const match = !q || dev.dataset.search.includes(q);
      dev.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    group.classList.toggle('hidden', visible === 0);
    if (q && visible > 0) group.open = true;
  });

  if (!q && openBeforeSearch) {
    openBeforeSearch.forEach((wasOpen, g) => { g.open = wasOpen; });
    openBeforeSearch = null;
  }
}

init();
