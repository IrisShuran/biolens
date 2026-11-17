/* Cross-document transition: fade the outgoing main out and up, then let the
   arriving page fade its main in. The colour veil in site-transition.css covers
   the gap so the switch never flashes white. */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  const transitionKey = 'biolens.transition.destination';
  const main = () => document.querySelector('main');
  let destination = null;
  try {
    destination = sessionStorage.getItem(transitionKey);
    sessionStorage.removeItem(transitionKey);
  } catch (_) {}

  if (destination === location.pathname) {
    root.classList.add('bio-arriving');
    const reveal = () => requestAnimationFrame(() => {
      root.classList.remove('bio-arriving');
      const el = main();
      if (!el) return;
      el.classList.add('page-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('page-enter')));
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal, { once: true });
    else reveal();
  }

  document.addEventListener('click', event => {
    if (root.classList.contains('bio-leaving') || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.target && link.target !== '_self' || link.hasAttribute('download')) return;
    const next = new URL(link.href, location.href);
    if (next.origin !== location.origin || next.pathname === location.pathname) return;
    event.preventDefault();
    try { sessionStorage.setItem(transitionKey, next.pathname); } catch (_) {}
    root.classList.add('bio-leaving');
    const el = main();
    if (el) el.classList.add('page-leave');
    setTimeout(() => { location.href = next.href; }, 180);
  });

  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    root.classList.remove('bio-leaving', 'bio-arriving');
    const el = main();
    if (el) el.classList.remove('page-leave', 'page-enter');
  });
})();
