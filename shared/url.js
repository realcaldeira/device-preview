function dpIsHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}
