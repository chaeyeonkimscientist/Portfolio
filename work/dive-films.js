(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAV = [183, 167, 216];
  const AMAR = [201, 67, 106];

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width));
    const H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }

  /* ---- tonic that never resolves ---- */
  (function tonic() {
    const stage = document.querySelector('#ix-tonic .chord-stage');
    if (!stage) return;
    let t = 0;
    let paused = false;
    let raf = 0;

    function paint() {
      stage.classList.toggle('is-paused', paused);
      if (paused) {
        stage.classList.add('is-pull');
        stage.classList.remove('is-almost');
        return;
      }
      const cycle = (t % 1);
      stage.classList.toggle('is-pull', cycle < 0.78);
      stage.classList.toggle('is-almost', cycle >= 0.62 && cycle < 0.9);
    }

    function tick() {
      if (!paused) t = (t + 0.0048) % 1;
      paint();
      raf = requestAnimationFrame(tick);
    }

    function hold(on) {
      paused = on;
      paint();
    }

    stage.addEventListener('pointerenter', function () { hold(true); });
    stage.addEventListener('pointerleave', function () { hold(false); });
    stage.addEventListener('focus', function () { hold(true); });
    stage.addEventListener('blur', function () { hold(false); });

    if (reduced) {
      stage.classList.add('is-pull');
      return;
    }
    raf = requestAnimationFrame(tick);
  })();

  /* ---- flute vs oboe ribbons ---- */
  (function ribbons() {
    const row = document.querySelector('#ix-ribbons .ribbon-row');
    if (!row) return;
    const figures = Array.prototype.slice.call(row.querySelectorAll('.ribbon'));
    let ph = 0;
    let raf = 0;

    function draw(fig, voice) {
      const canvas = fig.querySelector('canvas');
      if (!canvas) return;
      const sized = fit(canvas);
      const ctx = sized.ctx;
      const W = sized.W;
      const H = sized.H;
      ctx.clearRect(0, 0, W, H);
      const mid = H / 2;
      const fast = voice === 'flute';
      const amp = fast ? H * 0.16 : H * 0.32;
      const fq = fast ? 0.085 : 0.028;
      const color = fast ? LAV : AMAR;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const n1 = Math.sin(x * fq + ph * (fast ? 1.8 : 0.7));
        const n2 = Math.sin(x * fq * (fast ? 2.4 : 0.55) + ph * (fast ? 2.6 : 0.9));
        const leap = fast ? 0 : Math.sin(x * 0.012 + ph * 0.35) * 0.55;
        const y = mid + (n1 * 0.7 + n2 * 0.3 + leap) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.9)';
      ctx.lineWidth = fast ? 1.4 : 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    function frame() {
      ph += 0.045;
      figures.forEach(function (fig) {
        draw(fig, fig.getAttribute('data-voice'));
      });
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function setHot(target) {
      const on = !!target;
      row.classList.toggle('is-solo', on);
      figures.forEach(function (fig) {
        fig.classList.toggle('is-hot', fig === target);
      });
    }

    figures.forEach(function (fig) {
      fig.addEventListener('pointerenter', function () { setHot(fig); });
      fig.addEventListener('pointerleave', function () { setHot(null); });
      fig.addEventListener('focus', function () { setHot(fig); });
      fig.addEventListener('blur', function () { setHot(null); });
    });

    frame();
    addEventListener('resize', function () {
      figures.forEach(function (fig) {
        draw(fig, fig.getAttribute('data-voice'));
      });
    });
  })();

  /* ---- instrument-as-identity cards ---- */
  (function identity() {
    const cards = Array.prototype.slice.call(document.querySelectorAll('#ix-identity .id-card'));
    if (!cards.length) return;
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        const on = card.getAttribute('aria-pressed') === 'true';
        card.setAttribute('aria-pressed', on ? 'false' : 'true');
      });
    });
  })();

  /* ---- Morse S-T-O-P ---- */
  (function morse() {
    const root = document.querySelector('#ix-morse .morse');
    if (!root) return;
    const clusters = Array.prototype.slice.call(root.querySelectorAll('.morse-cluster'));
    const reducedMotion = reduced;
    let i = 0;
    let timer = 0;

    function clear() {
      clusters.forEach(function (c) { c.classList.remove('is-lit'); });
    }

    function beat() {
      clear();
      const c = clusters[i];
      if (c) c.classList.add('is-lit');
      i = (i + 1) % clusters.length;
      const hold = c && (c.getAttribute('data-code') || '').indexOf('-') !== -1 ? 720 : 420;
      timer = setTimeout(beat, hold + 280);
    }

    clusters.forEach(function (c) {
      c.addEventListener('pointerenter', function () { c.classList.add('is-show'); });
      c.addEventListener('pointerleave', function () { c.classList.remove('is-show'); });
    });

    if (reducedMotion) {
      clusters.forEach(function (c) { c.classList.add('is-show'); });
      return;
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) {
            beat();
            io.disconnect();
          }
        });
      }, { threshold: 0.2 });
      io.observe(root);
    } else {
      beat();
    }
  })();

  /* ---- triptych: one foreground at a time ---- */
  (function triptych() {
    const panels = Array.prototype.slice.call(document.querySelectorAll('#ix-triptych .tri-panel'));
    if (!panels.length) return;

    function select(target) {
      panels.forEach(function (p) {
        const on = p === target;
        p.classList.toggle('is-fore', on);
        p.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    panels.forEach(function (p) {
      p.addEventListener('click', function () { select(p); });
    });
  })();

  /* ---- wings: tap support on coarse pointers ---- */
  (function wings() {
    const fig = document.getElementById('ix-wings');
    if (!fig) return;
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    fig.addEventListener('click', function () {
      if (hover.matches) return;
      fig.classList.toggle('is-open');
    });
  })();
})();
