/* Shared GLB loaders for vinyl, turntable, and album covers. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VINYL_GLB = new URL('./vinyl_record.glb', import.meta.url).href;
export const TURNTABLE_GLB = new URL('./turntable 3d model.glb', import.meta.url).href;

export const COVER_GLBS = {
  'the_body_conducts': new URL('./the_body_conducts.glb', import.meta.url).href,
  'paramount_internship': new URL('./paramount_internship.glb', import.meta.url).href,
  'short_films': new URL('./short_films.glb', import.meta.url).href
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
  const url = COVER_GLBS[key];
  if (!url) return Promise.reject(new Error('unknown cover ' + key));
  return cached(url, prepareCover);
}

export function cloneAsset(root) {
  return root.clone(true);
}

/** Cover GLB is a 1×1×0.05 jacket in XY, facing +Z. */
export const COVER_SIZE = 1;
/** Vinyl GLB is a disc of radius 1 in XY, facing +Z. */
export const VINYL_RADIUS = 1;
