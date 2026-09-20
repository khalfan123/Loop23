(() => {
  const topbar = document.querySelector('.lg-topbar');
  if (!topbar) return;

  const burger = topbar.querySelector('.lg-nav-burger');
  const nav = topbar.querySelector('.lg-navlinks');
  const backdrop = document.querySelector('.lg-nav-backdrop');

  const items = [...topbar.querySelectorAll('.lg-nav-item')];
  const isMobile = () => window.matchMedia('(max-width: 980px)').matches;

  function closeAllPanels() {
    items.forEach((item) => {
      item.classList.remove('is-open');
      const btn = item.querySelector('.lg-nav-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function closeMobile() {
    nav?.classList.remove('is-open');
    topbar.classList.remove('is-menu-open');
    backdrop?.classList.remove('is-on');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    closeAllPanels();
    document.body.style.overflow = '';
  }

  function openMobile() {
    nav?.classList.add('is-open');
    topbar.classList.add('is-menu-open');
    backdrop?.classList.add('is-on');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  burger?.addEventListener('click', () => {
    if (nav?.classList.contains('is-open')) closeMobile();
    else openMobile();
  });
  backdrop?.addEventListener('click', closeMobile);

  items.forEach((item) => {
    const trigger = item.querySelector('.lg-nav-trigger');
    if (!trigger || trigger.tagName === 'A' && !item.querySelector('.lg-mega')) return;

    trigger.addEventListener('click', (e) => {
      if (!item.querySelector('.lg-mega')) return;
      // On desktop, allow hover; click toggles for keyboard / sticky open
      e.preventDefault();
      const open = item.classList.contains('is-open');
      if (isMobile()) {
        items.forEach((other) => {
          if (other !== item) {
            other.classList.remove('is-open');
            other.querySelector('.lg-nav-trigger')?.setAttribute('aria-expanded', 'false');
          }
        });
        item.classList.toggle('is-open', !open);
        trigger.setAttribute('aria-expanded', String(!open));
      } else {
        closeAllPanels();
        if (!open) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllPanels();
      closeMobile();
    }
  });

  document.addEventListener('click', (e) => {
    if (!topbar.contains(e.target) && !isMobile()) closeAllPanels();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobile();
  });
})();
