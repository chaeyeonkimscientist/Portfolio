/* Idle 3D album covers in Selected Work — GLB jackets + vinyl peek.
   While the track is scrolling, rotate each jacket so the GLB spine faces
   the camera. Never swap in the CSS sleeve/spine placeholders. */
import * as THREE from 'three';
import {
  loadVinylModel, loadCoverModel, cloneAsset, makeVinylLabel,
  COVER_SIZE
} from './vinyl-glb.js';

(function () {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const rigs = [...document.querySelectorAll('.rig[data-cover]')];
  if (!rigs.length) return;

  const cards = [];
  const TILT_X = 0.22;
  const TILT_Y = 0.46;
  const TILT_Z = 0.10;
  const SPINE_CUT = 18;

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

  function spinOf(card) {
    const host = card.host || card.rig;
    return parseFloat(host.getAttribute('data-spin') || '0') || 0;
  }

  function resize(card) {
    const canvas = card.renderer.domElement;
    const hostEl = card.host || card.rig;
    const w = canvas.clientWidth || hostEl.clientWidth || 1;
    const h = canvas.clientHeight || hostEl.clientHeight || 1;
    if (w < 4 || h < 4) return;
    card.camera.aspect = w / h;
    card.camera.updateProjectionMatrix();
    card.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    card.renderer.setSize(w, h, false);
    layout(card);
  }

  function layout(card) {
    const { camera, cover, vinyl, vinylRest, stage, rig } = card;
    const canvas = card.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (w < 4 || h < 4) return;

    const dist = camera.position.z;
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const worldW = worldH * camera.aspect;

    const cRect = canvas.getBoundingClientRect();
    const rRect = rig.getBoundingClientRect();
    const cw = cRect.width || w;
    const ch = cRect.height || h;
    const rigWorldW = worldW * ((rRect.width || cw) / cw);
    const rigWorldH = worldH * ((rRect.height || ch) / ch);

    const nx = (((rRect.left + rRect.width / 2) - cRect.left) / cw) * 2 - 1;
    const ny = -((((rRect.top + rRect.height / 2) - cRect.top) / ch) * 2 - 1);
    const rigCenterX = nx * worldW * 0.5;
    const rigCenterY = ny * worldH * 0.5;

    const sleeveW = rigWorldW * 0.58;
    const coverScale = Math.min(sleeveW, rigWorldH * 0.92) / COVER_SIZE;
    cover.scale.setScalar(coverScale);

    const idleX = rigCenterX - rigWorldW * 0.5 + coverScale * 0.52;
    const spineX = rigCenterX - rigWorldW * 0.5 + rigWorldW * 0.32;
    const spin = spinOf(card);
    const k = Math.min(1, Math.abs(spin) / 90);
    card.spin = spin;

    cover.position.set(
      idleX + (spineX - idleX) * k,
      rigCenterY,
      0.02
    );
    cover.rotation.y = THREE.MathUtils.degToRad(spin);

    if (vinyl) {
      const vinylScale = coverScale * 0.46;
      vinyl.scale.setScalar(vinylScale);
      vinylRest.set(idleX + coverScale * 0.34, cover.position.y, -0.01);
      vinyl.visible = k < 0.35;
      if (!vinyl.visible) card.hoverT = 0;
    }
    if (stage) stage.position.set(0, 0, 0);
  }

  async function mount(rig) {
    const key = rig.getAttribute('data-cover');
    const host = rig.closest('a.release') || rig;
    const canvas = host.querySelector('.rig-canvas') || rig.querySelector('.rig-canvas');
    if (!key || !canvas) return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: false
      });
    } catch (e) {
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
    camera.position.set(0, 0.04, 2.35);
    camera.lookAt(0, 0, 0);
    lights(scene);

    const [coverRoot, vinylRoot] = await Promise.all([
      loadCoverModel(key),
      key === 'other' ? Promise.resolve(null) : loadVinylModel()
    ]);
    const cover = cloneAsset(coverRoot);

    const stage = new THREE.Group();
    stage.add(cover);

    let vinyl = null;
    if (vinylRoot) {
      vinyl = cloneAsset(vinylRoot);
      vinyl.add(makeVinylLabel(key));
      stage.add(vinyl);
    }
    scene.add(stage);

    const card = {
      rig, host, renderer, scene, camera, cover, vinyl, stage,
      vinylRest: new THREE.Vector3(),
      hover: 0, hoverT: 0,
      tiltX: 0, tiltY: 0, tiltZ: 0,
      tiltTX: 0, tiltTY: 0, tiltTZ: 0,
      spin: 0, visible: true, paused: false
    };
    resize(card);
    renderer.render(scene, camera);
    rig.classList.add('is-3d');
    host.classList.add('is-3d');
    return card;
  }

  Promise.all(rigs.map((rig) => mount(rig).catch((err) => {
    console.error('[covers] failed', rig.getAttribute('data-cover'), err);
    return null;
  }))).then((list) => {
    list.filter(Boolean).forEach((c) => cards.push(c));
    if (!cards.length) return;
    document.getElementById('work')?.classList.add('covers-ready');

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const card = cards.find((c) => c.rig === en.target || c.host === en.target);
        if (!card) return;
        const vis = en.isIntersecting && en.intersectionRatio > 0.02;
        if (vis && !card.visible) resize(card);
        card.visible = vis;
      });
    }, { threshold: [0, 0.02, 0.08, 0.4] });
    cards.forEach((c) => io.observe(c.host || c.rig));

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => cards.forEach(resize));
      cards.forEach((c) => ro.observe(c.host || c.rig));
    }

    cards.forEach((c) => {
      const rel = c.host || c.rig.closest('a.release') || c.rig;
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

    addEventListener('resize', () => cards.forEach(resize));

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = Math.min(1, dt * 8);
      cards.forEach((c) => {
        if (c.paused) return;
        const hidden = (c.host && c.host.style.visibility === 'hidden')
          || (c.host && c.host.classList.contains('tt-away'))
          || c.rig.classList.contains('tt-away');
        if (hidden) return;
        layout(c);
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
        c.stage.rotation.x = c.tiltX;
        c.stage.rotation.y = c.tiltY;
        c.stage.rotation.z = c.tiltZ;
        if (c.vinyl) {
          const extra = c.cover.scale.x * 0.38 * c.hover;
          c.vinyl.position.x = c.vinylRest.x + extra;
          c.vinyl.position.y = c.vinylRest.y;
          c.vinyl.position.z = c.vinylRest.z;
        }
        c.renderer.render(c.scene, c.camera);
      });
    }
    frame();
  });

  window.__pauseWorkCovers = function (on) {
    cards.forEach((c) => { c.paused = !!on; });
  };
  window.__disposeWorkCovers = function () {
    cards.forEach((c) => {
      c.paused = true;
      c.visible = false;
      try {
        const el = c.renderer && c.renderer.domElement;
        if (el) {
          el.style.transition = 'none';
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.background = 'transparent';
        }
        /* Do not forceContextLoss — Chrome paints a broken-image icon
           on the lost canvas, which flashes as a white band. */
        if (c.renderer) c.renderer.dispose();
      } catch (err) { /* already gone */ }
    });
  };
})();
