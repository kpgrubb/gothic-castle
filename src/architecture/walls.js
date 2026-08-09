import * as THREE from 'three';
import { addBox } from './geom-utils.js';

// ---------------------------------------------------------------------------
// Perimeter walls of the cruciform hall (scene-contract.md §4).
//   South (z=+15): 3.0w x 4.5h round-arched DOORWAY at x=0 (open to sky).
//   North/apse (z=-20): 5w tracery WINDOW opening, sill 2.0 -> head 7.0.
//   West (x=-6): solid + clerestory window openings y[6,8].
//   East (x=+6): as west + a 7m-wide OPENING z[0,7] into the side chamber.
// Wall thickness 0.6, height 9. Interior faces sit exactly on the §4 lines so
// the nave stays x[-6,6] walkable. Lower wall bands are collided; high window
// heads / lintels are left un-collided (out of reach).
// ---------------------------------------------------------------------------

const T = 0.6;   // wall thickness
const H = 9;     // wall height
const XO = 6.6;  // outer x face of E/W walls (interior face at 6.0)

// Fill the spandrels of a round arch so the opening below reads as an arch.
function roundArchSpandrels(root, mat, xc, zc, thickness, halfW, springY, cols, name) {
  const apexY = springY + halfW;        // semicircular head
  const step = (2 * halfW) / cols;
  for (let i = 0; i < cols; i++) {
    const x = -halfW + step * (i + 0.5);
    const yc = springY + Math.sqrt(Math.max(0, halfW * halfW - x * x));
    const h = apexY - yc;
    if (h <= 0.02) continue;
    addBox(root, step * 1.02, h, thickness, mat, xc + x, (yc + apexY) / 2, zc, name, false);
  }
}

// ----------------------------------------------------------- south / entrance
function buildSouthWall(root, M) {
  const zc = 15.3;
  const hw = 1.5;          // doorway half-width (3.0 opening)
  const springY = 3.0, apexY = springY + hw; // 4.5 head
  // left + right jambs (full height), collided
  addBox(root, XO - hw, H, T, M.wall, (-XO - hw) / 2, H / 2, zc, 'arch_wall_south_l', true);
  addBox(root, XO - hw, H, T, M.wall, (XO + hw) / 2, H / 2, zc, 'arch_wall_south_r', true);
  // band above the arch apex
  addBox(root, 2 * hw, H - apexY, T, M.wall, 0, (apexY + H) / 2, zc, 'arch_wall_south_head', false);
  // arch
  roundArchSpandrels(root, M.stone, 0, zc, T, hw, springY, 6, 'arch_wall_south_arch');

  // ROSE WINDOW above the door — mirrors the exterior façade rose so it reads
  // from INSIDE too (this head band was solid, so the glowing rose only showed
  // on the outside). Emissive stained glass in a stone ring + cross mullions,
  // set just proud of the interior (nave) face and turned to face -Z / the nave.
  const roseY = 7.0, roseR = 1.2, rz = zc - T / 2 - 0.04; // interior face ≈ 14.96
  const glass = new THREE.MeshBasicMaterial({ color: 0xaec4dc, fog: false, side: THREE.DoubleSide });
  const rose = new THREE.Mesh(new THREE.CircleGeometry(roseR, 16), glass);
  rose.position.set(0, roseY, rz); rose.rotation.y = Math.PI; rose.name = 'arch_south_rose_glass';
  root.add(rose);
  const ring = new THREE.Mesh(new THREE.RingGeometry(roseR, roseR + 0.26, 16), M.stone);
  ring.position.set(0, roseY, rz - 0.02); ring.rotation.y = Math.PI; ring.name = 'arch_south_rose_ring';
  root.add(ring);
  const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2 * roseR, 0.1), M.stone);
  mullV.position.set(0, roseY, rz - 0.03); mullV.name = 'arch_south_rose_mull'; root.add(mullV);
  const mullH = new THREE.Mesh(new THREE.BoxGeometry(2 * roseR, 0.12, 0.1), M.stone);
  mullH.position.set(0, roseY, rz - 0.03); mullH.name = 'arch_south_rose_mull'; root.add(mullH);
}

// ------------------------------------------------------------- north / apse
function buildApseWall(root, M) {
  const zc = -20.3;
  const wHalf = 2.5;       // window half-width (5.0 opening)
  const sill = 2.0, head = 7.0;
  // solid lower band (full width) — collided
  addBox(root, 2 * XO, sill, T, M.wall, 0, sill / 2, zc, 'arch_wall_apse_lower', true);
  // side blocks flanking the window
  addBox(root, XO - wHalf, H - sill, T, M.wall, (-XO - wHalf) / 2, (sill + H) / 2, zc, 'arch_wall_apse_l', false);
  addBox(root, XO - wHalf, H - sill, T, M.wall, (XO + wHalf) / 2, (sill + H) / 2, zc, 'arch_wall_apse_r', false);
  // head band above the window
  addBox(root, 2 * wHalf, H - head, T, M.wall, 0, (head + H) / 2, zc, 'arch_wall_apse_head', false);

  // --- stone tracery inside the opening (mullions / transom / pointed head).
  const tz = zc + 0.16;   // front face of the opening (toward nave)
  const mullY = (sill + head) / 2 + 0.2;
  const mullH = head - sill - 0.4;
  for (const mx of [-1.66, 0, 1.66]) {
    addBox(root, 0.18, mullH, 0.24, M.stone, mx, mullY, tz, 'arch_tracery_mullion', false);
  }
  // transom
  addBox(root, 2 * wHalf, 0.18, 0.24, M.stone, 0, 4.6, tz, 'arch_tracery_transom', false);
  // pointed head: two angled bars meeting at the apex
  const barL = addBox(root, 0.16, 2.4, 0.24, M.stone, -1.2, 6.1, tz, 'arch_tracery_headL', false);
  barL.rotation.z = 0.62;
  const barR = addBox(root, 0.16, 2.4, 0.24, M.stone, 1.2, 6.1, tz, 'arch_tracery_headR', false);
  barR.rotation.z = -0.62;
}

