/* Idle 3D album covers in Selected Work — replaces CSS sleeve/disc placeholders. */
import * as THREE from 'three';
import {
  loadVinylModel, loadCoverModel, cloneAsset, makeVinylLabel,
  COVER_SIZE, VINYL_RADIUS
} from './vinyl-glb.js';

(function () {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const rigs = [...document.querySelectorAll('.rig[data-cover]')];
  if (!rigs.length) return;

  const cards = [];
  const TILT_X = 0.16;
  const TILT_Y = 0.32;

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

  function layout(card) {
    const { camera, cover, vinyl, vinylRest, stage } = card;
    const canvas = card.renderer.domElement;
    const rigW = card.rig.clientWidth || 1;
    const rigH = card.rig.clientHeight || 1;
    const w = canvas.clientWidth || rigW;
    const h = canvas.clientHeight || rigH;
    if (w < 4 || h < 4) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    card.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    card.renderer.setSize(w, h, false);

    const dist = camera.position.z;
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const worldW = worldH * camera.aspect;
    const rigWorldW = worldW * (rigW / w);

    const sleeveW = rigWorldW * 0.58;
    const coverScale = Math.min(sleeveW, worldH * 0.92) / COVER_SIZE;
    cover.scale.setScalar(coverScale);
    const left = -worldW * 0.5 + coverScale * 0.52;
    cover.position.set(left, 0, 0.02);

    const vinylScale = coverScale * 0.46;
    vinyl.scale.setScalar(vinylScale);
    vinylRest.set(cover.position.x + coverScale * 0.34, 0, -0.01);
    vinyl.position.copy(vinylRest);
    if (stage) stage.position.set(0, 0, 0);
  }

  async function mount(rig) {
    const key = rig.getAttribute('data-cover');
    const canvas = rig.querySelector('.rig-canvas');
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
      loadVinylModel()
    ]);
    const cover = cloneAsset(coverRoot);
    const vinyl = cloneAsset(vinylRoot);
    const title = (rig.querySelector('.stitle')?.innerText || '').replace(/\s+/g, ' ').trim();
    vinyl.add(makeVinylLabel(title));

    const stage = new THREE.Group();
    stage.add(cover);
    stage.add(vinyl);
    scene.add(stage);

    const card = {
      rig, renderer, scene, camera, cover, vinyl, stage,
      vinylRest: new THREE.Vector3(),
      hover: 0, hoverT: 0,
      tiltX: 0, tiltY: 0, tiltTX: 0, tiltTY: 0,
      visible: false, paused: false
    };
    layout(card);
    renderer.render(scene, camera);
    rig.classList.add('is-3d');
    return card;
  }

  Promise.all(rigs.map((rig) => mount(rig).catch((err) => {
    console.error('[covers] failed', rig.getAttribute('data-cover'), err);
    return null;
  }))).then((list) => {
    list.filter(Boolean).forEach((c) => cards.push(c));
    if (!cards.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const card = cards.find((c) => c.rig === en.target);
        if (card) card.visible = en.isIntersecting && en.intersectionRatio > 0.08;
      });
    }, { threshold: [0, 0.08, 0.4] });
    cards.forEach((c) => io.observe(c.rig));

    cards.forEach((c) => {
      const rel = c.rig.closest('a.release') || c.rig;
      rel.addEventListener('pointerenter', () => { c.hoverT = 1; });
      rel.addEventListener('pointerleave', () => {
        c.hoverT = 0;
        c.tiltTX = 0;
        c.tiltTY = 0;
      });
      rel.addEventListener('pointermove', (e) => {
        const r = c.rig.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        c.tiltTY = THREE.MathUtils.clamp(nx, -1, 1) * TILT_Y;
        c.tiltTX = THREE.MathUtils.clamp(ny, -1, 1) * TILT_X;
        c.hoverT = 1;
      });
    });

    addEventListener('resize', () => cards.forEach(layout));

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = Math.min(1, dt * 8);
      cards.forEach((c) => {
        if (c.paused || !c.visible) return;
        c.hover += (c.hoverT - c.hover) * k;
        c.tiltX += (c.tiltTX - c.tiltX) * k;
        c.tiltY += (c.tiltTY - c.tiltY) * k;
        const extra = c.cover.scale.x * 0.42 * c.hover;
        c.vinyl.position.x = c.vinylRest.x + extra;
        c.stage.rotation.x = c.tiltX;
        c.stage.rotation.y = c.tiltY;
        c.renderer.render(c.scene, c.camera);
      });
    }
    frame();
  });

  window.__pauseWorkCovers = function (on) {
    cards.forEach((c) => { c.paused = !!on; });
  };
})();
