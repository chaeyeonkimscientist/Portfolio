/* Shared GLB loaders for vinyl, turntable, and album covers. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VINYL_GLB = new URL('./vinyl_record.glb', import.meta.url).href;
export const TURNTABLE_GLB = new URL('./turntable 3d model.glb', import.meta.url).href;

export const COVER_GLBS = {
  'the_body_conducts': new URL('./the_body_conducts.glb', import.meta.url).href,
  'paramount_internship': new URL('./paramount_internship.glb', import.meta.url).href,
  'short_films': new URL('./short_films.glb', import.meta.url).href,
  'body_says_otherwise': new URL('./body_says_otherwise.glb', import.meta.url).href,
  'synthetic_synesthesia': new URL('./synthetic_synesthesia.glb', import.meta.url).href
};

export const COVER_IMAGES = {
  body_says_otherwise: new URL('./covers/body_says_otherwise.webp', import.meta.url).href + '?v=2',
  synthetic_synesthesia: new URL('./covers/synthetic_synesthesia.webp', import.meta.url).href + '?v=2',
  paramount_internship: new URL('./covers/paramount_internship.webp', import.meta.url).href + '?v=2'
};

const loader = new GLTFLoader();
const cache = new Map();

function loadGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function cached(url, prepare) {
  if (!cache.has(url)) {
    cache.set(url, loadGlb(url).then((gltf) => prepare(gltf.scene)));
  }
  return cache.get(url);
}

export function prepareVinyl(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry && !o.geometry.getAttribute('normal')) {
      o.geometry.computeVertexNormals();
    }
    // Source material uses a near-zero alpha baseColor — override so vertex
    // colors (grape label + charcoal grooves) actually read.
    o.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.16,
      side: THREE.DoubleSide
    });
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

export function prepareTurntable(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material) {
      o.material.envMapIntensity = 0.85;
      o.material.needsUpdate = true;
    }
  });
  splitTurntableArm(root);
  return root;
}

/**
 * Tripo baked the tonearm into the same mesh as the plinth. Cut it free and
 * hang it on a vertical pivot so the needle can swing onto the record.
 *
 * Rest pose (model space): arm along +Z at x≈0.35, pivot near (0.35, 0.13, -0.15),
 * headshell at z≈0.42. The clip at x>0.41 stays on the deck.
 */
function splitTurntableArm(root) {
  let mesh = null;
  root.traverse((o) => { if (!mesh && o.isMesh && o.geometry) mesh = o; });
  if (!mesh || !mesh.geometry.index) return;

  const geom = mesh.geometry;
  const pos = geom.getAttribute('position');
  const index = geom.index;
  const n = pos.count;
  const arm = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x > 0.30 && x < 0.40 && y > 0.13) arm[i] = 1;
  }
  let added = true;
  while (added) {
    added = false;
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      if (!(arm[a] || arm[b] || arm[c])) continue;
      for (const v of [a, b, c]) {
        if (arm[v]) continue;
        const x = pos.getX(v);
        const y = pos.getY(v);
        if (y < 0.058 || x < 0.215 || x > 0.408) continue;
        arm[v] = 1;
        added = true;
      }
    }
  }

  let armCount = 0;
  for (let i = 0; i < n; i++) if (arm[i]) armCount++;
  if (armCount < 2000) return;

  const armTris = [];
  const baseTris = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const votes = (arm[a] ? 1 : 0) + (arm[b] ? 1 : 0) + (arm[c] ? 1 : 0);
    if (votes >= 2) armTris.push(a, b, c);
    else baseTris.push(a, b, c);
  }
  if (armTris.length < 600) return;

  const hinge = new THREE.Vector3();
  const needle = new THREE.Vector3();
  let hingeN = 0;
  let needleZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (!arm[i]) continue;
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x > 0.32 && x < 0.39 && z > -0.20 && z < -0.10) {
      hinge.x += x; hinge.y += y; hinge.z += z;
      hingeN++;
    }
    if (z > needleZ) {
      needleZ = z;
      needle.set(x, y, z);
    }
  }
  if (hingeN) hinge.multiplyScalar(1 / hingeN);
  else hinge.set(0.353, 0.133, -0.152);

  const armGeom = compactGeometry(geom, armTris);
  const baseGeom = compactGeometry(geom, baseTris);
  const mat = mesh.material;

  const baseMesh = new THREE.Mesh(baseGeom, mat);
  baseMesh.name = 'tt-plinth';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const armMesh = new THREE.Mesh(armGeom, mat);
  armMesh.name = 'tt-arm';
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;

  const armHold = new THREE.Group();
  armHold.name = 'tt-arm-hold';
  armHold.position.copy(hinge).negate();
  armHold.add(armMesh);

  const armPivot = new THREE.Group();
  armPivot.name = 'tt-arm-pivot';
  armPivot.position.copy(hinge);
  armPivot.userData.hinge = hinge.clone();
  armPivot.userData.needle = needle.clone();
  armPivot.add(armHold);

  const parent = mesh.parent || root;
  parent.remove(mesh);
  parent.add(baseMesh);
  parent.add(armPivot);
  geom.dispose();
  console.log('[tt] arm split', armCount, 'hinge', hinge.toArray().map((n) => n.toFixed(3)).join(','));
}

