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
  body_says_otherwise: new URL('./covers/body_says_otherwise.webp', import.meta.url).href,
  synthetic_synesthesia: new URL('./covers/synthetic_synesthesia.webp', import.meta.url).href,
  paramount_internship: new URL('./covers/paramount_internship.webp', import.meta.url).href
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
  return root;
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
  return root;
}

export function loadVinylModel() {
  return cached(VINYL_GLB, prepareVinyl);
}

export function loadTurntableModel() {
  return cached(TURNTABLE_GLB, prepareTurntable);
}

export function loadCoverModel(key) {
  const imgUrl = COVER_IMAGES[key];
  if (imgUrl) {
    if (!cache.has(imgUrl)) cache.set(imgUrl, loadImageJacket(imgUrl));
    return cache.get(imgUrl);
  }
  const url = COVER_GLBS[key];
  if (!url) return Promise.reject(new Error('unknown cover ' + key));
  return cached(url, prepareCover);
}

function loadImageJacket(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
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
