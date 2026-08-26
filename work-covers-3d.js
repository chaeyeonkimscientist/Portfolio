/* Idle 3D album covers in Selected Work — replaces CSS sleeve/disc placeholders. */
import * as THREE from 'three';
import {
  loadVinylModel, loadCoverModel, cloneAsset, COVER_SIZE, VINYL_RADIUS
} from './vinyl-glb.js';

(function () {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const rigs = [...document.querySelectorAll('.rig[data-cover]')];
  if (!rigs.length) return;

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

  function layout(card) {
    const { camera, cover, vinyl, vinylRest } = card;
    const canvas = card.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (w < 4 || h < 4) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    card.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    card.renderer.setSize(w, h, false);

    const dist = camera.position.z;
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const worldW = worldH * camera.aspect;

    // Match the CSS sleeve: 64% of rig width, full height — nearly square.
    const sleeveW = worldW * 0.64;
    const sleeveH = worldH;
    const coverScale = Math.min(sleeveW, sleeveH) / COVER_SIZE;
    cover.scale.setScalar(coverScale);
    cover.position.set(-worldW * 0.5 + sleeveW * 0.5, 0, 0.02);

    // Disc is 62% of rig width; keep it slightly smaller than the jacket.
    const discPxFrac = 0.62;
    const vinylScale = (worldW * discPxFrac * 0.5) / VINYL_RADIUS;
    vinyl.scale.setScalar(vinylScale);
    const peek = coverScale * 0.36;
    vinylRest.set(
      cover.position.x + peek,
      0,
      -0.01
    );
    vinyl.position.copy(vinylRest);
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
    scene.add(cover);
    scene.add(vinyl);

    const card = {
      rig, renderer, scene, camera, cover, vinyl,
      vinylRest: new THREE.Vector3(),
      hover: 0, hoverT: 0, visible: false, paused: false
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
      const rel = c.rig.closest('a.release');
      const enter = () => { c.hoverT = 1; };
      const leave = () => { c.hoverT = 0; };
      (rel || c.rig).addEventListener('pointerenter', enter);
      (rel || c.rig).addEventListener('pointerleave', leave);
    });

    addEventListener('resize', () => cards.forEach(layout));

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      cards.forEach((c) => {
        if (c.paused || !c.visible) return;
        c.hover += (c.hoverT - c.hover) * Math.min(1, dt * 8);
        const extra = c.cover.scale.x * 0.28 * c.hover;
        c.vinyl.position.x = c.vinylRest.x + extra;
        c.renderer.render(c.scene, c.camera);
      });
    }
    frame();
  });

  window.__pauseWorkCovers = function (on) {
    cards.forEach((c) => { c.paused = !!on; });
  };
})();