function compactGeometry(src, triVerts) {
  const map = new Map();
  const remap = [];
  for (let i = 0; i < triVerts.length; i++) {
    const v = triVerts[i];
    let ni = map.get(v);
    if (ni === undefined) {
      ni = map.size;
      map.set(v, ni);
    }
    remap.push(ni);
  }
  const g = new THREE.BufferGeometry();
  const attrs = src.attributes;
  for (const name in attrs) {
    const attr = attrs[name];
    const item = attr.itemSize;
    const out = new Float32Array(map.size * item);
    map.forEach((ni, vi) => {
      out[ni * item] = attr.getX(vi);
      if (item > 1) out[ni * item + 1] = attr.getY(vi);
      if (item > 2) out[ni * item + 2] = attr.getZ(vi);
      if (item > 3) out[ni * item + 3] = attr.getW(vi);
    });
    g.setAttribute(name, new THREE.BufferAttribute(out, item, attr.normalized));
  }
  g.setIndex(remap.length > 65535
    ? new THREE.Uint32BufferAttribute(remap, 1)
    : new THREE.Uint16BufferAttribute(remap, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function prepareCover(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const geom = o.geometry;
    const hasColor = !!(geom && geom.getAttribute('color'));
    const mat = o.material ? o.material.clone() : new THREE.MeshStandardMaterial();
    mat.side = THREE.DoubleSide;
    mat.roughness = mat.roughness ?? 0.72;
    mat.metalness = mat.metalness ?? 0.04;
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (hasColor) {
      mat.vertexColors = true;
      mat.color.set(0xffffff);
    }
    o.material = mat;
  });
  const wrap = new THREE.Group();
  wrap.add(root);
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= center.z;
  const face = Math.max(size.x, size.y, 1e-4);
  wrap.scale.setScalar(1 / face);
  return wrap;
}

export function loadVinylModel() {
  return cached(VINYL_GLB, prepareVinyl);
}

export function loadTurntableModel() {
  return cached(TURNTABLE_GLB, prepareTurntable);
}

export function loadCoverModel(key) {
  if (key === 'other') {
    if (!cache.has('other')) cache.set('other', Promise.resolve(makeOtherCover()));
    return cache.get('other');
  }
  const url = COVER_GLBS[key];
  if (!url) return Promise.reject(new Error('unknown cover ' + key));
  return cached(url, prepareCover);
}

export const OTHER_DEPTH = 0.05;

export function makeOtherCover() {
  const depth = OTHER_DEPTH;
  const front = new THREE.MeshStandardMaterial({
    map: jacketCanvasTexture(drawOtherFront),
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04
  });
  const back = new THREE.MeshStandardMaterial({
    color: 0x1a161c, roughness: 0.86, metalness: 0.02
  });
  const edge = new THREE.MeshStandardMaterial({
    color: 0x2a1c24, roughness: 0.7, metalness: 0.05
  });
  const spine = new THREE.MeshStandardMaterial({
    map: jacketCanvasTexture(drawOtherSpine, 256, 1024),
    color: 0xffffff,
    roughness: 0.64,
    metalness: 0.04
  });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, depth),
    [edge, spine, edge, edge, front, back]
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

function jacketCanvasTexture(draw, w = 1024, h = 1024) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function drawOtherFront(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
  g.addColorStop(0, '#3a2832');
  g.addColorStop(0.55, '#241c24');
  g.addColorStop(1, '#2a1820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(239,231,239,0.82)';
  ctx.font = '600 96px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Other', w * 0.08, h * 0.9);
}

function drawOtherSpine(ctx, w, h) {
  ctx.fillStyle = '#241820';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#efe7ef';
  ctx.font = '600 72px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OTHER', 0, 0);
  ctx.restore();
}

