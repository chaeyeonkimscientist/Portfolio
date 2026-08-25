/* ============================================================
   BATON GATE 3D — Three.js + GSAP concert-hall intro
   Replaces the old SVG/CSS baton gate. Reuses the SAME hand-off
   hooks the rest of the page already exposes:
     window.__armAudio()        -> unlock + preload the orchestra
     window.__audioStart()      -> start the score loop
     window.__gateDrivingEntry  -> tells the wave engine "I'll start audio"
   so the transition into your wave landing page is unchanged.

   Real model facts (measured from Portfolio.glb, do not guess):
     scene:  floor Y=0  ->  top Y=2.5
     Baton       center (0.00, 1.83,  0.10)  width ~1.22
     Sheet_Music center (0.00, 2.11, -0.067) top edge Y~2.44, tilted back
     Stand       center (0.00, 1.25,  0.00)
   Camera therefore looks at the DESK (~Y 2.0), not origin.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

(function () {
  'use strict';

  const GATE_SEEN = 'ck-gate-seen';
  function markGateSeen() {
    try { sessionStorage.setItem(GATE_SEEN, '1'); }
    catch (e) {}
  }
  function arrivingAtWork() {
    return (location.hash || '').replace(/^#/, '').split(/[&?]/)[0] === 'work';
  }

  const gate = document.getElementById('baton-gate');
  if (!gate) return;

  // Inline skip on index.html already removed the overlay for return visits
  // and for #work. If we still have a gate but landed on #work, drop it.
  if (arrivingAtWork()) {
    markGateSeen();
    gate.classList.add('unlocked');
    if (gate.parentNode) gate.remove();
    return;
  }
  markGateSeen();

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas  = document.getElementById('gate-canvas');
  const trigger = document.getElementById('baton-trigger');   // a11y button, still clickable
  const pulse   = document.getElementById('baton-pulse');     // the CSS ring (repositioned each frame)
  const copy    = document.querySelector('.gate-copy');

  // Warm the orchestra as early as possible (kept from your original).
  if (typeof window.__preloadSamples === 'function') {
    try { window.__preloadSamples(); } catch (e) {}
  }

  /* --- measured world positions (see header) --- */
  const SHEET_POS = new THREE.Vector3(0.0031, 2.1088, -0.067);
  const BATON_POS = new THREE.Vector3(0.0,    1.83,    0.10);

  /* Act II end pose, precomputed from the real geometry.
     The sheet is tilted back ~66deg; its face normal points up-and-toward the
     viewer at (0, 0.407, 0.914). To make the score FILL the frame (not punch
     through it), the camera must stop ~1.05 units back ALONG that normal, so
     it looks square-on at the tilted page. Fills ~92% of a 3:2 frame. */
  const SHEET_NORMAL = new THREE.Vector3(0, 0.407, 0.914).normalize();
  const CAM_END = SHEET_POS.clone().add(SHEET_NORMAL.clone().multiplyScalar(1.05));

  /* ============================================================
     Renderer / scene / camera
     ============================================================ */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Deep iris fog so the hall recedes into #08090f exactly like your CSS gate.
  scene.background = null;                          // canvas is transparent; CSS bg shows through
  scene.fog = new THREE.Fog(0x08090f, 4.5, 12);

  // Start pose: eye level with the desk, pulled back and slightly above.
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
  const CAM_START = new THREE.Vector3(0, 2.05, 3.2);
  const LOOK_START = new THREE.Vector3(0, 1.9, 0);   // look at the desk, not the floor
  camera.position.copy(CAM_START);
  camera.lookAt(LOOK_START);

  /* ============================================================
     Lighting topology (from your brief, adapted to real scale)
     ============================================================ */
  // Ambient lavender fill.
  const ambient = new THREE.AmbientLight(0xB7A7D8, 1.2);
  scene.add(ambient);

  // A touch of hemispheric bounce so the dark carbon fibre doesn't crush to black.
  const hemi = new THREE.HemisphereLight(0x6767A2, 0x08090f, 0.5);
  scene.add(hemi);

  // Overhead volumetric key spotlight aimed at the desk.
  const spot = new THREE.SpotLight(0xffffff, 15, 14, THREE.MathUtils.degToRad(45), 0.8, 1.2);
  spot.position.set(0, 4, 3);
  spot.target.position.copy(SHEET_POS);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  scene.add(spot);
  scene.add(spot.target);

  // Rim light kissing the baton from behind-left so its lavender emissive reads.
  const rim = new THREE.PointLight(0x8f8fd0, 6, 8);
  rim.position.set(-1.6, 2.4, -1.2);
  scene.add(rim);

  /* ============================================================
     The holographic wireframe hall (code-built, no asset)
     Arches receding in Z + a floor plane to catch the spotlight.
     ============================================================ */
  const hall = new THREE.Group();
  scene.add(hall);

  const wireMat = new THREE.LineBasicMaterial({
    color: 0xB7A7D8, transparent: true, opacity: 0.22
  });

  function archAt(z, w, h) {
    const pts = [];
    const seg = 24;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const a = Math.PI * t;                 // 0..PI half-arch
      pts.push(new THREE.Vector3(
        Math.cos(a) * w,
        Math.sin(a) * h * 0.55 + 0.9,        // spring line ~0.9
        z
      ));
    }
    // drop legs to the floor
    pts.unshift(new THREE.Vector3(-w, 0, z));
    pts.push(new THREE.Vector3(w, 0, z));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, wireMat);
  }

  // Two arcades marching back into depth.
  for (let i = 0; i < 7; i++) {
    const z = -0.8 - i * 1.5;
    const scale = 1 + i * 0.08;
    hall.add(archAt(z, 2.4 * scale, 3.2));
  }
  // Connecting stringers along the tops of the arcades (left + right).
  (function stringers() {
    const zs = [];
    for (let i = 0; i < 7; i++) zs.push(-0.8 - i * 1.5);
    [-1, 1].forEach(side => {
      const pts = zs.map((z, i) => {
        const scale = 1 + i * 0.08;
        return new THREE.Vector3(side * 2.4 * scale, 0.9 + 3.2 * 0.55 * 0.2, z);
      });
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      hall.add(new THREE.Line(g, wireMat));
    });
  })();

  // Floor: dark, faintly reflective-looking plane so the spotlight pools on it.
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d0e1a, roughness: 0.85, metalness: 0.1
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ============================================================
     Load the GLB
     ============================================================ */
  let baton = null, sheet = null, stand = null, model = null;
  let ready = false;

  const loader = new GLTFLoader();
  loader.load(
    'Portfolio.glb',
    (gltf) => {
      model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) o.material.envMapIntensity = 0.6;
        }
        if (o.name === 'Baton')       baton = o;
        if (o.name === 'Sheet_Music') sheet = o;
        if (o.name === 'Stand')       stand = o;
      });
      scene.add(model);

      // Fallback: if names ever change, resolve by node role.
      if (!baton) baton = model.getObjectByName('Baton');
      if (!sheet) sheet = model.getObjectByName('Sheet_Music');

      // Cache the baton's rest pose for Act I.
      if (baton) batonRest = {
        x: baton.position.x, y: baton.position.y, z: baton.position.z,
        rz: baton.rotation.z
      };

      ready = true;
      hideLoading();
    },
    (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        const el = document.getElementById('gate-load');
        if (el) el.textContent = 'loading the hall \u00b7 ' + pct + '%';
      }
    },
    (err) => {
      console.error('[gate] GLB failed to load:', err);
      // Don't trap the visitor behind a broken 3D scene — skip straight in.
      fallbackSkip();
    }
  );

  function hideLoading() {
    const el = document.getElementById('gate-load');
    if (el) el.classList.add('gone');
  }

  /* ============================================================
     Idle breathing + baton pulse ring tracking
     ============================================================ */
  let batonRest = null;
  const clock = new THREE.Clock();

  // Project the baton tip to screen space so the CSS pulse ring sits on it.
  const tipWorld = new THREE.Vector3();
  function updatePulseRing() {
    if (!baton || !pulse) return;
    // tip = right end of the baton bar in its local +X; approximate with BATON_POS offset
    tipWorld.set(BATON_POS.x + 0.5, BATON_POS.y + 0.03, BATON_POS.z);
    baton.parent && baton.parent.localToWorld(tipWorld.copy(tipWorld)); // no-op if top-level
    const p = tipWorld.clone().project(camera);
    const sx = (p.x * 0.5 + 0.5) * innerWidth;
    const sy = (-p.y * 0.5 + 0.5) * innerHeight;
    pulse.style.left = sx + 'px';
    pulse.style.top  = sy + 'px';
    pulse.style.opacity = (p.z < 1 && !entered) ? '1' : '0';
  }

  /* ============================================================
     Raycaster — click the baton mesh (not just a hotspot div)
     ============================================================ */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovering = false;

  function setPointer(e) {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  }

  function hitBaton() {
    if (!baton) return false;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(baton, true);
    return hits.length > 0;
  }

  // Test-only: sweep the screen and report where the baton is clickable.
  window.__probeBaton = function () {
    if (!baton) return { resolved: false };
    let hits = 0, sample = null;
    for (let sy = 0.2; sy <= 0.8; sy += 0.05) {
      for (let sx = 0.2; sx <= 0.8; sx += 0.05) {
        pointer.x = sx * 2 - 1; pointer.y = -(sy * 2 - 1);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.intersectObject(baton, true).length) {
          hits++;
          if (!sample) sample = { x: Math.round(sx * innerWidth), y: Math.round(sy * innerHeight) };
        }
      }
    }
    return { resolved: true, hits, sample };
  };

  gate.addEventListener('pointermove', (e) => {
    if (entered || REDUCED) return;
    setPointer(e);
    hovering = hitBaton();
    gate.style.cursor = hovering ? 'pointer' : 'default';
    // low-inertia POV parallax target (see loop)
    px = (e.clientX / innerWidth  - 0.5) * 2;
    py = (e.clientY / innerHeight - 0.5) * 2;
  });
  gate.addEventListener('pointerleave', () => { px = 0; py = 0; });

  gate.addEventListener('pointerdown', (e) => {
    if (entered) return;
    setPointer(e);
    if (hitBaton()) enter();
  });

  // Keyboard / a11y: the invisible button still triggers everything.
  if (trigger) {
    trigger.addEventListener('click', enter);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); }
    });
  }

  /* ============================================================
     Cursor parallax (low inertia POV drift of the whole scene)
     ============================================================ */
  let px = 0, py = 0, cx = 0, cy = 0;

  /* ============================================================
     THE THREE ACTS
     ============================================================ */
  let entered = false;

  async function enter() {
    if (entered || !ready) return;
    entered = true;

    if (pulse) pulse.style.opacity = '0';
    if (copy)  gsap.to(copy, { opacity: 0, duration: 0.4 });
    gate.style.cursor = 'none';

    // Arm audio exactly like the old gate did.
    window.__gateDrivingEntry = true;
    const armed = (typeof window.__armAudio === 'function')
      ? window.__armAudio() : Promise.resolve();

    const tl = gsap.timeline();

    /* ---- ACT I: The Lift ---- */
    if (baton && batonRest && !REDUCED) {
      tl.to(baton.position, {
        y: batonRest.y + 0.45,
        x: batonRest.x + 0.08,
        duration: 1.0,
        ease: 'back.out(1.7)'
      }, 0);
      tl.to(baton.rotation, {
        z: batonRest.rz + 0.35,
        duration: 1.0,
        ease: 'back.out(1.7)'
      }, 0);
    }

    /* ---- ACT II: Camera dolly onto the score ----
       Fires 0.3s before Act I finishes. Move the eye to CAM_END (square-on to
       the tilted page, ~1.05u back along its normal) and swing the look-target
       up onto the sheet centre, so the score fills the frame without clipping. */
    const look = LOOK_START.clone();
    tl.to(camera.position, {
      x: CAM_END.x, y: CAM_END.y, z: CAM_END.z,
      duration: 1.4, ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(look)
    }, REDUCED ? 0 : 0.7);
    tl.to(look, {
      x: SHEET_POS.x, y: SHEET_POS.y, z: SHEET_POS.z,
      duration: 1.4, ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(look)
    }, REDUCED ? 0 : 0.7);

    // Push the concert-A "tuning" swell during the dolly (uses your Tone setup).
    startTuningA();

    /* ---- ACT III: dissolve + pass-through ----
       Fires 0.4s before Act II completes. Fade the whole gate to 0 and hand
       off to the wave page underneath. */
    const dissolveAt = (REDUCED ? 0.2 : 0.7 + 1.4 - 0.4);
    tl.to(gate, {
      opacity: 0, duration: 0.6, ease: 'power2.inOut',
      onStart: () => {
        // Start the real score right as the score fills the frame.
        const barSec = (typeof Tone !== 'undefined') ? Tone.Time('1m').toSeconds() : 2.1;
        if (typeof window.__audioStart === 'function') window.__audioStart();
        resolveTuningA(barSec * 0.9);
      },
      onComplete: () => {
        gate.classList.add('unlocked');   // visibility:hidden + pointer-events:none
        cleanup();
      }
    }, dissolveAt);

    try { await armed; } catch (e) {}
  }

  function fallbackSkip() {
    entered = true;
    window.__gateDrivingEntry = false;   // let the wave page arm audio on first gesture
    gate.classList.add('unlocked');
    cleanup();
  }

  /* ============================================================
     Concert-A tuning swell (kept from your original controller)
     ============================================================ */
  let tuneRig = null;
  function startTuningA() {
    if (typeof Tone === 'undefined') return;
    try {
      const rev  = new Tone.Reverb({ decay: 4.2, wet: 0.5 }).toDestination();
      const filt = new Tone.Filter(2600, 'lowpass').connect(rev);
      const gain = new Tone.Gain(0).connect(filt);
      const a = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.6, decay: 0.3, sustain: 1.0, release: 1.8 }
      }).connect(gain);
      a.volume.value = -15;
      a.triggerAttack(['A3', 'A4', 'E5']);
      gain.gain.rampTo(1.0, 0.6);
      tuneRig = { a, gain, rev, filt };
    } catch (e) {}
  }
  function resolveTuningA(dur) {
    if (!tuneRig) return;
    const { a, gain, rev, filt } = tuneRig; tuneRig = null;
    try {
      gain.gain.rampTo(0.0, dur);
      setTimeout(() => {
        try { a.releaseAll && a.releaseAll(); } catch (e) {}
        try { a.dispose(); gain.dispose(); filt.dispose(); rev.dispose(); } catch (e) {}
      }, dur * 1000 + 2200);
    } catch (e) {}
  }

  /* ============================================================
     Render loop
     ============================================================ */
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Idle breathing of the lights (2.5s loop) — only before entry.
    if (!entered) {
      const breathe = 0.5 + 0.5 * Math.sin((t / 2.5) * Math.PI * 2);
      spot.intensity = 34 + breathe * 10;
      ambient.intensity = 1.05 + breathe * 0.2;

      // low-inertia POV parallax
      if (!REDUCED) {
        cx += (px - cx) * 0.05;
        cy += (py - cy) * 0.05;
        camera.position.x = CAM_START.x + cx * 0.35;
        camera.position.y = CAM_START.y - cy * 0.18;
        camera.lookAt(LOOK_START);
      }
    }

    updatePulseRing();
    renderer.render(scene, camera);
  }
  animate();

  function cleanup() {
    // Stop rendering once we've handed off; free the GL context after the fade.
    setTimeout(() => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      if (gate.parentNode) gate.remove();
    }, 700);
  }

  /* ============================================================
     Resize
     ============================================================ */
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // If reduced-motion, don't force people to click through a static scene:
  // show it briefly, then auto-hand-off on first interaction.
  if (REDUCED) {
    gate.addEventListener('pointerdown', enter, { once: true });
    if (trigger) trigger.setAttribute('aria-label', 'Enter the site');
  }
})();
