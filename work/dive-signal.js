(function () {
  const SERIES = [
    { key: 'baseline', label: 'baseline', color: '#B7A7D8' },
    { key: 'nback', label: 'n-back', color: '#9fe0d8' },
    { key: 'linkedin', label: 'social-eval', color: '#c9436a' }
  ];
  const IRIS = '#101719';
  const HAIR = 'rgba(183,167,216,0.16)';
  const DIM = '#9a92a0';
  const ALPHA = '#B7A7D8';
  const BETA = '#9fe0d8';

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

  function setFont(ctx, size) {
    ctx.font = size + 'px "DM Mono", ui-monospace, monospace';
  }

  function hexAlpha(hex, a) {
    const n = hex.replace('#', '');
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function drawStress(canvas, data) {
    const sized = fit(canvas);
    const ctx = sized.ctx;
    const W = sized.W;
    const H = sized.H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = IRIS;
    ctx.fillRect(0, 0, W, H);

    const pad = { l: 44, r: 14, t: 30, b: 30 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    let tMax = 1;
    SERIES.forEach(function (s) {
      const t = data.curves[s.key].t;
      tMax = Math.max(tMax, t[t.length - 1]);
    });

    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    setFont(ctx, 10);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + plotH * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillText((i / 4).toFixed(1), pad.l - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = [0, 30, 60, 90];
    xTicks.forEach(function (sec) {
      if (sec > tMax + 0.01) return;
      const x = pad.l + (sec / tMax) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + plotH);
      ctx.stroke();
      ctx.fillText(String(sec) + 's', x, pad.t + plotH + 8);
    });

    ctx.save();
    ctx.translate(13, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('stress index', 0, 0);
    ctx.restore();

    SERIES.forEach(function (s) {
      const curve = data.curves[s.key];
      ctx.beginPath();
      curve.t.forEach(function (t, i) {
        const x = pad.l + (t / tMax) * plotW;
        const y = pad.t + (1 - curve.stress[i]) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.55;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    let lx = pad.l;
    const ly = 14;
    SERIES.forEach(function (s) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, ly - 6, 9, 9);
      ctx.fillStyle = DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      setFont(ctx, 10);
      ctx.fillText(s.label, lx + 13, ly);
      lx += ctx.measureText(s.label).width + 28;
    });
  }

  function drawBands(canvas, data) {
    const sized = fit(canvas);
    const ctx = sized.ctx;
    const W = sized.W;
    const H = sized.H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = IRIS;
    ctx.fillRect(0, 0, W, H);

    const pad = { l: 44, r: 12, t: 30, b: 36 };
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    let yMax = 0.6;
    SERIES.forEach(function (s) {
      const band = data.bands[s.key];
      yMax = Math.max(yMax, band.alpha, band.beta);
    });
    yMax = Math.ceil(yMax * 10) / 10;
    const n = SERIES.length;
    const groupW = plotW / n;
    const barW = Math.min(28, groupW * 0.28);
    const pairGap = 6;

    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    setFont(ctx, 10);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const v = (yMax * i) / 3;
      const y = pad.t + plotH * (1 - v / yMax);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(1), pad.l - 8, y);
    }

    ctx.save();
    ctx.translate(13, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('rel. power', 0, 0);
    ctx.restore();

    SERIES.forEach(function (s, i) {
      const band = data.bands[s.key];
      const cx = pad.l + (i + 0.5) * groupW;
      const alphaX = cx - pairGap / 2 - barW;
      const betaX = cx + pairGap / 2;
      const bars = [
        { x: alphaX, v: band.alpha, color: ALPHA },
        { x: betaX, v: band.beta, color: BETA }
      ];
      bars.forEach(function (bar) {
        const h = (bar.v / yMax) * plotH;
        const y = pad.t + plotH - h;
        ctx.fillStyle = hexAlpha(bar.color, 0.85);
        ctx.fillRect(bar.x, y, barW, h);
        ctx.fillStyle = bar.color;
        ctx.fillRect(bar.x, y, 2, h);
        ctx.fillStyle = DIM;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        setFont(ctx, 9);
        ctx.fillText(bar.v.toFixed(2), bar.x + barW / 2, y - 3);
      });
      ctx.fillStyle = DIM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      setFont(ctx, 10);
      ctx.fillText(s.label, cx, pad.t + plotH + 10);
    });

    const legend = [
      { color: ALPHA, label: 'alpha 8–12 Hz' },
      { color: BETA, label: 'beta 12–30 Hz' }
    ];
    let lx = pad.l;
    legend.forEach(function (item) {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, 8, 9, 9);
      ctx.fillStyle = DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      setFont(ctx, 10);
      ctx.fillText(item.label, lx + 13, 13);
      lx += ctx.measureText(item.label).width + 28;
    });
  }

  function paintBlank(canvas, msg) {
    const sized = fit(canvas);
    const ctx = sized.ctx;
    ctx.fillStyle = IRIS;
    ctx.fillRect(0, 0, sized.W, sized.H);
    setFont(ctx, 11);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, sized.W / 2, sized.H / 2);
  }

  const stressEl = document.getElementById('viz-stress');
  const bandsEl = document.getElementById('viz-bands');
  if (!stressEl && !bandsEl) return;

  fetch('./signal-data.json')
    .then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then(function (data) {
      function paint() {
        if (stressEl) drawStress(stressEl, data);
        if (bandsEl) drawBands(bandsEl, data);
      }
      paint();
      let timer = 0;
      function onResize() {
        clearTimeout(timer);
        timer = setTimeout(paint, 80);
      }
      window.addEventListener('resize', onResize);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(onResize);
        if (stressEl) ro.observe(stressEl);
        if (bandsEl) ro.observe(bandsEl);
      }
    })
    .catch(function () {
      if (stressEl) paintBlank(stressEl, 'signal data unavailable');
      if (bandsEl) paintBlank(bandsEl, 'signal data unavailable');
    });
})();
