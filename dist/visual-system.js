(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cards = document.querySelectorAll('.home-demo-track li,.home-route-card,.home-module-grid>a,.routes article,.topics article,.connections article,.bio-related a');
  cards.forEach(card => {
    card.addEventListener('pointermove', event => {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--bio-pointer-x', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--bio-pointer-y', `${event.clientY - bounds.top}px`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--bio-pointer-x');
      card.style.removeProperty('--bio-pointer-y');
    });
  });
})();
