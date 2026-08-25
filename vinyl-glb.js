/* Shared GLB loaders for the vinyl record + turntable. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VINYL_GLB = new URL('./vinyl_record.glb', import.meta.url).href;
export const TURNTABLE_GLB = new URL('./turntable 3d model.glb', import.meta.url).href;

const loader = new GLTFLoader();

function loadGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
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

export async function loadVinylModel() {
  const gltf = await loadGlb(VINYL_GLB);
  return prepareVinyl(gltf.scene);
}

export async function loadTurntableModel() {
  const gltf = await loadGlb(TURNTABLE_GLB);
  return prepareTurntable(gltf.scene);
}
