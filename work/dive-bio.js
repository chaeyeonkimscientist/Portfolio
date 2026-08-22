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
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
  mount.appendChild(svg);

  let nodeEls = [];
  let edges = [];
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
    nodeEls = [];
    edges = [];
    pulse = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }

    const pts = [];
    let VB_W, VB_H, nodeW, nodeH;

    if (!narrow) {
      VB_W = 980; VB_H = 340; nodeW = 176; nodeH = 78;
      const y = 56;
      const gap = (VB_W - NODES.length * nodeW) / (NODES.length + 1);
      NODES.forEach(function (_, i) {
        const x = gap + i * (nodeW + gap);
        pts.push({ x: x, y: y, cx: x + nodeW / 2, cy: y + nodeH / 2, w: nodeW, h: nodeH });
      });

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const path = el('path', {
          d: 'M' + (a.x + a.w + 2) + ',' + a.cy + ' L' + (b.x - 10) + ',' + b.cy,
          class: 'bio-edge',
          'marker-end': 'url(#bio-arrow)'
        });
        edgeLayer.appendChild(path);
        edges.push({ el: path, from: i, to: i + 1 });
      }

      const first = pts[0], last = pts[pts.length - 1];
      const fbY = y + nodeH + 88;
      const fb = el('path', {
        d: 'M' + last.cx + ',' + (y + nodeH + 2) +
           ' C' + last.cx + ',' + fbY + ' ' + first.cx + ',' + fbY + ' ' + first.cx + ',' + (y + nodeH + 12),
        class: 'bio-edge bio-edge-feedback',
        'marker-end': 'url(#bio-arrow)'
      });
      edgeLayer.appendChild(fb);
      edges.push({ el: fb, from: pts.length - 1, to: 0, feedback: true });

      const fbLabel = el('text', {
        x: String(VB_W / 2), y: String(fbY + 18),
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

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const path = el('path', {
          d: 'M' + a.cx + ',' + (a.y + a.h + 2) + ' L' + b.cx + ',' + (b.y - 10),
          class: 'bio-edge',
          'marker-end': 'url(#bio-arrow)'
        });
        edgeLayer.appendChild(path);
        edges.push({ el: path, from: i, to: i + 1 });
      }

      const first = pts[0], last = pts[pts.length - 1];
      const leftX = 28;
      const fb = el('path', {
        d: 'M' + last.x + ',' + last.cy +
           ' C' + leftX + ',' + last.cy + ' ' + leftX + ',' + first.cy + ' ' + (first.x - 8) + ',' + first.cy,
        class: 'bio-edge bio-edge-feedback',
        'marker-end': 'url(#bio-arrow)'
      });
      edgeLayer.appendChild(fb);
      edges.push({ el: fb, from: pts.length - 1, to: 0, feedback: true });

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

  function startPulse() {
    pulse = el('circle', { r: '5', class: 'bio-pulse' });
    edgeLayer.appendChild(pulse);
    const ordered = edges.slice();
    const lengths = ordered.map(function (e) {
      try { return Math.max(e.el.getTotalLength(), 1); } catch (err) { return 120; }
    });
    let ei = 0, t = 0;
    function step() {
      t += 2.4;
      if (t >= lengths[ei]) {
        t = 0;
        ei = (ei + 1) % ordered.length;
      }
      const pt = ordered[ei].el.getPointAtLength(Math.min(t, lengths[ei]));
      pulse.setAttribute('cx', pt.x);
      pulse.setAttribute('cy', pt.y);
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
