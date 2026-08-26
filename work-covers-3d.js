/* Idle 3D album covers in Selected Work — replaces CSS sleeve/disc placeholders. */
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
    const { camera, cover, vinyl, vinylRest, stage, rig, host } = card;
    const canvas = card.renderer.domElement;
    const hostEl = host || rig;
    const w = canvas.clientWidth || hostEl.clientWidth || 1;
    const h = canvas.clientHeight || hostEl.clientHeight || 1;
    if (w < 4 || h < 4) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    card.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    card.renderer.setSize(w, h, false);

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
    cover.position.set(
      rigCenterX - rigWorldW * 0.5 + coverScale * 0.52,
      rigCenterY,
      0.02
    );

    const vinylScale = coverScale * 0.46;
    vinyl.scale.setScalar(vinylScale);
    vinylRest.set(cover.position.x + coverScale * 0.34, cover.position.y, -0.01);
    vinyl.position.copy(vinylRest);
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
      rig, host, renderer, scene, camera, cover, vinyl, stage,
      vinylRest: new THREE.Vector3(),
      hover: 0, hoverT: 0,
      tiltX: 0, tiltY: 0, tiltZ: 0,
      tiltTX: 0, tiltTY: 0, tiltTZ: 0,
      visible: false, paused: false
    };
    layout(card);
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

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const card = cards.find((c) => c.rig === en.target || c.host === en.target);
        if (!card) return;
        const vis = en.isIntersecting && en.intersectionRatio > 0.08;
        if (vis && !card.visible) layout(card);
        card.visible = vis;
      });
    }, { threshold: [0, 0.08, 0.4] });
    cards.forEach((c) => io.observe(c.host || c.rig));

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => cards.forEach(layout));
      cards.forEach((c) => ro.observe(c.host || c.rig));
    }

    cards.forEach((c) => {
      const rel = c.host || c.rig.closest('a.release') || c.rig;
      rel.addEventListener('pointerenter', () => { c.hoverT = 1; });
      rel.addEventListener('pointerleave', () => {
        c.hoverT = 0;
        c.tiltTX = 0;
        c.tiltTY = 0;
        c.tiltTZ = 0;
      });
      rel.addEventListener('pointermove', (e) => {
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
        c.tiltZ += (c.tiltTZ - c.tiltZ) * k;
        const extra = c.cover.scale.x * 0.38 * c.hover;
        c.vinyl.position.x = c.vinylRest.x + extra;
        c.vinyl.position.y = c.vinylRest.y;
        c.stage.rotation.x = c.tiltX;
        c.stage.rotation.y = c.tiltY;
        c.stage.rotation.z = c.tiltZ;
        c.renderer.render(c.scene, c.camera);
      });
    }
    frame();
  });

  window.__pauseWorkCovers = function (on) {
    cards.forEach((c) => { c.paused = !!on; });
  };
})();
