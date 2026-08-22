(function () {
  const mount = document.getElementById('bio-graph');
  if (!mount) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NODES = [
    { id: 'stress',  label: 'Stress' },
    { id: 'alarm',   label: 'Neurological\nAlarm' },
    { id: 'inflam',  label: 'Immune\nInflammation' },
    { id: 'miscoord',label: 'Body\nMiscoordination' }
  ];

  const NS = 'http://www.w3.org/2000/svg';
  // logical viewBox; SVG scales to container width
  const VB_W = 900, VB_H = 300;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + VB_H);
  svg.setAttribute('class', 'bio-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    'Feedback cycle: Stress leads to Neurological Alarm, then Immune Inflammation, then Body Miscoordination, which feeds back to Stress.');

  // node geometry
  const nodeW = 168, nodeH = 74, y = 70;
  const gap = (VB_W - NODES.length * nodeW) / (NODES.length + 1);
  const pts = NODES.map(function (n, i) {
    const x = gap + i * (nodeW + gap);
    return { x: x, y: y, cx: x + nodeW / 2, cy: y + nodeH / 2 };
  });

  // ---- defs: arrowhead + glow ----
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<marker id="bio-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(--lav)"></path></marker>' +
    '<marker id="bio-arrow-lit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(--data)"></path></marker>';
  svg.appendChild(defs);

  const edgeLayer = document.createElementNS(NS, 'g');
  const nodeLayer = document.createElementNS(NS, 'g');
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);

  const edges = [];

  // forward edges: right side of A -> left side of B
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const x1 = a.x + nodeW, y1 = a.cy, x2 = b.x, y2 = b.cy;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M' + x1 + ',' + y1 + ' L' + (x2 - 2) + ',' + y2);
    path.setAttribute('class', 'bio-edge');
    path.setAttribute('marker-end', 'url(#bio-arrow)');
    edgeLayer.appendChild(path);
    edges.push({ el: path, from: i, to: i + 1 });
  }

  // feedback edge: bottom of last node -> curve down and back -> bottom of first node
  const first = pts[0], last = pts[pts.length - 1];
  const fbY = y + nodeH + 60;
  const fbPath = document.createElementNS(NS, 'path');
  const d = 'M' + last.cx + ',' + (y + nodeH) +
            ' C' + last.cx + ',' + fbY + ' ' + first.cx + ',' + fbY + ' ' + first.cx + ',' + (y + nodeH + 2);
  fbPath.setAttribute('d', d);
  fbPath.setAttribute('class', 'bio-edge bio-edge-feedback');
  fbPath.setAttribute('marker-end', 'url(#bio-arrow)');
  edgeLayer.appendChild(fbPath);
  edges.push({ el: fbPath, from: pts.length - 1, to: 0, feedback: true });

  // feedback label
  const fbLabel = document.createElementNS(NS, 'text');
  fbLabel.setAttribute('x', VB_W / 2);
  fbLabel.setAttribute('y', fbY + 4);
  fbLabel.setAttribute('class', 'bio-fb-label');
  fbLabel.setAttribute('text-anchor', 'middle');
  fbLabel.textContent = 'feeds back';
  edgeLayer.appendChild(fbLabel);

  // nodes
  const nodeEls = pts.map(function (p, i) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'bio-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('data-i', i);
    g.setAttribute('role', 'listitem');

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', p.x); rect.setAttribute('y', p.y);
    rect.setAttribute('width', nodeW); rect.setAttribute('height', nodeH);
    rect.setAttribute('rx', 6);
    rect.setAttribute('class', 'bio-node-box');
    g.appendChild(rect);

    const lines = NODES[i].label.split('\n');
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', p.cx);
    text.setAttribute('y', p.cy - (lines.length - 1) * 9 + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'bio-node-label');
    lines.forEach(function (ln, li) {
      const ts = document.createElementNS(NS, 'tspan');
      ts.setAttribute('x', p.cx);
      if (li > 0) ts.setAttribute('dy', '18');
      ts.textContent = ln;
      text.appendChild(ts);
    });
    g.appendChild(text);
    nodeLayer.appendChild(g);
    return g;
  });

  function setActive(i, on) {
    nodeEls.forEach(function (el, j) {
      el.classList.toggle('is-active', on && j === i);
    });
    edges.forEach(function (e) {
      const lit = on && (e.from === i || e.to === i);
      e.el.classList.toggle('is-lit', lit);
      e.el.setAttribute('marker-end', lit ? 'url(#bio-arrow-lit)' : 'url(#bio-arrow)');
    });
  }
  nodeEls.forEach(function (el, i) {
    el.addEventListener('mouseenter', function () { setActive(i, true); });
    el.addEventListener('mouseleave', function () { setActive(i, false); });
    el.addEventListener('focus', function () { setActive(i, true); });
    el.addEventListener('blur', function () { setActive(i, false); });
  });

  // animated signal pulse traveling around the cycle
  if (!reduced) {
    const pulse = document.createElementNS(NS, 'circle');
    pulse.setAttribute('r', '4.5');
    pulse.setAttribute('class', 'bio-pulse');
    edgeLayer.appendChild(pulse);
    const ordered = edges.slice();          // 3 forward + 1 feedback, already in cycle order
    let ei = 0, t = 0;
    const speeds = ordered.map(function (e) {
      return e.el.getTotalLength();
    });
    function step() {
      const e = ordered[ei];
      const len = speeds[ei];
      t += 2.2;
      if (t >= len) { t = 0; ei = (ei + 1) % ordered.length; }
      const pt = ordered[ei].el.getPointAtLength(Math.min(t, speeds[ei]));
      pulse.setAttribute('cx', pt.x);
      pulse.setAttribute('cy', pt.y);
      requestAnimationFrame(step);
    }
    // start only when scrolled into view to save cycles
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { requestAnimationFrame(step); io.disconnect(); }
        });
      }, { threshold: 0.2 });
      io.observe(mount);
    } else {
      requestAnimationFrame(step);
    }
  }

  mount.appendChild(svg);
})();
