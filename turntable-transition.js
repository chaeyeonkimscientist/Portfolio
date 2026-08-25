/* ============================================================
   TURNTABLE TRANSITION — Three.js + GSAP
   Replaces the CSS platter/arm overlay. On a Selected Work click:
     1. LP slides out of the album sleeve (~1.2s)
     2. Travels onto the 3D turntable and lays flat (~1.5s)
     3. Spins as if playing, then wipes into the project page
   Whole beat is ~5 seconds.
   ============================================================ */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadVinylModel, loadTurntableModel } from './vinyl-glb.js';

(function () {
  'use strict';

  const DURATION = 5.0;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.getElementById('turntable-overlay');
  const canvas = document.getElementById('tt-canvas');
  const sleeveSlot = document.getElementById('tt-sleeve-slot');
  if (!overlay || !canvas) return;

  const log = (msg) => {
    if (typeof window.ttlog === 'function') window.ttlog(msg);
  };

  let busy = false;
  let assets = null;
  let loading = null;

  function preload() {
    if (loading) return loading;
    loading = Promise.all([loadVinylModel(), loadTurntableModel()])
      .then(([vinyl, turntable]) => {
        assets = { vinyl, turntable };
        log('glb ready');
        return assets;
      })
      .catch((err) => {
        console.error('[tt] glb failed', err);
        log('glb FAIL ' + (err && err.message ? err.message : err));
        loading = null;
        throw err;
      });
    return loading;
  }

  // Warm models as soon as the work rail is in view / hovered.
  const work = document.getElementById('work');
  if (work && !REDUCED) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        preload();
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(work);
  }
  document.querySelectorAll('a.release').forEach((a) => {
    a.addEventListener('pointerenter', preload, { once: true, passive: true });
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
    if (!ray.ray.intersectPlane(plane, hit)) {
      hit.set(0, 0, planeZ);
    }
    return hit;
  }

  function pixelsToWorld(px, camera, dist) {
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    return px * (worldH / innerHeight);
  }

  function paintJacketTexture(sleeve) {
    const canvas2 = document.createElement('canvas');
    canvas2.width = 1024;
    canvas2.height = 1024;
    const ctx = canvas2.getContext('2d');
    const palettes = {
      'sl-body': ['#3a2630', '#241620', '#2a1016'],
      'sl-para': ['#222630', '#191c24', '#142a2f'],
      'sl-films': ['#33242c', '#1c1820', '#1a2430'],
      'sl-syn': ['#3f2333', '#2a2b41', '#0f2b2e'],
      'sl-eng': ['#251a22', '#1a1620', '#280f17']
    };
    let stops = palettes['sl-body'];
    for (const key of Object.keys(palettes)) {
      if (sleeve.classList.contains(key)) { stops = palettes[key]; break; }
    }
    const g = ctx.createLinearGradient(0, 0, 180, 1024);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(183,167,216,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 988, 988);

    const code = sleeve.querySelector('.scode');
    ctx.fillStyle = 'rgba(239,231,239,0.8)';
    ctx.font = '28px "DM Mono", monospace';
    ctx.textBaseline = 'top';
    if (code) {
      const spans = [...code.querySelectorAll('span')].map((s) => s.textContent.trim());
      ctx.fillText(spans[0] || '', 56, 52);
      ctx.textAlign = 'right';
      ctx.fillText(spans[1] || '', 968, 52);
      ctx.textAlign = 'left';
    }

    const title = (sleeve.querySelector('.stitle')?.innerText || '').trim();
    ctx.fillStyle = '#EFE7EF';
    ctx.font = '92px "Dreamer TM", "Pixelify Sans", monospace';
    ctx.textBaseline = 'bottom';
    const lines = title.split(/\n+/);
    let y = 960;
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], 56, y);
      y -= 100;
    }

    const tex = new THREE.CanvasTexture(canvas2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function makeJacket(sleeve, width, height) {
    const tex = paintJacketTexture(sleeve);
    const depth = Math.max(width, height) * 0.045;
    const geom = new THREE.BoxGeometry(width, height, depth);
    const paper = new THREE.MeshStandardMaterial({
      color: 0x1a161c, roughness: 0.82, metalness: 0.04
    });
    const front = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.55, metalness: 0.05
    });
    const mats = [paper, paper, paper, paper, front, paper];
    const mesh = new THREE.Mesh(geom, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* Measured from turntable 3d model.glb (Y-up, platter on -X, arm on +X). */
  const PLATTER_LOCAL = new THREE.Vector3(-0.13, 0.134, 0.0);

  async function run(link, disc, url) {
    busy = true;

    const sleeve = link.querySelector('.sleeve');
    const sleeveRect = sleeve ? sleeve.getBoundingClientRect() : disc.getBoundingClientRect();
    const discRect = disc.getBoundingClientRect();

    overlay.classList.add('tt-on', 'tt-dim');
    overlay.style.display = 'block';
    disc.classList.add('tt-hidden');

    let sleeveClone = null;
    if (sleeve && sleeveSlot) {
      sleeveClone = sleeve.cloneNode(true);
      sleeveClone.classList.add('tt-sleeve-clone');
      Object.assign(sleeveClone.style, {
        position: 'fixed',
        left: sleeveRect.left + 'px',
        top: sleeveRect.top + 'px',
        width: sleeveRect.width + 'px',
        height: sleeveRect.height + 'px',
        margin: '0',
        zIndex: '2',
        pointerEvents: 'none'
      });
      sleeveSlot.appendChild(sleeveClone);
      sleeve.style.visibility = 'hidden';
    }

    let models;
    try {
      models = await preload();
    } catch (e) {
      window.location.href = url;
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101719, 4.5, 11);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.05, 40);
    camera.position.set(0, 0.08, 2.55);
    const look = new THREE.Vector3(0, 0.02, 0);
    camera.lookAt(look);

    scene.add(new THREE.AmbientLight(0xb7a7d8, 0.7));
    scene.add(new THREE.HemisphereLight(0x6767a2, 0x101719, 0.45));

    const key = new THREE.SpotLight(0xfff4e8, 18, 16, THREE.MathUtils.degToRad(42), 0.55, 1.1);
    key.position.set(1.4, 3.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    scene.add(key);
    scene.add(key.target);

    const rim = new THREE.PointLight(0x8f8fd0, 7, 10);
    rim.position.set(-2.0, 1.6, 1.2);
    scene.add(rim);

    const fill = new THREE.PointLight(0xc9436a, 2.2, 8);
    fill.position.set(1.6, 0.6, 1.8);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshStandardMaterial({ color: 0x0c1012, roughness: 0.95, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    scene.add(floor);

    const vinylPivot = new THREE.Group();
    const vinylTilt = new THREE.Group();
    const vinyl = models.vinyl.clone(true);
    vinylTilt.add(vinyl);
    vinylPivot.add(vinylTilt);
    scene.add(vinylPivot);

    const jacketW = pixelsToWorld(sleeveRect.width, camera, camera.position.z);
    const jacketH = pixelsToWorld(sleeveRect.height, camera, camera.position.z);
    const jacket = sleeve ? makeJacket(sleeve, jacketW, jacketH) : null;
    if (jacket) {
      const jPos = ndcToPlane(
        sleeveRect.left + sleeveRect.width / 2,
        sleeveRect.top + sleeveRect.height / 2,
        camera, 0
      );
      jacket.position.copy(jPos);
      jacket.position.z = -0.02;
      scene.add(jacket);
    }

    const discCenter = ndcToPlane(
      discRect.left + discRect.width / 2,
      discRect.top + discRect.height / 2,
      camera, 0
    );
    const discSize = pixelsToWorld(Math.min(discRect.width, discRect.height), camera, camera.position.z);
    const startScale = discSize / 2;
    vinyl.scale.setScalar(startScale);
    vinylPivot.position.copy(discCenter);
    vinylPivot.position.z = 0.01;

    // Slide direction: out the right edge of the sleeve, in world units.
    const outDistance = Math.max(jacketW || discSize, discSize) * 1.12;

    const ttRoot = new THREE.Group();
    const turntable = models.turntable.clone(true);
    ttRoot.add(turntable);
    ttRoot.scale.setScalar(2.55);
    ttRoot.rotation.y = 0.42;
    const ttRest = new THREE.Vector3(0.72, -0.52, 0.12);
    ttRoot.position.copy(ttRest);
    scene.add(ttRoot);

    ttRoot.updateMatrixWorld(true);
    const platterWorld = PLATTER_LOCAL.clone().applyMatrix4(ttRoot.matrixWorld);
    platterWorld.y += 0.012;
    ttRoot.position.x = ttRest.x + 1.15;

    const playScale = 0.33 * ttRoot.scale.x;
    key.target.position.copy(platterWorld);

    const endCam = new THREE.Vector3(
      platterWorld.x + 0.55,
      platterWorld.y + 0.95,
      platterWorld.z + 1.55
    );
    const endLook = platterWorld.clone().add(new THREE.Vector3(0.05, 0.02, 0));

    let spinning = false;
    let spinVel = 0;
    const clock = new THREE.Clock();
    let raf = 0;
    let gone = false;

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (spinning) {
        spinVel = Math.min(spinVel + dt * 8.5, 3.6);
        vinylPivot.rotation.y += spinVel * dt;
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

    /* 0.00–1.20  vinyl slides out of the sleeve */
    tl.to(vinylPivot.position, {
      x: discCenter.x + outDistance,
      duration: 1.15,
      ease: 'power2.out'
    }, 0);

    /* 0.90–2.40  sleeve recedes, camera finds the turntable */
    if (sleeveClone) {
      tl.to(sleeveClone, {
        x: -Math.round(innerWidth * 0.22),
        y: -24,
        opacity: 0,
        duration: 0.85,
        ease: 'power2.in'
      }, 0.95);
    }
    tl.to(ttRoot.position, {
      x: ttRest.x,
      duration: 1.35,
      ease: 'power2.out'
    }, 1.05);

    if (jacket) {
      tl.to(jacket.position, {
        x: jacket.position.x - 1.4,
        y: jacket.position.y + 0.15,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.0);
      tl.to(jacket.rotation, {
        y: -0.55,
        z: 0.08,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.0);
      tl.to(jacket.scale, {
        x: 0.72, y: 0.72, z: 0.72,
        duration: 1.15,
        ease: 'power2.inOut'
      }, 1.0);
    }

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

    /* 1.35–3.15  vinyl flies to the platter and lays down */
    tl.to(vinylPivot.position, {
      x: platterWorld.x,
      y: platterWorld.y,
      z: platterWorld.z,
      duration: 1.55,
      ease: 'power3.inOut'
    }, 1.45);
    tl.to(vinylTilt.rotation, {
      x: -Math.PI / 2,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 1.65);
    tl.to(vinyl.scale, {
      x: playScale, y: playScale, z: playScale,
      duration: 1.35,
      ease: 'power2.inOut'
    }, 1.5);

    /* 3.15–5.00  playing */
    tl.add(() => {
      spinning = true;
      cueNeedle();
    }, 3.2);

    tl.to(camera.position, {
      y: endCam.y - 0.08,
      z: endCam.z - 0.12,
      duration: 1.7,
      ease: 'sine.inOut',
      onUpdate: () => camera.lookAt(look)
    }, 3.25);

    tl.to({}, { duration: Math.max(0.05, DURATION - 4.85) }, 4.85);

    overlay.addEventListener('transitionend', (e) => {
      if (e.target === overlay && e.propertyName === 'transform') go();
    }, { once: true });
    setTimeout(go, DURATION * 1000 + 700);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.release');
    if (!link) return;

    const url = link.getAttribute('href');
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!url || url === '#' || url.startsWith('#') || link.target === '_blank') return;

    const disc = link.querySelector('.disc');
    if (!disc || busy || REDUCED) return;

    e.preventDefault();
    run(link, disc, link.href);
  });
})();
