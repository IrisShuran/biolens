(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  const transitionKey = 'biolens.transition.destination';
  let destination = null;
  try {
    destination = sessionStorage.getItem(transitionKey);
    sessionStorage.removeItem(transitionKey);
  } catch (_) {}

  if (destination === location.pathname) {
    root.classList.add('bio-arriving');
    const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('bio-arriving')));
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
    setTimeout(() => { location.href = next.href; }, 200);
  });

  addEventListener('pageshow', event => {
    if (event.persisted) root.classList.remove('bio-leaving', 'bio-arriving');
  });
})();
