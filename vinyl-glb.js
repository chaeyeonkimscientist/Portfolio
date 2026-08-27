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

/**
 * Asymmetric paper label so rotation is visible.
 * The disc mesh is circularly symmetric; a gold wedge + SIDE A is what reads as spin.
 */
export function makeVinylLabel(title) {
  const group = new THREE.Group();
  group.name = 'vinyl-label';

  const paper = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 64),
    new THREE.MeshBasicMaterial({
      color: 0x6a3aa8, side: THREE.DoubleSide, toneMapped: false
    })
  );
  paper.position.z = 0.0132;
  paper.renderOrder = 2;
  group.add(paper);

  const wedge = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 32, 0.12, Math.PI * 0.62),
    new THREE.MeshBasicMaterial({
      color: 0xd4b45c, side: THREE.DoubleSide, toneMapped: false
    })
  );
  wedge.position.z = 0.0134;
  wedge.renderOrder = 3;
  group.add(wedge);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(239,231,239,0.92)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#EFE7EF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 54px "Instrument Serif","Times New Roman",serif';
  ctx.fillText('SIDE A', 256, 168);

  const raw = String(title || 'LP').replace(/\s+/g, ' ').trim();
  const words = raw.split(' ').filter(Boolean);
  let lines = [raw];
  if (raw.length > 14 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  ctx.font = '600 32px "Helvetica Neue",Helvetica,Arial,sans-serif';
  const startY = 300 - (lines.length - 1) * 18;
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, 256, startY + i * 36));

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(256, 256, 26, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const text = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 48),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.DoubleSide,
      depthWrite: false, toneMapped: false
    })
  );
  text.position.z = 0.0136;
  text.renderOrder = 4;
  group.add(text);

  return group;
}

/** Cover GLB is a 1×1×0.05 jacket in XY, facing +Z. */
export const COVER_SIZE = 1;
/** Vinyl GLB is a disc of radius 1 in XY, facing +Z. */
export const VINYL_RADIUS = 1;