// -------------------------------------------------- clerestory band builder
// Builds a wall side-band at y[y0,y1] running along z, leaving gaps (window
// openings) at the given z centres. Used for the clerestory bands.
function clerestoryBand(root, mat, xc, y0, y1, zStart, zEnd, winZ, winW, name) {
  const h = y1 - y0, yc = (y0 + y1) / 2;
  // sort windows and fill the gaps between them
  const wins = [...winZ].sort((a, b) => a - b);
  let cursor = zStart;
  const segs = [];
  for (const wz of wins) {
    const a = wz - winW / 2, b = wz + winW / 2;
    if (a > cursor) segs.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < zEnd) segs.push([cursor, zEnd]);
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    addBox(root, T, h, b - a, mat, xc, yc, (a + b) / 2, name, false);
  }
}

// --------------------------------------------------------------- west wall
// The lower band carries the NORDTURM seam doorway: a 1.2w x 2.2h opening at
// z=-17, floor y=+0.34 (chancel level). The band is split around it; the gap in
// z[-17.6,-16.4] is left un-collided so the player walks through into the tower.
const NORD_DOOR_Z = -17.0, NORD_DOOR_HZ = 0.6;
const NORD_DOOR_Y0 = 0.34, NORD_DOOR_Y1 = 2.54;

function buildWestWall(root, M) {
  const xc = -6.3;
  const z0 = -20.3, z1 = 15.3, len = z1 - z0, zmid = (z0 + z1) / 2;
  const dzN = NORD_DOOR_Z - NORD_DOOR_HZ;  // -17.6 (north jamb)
  const dzS = NORD_DOOR_Z + NORD_DOOR_HZ;  // -16.4 (south jamb)

  // lower solid band y[0,6], split into a north run and a south run around the
  // doorway — both collided (this is what the player walks into).
  addBox(root, T, 6, dzN - z0, M.wall, xc, 3, (z0 + dzN) / 2, 'arch_wall_west_lower_n', true);
  addBox(root, T, 6, z1 - dzS, M.wall, xc, 3, (dzS + z1) / 2, 'arch_wall_west_lower_s', true);
  // sill infill below the raised chancel floor (y[0,0.34]) — not collided
  addBox(root, T, NORD_DOOR_Y0, 2 * NORD_DOOR_HZ, M.wall, xc, NORD_DOOR_Y0 / 2, NORD_DOOR_Z, 'arch_wall_west_door_sill', false);
  // lintel band above the doorway head (y[2.54,6]) — not collided (out of reach)
  addBox(root, T, 6 - NORD_DOOR_Y1, 2 * NORD_DOOR_HZ, M.wall, xc, (NORD_DOOR_Y1 + 6) / 2, NORD_DOOR_Z, 'arch_wall_west_door_head', false);

  // upper band y[8,9]
  addBox(root, T, 1, len, M.wall, xc, 8.5, zmid, 'arch_wall_west_upper', false);
  // clerestory band y[6,8] with window openings
  clerestoryBand(root, M.wall, xc, 6, 8, z0, z1, [9, 3, -3, -9], 1.4, 'arch_wall_west_cler');
}

// --------------------------------------------------------------- east wall
function buildEastWall(root, M) {
  const xc = 6.3;
  // chamber opening z[0,7]; wall is split into a north run and a south run.
  const zN0 = -20.3, zN1 = 0;   // north run
  const zS0 = 7, zS1 = 15.3;    // south run
  // north run lower band (collided)
  addBox(root, T, 6, zN1 - zN0, M.wall, xc, 3, (zN0 + zN1) / 2, 'arch_wall_east_n_lower', true);
  addBox(root, T, 1, zN1 - zN0, M.wall, xc, 8.5, (zN0 + zN1) / 2, 'arch_wall_east_n_upper', false);
  clerestoryBand(root, M.wall, xc, 6, 8, zN0, zN1, [-9, -3], 1.4, 'arch_wall_east_n_cler');
  // south run lower band (collided)
  addBox(root, T, 6, zS1 - zS0, M.wall, xc, 3, (zS0 + zS1) / 2, 'arch_wall_east_s_lower', true);
  addBox(root, T, 1, zS1 - zS0, M.wall, xc, 8.5, (zS0 + zS1) / 2, 'arch_wall_east_s_upper', false);
  clerestoryBand(root, M.wall, xc, 6, 8, zS0, zS1, [11], 1.4, 'arch_wall_east_s_cler');
  // lintel over the chamber opening (y[7,9], z[0,7]) — walkable below, not collided
  addBox(root, T, 2, 7, M.wall, xc, 8, 3.5, 'arch_wall_east_lintel', false);
}

export function buildWalls(root, M) {
  buildSouthWall(root, M);
  buildApseWall(root, M);
  buildWestWall(root, M);
  buildEastWall(root, M);
}
