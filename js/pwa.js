/*!
 * AkihiroLabs — Kanji Bridge — PWA helper
 * Registers the service worker and shows any [data-install] button when the
 * browser offers "Add to Home Screen".
 */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  let deferred = null;
  const buttons = () => document.querySelectorAll('[data-install]');
  const show = on => buttons().forEach(b => { b.hidden = !on; });

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    show(true);
  });
  window.addEventListener('appinstalled', () => { deferred = null; show(false); });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-install]');
    if (!btn || !deferred) return;
    e.preventDefault();
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    show(false);
  });
})();
