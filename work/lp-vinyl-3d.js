/* 3D vinyl dock for The Body Conducts — replaces the CSS LP disc. */
import * as THREE from 'three';
import { loadVinylModel } from '../vinyl-glb.js';

(function () {
  'use strict';

  const dock = document.getElementById('lp-dock');
  const canvas = document.getElementById('lp-vinyl-canvas');
  if (!dock || !canvas) return;
  if (document.body.getAttribute('data-has-lp') !== 'true') return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 760px)').matches;
  if (MOBILE) return;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'low-power'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0, 3.7);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xb7a7d8, 1.05));
  scene.add(new THREE.HemisphereLight(0x6767a2, 0x101719, 0.55));
  const dir = new THREE.DirectionalLight(0xfff6ea, 2.4);
  dir.position.set(1.4, 1.8, 2.4);
  scene.add(dir);
  const rim = new THREE.PointLight(0x8f8fd0, 3.2, 8);
  rim.position.set(-1.6, 0.4, 1.8);
  scene.add(rim);

  function sizeToDock() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeToDock();
  addEventListener('resize', sizeToDock);

  let vinyl = null;
  loadVinylModel().then((model) => {
    vinyl = model;
    vinyl.scale.setScalar(1);
    scene.add(vinyl);
    renderer.render(scene, camera);
  }).catch((err) => {
    console.error('[lp] vinyl glb failed', err);
  });

  const clock = new THREE.Clock();
  const spin = REDUCED ? 0 : (Math.PI * 2) / 8.5;

  function frame() {
    requestAnimationFrame(frame);
    if (vinyl && spin) vinyl.rotation.z += spin * clock.getDelta();
    if (vinyl) renderer.render(scene, camera);
  }
  frame();
})();
