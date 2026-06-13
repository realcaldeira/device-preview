const FAV_KEY = 'favorites';
let favorites = new Set();
const deviceById = {};
const deviceOrder = [];
let activeId = null;

const STAR_SVG =
  '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
  '<path d="M12 3.5l2.6 5.3 5.9.86-4.27 4.16 1.01 5.87L12 17.9l-5.25 2.79 1.01-5.87L3.5 9.66l5.9-.86z"/></svg>';

async function init() {
  const root = document.getElementById('groups');
  try {
    const storedFav = await chrome.storage.local.get([FAV_KEY]);
    favorites = new Set(Array.isArray(storedFav[FAV_KEY]) ? storedFav[FAV_KEY] : []);

    const res = await fetch(chrome.runtime.getURL('data/devices.json'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    for (const cat of data.categories) for (const d of cat.devices) {
      deviceById[d.id] = d;
      deviceOrder.push(d.id);
    }

    root.appendChild(renderFavorites());
    for (const cat of data.categories) root.appendChild(renderCategory(cat));
    refreshFavorites();
  } catch (e) {
    showError('Não foi possível carregar a lista de dispositivos: ' + e.message +
      '. Recarregue a extensão em chrome://extensions.');
    return;
  }
  document.getElementById('search').addEventListener('input', (e) => filter(e.target.value));
}

function showError(message) {
  const box = document.getElementById('panelError');
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  document.getElementById('panelError').classList.add('hidden');
}

function renderFavorites() {
  const details = document.createElement('details');
  details.id = 'favGroup';
  details.open = true;
  details.dataset.cat = 'favorites';

  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = 'Favoritos';
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
    star.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  });
}

function renderCategory(cat) {
  const details = document.createElement('details');
  details.open = true;
  details.dataset.cat = cat.id;

  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = cat.name;
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
  btn.title = `Resolução física: ${d.physical} px`;
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
  star.title = fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  star.innerHTML = STAR_SVG;

  const toggle = (e) => { e.stopPropagation(); e.preventDefault(); toggleFavorite(d.id); };
  star.addEventListener('click', toggle);
  star.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') toggle(e);
  });

  btn.append(icon, info, star);

  const open = () => {
    chrome.runtime.sendMessage({ type: 'open-preview', deviceId: d.id })
      .then((res) => {
        if (res && res.ok) hideError();
        else showError('Falha ao abrir a prévia: ' + ((res && res.error) || 'sem resposta do service worker'));
      })
      .catch((e) => showError('Falha ao abrir a prévia: ' + e.message +
        '. Recarregue a extensão em chrome://extensions.'));
    activeId = d.id;
    document.querySelectorAll('.device.active').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll(`.device[data-id="${CSS.escape(d.id)}"]`)
      .forEach((el) => el.classList.add('active'));
  };
  btn.addEventListener('click', open);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  return btn;
}

let openBeforeSearch = null;

function filter(query) {
  const q = query.trim().toLowerCase();
  const groups = document.querySelectorAll('details');

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
