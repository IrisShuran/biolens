/* BioLens motion controller: nav indicator (L1), world switching (L2), page transitions (L3).
   Emits one `bio:motion` stream so audio, haptics or demo mode can subscribe later. */
(() => {
  'use strict';
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMQ.matches;
  const emit = (name, extra) => {
    try {
      window.dispatchEvent(new CustomEvent('bio:motion', {
        detail: Object.assign({ name, phase: '' }, extra || {})
      }));
    } catch (_) {}
  };
  const start = (name, extra) => emit(name, Object.assign({ phase: 'start' }, extra || {}));
  const end = (name, extra) => emit(name, Object.assign({ phase: 'end' }, extra || {}));

  const views = ['homeMain', 'cellMain', 'dnaMain', 'mitoMain', 'atpMain']
    .map(id => document.getElementById(id)).filter(Boolean);
  views.forEach(v => v.classList.add('world-view'));

  const nav = document.querySelector('.world-nav');
  let indicator = null, preview = null;

  const items = () => (nav ? [...nav.querySelectorAll('button,a')] : []);
  function box(el) {
    const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
    return { x: r.left - n.left, w: r.width };
  }
  function paint(bar, geo, instant) {
    if (!bar) return;
    if (instant) nav.classList.add('no-anim');
    bar.style.transform = 'translate3d(' + geo.x + 'px,0,0) scaleX(' + (geo.w / 100).toFixed(4) + ')';
    if (instant) { void bar.offsetWidth; nav.classList.remove('no-anim'); }
  }
  function activeEl() {
    return nav.querySelector('[aria-pressed="true"]') ||
           nav.querySelector('[aria-current="true"]') || items()[0] || null;
  }
  function singleRow() {
    return new Set(items().map(el => Math.round(el.offsetTop))).size <= 1;
  }
  function updateNav(instant) {
    if (!nav || !indicator) return;
    if (!singleRow()) { nav.classList.remove('has-indicator'); return; }
    nav.classList.add('has-indicator');
    const el = activeEl();
    if (el) paint(indicator, box(el), instant !== false);
  }
  function initNav() {
    if (!nav || indicator) return;
    preview = document.createElement('span');
    preview.className = 'nav-indicator-preview';
    preview.setAttribute('aria-hidden', 'true');
    indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.append(preview, indicator);
    updateNav(true);
    nav.addEventListener('pointerover', event => {
      const el = event.target.closest && event.target.closest('button,a');
      if (!el || !nav.contains(el)) return;
      paint(preview, box(el), true);
      preview.classList.add('is-on');
      start('nav:preview', { unit: el.id || el.textContent.trim() });
    });
    nav.addEventListener('pointerleave', () => preview.classList.remove('is-on'));
    nav.addEventListener('focusin', event => {
      const el = event.target.closest && event.target.closest('button,a');
      if (!el) return;
      paint(preview, box(el), true);
      preview.classList.add('is-on');
    });
    nav.addEventListener('focusout', () => preview.classList.remove('is-on'));
    nav.addEventListener('click', () => requestAnimationFrame(() => updateNav(false)));
    addEventListener('resize', () => updateNav(true));
    addEventListener('biolanguagechange', () => updateNav(true));
    if (window.ResizeObserver) new ResizeObserver(() => updateNav(true)).observe(nav);
  }

  function enterView(el, unit) {
    el.hidden = false;
    el.classList.add('m-enter');
    el.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('m-enter')));
    start('world:enter', { unit });
    setTimeout(() => end('world:enter', { unit }), 240);
  }

  let pending = null;
  function flush() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.el.classList.remove('m-leave');
    pending.apply();
    pending = null;
  }

  window.BioMotion = {
    updateNav,
    switchWorld(world, apply) {
      const target = document.getElementById(world === 'home' ? 'homeMain' : world + 'Main');
      if (pending) {
        flush();
        apply();
        if (target) { target.hidden = false; target.classList.remove('m-enter', 'm-leave'); }
        updateNav(false);
        start('world:enter', { unit: world });
        end('world:enter', { unit: world });
        return;
      }
      const current = views.find(v => !v.hidden && v !== target);
      start('world:leave', { unit: world });
      if (!target || !current || reduced()) {
        apply();
        if (target) enterView(target, world);
        updateNav(false);
        end('world:leave', { unit: world });
        return;
      }
      current.classList.add('m-leave');
      pending = {
        el: current,
        apply,
        timer: setTimeout(() => {
          pending = null;
          current.classList.remove('m-leave');
          apply();
          enterView(target, world);
          updateNav(false);
          end('world:leave', { unit: world });
        }, 160)
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNav, { once: true });
  else initNav();
})();
