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

/** Asymmetric paper label so rotation is visible (the disc itself is circularly symmetric). */
export function makeVinylLabel(title) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6740a8';
  ctx.beginPath();
  ctx.arc(256, 256, 252, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239,231,239,0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(256, 256, 238, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#EFE7EF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(title || 'LP').split('\n').slice(0, 3);
  ctx.font = '600 42px "Dreamer TM","Instrument Serif",serif';
  const startY = 256 - (lines.length - 1) * 28;
  lines.forEach((line, i) => ctx.fillText(line.trim(), 256, startY + i * 56));

  ctx.strokeStyle = 'rgba(239,231,239,0.7)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(256, 118);
  ctx.lineTo(256, 148);
  ctx.stroke();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(256, 256, 22, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.5, metalness: 0.08,
    side: THREE.DoubleSide, depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.30, 48), mat);
  mesh.position.z = 0.0135;
  mesh.name = 'vinyl-label';
  mesh.renderOrder = 2;
  return mesh;
}

/** Cover GLB is a 1×1×0.05 jacket in XY, facing +Z. */
export const COVER_SIZE = 1;
/** Vinyl GLB is a disc of radius 1 in XY, facing +Z. */
export const VINYL_RADIUS = 1;

/** Cover GLB is a 1×1×0.05 jacket in XY, facing +Z. */
export const COVER_SIZE = 1;
/** Vinyl GLB is a disc of radius 1 in XY, facing +Z. */
export const VINYL_RADIUS = 1;
