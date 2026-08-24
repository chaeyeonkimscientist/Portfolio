(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const LAV = [183, 167, 216];
  const AMAR = [201, 67, 106];
  const DATA = [159, 224, 216];

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

  let audioCtx = null;
  const taps = new WeakMap();

  function context() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tap(el) {
    if (taps.has(el)) return taps.get(el);
    const ctx = context();
    if (!ctx) return null;
    const src = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    const node = { analyser: analyser, time: new Uint8Array(analyser.fftSize) };
    taps.set(el, node);
    return node;
  }

  function clip(src, loop) {
    const el = new Audio(src);
    el.preload = 'auto';
    el.loop = !!loop;
    el.crossOrigin = 'anonymous';
    return el;
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-hot', on);
  }

  /* ---- Beginning / Climax voicings ---- */
  (function voicing() {
    const row = document.querySelector('#ix-voicing .voicing-row');
    if (!row) return;

    const clips = {
      beginning: clip('./Caug_beginning.mp3', true),
      climax: clip('./Caug_climax.mp3', true)
    };

    /* Climax MIDI unique pitches; Beginning is the exposed C♯–F♯–A voicing. */
    const climaxPitches = [35, 36, 38, 40, 42, 43, 44, 50, 54, 55, 57, 60, 61, 62, 66, 67, 69, 71, 72, 73, 74, 75, 76, 78, 79, 81, 83, 84, 85, 86, 87, 88, 90, 91, 93, 95];
    const beginPitches = [73, 78, 81]; /* C♯5 F♯5 A5 */
    const pcX = function (midi) { return ((midi % 12) + 0.5) / 12; };
    const minP = 35;
    const maxP = 95;

    const players = Array.prototype.slice.call(row.querySelectorAll('.voicing-player'));
    const state = { hovering: null, pinned: null, raf: 0, t: 0 };

    function activeName() {
      return state.hovering || state.pinned;
    }

    function stopAll() {
      Object.keys(clips).forEach(function (k) {
        clips[k].pause();
      });
    }

    function syncAudio() {
      const on = activeName();
      Object.keys(clips).forEach(function (k) {
        const el = clips[k];
        if (k === on) {
          tap(el);
          if (el.paused) {
            const play = el.play();
            if (play && play.catch) play.catch(function () {});
          }
        } else if (!el.paused) {
          el.pause();
        }
      });
      players.forEach(function (btn) {
        const name = btn.getAttribute('data-clip');
        setPressed(btn, name === on);
      });
    }

    function draw(btn) {
      const canvas = btn.querySelector('canvas');
      if (!canvas) return;
      const sized = fit(canvas);
      const ctx = sized.ctx;
      const W = sized.W;
      const H = sized.H;
      ctx.clearRect(0, 0, W, H);

      const name = btn.getAttribute('data-clip');
      const pitches = name === 'climax' ? climaxPitches : beginPitches;
      const playing = activeName() === name;
      const csX = pcX(73) * W;

      ctx.strokeStyle = 'rgba(239,231,239,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(csX, 10);
      ctx.lineTo(csX, H - 10);
      ctx.stroke();

      pitches.forEach(function (p) {
        const x = pcX(p) * W;
        const y = H - 16 - ((p - minP) / (maxP - minP)) * (H - 32);
        const isCs = p % 12 === 1;
        const lone = name === 'beginning' && isCs;
        let glow = 0.45;
        if (playing) {
          if (name === 'beginning') {
            glow = lone ? 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(state.t * 1.15)) : 0.55;
          } else {
            glow = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(state.t * 2.4 + p * 0.08));
          }
        } else if (lone) {
          glow = 0.28 + 0.18 * (0.5 + 0.5 * Math.sin(state.t * 0.7));
        }
        const r = name === 'climax' ? 3.1 : (lone ? 5.2 : 4.2);
        const col = isCs ? LAV : (name === 'climax' ? DATA : LAV);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + glow + ')';
        ctx.shadowColor = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (playing ? 0.85 : 0.35) + ')';
        ctx.shadowBlur = playing || lone ? 14 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    function frame() {
      state.t += reduced ? 0 : 0.032;
      players.forEach(draw);
      state.raf = requestAnimationFrame(frame);
    }

    players.forEach(function (btn) {
      const name = btn.getAttribute('data-clip');
      btn.addEventListener('pointerenter', function () {
        if (!finePointer.matches) return;
        state.hovering = name;
        context();
        syncAudio();
      });
      btn.addEventListener('pointerleave', function () {
        if (state.hovering === name) state.hovering = null;
        syncAudio();
      });
      btn.addEventListener('click', function () {
        state.pinned = state.pinned === name ? null : name;
        context();
        syncAudio();
      });
      btn.addEventListener('blur', function () {
        if (!btn.matches(':hover') && state.hovering === name) {
          state.hovering = null;
          syncAudio();
        }
      });
    });

    addEventListener('pagehide', stopAll);
    frame();
    addEventListener('resize', function () { players.forEach(draw); });
  })();

  /* ---- instrument-as-identity cards ---- */
  (function identity() {
    const root = document.getElementById('ix-identity');
    if (!root) return;
    const cards = {
      allison: root.querySelector('[data-char="allison"]'),
      brett: root.querySelector('[data-char="brett"]')
    };
    const audio = {
      allison: clip('./Flutes.mp3', true),
      brett: clip('./Cellos-BBC.mp3', true)
    };
    const mix = document.getElementById('mix-state');
    const on = { allison: false, brett: false };
    let corrSmooth = 0;

    function setVoice(name, want) {
      const el = audio[name];
      const btn = cards[name];
      on[name] = want;
      if (btn) setPressed(btn, want);
      if (want) {
        tap(el);
        const other = name === 'allison' ? audio.brett : audio.allison;
        const otherOn = name === 'allison' ? on.brett : on.allison;
        if (otherOn && !other.paused) {
          el.currentTime = other.currentTime;
        } else if (!otherOn) {
          el.currentTime = 0;
        }
        const play = el.play();
        if (play && play.catch) play.catch(function () {});
      } else {
        el.pause();
      }
    }

    function bothOn() { return on.allison && on.brett; }

    function corr() {
      const a = taps.get(audio.allison);
      const b = taps.get(audio.brett);
      if (!a || !b) return 0;
      a.analyser.getByteTimeDomainData(a.time);
      b.analyser.getByteTimeDomainData(b.time);
      const n = Math.min(a.time.length, b.time.length);
      let sa = 0, sb = 0, sap = 0, sbp = 0, sab = 0;
      for (let i = 0; i < n; i++) {
        const va = (a.time[i] - 128) / 128;
        const vb = (b.time[i] - 128) / 128;
        sa += va; sb += vb; sap += va * va; sbp += vb * vb; sab += va * vb;
      }
      const ma = sa / n, mb = sb / n;
      const den = Math.sqrt((sap / n - ma * ma) * (sbp / n - mb * mb));
      if (den < 1e-6) return 0;
      return (sab / n - ma * mb) / den;
    }

    function drawCard(name, fast) {
      const btn = cards[name];
      if (!btn) return;
      const canvas = btn.querySelector('canvas');
      if (!canvas) return;
      const sized = fit(canvas);
      const ctx = sized.ctx;
      const W = sized.W;
      const H = sized.H;
      ctx.clearRect(0, 0, W, H);
      const node = taps.get(audio[name]);
      const color = fast ? LAV : AMAR;
      ctx.beginPath();
      const mid = H / 2;
      if (on[name] && node) {
        node.analyser.getByteTimeDomainData(node.time);
        const step = Math.max(1, Math.floor(node.time.length / W));
        for (let x = 0; x < W; x++) {
          const v = (node.time[Math.min(node.time.length - 1, x * step)] - 128) / 128;
          const y = mid + v * H * (fast ? 0.28 : 0.42);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        const fq = fast ? 0.22 : 0.07;
        const amp = fast ? H * 0.14 : H * 0.28;
        for (let x = 0; x <= W; x += 2) {
          const y = mid + Math.sin(x * fq) * amp * 0.18;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.9)';
      ctx.lineWidth = fast ? 1.35 : 2.15;
      ctx.stroke();
    }

    function frame() {
      drawCard('allison', true);
      drawCard('brett', false);
      if (mix) {
        if (bothOn()) {
          const c = corr();
          corrSmooth = corrSmooth * 0.82 + c * 0.18;
          const harmony = corrSmooth > 0.12;
          mix.hidden = false;
          mix.textContent = harmony ? 'HARMONY' : 'DISSONANCE';
          mix.classList.toggle('is-harmony', harmony);
          mix.classList.toggle('is-dissonance', !harmony);
        } else {
          mix.hidden = true;
          mix.textContent = '';
          corrSmooth = 0;
        }
      }
      if (on.allison && on.brett && !audio.allison.paused && !audio.brett.paused) {
        if (Math.abs(audio.allison.currentTime - audio.brett.currentTime) > 0.08) {
          audio.brett.currentTime = audio.allison.currentTime;
        }
      }
      requestAnimationFrame(frame);
    }

    Object.keys(cards).forEach(function (name) {
      if (!cards[name]) return;
      cards[name].addEventListener('click', function () {
        context();
        setVoice(name, !on[name]);
      });
    });

    frame();
    addEventListener('resize', function () {
      drawCard('allison', true);
      drawCard('brett', false);
    });
  })();

  /* ---- Morse S-T-O-P ---- */
  (function morse() {
    const btn = document.querySelector('#ix-morse .morse');
    if (!btn) return;
    const clusters = Array.prototype.slice.call(btn.querySelectorAll('.morse-cluster'));
    const audio = clip('./Morse.mp3', true);
    /* Echolocation-track letter windows, seconds from first sounding note. */
    const windows = [
      { letter: 'S', start: 0.30, end: 5.20 },
      { letter: 'T', start: 8.50, end: 12.30 },
      { letter: 'O', start: 13.70, end: 16.70 },
      { letter: 'P', start: 17.80, end: 20.19 }
    ];
    let playing = false;
    let raf = 0;

    function marks(cluster) {
      return Array.prototype.slice.call(cluster.querySelectorAll('i'));
    }

    function clear() {
      clusters.forEach(function (c) {
        c.classList.remove('is-lit');
        marks(c).forEach(function (m) { m.classList.remove('is-on'); });
      });
    }

    function paint(t) {
      clear();
      let win = null;
      for (let i = 0; i < windows.length; i++) {
        if (t >= windows[i].start && t < windows[i].end) { win = windows[i]; break; }
      }
      if (!win) return;
      const cluster = clusters.filter(function (c) {
        return c.getAttribute('data-letter') === win.letter;
      })[0];
      if (!cluster) return;
      cluster.classList.add('is-lit');
      const ms = marks(cluster);
      if (!ms.length) return;
      const local = (t - win.start) / Math.max(win.end - win.start, 0.001);
      const idx = Math.min(ms.length - 1, Math.floor(local * ms.length));
      ms[idx].classList.add('is-on');
    }

    function loop() {
      if (playing) paint(audio.currentTime || 0);
      raf = requestAnimationFrame(loop);
    }

    function setPlay(on) {
      playing = on;
      setPressed(btn, on);
      if (on) {
        tap(audio);
        const play = audio.play();
        if (play && play.catch) play.catch(function () {});
      } else {
        audio.pause();
        clear();
      }
    }

    btn.addEventListener('click', function () {
      context();
      setPlay(!playing);
    });

    if (reduced) {
      clusters.forEach(function (c) { c.classList.add('is-show'); });
    }

    raf = requestAnimationFrame(loop);
  })();
})();
