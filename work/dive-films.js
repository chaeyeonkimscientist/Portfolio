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
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
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
      beginning: clip('./Minervopolis-Spring-26-beginning.mp3', true),
      climax: clip('./Minervopolis-Spring-26-climax.mp3', true)
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

      const ordered = pitches.slice().sort(function (a, b) {
        const ac = a % 12 === 1 ? 1 : 0;
        const bc = b % 12 === 1 ? 1 : 0;
        return ac - bc;
      });
      ordered.forEach(function (p) {
        const x = pcX(p) * W;
        const y = H - 16 - ((p - minP) / (maxP - minP)) * (H - 32);
        const isCs = p % 12 === 1;
        const lone = name === 'beginning' && isCs;
        let glow = name === 'beginning' ? 0.72 : 0.5;
        if (playing) {
          if (name === 'beginning') {
            glow = lone ? 0.62 + 0.35 * (0.5 + 0.5 * Math.sin(state.t * 1.15)) : 0.8;
          } else {
            glow = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(state.t * 2.4 + p * 0.08));
          }
        } else if (lone) {
          glow = 0.42 + 0.28 * (0.5 + 0.5 * Math.sin(state.t * 0.7));
        }
        const r = name === 'climax' ? 3.1 : (lone ? 5.4 : 4.6);
        const col = isCs ? LAV : (name === 'climax' ? DATA : LAV);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + glow + ')';
        ctx.shadowColor = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (playing || lone ? 0.85 : 0.45) + ')';
        ctx.shadowBlur = playing || lone ? 16 : 6;
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
    const urls = { allison: './Flutes.mp3', brett: './Cellos-BBC.mp3' };
    const mix = document.getElementById('mix-state');
    const on = { allison: false, brett: false };
    const buffers = {};
    const sources = { allison: null, brett: null };
    const analysers = {};
    const waves = {};
    let clockStart = 0;
    let loaded = null;
    const DISSONANCE_AT = 19.0;
    const WAVE_HOP = 1 / 200;

    function peaksFromBuffer(buf) {
      const ch0 = buf.getChannelData(0);
      const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
      const hop = Math.max(1, Math.round(buf.sampleRate * WAVE_HOP));
      const n = Math.max(1, Math.ceil(ch0.length / hop));
      const mins = new Float32Array(n);
      const maxs = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = i * hop;
        const b = Math.min(ch0.length, a + hop);
        let mn = 1;
        let mx = -1;
        for (let s = a; s < b; s++) {
          let v = ch0[s];
          if (ch1) v = (v + ch1[s]) * 0.5;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        mins[i] = mn;
        maxs[i] = mx;
      }
      return { mins: mins, maxs: maxs, hop: WAVE_HOP, duration: buf.duration };
    }

    function ensureNodes() {
      const ctx = context();
      if (!ctx) return null;
      ['allison', 'brett'].forEach(function (name) {
        if (analysers[name]) return;
        const a = ctx.createAnalyser();
        a.fftSize = 2048;
        a.smoothingTimeConstant = 0.35;
        a.connect(ctx.destination);
        analysers[name] = a;
      });
      return ctx;
    }

    function loadAll() {
      if (loaded) return loaded;
      const ctx = ensureNodes();
      if (!ctx) {
        loaded = Promise.reject(new Error('no audio context'));
        return loaded;
      }
      loaded = Promise.all(Object.keys(urls).map(function (name) {
        return fetch(urls[name]).then(function (res) { return res.arrayBuffer(); }).then(function (buf) {
          return ctx.decodeAudioData(buf);
        }).then(function (decoded) {
          buffers[name] = decoded;
          waves[name] = peaksFromBuffer(decoded);
        });
      }));
      return loaded;
    }

    function offsetFor(name) {
      const ctx = audioCtx;
      const buf = buffers[name];
      if (!ctx || !buf) return 0;
      if (!on.allison && !on.brett) return 0;
      const dur = buf.duration;
      const elapsed = ctx.currentTime - clockStart;
      return ((elapsed % dur) + dur) % dur;
    }

    function stopVoice(name) {
      if (sources[name]) {
        try { sources[name].stop(); } catch (err) {}
        try { sources[name].disconnect(); } catch (err) {}
        sources[name] = null;
      }
    }

    function startVoice(name) {
      const ctx = ensureNodes();
      const buf = buffers[name];
      if (!ctx || !buf || !analysers[name]) return;
      stopVoice(name);
      const otherOn = name === 'allison' ? on.brett : on.allison;
      if (!otherOn) clockStart = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(analysers[name]);
      src.start(0, offsetFor(name));
      sources[name] = src;
    }

    function setVoice(name, want) {
      const btn = cards[name];
      if (btn) setPressed(btn, want);
      if (want) {
        on[name] = true;
        startVoice(name);
      } else {
        on[name] = false;
        stopVoice(name);
        if (!on.allison && !on.brett) clockStart = 0;
      }
    }

    function bothOn() { return on.allison && on.brett; }

    function sharedTime() {
      const ctx = audioCtx;
      if (!ctx || clockStart === 0 || (!on.allison && !on.brett)) return 0;
      const durs = [];
      if (on.allison && buffers.allison) durs.push(buffers.allison.duration);
      if (on.brett && buffers.brett) durs.push(buffers.brett.duration);
      const dur = durs.length ? Math.min.apply(null, durs) : 1;
      const elapsed = ctx.currentTime - clockStart;
      return ((elapsed % dur) + dur) % dur;
    }

    function drawRibbon(ctx, W, H, wave, tPlay, playing, amp) {
      const mid = H / 2;
      const mins = wave.mins;
      const maxs = wave.maxs;
      const n = mins.length;
      ctx.beginPath();
      if (playing) {
        const windowSec = 2.8;
        const hop = wave.hop;
        const center = tPlay / hop;
        const span = windowSec / hop;
        for (let x = 0; x < W; x++) {
          const idx = Math.round(center + (x / Math.max(W - 1, 1) - 0.5) * span);
          let mn = 0;
          let mx = 0;
          if (idx >= 0 && idx < n) {
            mn = mins[idx];
            mx = maxs[idx];
          }
          const y = mid - mx * H * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = W - 1; x >= 0; x--) {
          const idx = Math.round(center + (x / Math.max(W - 1, 1) - 0.5) * span);
          const mn = (idx >= 0 && idx < n) ? mins[idx] : 0;
          ctx.lineTo(x, mid - mn * H * amp);
        }
      } else {
        for (let x = 0; x < W; x++) {
          const i0 = Math.floor(x / W * n);
          const i1 = Math.max(i0 + 1, Math.floor((x + 1) / W * n));
          let mx = -1;
          for (let i = i0; i < i1 && i < n; i++) {
            if (maxs[i] > mx) mx = maxs[i];
          }
          const y = mid - mx * H * amp * 0.55;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = W - 1; x >= 0; x--) {
          const i0 = Math.floor(x / W * n);
          const i1 = Math.max(i0 + 1, Math.floor((x + 1) / W * n));
          let mn = 1;
          for (let i = i0; i < i1 && i < n; i++) {
            if (mins[i] < mn) mn = mins[i];
          }
          ctx.lineTo(x, mid - mn * H * amp * 0.55);
        }
      }
      ctx.closePath();
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
      const color = fast ? LAV : AMAR;
      const mid = H / 2;
      const playing = on[name];
      const wave = waves[name];
      const amp = fast ? 0.32 : 0.46;
      if (wave) {
        ctx.lineJoin = 'round';
        drawRibbon(ctx, W, H, wave, playing ? sharedTime() : 0, playing, amp);
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (playing ? 0.28 : 0.14) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (playing ? 0.95 : 0.7) + ')';
        ctx.lineWidth = fast ? 1.2 : 1.7;
        ctx.stroke();
        if (playing) {
          ctx.beginPath();
          ctx.moveTo(W / 2, 4);
          ctx.lineTo(W / 2, H - 4);
          ctx.strokeStyle = 'rgba(239,231,239,0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(W, mid);
        ctx.stroke();
      }
    }

    function frame() {
      drawCard('allison', true);
      drawCard('brett', false);
      if (mix) {
        if (bothOn()) {
          const harmony = sharedTime() < DISSONANCE_AT;
          mix.hidden = false;
          mix.textContent = harmony ? 'HARMONY' : 'DISSONANCE';
          mix.classList.toggle('is-harmony', harmony);
          mix.classList.toggle('is-dissonance', !harmony);
        } else {
          mix.hidden = true;
          mix.textContent = '';
        }
      }
      requestAnimationFrame(frame);
    }

    Object.keys(cards).forEach(function (name) {
      if (!cards[name]) return;
      cards[name].addEventListener('click', function () {
        const want = !on[name];
        context();
        loadAll().then(function () {
          setVoice(name, want);
        }).catch(function () {});
      });
    });

    root.addEventListener('pointerenter', function preload() {
      context();
      loadAll().catch(function () {});
    }, { once: true });

    frame();
    addEventListener('resize', function () {
      drawCard('allison', true);
      drawCard('brett', false);
    });
  })();

  /* ---- Morse S-T-O-P from Echolocation MIDI note on/off ---- */
  (function morse() {
    const btn = document.querySelector('#ix-morse .morse');
    if (!btn) return;
    const clusters = Array.prototype.slice.call(btn.querySelectorAll('.morse-cluster'));
    const audio = clip('./24H-Voice.mp3', true);
    const byLetter = {};
    clusters.forEach(function (c) {
      byLetter[c.getAttribute('data-letter')] = c;
    });
    /* Echolocation track (Morse.mid track 3): note on/off, shifted by the 10.0s
       session offset where that track begins (tick 9600 at 120 BPM / 480 PPQ).
       24H_Voice is a Logic bounce from that same point. */
    const notes = [
      { on: 0.85729, off: 0.95937, letter: 'S', mark: 0 },
      { on: 1.18021, off: 1.26771, letter: 'S', mark: 1 },
      { on: 1.5, off: 1.59479, letter: 'S', mark: 2 },
      { on: 1.85104, off: 2.26979, letter: 'T', mark: 0 },
      { on: 2.51354, off: 2.85417, letter: 'O', mark: 0 },
      { on: 3.17708, off: 3.55312, letter: 'O', mark: 1 },
      { on: 3.83542, off: 4.22188, letter: 'O', mark: 2 },
      { on: 4.52187, off: 4.60729, letter: 'P', mark: 0 },
      { on: 4.75, off: 5.0, letter: 'P', mark: 1 },
      { on: 5.125, off: 5.375, letter: 'P', mark: 2 },
      { on: 5.54479, off: 5.60938, letter: 'P', mark: 3 },
      { on: 9.15312, off: 9.2375, letter: 'S', mark: 0 },
      { on: 9.36771, off: 9.45208, letter: 'S', mark: 1 },
      { on: 9.60625, off: 9.68021, letter: 'S', mark: 2 },
      { on: 9.86458, off: 10.09062, letter: 'T', mark: 0 },
      { on: 10.375, off: 10.625, letter: 'O', mark: 0 },
      { on: 10.72917, off: 11.0, letter: 'O', mark: 1 },
      { on: 11.125, off: 11.36771, letter: 'O', mark: 2 },
      { on: 11.58646, off: 11.66875, letter: 'P', mark: 0 },
      { on: 11.8125, off: 12.0625, letter: 'P', mark: 1 },
      { on: 12.11979, off: 12.41667, letter: 'P', mark: 2 },
      { on: 12.57917, off: 12.64688, letter: 'P', mark: 3 },
      { on: 14.38542, off: 14.46979, letter: 'S', mark: 0 },
      { on: 14.5625, off: 14.63542, letter: 'S', mark: 1 },
      { on: 14.73542, off: 14.81667, letter: 'S', mark: 2 },
      { on: 14.9375, off: 15.24792, letter: 'T', mark: 0 },
      { on: 15.40104, off: 15.58333, letter: 'O', mark: 0 },
      { on: 15.625, off: 15.875, letter: 'O', mark: 1 },
      { on: 15.91667, off: 16.125, letter: 'O', mark: 2 },
      { on: 16.25313, off: 16.34271, letter: 'P', mark: 0 },
      { on: 16.4375, off: 16.625, letter: 'P', mark: 1 },
      { on: 16.6875, off: 16.86771, letter: 'P', mark: 2 },
      { on: 16.98854, off: 17.0625, letter: 'P', mark: 3 },
      { on: 18.44063, off: 18.51146, letter: 'S', mark: 0 },
      { on: 18.575, off: 18.63437, letter: 'S', mark: 1 },
      { on: 18.67708, off: 18.74583, letter: 'S', mark: 2 },
      { on: 18.875, off: 19.04583, letter: 'T', mark: 0 },
      { on: 19.20833, off: 19.30729, letter: 'O', mark: 0 },
      { on: 19.41042, off: 19.52812, letter: 'O', mark: 1 },
      { on: 19.63229, off: 19.75937, letter: 'O', mark: 2 },
      { on: 19.875, off: 19.93646, letter: 'P', mark: 0 },
      { on: 20.03125, off: 20.16667, letter: 'P', mark: 1 },
      { on: 20.20104, off: 20.35417, letter: 'P', mark: 2 },
      { on: 20.41667, off: 20.46354, letter: 'P', mark: 3 }
    ];
    let playing = false;

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
      if (!notes.length) return;
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (t < n.on || t >= n.off) continue;
        const cluster = byLetter[n.letter];
        if (!cluster) continue;
        cluster.classList.add('is-lit');
        const ms = marks(cluster);
        if (ms[n.mark]) ms[n.mark].classList.add('is-on');
      }
    }

    function loop() {
      if (playing) paint(audio.currentTime || 0);
      requestAnimationFrame(loop);
    }

    function setPlay(want) {
      playing = want;
      setPressed(btn, want);
      if (want) {
        tap(audio);
        const play = audio.play();
        if (play && play.catch) play.catch(function () {});
      } else {
        audio.pause();
        audio.currentTime = 0;
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

    requestAnimationFrame(loop);
  })();
})();
