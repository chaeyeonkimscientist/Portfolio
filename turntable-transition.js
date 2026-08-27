/* ============================================================
   TURNTABLE TRANSITION — Three.js + GSAP
   On a Selected Work click:
     1. LP slides out of the 3D album cover (~1.2s)
     2. Travels onto the 3D turntable, centered on the platter
     3. Spins as if playing, then wipes into the project page
   Whole beat is ~5 seconds. Cover + vinyl start at the on-page
   placeholder size.
   ============================================================ */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  loadVinylModel, loadTurntableModel, loadCoverModel, cloneAsset, makeVinylLabel,
  COVER_GLBS, VINYL_RADIUS
} from './vinyl-glb.js';

(function () {
  'use strict';

  const DURATION = 5.0;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.getElementById('turntable-overlay');
  const canvas = document.getElementById('tt-canvas');
  if (!overlay || !canvas) return;

  const log = (msg) => {
    if (typeof window.ttlog === 'function') window.ttlog(msg);
  };

  let busy = false;

  addEventListener('pagehide', () => { busy = false; });
  addEventListener('pageshow', () => { busy = false; });

  function coverKeyFrom(link) {
    const rig = link.querySelector('.rig');
    return (rig && rig.getAttribute('data-cover')) || link.getAttribute('data-cover');
  }

  function preload(coverKey) {
    const jobs = [loadVinylModel(), loadTurntableModel()];
    if (coverKey && COVER_GLBS[coverKey]) jobs.push(loadCoverModel(coverKey));
    return Promise.all(jobs).then((models) => {
      log('glb ready');
      return models;
    }).catch((err) => {
      console.error('[tt] glb failed', err);
      log('glb FAIL ' + (err && err.message ? err.message : err));
      throw err;
    });
  }

  const work = document.getElementById('work');
  if (work && !REDUCED) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        preload('the_body_conducts');
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(work);
  }
  document.querySelectorAll('a.release').forEach((a) => {
    a.addEventListener('pointerenter', () => preload(coverKeyFrom(a)), { once: true, passive: true });
  });

  function cueNeedle() {
    if (typeof Tone === 'undefined' || Tone.context.state !== 'running') return;
    try {
      const now = Tone.now();
      const crackle = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.004, decay: 0.28, sustain: 0 }
      }).connect(new Tone.Filter(2200, 'lowpass').toDestination());
      crackle.volume.value = -22;
      crackle.triggerAttackRelease('8n', now);

      const chord = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.2, modulationIndex: 6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.6, sustain: 0.25, release: 1.6 }
      }).connect(new Tone.Reverb({ decay: 3.2, wet: 0.4 }).toDestination());
      chord.volume.value = -14;
      chord.triggerAttackRelease(['D3', 'F3', 'A3', 'C4', 'E4'], '2n', now + 0.06);
      setTimeout(() => { crackle.dispose(); chord.dispose(); }, 3000);
    } catch (e) { /* audio is decorative */ }
  }

  function ndcToPlane(clientX, clientY, camera, planeZ) {
    const ndc = new THREE.Vector2(
      (clientX / innerWidth) * 2 - 1,
      -(clientY / innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) hit.set(0, 0, planeZ);
    return hit;
  }

  function pixelsToWorld(px, camera, dist) {
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    return px * (worldH / innerHeight);
  }

  /*
   * Platter center in turntable-local space (Y-up, platter on −X, arm on +X).
   * Sit height matches the platter surface. Local +X is toward the arm /
   * screen-right. -0.16 sat left of the circular board; this nudges the
   * hole onto the board center.
   */
  const SPINDLE_LOCAL = new THREE.Vector3(-0.08, 0.141, 0.005);
  const PLATTER_RADIUS_LOCAL = 0.30;
  const VINYL_ON_PLATTER = 0.286;

  function spindleWorld(root) {
    root.updateMatrixWorld(true);
    return SPINDLE_LOCAL.clone().applyMatrix4(root.matrixWorld);
  }

  function mountVinylOnPlatter(scene, ttRoot, vinylPivot, vinylTilt, vinyl, playScale) {
    gsap.killTweensOf(vinylPivot);
    gsap.killTweensOf(vinylPivot.position);
    gsap.killTweensOf(vinylPivot.rotation);
    gsap.killTweensOf(vinylTilt.rotation);
    gsap.killTweensOf(vinyl.scale);
    /* Stay in world space so leftover GSAP world-position tweens cannot
       treat platter-local coords as a world offset toward the arm. */
    if (vinylPivot.parent !== scene) scene.add(vinylPivot);
    const p = spindleWorld(ttRoot);
    vinylPivot.position.copy(p);
    vinylPivot.rotation.set(0, 0, 0);
    vinylPivot.scale.set(1, 1, 1);
    vinylTilt.rotation.set(-Math.PI / 2, 0, 0);
    vinyl.scale.setScalar(playScale);
    log('seat local ' + SPINDLE_LOCAL.toArray().map((n) => n.toFixed(3)).join(',')
      + ' world ' + p.toArray().map((n) => n.toFixed(3)).join(',')
      + ' tt ' + ttRoot.position.toArray().map((n) => n.toFixed(3)).join(',')
      + ' s=' + ttRoot.scale.x.toFixed(3));
  }

  async function run(link, disc, url) {
    busy = true;
    try {
      await runScene(link, disc, url);
    } catch (err) {
      console.error('[tt] run failed', err);
      log('run FAIL ' + (err && err.message ? err.message : err));
      busy = false;
      if (typeof window.__pauseWorkCovers === 'function') window.__pauseWorkCovers(false);
      window.location.href = url;
    }
  }

  async function runScene(link, disc, url) {
    const rig = link.querySelector('.rig');
    const sleeve = link.querySelector('.sleeve');
    const coverKey = coverKeyFrom(link);
    const sleeveRect = (sleeve || disc || rig).getBoundingClientRect();
    const discRect = disc ? disc.getBoundingClientRect() : sleeveRect;

    overlay.classList.add('tt-on', 'tt-dim');
    overlay.style.display = 'block';
    disc.classList.add('tt-hidden');
    if (sleeve) sleeve.style.visibility = 'hidden';
    if (rig) rig.classList.add('tt-away');
    if (link) link.classList.add('tt-away');
    if (typeof window.__pauseWorkCovers === 'function') window.__pauseWorkCovers(true);
    if (typeof window.__disposeWorkCovers === 'function') window.__disposeWorkCovers();

    const [vinylRoot, turntableRoot, coverRoot] = await Promise.all([
      loadVinylModel(),
      loadTurntableModel(),
      coverKey ? loadCoverModel(coverKey).catch(() => null) : Promise.resolve(null)
    ]);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: true
      });
    } catch (err) {
      log('webgl FAIL ' + (err && err.message ? err.message : err));
      throw err;
    }
    log('webgl ok');
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101719, 4.5, 11);

    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch (e) {
      log('env skipped');
    }

    const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.05, 40);
    camera.position.set(0, 0.06, 2.55);
    const look = new THREE.Vector3(0, 0.02, 0);
    camera.lookAt(look);

    scene.add(new THREE.AmbientLight(0xb7a7d8, 0.38));
    scene.add(new THREE.HemisphereLight(0x6767a2, 0x101719, 0.28));

    const key = new THREE.SpotLight(0xfff4e8, 5.5, 16, THREE.MathUtils.degToRad(42), 0.55, 1.1);
    key.position.set(1.4, 3.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    scene.add(key);
    scene.add(key.target);

    const rim = new THREE.PointLight(0x8f8fd0, 7, 10);
    rim.position.set(-2.0, 1.6, 1.2);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({ color: 0x0c1012, roughness: 0.95, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    scene.add(floor);

    const dist = camera.position.z;
    const coverPos = ndcToPlane(
      sleeveRect.left + sleeveRect.width / 2,
      sleeveRect.top + sleeveRect.height / 2,
      camera, 0
    );
    const coverWorld = pixelsToWorld(
      Math.min(sleeveRect.width, sleeveRect.height),
      camera, dist
    );
    const discSize = pixelsToWorld(
      Math.min(discRect.width, discRect.height),
      camera, dist
    );
    const startVinylScale = (discSize * 0.5) / VINYL_RADIUS;

    let jacket = null;
    if (coverRoot) {
      jacket = cloneAsset(coverRoot);
      jacket.scale.setScalar(coverWorld);
      jacket.position.copy(coverPos);
      jacket.position.z = 0.02;
      scene.add(jacket);
    }

    const vinylPivot = new THREE.Group();
    const vinylTilt = new THREE.Group();
    const vinylSpin = new THREE.Group();
    const vinyl = cloneAsset(vinylRoot);
    vinyl.scale.setScalar(startVinylScale);
    const jacketTitle = (sleeve && sleeve.querySelector('.stitle')?.innerText || '').replace(/\s+/g, ' ').trim();
    vinyl.add(makeVinylLabel(jacketTitle));
    vinylSpin.add(vinyl);
    vinylTilt.add(vinylSpin);
    vinylPivot.add(vinylTilt);
    scene.add(vinylPivot);

    const discCenter = ndcToPlane(
      discRect.left + discRect.width / 2,
      discRect.top + discRect.height / 2,
      camera, 0
    );
    /* Start in the sleeve: vertical, Side A on +Z with the cover art. */
    vinylTilt.rotation.set(0, 0, 0);
    vinylPivot.position.copy(discCenter);
    if (jacket) {
      vinylPivot.position.x = jacket.position.x + coverWorld * 0.34;
      vinylPivot.position.y = jacket.position.y;
      vinylPivot.position.z = jacket.position.z - 0.03;
    } else {
      vinylPivot.position.z = -0.02;
    }

    const ttRoot = new THREE.Group();
    ttRoot.add(cloneAsset(turntableRoot));
    /* Keep the playing LP the same size as the placeholder disc. */
    const playScale = startVinylScale;
    const ttScale = playScale / PLATTER_RADIUS_LOCAL;
    ttRoot.scale.setScalar(ttScale);
    ttRoot.rotation.y = 0.38;
    const ttRest = new THREE.Vector3(0.38, -0.18 * ttScale, 0.12);
    ttRoot.position.copy(ttRest);
    scene.add(ttRoot);

    ttRoot.updateMatrixWorld(true);
    const platterWorld = spindleWorld(ttRoot);
    ttRoot.position.x = ttRest.x + Math.max(0.55, ttScale * 0.7);

    /* Slide out of the sleeve while still upright — always leave the jacket. */
    const vinylR = startVinylScale * VINYL_RADIUS;
    const jacketX = jacket ? jacket.position.x : vinylPivot.position.x;
    const jacketZ = jacket ? jacket.position.z : 0.02;
    const coverRight = jacketX + coverWorld * 0.5;
    const sleeveOutX = coverRight + vinylR + 0.05;
    const freeZ = jacketZ + 0.07;

    key.target.position.copy(platterWorld);

    const endCam = new THREE.Vector3(
      platterWorld.x + 0.28 * Math.max(ttScale, 1),
      platterWorld.y + 0.48 * Math.max(ttScale, 1),
      platterWorld.z + 0.78 * Math.max(ttScale, 1)
    );
    const endLook = platterWorld.clone();

    let spinning = false;
    let seated = false;
    const clock = new THREE.Clock();
    let raf = 0;
    let gone = false;

    function seatNow() {
      if (seated) return;
      seated = true;
      gsap.killTweensOf(vinylPivot.position);
      gsap.killTweensOf(vinylPivot.rotation);
      gsap.killTweensOf(vinylTilt.rotation);
      gsap.killTweensOf(vinyl.scale);
      ttRoot.position.copy(ttRest);
      ttRoot.updateMatrixWorld(true);
      mountVinylOnPlatter(scene, ttRoot, vinylPivot, vinylTilt, vinyl, playScale);
      spinning = true;
      cueNeedle();
      log('seated');
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (seated) {
        const p = spindleWorld(ttRoot);
        vinylPivot.position.copy(p);
        vinylPivot.rotation.set(0, 0, 0);
        vinylTilt.rotation.set(-Math.PI / 2, 0, 0);
        vinylSpin.rotation.z -= dt * 5.2;
      }
      renderer.render(scene, camera);
    }
    frame();

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    addEventListener('resize', onResize);

    function go() {
      if (gone) return;
      gone = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      window.location.href = url;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        overlay.classList.add('tt-exit');
        setTimeout(go, 420);
      }
    });
    /* Keep the 5s beat on wall time even if a few frames hitch. */
    gsap.ticker.lagSmoothing(0);

    /*
     * 1. Slide out of the sleeve upright, Side A facing the same way as the art.
     * 2. Then float and lay flat — never while still inside the jacket.
     * 3. Approach the player at float height; sit on the platter, not above it.
     */
    const floatY = platterWorld.y + playScale + 0.10;
    log('arc floatY=' + floatY.toFixed(3) + ' sitY=' + platterWorld.y.toFixed(3));

    tl.to(vinylPivot.position, {
      x: sleeveOutX,
      duration: 1.05,
      ease: 'power2.out',
      overwrite: false
    }, 0);

    /* Come forward off the artwork only after the disc has cleared the right edge. */
    tl.to(vinylPivot.position, {
      z: freeZ,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: false
    }, 0.95);

    /* Rise once the disc is already coming out, still vertical. */
    tl.to(vinylPivot.position, {
      y: floatY,
      duration: 0.55,
      ease: 'power2.out',
      overwrite: false
    }, 0.7);

    /* Lay onto the player only after it has left the cover. */
    tl.to(vinylTilt.rotation, {
      x: -Math.PI / 2,
      duration: 0.7,
      ease: 'power2.inOut',
      overwrite: false
    }, 1.2);

    /* Cover recedes as the LP begins to lay onto the player. */
    if (jacket) {
      tl.to(jacket.position, {
        x: jacket.position.x - 1.15,
        y: jacket.position.y + 0.12,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.05);
      tl.to(jacket.rotation, {
        y: -0.55,
        z: 0.08,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.05);
      tl.to(jacket.scale, {
        x: jacket.scale.x * 0.72,
        y: jacket.scale.y * 0.72,
        z: jacket.scale.z * 0.72,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.05);
    }

    tl.to(ttRoot.position, {
      x: ttRest.x,
      duration: 1.35,
      ease: 'power2.out'
    }, 1.05);

    tl.to(camera.position, {
      x: endCam.x, y: endCam.y, z: endCam.z,
      duration: 1.55,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(look)
    }, 1.05);
    tl.to(look, {
      x: endLook.x, y: endLook.y, z: endLook.z,
      duration: 1.55,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(look)
    }, 1.05);

    /* Approach on X/Z only — keep float Y so the path never dips through the player. */
    tl.to(vinylPivot.position, {
      x: platterWorld.x,
      z: platterWorld.z,
      duration: 1.05,
      ease: 'power3.inOut',
      overwrite: false
    }, 1.35);
    /* Drop onto the platter only after the disc is over it and already flat. */
    tl.to(vinylPivot.position, {
      y: platterWorld.y,
      duration: 0.4,
      ease: 'power2.inOut',
      overwrite: false
    }, 2.40);
    tl.to(vinyl.scale, {
      x: playScale, y: playScale, z: playScale,
      duration: 1.0,
      ease: 'power2.inOut'
    }, 1.30);

    tl.add(seatNow, 2.85);

    tl.to(camera.position, {
      y: endCam.y - 0.05,
      z: endCam.z - 0.08,
      duration: 2.2,
      ease: 'sine.inOut',
      onUpdate: () => camera.lookAt(look)
    }, 2.6);

    tl.to(camera.position, { x: '+=0', duration: DURATION - 4.8, ease: 'none' }, 4.8);

    setTimeout(go, DURATION * 1000 + 700);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.release');
    if (!link) return;

    const url = link.getAttribute('href');
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!url || url === '#' || url.startsWith('#') || link.target === '_blank') return;

    const disc = link.querySelector('.disc');
    const reducedNow = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!disc || busy || reducedNow) return;

    e.preventDefault();
    e.stopPropagation();
    log('click ' + url);
    run(link, disc, link.href);
  }, true);
})();
