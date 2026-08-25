(function () {
  const KEY = 'ck-working-memory';
  const ONBOARD = 'ck-memory-onboarded';
  const memory = document.getElementById('memory');
  if (!memory) return;

  const tab = memory.querySelector('.memory-tab');
  const map = document.getElementById('memory-map');
  const wave = memory.querySelector('.memory-wave');
  const countEl = memory.querySelector('.memory-count');
  const bubble = document.getElementById('memory-bubble');
  const pop = document.getElementById('sel-pop');
  const send = document.getElementById('sel-send');
  const warn = document.getElementById('term-warn');
  const copyBtn = memory.querySelector('.memory-copy');
  const project = document.body.getAttribute('data-project') || 'Project';
  const projectId = document.body.getAttribute('data-project-id') || 'project';
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{"nodes":[]}'); }
    catch (e) { return { nodes: [] }; }
  }
  function save(state) {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }

  function kindFromNode(node) {
    const host = node && node.nodeType === 1 ? node : (node && node.parentElement);
    const sec = host && host.closest ? host.closest('[data-kind]') : null;
    return (sec && sec.getAttribute('data-kind')) || 'data';
  }
  function sectionFromNode(node) {
    const host = node && node.nodeType === 1 ? node : (node && node.parentElement);
    const h = host && host.closest ? host.closest('section') : null;
    const heading = h && h.querySelector('h2');
    return heading ? heading.textContent.trim() : 'Untitled';
  }

  /* No model is wired. Add project/section provenance so a fragment still reads. */
  function contextualize(text, meta) {
    const clipped = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clipped) return '';
    if (clipped.length < 12) return clipped;
    const already = clipped.indexOf(meta.project) !== -1 || clipped.indexOf(meta.section) !== -1;
    if (already) return clipped;
    return clipped + ' — (' + meta.project + ' / ' + meta.section + ')';
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function drawWave(n) {
    if (!wave || !wave.getContext) return;
    const ctx = wave.getContext('2d');
    const w = wave.width, h = wave.height;
    ctx.clearRect(0, 0, w, h);
    const load = Math.min(n / 8, 1);
    const amp = 4 + load * 10;
    const freq = 1.6 + load * 4.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 2 * freq) * amp * (0.65 + 0.35 * Math.sin(x / 9));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#B7A7D8';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#B7A7D8';
    ctx.shadowBlur = 6;
    ctx.stroke();
  }

  function render() {
    const state = load();
    map.innerHTML = '';
    state.nodes.forEach(function (node) {
      const art = document.createElement('article');
      art.className = 'mem-node is-' + (node.type || 'data');
      art.innerHTML = '<div class="mem-meta">' +
        (node.project || '') + ' · ' + (node.type || 'data') + ' · ' + (node.section || '') +
        '</div><div class="mem-text"></div>';
      art.querySelector('.mem-text').textContent = node.text;
      map.appendChild(art);
    });
    countEl.textContent = pad(state.nodes.length);
    drawWave(state.nodes.length);
    tab.setAttribute('data-load', String(state.nodes.length));
  }

  function addNode(original, type, section) {
    const state = load();
    const text = contextualize(original, { project: project, section: section, type: type });
    state.nodes.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      project: project,
      projectId: projectId,
      type: type,
      section: section,
      original: original,
      text: text,
      t: Date.now()
    });
    save(state);
    render();
  }

  const HOME = '../index.html#work';
  const WARNED = 'ck-term-warned';

  function hasWarned() {
    try { return sessionStorage.getItem(WARNED) === '1'; }
    catch (e) { return false; }
  }
  function markWarned() {
    try { sessionStorage.setItem(WARNED, '1'); }
    catch (e) {}
  }
  function homeHref() {
    const a = document.querySelector('.hud-back');
    return (a && (a.getAttribute('href') || a.href)) || HOME;
  }
  function nodesBlob() {
    const state = load();
    if (!state.nodes.length) return '';
    return state.nodes.map(function (n) {
      return '[' + n.project + ' / ' + n.type + ' / ' + n.section + ']\n' + n.text;
    }).join('\n\n');
  }
  function copyNodes() {
    const blob = nodesBlob();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(blob).catch(function () { return blob; });
    }
    return Promise.resolve(blob);
  }

  let pending = null;
  function showPop() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      pop.hidden = true;
      pending = null;
      return;
    }
    const text = sel.toString();
    const anchor = sel.anchorNode;
    const el = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
    const inHero = !!(document.querySelector('.hero') && el && document.querySelector('.hero').contains(el));
    const inMain = !!(document.getElementById('content') && el && document.getElementById('content').contains(el));
    if (!inHero && !inMain) {
      pop.hidden = true;
      return;
    }
    pending = {
      text: text,
      type: kindFromNode(anchor),
      section: sectionFromNode(anchor)
    };
    const r = sel.getRangeAt(0).getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = (r.left + r.width / 2 + scrollX) + 'px';
    pop.style.top = (r.top + scrollY) + 'px';
  }

  document.addEventListener('mouseup', function () {
    setTimeout(showPop, 0);
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Shift' || e.key.indexOf('Arrow') === 0) showPop();
  });
  send.addEventListener('click', function () {
    if (!pending) return;
    addNode(pending.text, pending.type, pending.section);
    pop.hidden = true;
    pending = null;
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    if (bubble) bubble.hidden = true;
    sessionStorage.setItem(ONBOARD, '1');
  });

  if (tab) {
    tab.addEventListener('click', function () {
      if (hoverQuery.matches) return;
      memory.classList.toggle('is-open');
      tab.setAttribute('aria-expanded', memory.classList.contains('is-open') ? 'true' : 'false');
    });
  }
  if (copyBtn) copyBtn.addEventListener('click', function () { copyNodes(); });

  if (bubble && !sessionStorage.getItem(ONBOARD) && load().nodes.length === 0) {
    bubble.hidden = false;
  }

  function showWarn(opts) {
    if (!warn || hasWarned()) return false;
    if (!(opts && opts.force) && !load().nodes.length) return false;
    markWarned();
    warn.hidden = false;
    return true;
  }
  function hideWarn() {
    if (warn) warn.hidden = true;
  }
  if (warn) {
    const copyTerm = warn.querySelector('[data-term-copy]');
    const stayTerm = warn.querySelector('[data-term-dismiss]');
    if (copyTerm) {
      copyTerm.addEventListener('click', function () {
        markWarned();
        const href = homeHref();
        copyNodes().then(function () {
          location.href = href;
        }, function () {
          location.href = href;
        });
      });
    }
    if (stayTerm) stayTerm.addEventListener('click', hideWarn);
  }

  document.addEventListener('click', function (e) {
    const back = e.target.closest && e.target.closest('.hud-back');
    if (!back) return;
    if (warn && !warn.hidden) {
      e.preventDefault();
      return;
    }
    if (hasWarned()) return;
    e.preventDefault();
    showWarn({ force: true });
  }, true);

  let idle = 0;
  function bump() { idle = 0; }
  ['pointermove', 'keydown', 'scroll', 'click'].forEach(function (ev) {
    addEventListener(ev, bump, { passive: true });
  });
  setInterval(function () {
    idle += 1;
    if (idle === 120) showWarn();
  }, 1000);

  setInterval(function () {
    if (!load().nodes.length) return;
    let toast = document.querySelector('.memory-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'memory-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = 'Don’t forget to copy me before you go!';
    toast.hidden = false;
    setTimeout(function () { toast.hidden = true; }, 5000);
  }, 90000);

  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') showWarn();
  });
  addEventListener('beforeunload', function (e) {
    if (hasWarned() || !load().nodes.length) return;
    showWarn();
    e.preventDefault();
    e.returnValue = '';
  });

  render();
})();