function loadImageJacket(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        const edge = new THREE.MeshStandardMaterial({
          color: 0x171410, roughness: 0.78, metalness: 0.04
        });
        const front = new THREE.MeshStandardMaterial({
          map: tex, color: 0xffffff, roughness: 0.68, metalness: 0.03
        });
        const back = new THREE.MeshStandardMaterial({
          color: 0x1b1814, roughness: 0.86, metalness: 0.02
        });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 0.05),
          [edge, edge, edge, edge, front, back]
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const group = new THREE.Group();
        group.add(mesh);
        resolve(group);
      },
      undefined,
      reject
    );
  });
}

export function cloneAsset(root) {
  return root.clone(true);
}

export const LABEL_URLS = {
  the_body_conducts: new URL('./vinyl-labels/the_body_conducts.webp', import.meta.url).href,
  paramount_internship: new URL('./vinyl-labels/paramount_internship.webp', import.meta.url).href,
  short_films: new URL('./vinyl-labels/short_films.webp', import.meta.url).href,
  body_says_otherwise: new URL('./vinyl-labels/body_says_otherwise.webp', import.meta.url).href,
  synthetic_synesthesia: new URL('./vinyl-labels/synthetic_synesthesia.webp', import.meta.url).href
};

export const PROJECT_LABEL_KEYS = {
  'body-conducts': 'the_body_conducts',
  paramount: 'paramount_internship',
  'short-films': 'short_films',
  'body-says-otherwise': 'body_says_otherwise',
  'synthetic-synesthesia': 'synthetic_synesthesia'
};

const labelTexCache = new Map();

function loadLabelTexture(url) {
  if (!labelTexCache.has(url)) {
    labelTexCache.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = () => reject(new Error('label image failed: ' + url));
      img.src = url;
    }));
  }
  return labelTexCache.get(url);
}

/**
 * Circular label disc for the vinyl center. Texture only — no type.
 */
export function makeVinylLabel(key) {
  const group = new THREE.Group();
  group.name = 'vinyl-label';

  const mat = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false
  });
  const paper = new THREE.Mesh(new THREE.CircleGeometry(0.36, 64), mat);
  paper.position.z = 0.0132;
  paper.renderOrder = 2;
  group.add(paper);

  const url = LABEL_URLS[key];
  if (url) {
    loadLabelTexture(url).then((tex) => {
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }).catch((err) => {
      console.warn('[vinyl] label texture failed', key, err);
    });
  }

  return group;
}

/** Cover GLB is a 1×1×0.05 jacket in XY, facing +Z. */
export const COVER_SIZE = 1;
/** Vinyl GLB is a disc of radius 1 in XY, facing +Z. */
export const VINYL_RADIUS = 1;
