import * as THREE from 'three';
import { addBox, addMesh } from './geom-utils.js';
import { registerFloor } from '../core/scene.js';

// ---------------------------------------------------------------------------
// Side chamber: x[6,13] z[0,8] (scene-contract.md §4). Reached from the nave
// through the east-wall opening (z[0,7], built in walls.js). Own flagstone
// floor, its own N/S/E walls, and a WINDOW opening on x=+13 (y[2,5], z[2,6])
// for the atmosphere agent's cold side-light. The abandoned table lives here
// (built in decay.js). Three collided walls.
// ---------------------------------------------------------------------------

const T = 0.6, H = 9;

export function buildSideChamber(root, M) {
  // flagstone floor  x[6,13] z[0,8]  (walkable — registered for eye-height raycast)
  const chamberFloor = addMesh(root, new THREE.PlaneGeometry(7, 8), M.floor, 'arch_floor_chamber',
    [9.5, 0.0, 4], [-Math.PI / 2, 0, 0]);
  registerFloor(chamberFloor);

  // north wall (z=0), spans x[6,13.6]
  addBox(root, 7.6, H, T, M.wall, 9.8, H / 2, -0.3, 'arch_chamber_wall_n', true);
  // south wall (z=8), spans x[6,13.6]
  addBox(root, 7.6, H, T, M.wall, 9.8, H / 2, 8.3, 'arch_chamber_wall_s', true);

  // east/far wall x=13 with a window opening y[2,5] z[2,6]
  const xc = 13.3;
  addBox(root, T, 2, 8, M.wall, xc, 1, 4, 'arch_chamber_wall_e_lower', true);   // sill band (collided)
  addBox(root, T, H - 5, 8, M.wall, xc, (5 + H) / 2, 4, 'arch_chamber_wall_e_upper', false); // head
  addBox(root, T, 3, 2, M.wall, xc, 3.5, 1, 'arch_chamber_wall_e_l', false);    // left of window
  addBox(root, T, 3, 2, M.wall, xc, 3.5, 7, 'arch_chamber_wall_e_r', false);    // right of window

  // window frame mullion (thin) so the opening reads as a window
  addBox(root, 0.22, 3, 0.18, M.stone, xc - 0.16, 3.5, 4, 'arch_chamber_mullion', false);
  addBox(root, 0.22, 0.18, 4, M.stone, xc - 0.16, 3.5, 4, 'arch_chamber_transom', false);

  return { window: { x: 13, y: [2, 5], z: [2, 6] } };
}
