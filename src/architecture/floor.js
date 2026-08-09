import * as THREE from 'three';
import { addMesh, addBox } from './geom-utils.js';
import { registerFloor } from '../core/scene.js';

// ---------------------------------------------------------------------------
// Floors: flagstone nave (x[-6,6] z[-15,15]) + raised chancel (z[-20,-15.3],
// +0.34m) reached by two 0.17m steps at z=-15.  scene-contract.md §4.
//
// THE UNDERCROFT: a stairwell descends from the chancel into the crypt, so a
// real hole is cut through the floor slab at x[-1.5,1.5], z[-16,-9] — the nave
// plane, the chancel platform, the chancel top and the two steps are all built
// as segments AROUND that opening (no floor left over the shaft). undercroft.js
// lays the descending treads + invisible ramp through the hole.
//
// Every walkable top surface is pushed via registerFloor so interaction can
// raycast down for eye height (the player stands on the nave, climbs the
// chancel, and walks down into the crypt). The raised chancel block + step
// risers keep their AABB colliders (read as an obstacle to climb).
// ---------------------------------------------------------------------------

const OPEN_HX = 1.5;     // half-width of the stair opening (x[-1.5,1.5])
const OPEN_ZN = -16;     // north edge of the opening (under the chancel lip)
const OPEN_ZS = -9;      // south edge of the opening (out in the nave)

export function buildFloors(root, M) {
  // === nave flagstone (y=0), split around the stair hole (x[-1.5,1.5] z[-15,-9])
  // south section: the bulk of the nave, x[-6,6] z[-9,15]
  const naveS = addMesh(root, new THREE.PlaneGeometry(12, 24), M.floor,
    'arch_floor_nave_s', [0, 0, 3], [-Math.PI / 2, 0, 0]);
  registerFloor(naveS);
  // north strips flanking the opening: z[-15,-9]
  const naveNW = addMesh(root, new THREE.PlaneGeometry(6 - OPEN_HX, 6), M.floor,
    'arch_floor_nave_nw', [-(6 + OPEN_HX) / 2, 0, -12], [-Math.PI / 2, 0, 0]);
  registerFloor(naveNW);
  const naveNE = addMesh(root, new THREE.PlaneGeometry(6 - OPEN_HX, 6), M.floor,
    'arch_floor_nave_ne', [(6 + OPEN_HX) / 2, 0, -12], [-Math.PI / 2, 0, 0]);
  registerFloor(naveNE);

  // === raised chancel platform (top y=0.34, z[-20,-15.3]), split around the
  //     opening's north bite (x[-1.5,1.5], z[-16,-15.3]).
  // left / right full-depth blocks (collided) + a middle block north of the shaft
  addBox(root, 6 - OPEN_HX, 0.34, 4.7, M.chancel, -(6 + OPEN_HX) / 2, 0.17, -17.65, 'arch_chancel_platform_l', true);
  addBox(root, 6 - OPEN_HX, 0.34, 4.7, M.chancel, (6 + OPEN_HX) / 2, 0.17, -17.65, 'arch_chancel_platform_r', true);
  // middle-north block: x[-1.5,1.5], z[-20,-16] (solid; the stairhead is at z=-16)
  addBox(root, 2 * OPEN_HX, 0.34, 4.0, M.chancel, 0, 0.17, -18.0, 'arch_chancel_platform_m', true);

  // chancel walking tops (flagstone map), matching the three blocks — registered
  const chL = addMesh(root, new THREE.PlaneGeometry(6 - OPEN_HX, 4.7), M.chancel,
    'arch_chancel_top_l', [-(6 + OPEN_HX) / 2, 0.341, -17.65], [-Math.PI / 2, 0, 0]);
  registerFloor(chL);
  const chR = addMesh(root, new THREE.PlaneGeometry(6 - OPEN_HX, 4.7), M.chancel,
    'arch_chancel_top_r', [(6 + OPEN_HX) / 2, 0.341, -17.65], [-Math.PI / 2, 0, 0]);
  registerFloor(chR);
  const chM = addMesh(root, new THREE.PlaneGeometry(2 * OPEN_HX, 4.0), M.chancel,
    'arch_chancel_top_m', [0, 0.341, -18.0], [-Math.PI / 2, 0, 0]);
  registerFloor(chM);

  // === two steps at the chancel edge (rise 0.17, tread 0.30), split L/R so the
  //     middle x[-1.5,1.5] stays open for the descent.
  for (const [sx, name] of [[-(6 + OPEN_HX) / 2, 'l'], [(6 + OPEN_HX) / 2, 'r']]) {
    // step 1 (nave side): top y=0.17
    addBox(root, 6 - OPEN_HX, 0.17, 0.30, M.chancel, sx, 0.085, -15.0 + 0.15, `arch_chancel_step1_${name}`, true);
    // step 2: top y=0.34
    addBox(root, 6 - OPEN_HX, 0.34, 0.30, M.chancel, sx, 0.17, -15.0 - 0.15, `arch_chancel_step2_${name}`, true);
  }

  return { OPEN_HX, OPEN_ZN, OPEN_ZS };
}
