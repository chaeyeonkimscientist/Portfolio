(function () {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const rail = hud.querySelector('.hud-rail');
  const fill = hud.querySelector('.hud-fill');
  const dot = hud.querySelector('.hud-dot');
  const nav = hud.querySelector('.hud-nav');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  const headings = Array.prototype.slice.call(
    document.querySelectorAll('main h2[id]')
  );
  const items = headings.map(function (h) {
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.getAttribute('data-nav') || h.textContent.trim();
    nav.appendChild(a);
    return { el: h, link: a };
  });

  const icons = {
    music: document.querySelector('.mode-icon[data-icon="music"]'),
    cog: document.querySelector('.mode-icon[data-icon="cog"]'),
    data: document.querySelector('.mode-icon[data-icon="data"]')
  };
  const iconSections = Array.prototype.slice.call(
    document.querySelectorAll('[data-icons]')
  );

  function maxScroll() {
    return Math.max(document.documentElement.scrollHeight - innerHeight, 1);
  }

  function headingY(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function layoutNav() {
    const docH = Math.max(document.documentElement.scrollHeight, 1);
    items.forEach(function (item) {
      const p = Math.min(Math.max(headingY(item.el) / docH, 0), 1);
      item.link.style.top = (p * 100).toFixed(3) + '%';
    });
  }

  function currentHeading() {
    const probe = innerHeight * 0.28;
    let current = items[0];
    items.forEach(function (item) {
      if (item.el.getBoundingClientRect().top <= probe) current = item;
    });
    return current;
  }

  function updateIcons() {
    const probe = innerHeight * 0.3;
    let keys = [];
    iconSections.forEach(function (sec) {
      const r = sec.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        keys = (sec.getAttribute('data-icons') || '').split(/\s+/).filter(Boolean);
      }
    });
    Object.keys(icons).forEach(function (k) {
      if (icons[k]) icons[k].classList.toggle('is-lit', keys.indexOf(k) !== -1);
    });
  }

  function paint() {
    const p = Math.min(Math.max(scrollY / maxScroll(), 0), 1);
    const pct = (p * 100).toFixed(3) + '%';
    fill.style.height = pct;
    dot.style.top = pct;

    const cur = currentHeading();
    items.forEach(function (item) {
      item.link.classList.toggle('is-current', item === cur);
    });
    updateIcons();
    paintScenario();
  }

  let ticking = false;
  function requestPaint() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      paint();
    });
  }

  function setOpen(on) {
    hud.classList.toggle('is-open', on);
    rail.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  rail.addEventListener('mouseenter', function () {
    if (hoverQuery.matches) setOpen(true);
  });
  rail.addEventListener('mouseleave', function () {
    if (hoverQuery.matches && document.activeElement && !rail.contains(document.activeElement)) {
      setOpen(false);
    } else if (hoverQuery.matches) {
      setOpen(false);
    }
  });
  rail.addEventListener('click', function (e) {
    if (hoverQuery.matches) return;
    if (e.target.closest('a')) return;
    setOpen(!hud.classList.contains('is-open'));
  });
  document.addEventListener('click', function (e) {
    if (!hoverQuery.matches && !hud.contains(e.target)) setOpen(false);
  });
  hud.addEventListener('focusin', function () { setOpen(true); });
  hud.addEventListener('focusout', function (e) {
    if (!hud.contains(e.relatedTarget)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  addEventListener('scroll', requestPaint, { passive: true });
  addEventListener('resize', function () {
    layoutNav();
    requestPaint();
  });
  addEventListener('load', function () {
    layoutNav();
    requestPaint();
  });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(function () { layoutNav(); });
    ro.observe(document.documentElement);
  }

  const pin = document.querySelector('.scenario-pin');
  const steps = pin ? Array.prototype.slice.call(pin.querySelectorAll('[data-reveal]')) : [];

  function paintScenario() {
    if (!steps.length) return;
    if (reduced) {
      steps.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    const rect = pin.getBoundingClientRect();
    const range = Math.max(pin.offsetHeight - innerHeight, 1);
    const started = rect.top <= innerHeight * 0.52;
    const p = Math.min(Math.max(-rect.top / range, 0), 1);
    steps.forEach(function (el, i) {
      const enter = i / steps.length;
      el.classList.toggle('is-in', started && p >= enter);
    });
  }

  layoutNav();
  paint();

  const toggle = document.querySelector('[data-track-toggle]');
  if (toggle) {
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      if (panel) {
        panel.hidden = open;
        if (!open && !reduced) layoutNav();
        requestPaint();
      }
    });
  }
})();
