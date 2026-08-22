(function () {
  const mount = document.getElementById('bio-graph');
  if (!mount) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NODES = [
    { id: 'stress',   label: ['Stress'] },
    { id: 'alarm',    label: ['Neurological', 'Alarm'] },
    { id: 'inflam',   label: ['Immune', 'Inflammation'] },
    { id: 'miscoord', label: ['Body', 'Miscoordination'] }
  ];

  const NS = 'http://www.w3.org/2000/svg';
  const LAV = '#B7A7D8';
  const DATA = '#9fe0d8';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'bio-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    'Feedback cycle: Stress leads to Neurological Alarm, then Immune Inflammation, then Body Miscoordination, which feeds back to Stress.');

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<marker id="bio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
      '<path d="M0,1.2 L9,5 L0,8.8 z" fill="' + LAV + '"></path></marker>' +
    '<marker id="bio-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
      '<path d="M0,1.2 L9,5 L0,8.8 z" fill="' + DATA + '"></path></marker>';
  svg.appendChild(defs);

  const edgeLayer = document.createElementNS(NS, 'g');
  const nodeLayer = document.createElementNS(NS, 'g');
  const pulseLayer = document.createElementNS(NS, 'g');
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
  svg.appendChild(pulseLayer);
  mount.appendChild(svg);

  let nodeEls = [];
  let edges = [];
  let orbit = [];
  let pulse = null;
  let raf = 0;
  let layoutMode = '';

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function clearLayer(layer) {
    while (layer.firstChild) layer.removeChild(layer.firstChild);
  }

  function draw() {
    const narrow = mount.clientWidth < 640;
    const mode = narrow ? 'vert' : 'horiz';
    if (mode === layoutMode && nodeEls.length) return;
    layoutMode = mode;

    clearLayer(edgeLayer);
    clearLayer(nodeLayer);
    clearLayer(pulseLayer);
    nodeEls = [];
    edges = [];
    orbit = [];
    pulse = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }

    const pts = [];
    let VB_W, VB_H, nodeW, nodeH;

    if (!narrow) {
      VB_W = 980; VB_H = 360; nodeW = 176; nodeH = 78;
      const y = 48;
      const gap = (VB_W - NODES.length * nodeW) / (NODES.length + 1);
      NODES.forEach(function (_, i) {
        const x = gap + i * (nodeW + gap);
        pts.push({ x: x, y: y, cx: x + nodeW / 2, cy: y + nodeH / 2, w: nodeW, h: nodeH });
      });

      const PAD = 12;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const x1 = a.x + a.w + PAD, y1 = a.cy, x2 = b.x - PAD, y2 = b.cy;
        const path = el('path', {
          d: 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2,
          class: 'bio-edge',
          'marker-end': 'url(#bio-arrow)'
        });
        edgeLayer.appendChild(path);
        edges.push({ el: path, from: i, to: i + 1 });
        appendLine(orbit, x1, y1, x2, y2);
      }

      const first = pts[0], last = pts[pts.length - 1];
      const fbY = y + nodeH + 96;
      const fbStart = { x: last.cx, y: last.y + last.h + PAD };
      const fbC1 = { x: last.cx, y: fbY };
      const fbC2 = { x: first.cx, y: fbY };
      const fbEnd = { x: first.cx, y: first.y + first.h + PAD };
      const fb = el('path', {
        d: 'M' + fbStart.x + ',' + fbStart.y +
           ' C' + fbC1.x + ',' + fbC1.y + ' ' + fbC2.x + ',' + fbC2.y + ' ' + fbEnd.x + ',' + fbEnd.y,
        class: 'bio-edge bio-edge-feedback',
        'marker-end': 'url(#bio-arrow)'
      });
      edgeLayer.appendChild(fb);
      edges.push({ el: fb, from: pts.length - 1, to: 0, feedback: true });
      appendCubic(orbit, fbStart, fbC1, fbC2, fbEnd);

      const fbLabel = el('text', {
        x: String(VB_W / 2), y: String(fbY + 22),
        class: 'bio-fb-label', 'text-anchor': 'middle'
      });
      fbLabel.textContent = 'feeds back';
      edgeLayer.appendChild(fbLabel);
    } else {
      VB_W = 360; VB_H = 620; nodeW = 220; nodeH = 72;
      const x = (VB_W - nodeW) / 2;
      const startY = 18;
      const stride = 118;
      NODES.forEach(function (_, i) {
        const y = startY + i * stride;
        pts.push({ x: x, y: y, cx: x + nodeW / 2, cy: y + nodeH / 2, w: nodeW, h: nodeH });
      });

      const PAD = 12;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const x1 = a.cx, y1 = a.y + a.h + PAD, x2 = b.cx, y2 = b.y - PAD;
        const path = el('path', {
          d: 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2,
          class: 'bio-edge',
          'marker-end': 'url(#bio-arrow)'
        });
        edgeLayer.appendChild(path);
        edges.push({ el: path, from: i, to: i + 1 });
        appendLine(orbit, x1, y1, x2, y2);
      }

      const first = pts[0], last = pts[pts.length - 1];
      const leftX = 24;
      const fbStart = { x: last.x - PAD, y: last.cy };
      const fbC1 = { x: leftX, y: last.cy };
      const fbC2 = { x: leftX, y: first.cy };
      const fbEnd = { x: first.x - PAD, y: first.cy };
      const fb = el('path', {
        d: 'M' + fbStart.x + ',' + fbStart.y +
           ' C' + fbC1.x + ',' + fbC1.y + ' ' + fbC2.x + ',' + fbC2.y + ' ' + fbEnd.x + ',' + fbEnd.y,
        class: 'bio-edge bio-edge-feedback',
        'marker-end': 'url(#bio-arrow)'
      });
      edgeLayer.appendChild(fb);
      edges.push({ el: fb, from: pts.length - 1, to: 0, feedback: true });
      appendCubic(orbit, fbStart, fbC1, fbC2, fbEnd);

      const fbLabel = el('text', {
        x: '22', y: String((first.cy + last.cy) / 2),
        class: 'bio-fb-label', 'text-anchor': 'middle',
        transform: 'rotate(-90 22 ' + ((first.cy + last.cy) / 2) + ')'
      });
      fbLabel.textContent = 'feeds back';
      edgeLayer.appendChild(fbLabel);
    }

    svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H);

    pts.forEach(function (p, i) {
      const g = el('g', { class: 'bio-node', tabindex: '0', 'data-i': String(i), role: 'listitem' });
      g.appendChild(el('rect', {
        x: p.x, y: p.y, width: p.w, height: p.h, rx: '8', class: 'bio-node-box'
      }));
      const lines = NODES[i].label;
      const text = el('text', {
        x: p.cx,
        y: p.cy - (lines.length - 1) * 9 + 5,
        'text-anchor': 'middle',
        class: 'bio-node-label'
      });
      lines.forEach(function (ln, li) {
        const ts = el('tspan', { x: p.cx });
        if (li > 0) ts.setAttribute('dy', '18');
        ts.textContent = ln;
        text.appendChild(ts);
      });
      g.appendChild(text);
      nodeLayer.appendChild(g);
      nodeEls.push(g);
    });

    function setActive(i, on) {
      nodeEls.forEach(function (n, j) {
        n.classList.toggle('is-active', on && j === i);
      });
      edges.forEach(function (e) {
        const lit = on && (e.from === i || e.to === i);
        e.el.classList.toggle('is-lit', lit);
        e.el.setAttribute('marker-end', lit ? 'url(#bio-arrow-lit)' : 'url(#bio-arrow)');
      });
    }
    nodeEls.forEach(function (n, i) {
      n.addEventListener('mouseenter', function () { setActive(i, true); });
      n.addEventListener('mouseleave', function () { setActive(i, false); });
      n.addEventListener('focus', function () { setActive(i, true); });
      n.addEventListener('blur', function () { setActive(i, false); });
    });

    if (!reduced) startPulse();
  }

  function appendLine(arr, x1, y1, x2, y2) {
    const n = Math.max(8, Math.round(Math.hypot(x2 - x1, y2 - y1) / 3));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      arr.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
    }
  }

  function appendCubic(arr, p0, p1, p2, p3) {
    const n = 48;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const u = 1 - t;
      arr.push({
        x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
        y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
      });
    }
  }

  function startPulse() {
    if (!orbit.length) return;
    pulse = el('circle', { r: '4.5', class: 'bio-pulse' });
    pulseLayer.appendChild(pulse);
    let i = 0;
    function step() {
      const pt = orbit[i];
      pulse.setAttribute('cx', pt.x.toFixed(2));
      pulse.setAttribute('cy', pt.y.toFixed(2));
      i = (i + 1) % orbit.length;
      raf = requestAnimationFrame(step);
    }
    function kick() {
      if (raf) return;
      raf = requestAnimationFrame(step);
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { kick(); io.disconnect(); }
        });
      }, { threshold: 0.15 });
      io.observe(mount);
    } else {
      kick();
    }
  }

  draw();
  let resizeTimer = 0;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layoutMode = '';
      draw();
    }, 120);
  });
})();
