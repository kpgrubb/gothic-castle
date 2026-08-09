import * as THREE from 'three';
import { registerAABB } from './geom-utils.js';

// ---------------------------------------------------------------------------
// Two column rows at x=+/-3.5, z = 11,7,3,-1,-5,-9,-13 (scene-contract.md §4).
// Octagonal piers ~0.9m across: base moulding (human-scale cue) -> shaft to the
// ~5m springing -> capital. Shared geometry, one collider box per pier.
// ---------------------------------------------------------------------------

const COL_X = [-3.5, 3.5];
const COL_Z = [11, 7, 3, -1, -5, -9, -13];

const SHAFT_R = 0.45;
const SHAFT_TOP = 5.0;
const BASE_R = 0.62, BASE_H = 0.5;
const CAP_R = 0.6, CAP_H = 0.55;

export function buildColumns(root, M) {
  const baseGeo = new THREE.CylinderGeometry(0.58, BASE_R, BASE_H, 8);
  const shaftGeo = new THREE.CylinderGeometry(SHAFT_R, 0.5, SHAFT_TOP - BASE_H, 8);
  const capGeo = new THREE.CylinderGeometry(CAP_R, 0.46, CAP_H, 8);

  for (const x of COL_X) {
    for (const z of COL_Z) {
      const g = new THREE.Group();
      g.name = 'arch_column';
      g.position.set(x, 0, z);

      const base = new THREE.Mesh(baseGeo, M.column);
      base.position.y = BASE_H / 2;
      base.name = 'arch_column_base';
      g.add(base);

      const shaft = new THREE.Mesh(shaftGeo, M.column);
      shaft.position.y = BASE_H + (SHAFT_TOP - BASE_H) / 2;
      shaft.name = 'arch_column_shaft';
      g.add(shaft);

      const cap = new THREE.Mesh(capGeo, M.column);
      cap.position.y = SHAFT_TOP + CAP_H / 2;
      cap.name = 'arch_column_capital';
      g.add(cap);

      root.add(g);
      // collider: box approximation of the round pier, full height to springing
      registerAABB(x, (SHAFT_TOP + CAP_H) / 2, z, 1.0, SHAFT_TOP + CAP_H, 1.0);
    }
  }
  return { COL_X, COL_Z, SHAFT_TOP };
}
