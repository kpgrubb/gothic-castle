import * as THREE from 'three';
import { addMesh } from './geom-utils.js';

// ---------------------------------------------------------------------------
// Low-poly pointed vault over the nave: springing y~5, crown y~9
// (scene-contract.md §4). Parametric shell (one BufferGeometry) with baked
// dark-crown vertex colours for value structure, plus dull terracotta ribs.
// One bay on the WEST side (z[-11,-6]) is collapsed -> an open hole that lets a
// cold shaft down onto the debris cluster (atmosphere fills the shaft/light).
// No colliders (it is overhead).
// ---------------------------------------------------------------------------

const SPRING_Y = 5.0;
const CROWN_Y = 9.0;
const HALF_W = 6.0;

// pointed profile: cusp at the crown (exponent < 1 => pointed, not round)
function archY(x) {
  const t = 1 - Math.abs(x) / HALF_W;
  return SPRING_Y + (CROWN_Y - SPRING_Y) * Math.pow(Math.max(0, t), 0.7);
}

// collapse hole test (west half, one bay deep)
function collapsed(cx, cz) {
  return cx < 0 && cz > -11 && cz < -6;
}

const COL_Z = [11, 7, 3, -1, -5, -9, -13];

export function buildVault(root, M) {
  buildShell(root, M);
  buildRibs(root, M);
}

function buildShell(root, M) {
  const Nu = 13, Nv = 23;
  const xs = [], zs = [];
  for (let i = 0; i < Nu; i++) xs.push(-HALF_W + (2 * HALF_W) * i / (Nu - 1));
  for (let j = 0; j < Nv; j++) zs.push(-20 + 35 * j / (Nv - 1));

  const pos = [], col = [], idx = [];
  const cLow = new THREE.Color(0x6e3b2a);   // lit springing (terracotta)
  const cHigh = new THREE.Color(0x140d09);  // near-black crown
  const tmp = new THREE.Color();

  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      const y = archY(xs[i]);
      pos.push(xs[i], y, zs[j]);
      const t = (y - SPRING_Y) / (CROWN_Y - SPRING_Y);
      tmp.copy(cLow).lerp(cHigh, t);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const at = (i, j) => i * Nv + j;
  for (let i = 0; i < Nu - 1; i++) {
    for (let j = 0; j < Nv - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      if (collapsed(cx, cz)) continue;
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      idx.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  addMesh(root, geo, M.vault, 'arch_vault_shell');
}

function pushQuad(arr, p0, p1, p2, p3) {
  arr.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
}

function buildRibs(root, M) {
  const Nu = 13;
  const xs = [];
  for (let i = 0; i < Nu; i++) xs.push(-HALF_W + (2 * HALF_W) * i / (Nu - 1));
  const pos = [];

  // transverse ribs at each bay division
  for (const zr of COL_Z) {
    for (let i = 0; i < Nu - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      if (collapsed(cx, zr)) continue;
      const y0 = archY(xs[i]) - 0.06, y1 = archY(xs[i + 1]) - 0.06;
      pushQuad(pos,
        [xs[i], y0, zr - 0.15], [xs[i + 1], y1, zr - 0.15],
        [xs[i + 1], y1, zr + 0.15], [xs[i], y0, zr + 0.15]);
    }
  }
  // longitudinal ridge rib along the crown (x=0)
  const zs = [];
  for (let j = 0; j <= 22; j++) zs.push(-20 + 35 * j / 22);
  const yr = CROWN_Y - 0.05;
  for (let j = 0; j < zs.length - 1; j++) {
    pushQuad(pos,
      [-0.16, yr, zs[j]], [0.16, yr, zs[j]],
      [0.16, yr, zs[j + 1]], [-0.16, yr, zs[j + 1]]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  addMesh(root, geo, M.vaultRib, 'arch_vault_ribs');
}
