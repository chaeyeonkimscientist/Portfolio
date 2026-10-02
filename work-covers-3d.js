/* Selected Work Cover Flow: linear row, 45° neighbors, original thin jackets.
   Scroll moves the focused cover; jacket and LP rotate as one unit. */
import * as THREE from 'three';
import {
  loadVinylModel, loadCoverModel, cloneAsset, makeVinylLabel,
  COVER_SIZE
} from './vinyl-glb.js';

(function () {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const viewport = document.querySelector('.work-viewport');
  const track = document.getElementById('work-track');
  if (!viewport || !track) return;

  const releases = [...track.querySelectorAll('a.release')];
  if (!releases.length) return;

  let canvas = document.getElementById('work-covers-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'work-covers-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    viewport.insertBefore(canvas, viewport.firstChild);
  }

  const TILT_X = 0.18;
  const TILT_Y = 0.32;
  const TILT_Z = 0.08;
  const SPINE_CUT = 18;

  const cards = [];

  function lights(scene) {
    scene.add(new THREE.AmbientLight(0xb7a7d8, 0.55));
    scene.add(new THREE.HemisphereLight(0x6767a2, 0x101719, 0.4));
    const key = new THREE.DirectionalLight(0xfff6ea, 1.7);
    key.position.set(0.8, 1.2, 2.4);
    scene.add(key);
    const rim = new THREE.PointLight(0x8f8fd0, 2.4, 8);
    rim.position.set(-1.4, 0.4, 1.6);
    scene.add(rim);
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false
    });
  } catch (e) {
    console.error('[covers] webgl failed', e);
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
  camera.position.set(0, 0.04, 3.25);
  camera.lookAt(0, 0, 0);
  lights(scene);

  function viewSize() {
    const w = canvas.clientWidth || viewport.clientWidth || 1;
    const h = canvas.clientHeight || viewport.clientHeight || 1;
    const dist = camera.position.z;
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const worldW = worldH * (w / Math.max(h, 1));
    return { w, h, worldW, worldH };
  }

  function resizeRenderer() {
    const { w, h } = viewSize();
    if (w < 4 || h < 4) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  }

  function coverKeyOf(el) {
    if (el.classList.contains('is-loop-clone')) return 'the_body_conducts';
    const rig = el.querySelector('.rig[data-cover]');
    return (rig && rig.getAttribute('data-cover')) || el.getAttribute('data-cover');
  }

  function spinOf(card) {
    return parseFloat(card.el.getAttribute('data-spin') || '0') || 0;
  }

  function layoutCard(card) {
    const rig = card.rig;
    if (!rig) return;
    const { w, h, worldW, worldH } = viewSize();
    const vRect = viewport.getBoundingClientRect();
    const rRect = rig.getBoundingClientRect();
    if (!rRect.height || !vRect.width) return;

    const cx = rRect.left + rRect.width / 2;
    const cy = rRect.top + rRect.height / 2;
    const nx = ((cx - vRect.left) / vRect.width) * 2 - 1;
    const ny = -(((cy - vRect.top) / vRect.height) * 2 - 1);

    const spin = spinOf(card);
    const k = Math.min(1, Math.abs(spin) / 45);
    card.spin = spin;
    card.k = k;

    const coverPx = rRect.height;
    const coverWorld = worldH * (coverPx / Math.max(h, 1));
    const coverScale = (coverWorld * (0.90 + 0.08 * (1 - k))) / COVER_SIZE;
    card.cover.scale.setScalar(coverScale);
    card.cover.position.set(0, 0, 0);
    card.cover.rotation.set(0, 0, 0);

    card.hold.position.set(
      nx * worldW * 0.5,
      ny * worldH * 0.5,
      (1 - k) * 0.78
    );
    card.hold.rotation.y = THREE.MathUtils.degToRad(spin);

    if (card.vinyl) {
      const vinylScale = coverScale * 0.42;
      card.vinyl.scale.setScalar(vinylScale);
      const behind = coverScale * ((card.coverDepth || 0.05) * 0.5 + 0.028);
      card.vinylRest.set(coverScale * 0.30, 0, -behind);
      card.vinyl.visible = k < 0.35;
      if (!card.vinyl.visible) card.hoverT = 0;
    }
  }

  async function mountOne(el, index) {
    const key = coverKeyOf(el);
    const rig = el.querySelector('.rig') || el;
    if (!key) return null;

    const [coverRoot, vinylRoot] = await Promise.all([
      loadCoverModel(key),
      key === 'other' ? Promise.resolve(null) : loadVinylModel()
    ]);
    const cover = cloneAsset(coverRoot);
    cover.updateMatrixWorld(true);
    const coverDepth = new THREE.Box3().setFromObject(cover).getSize(new THREE.Vector3()).z || 0.16;

    const hold = new THREE.Group();
    const stage = new THREE.Group();
    hold.add(stage);
    stage.add(cover);

    let vinyl = null;
    if (vinylRoot) {
      vinyl = cloneAsset(vinylRoot);
      vinyl.add(makeVinylLabel(key));
      stage.add(vinyl);
    }
    scene.add(hold);

    const card = {
      el, rig, key, index,
      cover, vinyl, hold, stage, coverDepth,
      vinylRest: new THREE.Vector3(),
      hover: 0, hoverT: 0,
      tiltX: 0, tiltY: 0, tiltZ: 0,
      tiltTX: 0, tiltTY: 0, tiltTZ: 0,
      spin: 0, k: 0, visible: true, paused: false
    };
    layoutCard(card);
    el.classList.add('is-3d');
    rig.classList.add('is-3d');
    return card;
  }

  Promise.all(releases.map((el, i) => mountOne(el, i).catch((err) => {
    console.error('[covers] failed', coverKeyOf(el), err);
    return null;
  }))).then((list) => {
    list.filter(Boolean).forEach((c) => cards.push(c));
    if (!cards.length) return;
    document.getElementById('work')?.classList.add('covers-ready');
    resizeRenderer();
    cards.forEach(layoutCard);
    renderer.render(scene, camera);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        resizeRenderer();
        cards.forEach(layoutCard);
      });
      ro.observe(viewport);
    }

    cards.forEach((c) => {
      const rel = c.el;
      rel.addEventListener('pointerenter', () => {
        if (Math.abs(spinOf(c)) < SPINE_CUT) c.hoverT = 1;
      });
      rel.addEventListener('pointerleave', () => {
        c.hoverT = 0;
        c.tiltTX = 0;
        c.tiltTY = 0;
        c.tiltTZ = 0;
      });
      rel.addEventListener('pointermove', (e) => {
        if (Math.abs(spinOf(c)) >= SPINE_CUT) return;
        const r = rel.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        const ny = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        c.tiltTY = nx * TILT_Y;
        c.tiltTX = ny * TILT_X;
        c.tiltTZ = -nx * TILT_Z;
        c.hoverT = 1;
      });
    });

    addEventListener('resize', () => {
      resizeRenderer();
      cards.forEach(layoutCard);
    });

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = Math.min(1, dt * 9);
      cards.forEach((c) => {
        if (c.paused) return;
        const hidden = c.el.style.visibility === 'hidden' || c.el.classList.contains('tt-away');
        c.hold.visible = !hidden;
        if (hidden) return;
        layoutCard(c);
        if (Math.abs(c.spin) >= SPINE_CUT) {
          c.hoverT = 0;
          c.tiltTX = 0;
          c.tiltTY = 0;
          c.tiltTZ = 0;
        }
        c.hover += (c.hoverT - c.hover) * k;
        c.tiltX += (c.tiltTX - c.tiltX) * k;
        c.tiltY += (c.tiltTY - c.tiltY) * k;
        c.tiltZ += (c.tiltTZ - c.tiltZ) * k;
        c.stage.rotation.x = c.tiltX * (1 - c.k);
        c.stage.rotation.y = c.tiltY * (1 - c.k);
        c.stage.rotation.z = c.tiltZ * (1 - c.k);
        if (c.vinyl) {
          const extra = c.cover.scale.x * 0.38 * c.hover * (1 - c.k);
          c.vinyl.position.x = c.vinylRest.x + extra;
          c.vinyl.position.y = c.vinylRest.y;
          c.vinyl.position.z = c.vinylRest.z;
        }
      });
      renderer.render(scene, camera);
    }
    frame();
  });

  window.__pauseWorkCovers = function (on) {
    cards.forEach((c) => { c.paused = !!on; });
  };
  window.__disposeWorkCovers = function () {
    cards.forEach((c) => {
      c.paused = true;
      c.hold.visible = false;
    });
    try {
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
      canvas.style.visibility = 'hidden';
      canvas.style.background = 'transparent';
      if (renderer) renderer.dispose();
    } catch (err) { /* already gone */ }
  };
})();
