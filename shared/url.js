// Utilitário de URL compartilhado pela prévia (preview.js, via <script>) e pelo
// service worker (via importScripts). Define a função no escopo global de cada
// contexto.

// É uma URL http(s) navegável?
function dpIsHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}
