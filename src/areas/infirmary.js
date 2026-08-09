import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';

// ===========================================================================
// THE INFIRMARY  (self-contained island area — world-bible §8 CORPSE DOCTRINE
// Middle / month 13: "In beds, in the infirmary, laid out with hands composed,
// sheets drawn — Care, until care ran out." §6 voices: Sister Klara the
// infirmarian, Magister Cyriak Bohn the physician. §3 Gen 5 Konrad: plain,
// dark stone, the works that keep a castle alive.)
//
// Built far out on its own island centred C = (-100, 0, 0), no overlap with the
// great hall. A plain beamed sick-ward ~12 (x) × 18 (z): two rows of low beds
// along the long walls, most made and empty, several holding a composed
// shrouded body (plain, NOT gory — one bared hand blackened at the tips). A
// physician's table by the door with basins, a candle, papers. Vinegar bowls
// gone to scum + scattered lime + herb bundles at the threshold. Drifts of dead
// flies at the sills, in the corners, in the empty basins — never labelled. One
// dark stain worked into the floor by a bed-foot, ringed with the pale marks of
// a brush that gave out. Care that was overwhelmed.
//
// Builds geometry + colliders + walkable floor + its OWN local lighting + two
// readable leaves + three examinable props. Fully isolated: local point lights
// only (no global ambient added), so the great hall's tuning is untouched.
// Every named object is prefixed `inf_`.
// ===========================================================================

// --- Island centre + room shell (metres) -----------------------------------
const CX = -100, CZ = 0;                 // island centre
const HX = 6, HZ = 9;                    // interior half-extents → 12 × 18
const X0 = CX - HX, X1 = CX + HX;        // interior x faces  [-106, -94]
const Z0 = CZ - HZ, Z1 = CZ + HZ;        // interior z faces  [-9, 9]
const T = 0.6;                           // wall thickness
const WALL_H = 4.2;                       // top of the perimeter walls
const CEIL_Y = 4.3;                       // plain beamed ceiling

// --- Door (plain ward door in the south wall, z = +9) -----------------------
const DOOR_CX = CX;                       // centred on the island axis
const DOOR_W = 1.6, DOOR_H = 2.4;
const DOOR_X0 = DOOR_CX - DOOR_W / 2;     // -100.8
const DOOR_X1 = DOOR_CX + DOOR_W / 2;     // -99.2

// --- Beds ------------------------------------------------------------------
const BED_W = 0.95, BED_L = 2.05;         // width (x) × length (z)
const BED_FRAME_TOP = 0.40;
const BED_MATT_TOP = 0.50;                // mattress top surface
const BED_SHEET_TOP = 0.52;               // made-bed sheet top (marker rests here)
const WEST_X = -105.0, EAST_X = -95.0;    // row x-centres (against the long walls)
const BED_Z = [-6, -3, 0, 3, 6];          // five beds per row
// which beds hold a composed body (the rest are made + empty)
const WEST_BODY = new Set([-6, 0, 6]);
const EAST_BODY = new Set([-3, 3]);

// --- Physician's table (by the door) ---------------------------------------
const TABLE_CX = -98, TABLE_CZ = 7;
const TABLE_TOP_Y = 0.75;                 // table-top surface

// --- Entry point (just inside the doorway, facing into the ward, -Z) --------
export const INFIRMARY_ENTRY = { position: new THREE.Vector3(CX, 0, 8), yaw: Math.PI };

// --- Windows (cold sources, high on the west wall) --------------------------
const WINDOW_Z = [-3, 4];
const WINDOW_SILL = 2.6, WINDOW_HEAD = 3.8, WINDOW_W = 1.0;

// ---------------------------------------------------------------------------
// Small deterministic RNG so the scatter (flies, lime) is stable across loads.
// ---------------------------------------------------------------------------
let _seed = 0x1a2b3c;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// ---------------------------------------------------------------------------
// Geometry helpers.
// ---------------------------------------------------------------------------
function pushBox(arr, cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const q = (a, b, c, e) => arr.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[e]);
  q(1, 2, 3, 0); q(4, 7, 6, 5);
  q(0, 4, 5, 1); q(3, 2, 6, 7);
  q(0, 3, 7, 4); q(1, 5, 6, 2);
}

function mergedMesh(root, positions, mat, name) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  root.add(m);
  return m;
}

// A single box mesh; optionally register a matching world-space AABB collider.
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (ry) m.rotation.y = ry;
  m.name = name;
  root.add(m);
  if (collide) {
    registerCollider(new THREE.Box3(
      new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
      new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
  }
  return m;
}

// Explicit collider box (used where the collider differs from the visible mesh,
// e.g. low beds that must still stop the player).
function collideBox(cx, cy, cz, w, h, d) {
  registerCollider(new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
}

// ---------------------------------------------------------------------------
// Tiny canvas texture — dark Konrad stone speckle. Crunched to PS1 nearest.
// (Called at runtime in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function makeStoneTexture(base, speck) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 340; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.15, 0.5);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function makeMaterials() {
  const stoneTex = makeStoneTexture('#2b2f36', '#1b1e26');
  const floorTex = makeStoneTexture('#24272e', '#15171d');
  stoneTex.repeat.set(3, 2);
  floorTex.repeat.set(4, 6);

  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));

  return {
    wall: lambert({ color: 0x4a4e56, map: stoneTex }),
    floor: lambert({ color: 0x3a3d44, map: floorTex }),
    darkStone: lambert({ color: 0x23262d }),
    ceiling: lambert({ color: 0x1b1e26 }),
    beam: lambert({ color: 0x3a2e22 }),
    timber: lambert({ color: 0x4a3a2a }),            // bed frames
    linen: lambert({ color: 0xa9a89e }),             // mattress / sheets (cool pale)
    shroud: lambert({ color: 0x938f84 }),            // drawn sheet over a body
    flesh: lambert({ color: 0x8a7f6d }),             // a bared hand
    black: lambert({ color: 0x14100e }),             // blackened fingertips
    metal: lambert({ color: 0x55585c }),             // basins
    wax: lambert({ color: 0xcbb89a }),               // candle stub
    scum: lambert({ color: 0x3f4a3a }),              // vinegar gone to scum
    lime: lambert({ color: 0xcfcabb }),              // scattered lime
    herb: lambert({ color: 0x4c5f4a }),              // herb bundles
    fly: lambert({ color: 0x17140f }),               // drifts of dead flies
    stain: basic({ color: 0x1c1815 }),               // the stain (unlit, flat dark)
    scrub: basic({ color: 0x544f47, transparent: true, opacity: 0.35 }),
    flame: basic({ color: 0xffd9a0, fog: false }),   // candle flame (visible source)
    glass: basic({ color: 0x9fb0c4, fog: false, side: THREE.DoubleSide }), // window glow
    parchment: basic({ color: 0xb7a06a, side: THREE.DoubleSide }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildInfirmary(world) {
  const root = new THREE.Group();
  root.name = 'inf_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildShell(root, M);
  buildCeiling(root, M);
  buildBeds(root, M);
  buildBodies(root, M);
  buildTable(root, M);
  buildThreshold(root, M);
  buildFlies(root, M);
  buildStain(root, M);
  buildLighting(root, M, world);
  buildDocuments(root, M, world);
  buildProps(world);

  return INFIRMARY_ENTRY;
}

// -------------------------------------------------------------------- shell
function buildShell(root, M) {
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HX, 2 * HZ), M.floor);
  floor.name = 'inf_floor';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);

  const yc = WALL_H / 2;
  // north wall (z = -9)
  addBox(root, M.wall, CX, yc, Z0 - T / 2, 2 * HX + 2 * T, WALL_H, T, 'inf_wall_n', true);
  // west wall (x = -106) — carries the two high windows (openings above the band)
  addBox(root, M.wall, X0 - T / 2, yc, CZ, T, WALL_H, 2 * HZ + 2 * T, 'inf_wall_w', true);
  // east wall (x = -94)
  addBox(root, M.wall, X1 + T / 2, yc, CZ, T, WALL_H, 2 * HZ + 2 * T, 'inf_wall_e', true);

  // south wall (z = +9) split around the doorway
  const sLeftW = (DOOR_X0) - (X0 - T);       // from outer corner to door jamb
  addBox(root, M.wall, ((X0 - T) + DOOR_X0) / 2, yc, Z1 + T / 2, sLeftW, WALL_H, T, 'inf_wall_s_l', true);
  const sRightW = (X1 + T) - (DOOR_X1);
  addBox(root, M.wall, (DOOR_X1 + (X1 + T)) / 2, yc, Z1 + T / 2, sRightW, WALL_H, T, 'inf_wall_s_r', true);
  // lintel over the door (above the collision band — visual only)
  addBox(root, M.wall, DOOR_CX, (DOOR_H + WALL_H) / 2, Z1 + T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'inf_wall_s_lintel', false);
  // plain stone jambs framing the opening
  addBox(root, M.darkStone, DOOR_X0 - 0.05, DOOR_H / 2, Z1 + T / 2, 0.12, DOOR_H, T + 0.02, 'inf_door_jamb_l', false);
  addBox(root, M.darkStone, DOOR_X1 + 0.05, DOOR_H / 2, Z1 + T / 2, 0.12, DOOR_H, T + 0.02, 'inf_door_jamb_r', false);

  // window recesses on the west wall (dark reveals behind the glow planes)
  for (const wz of WINDOW_Z) {
    addBox(root, M.darkStone, X0 - T / 2, (WINDOW_SILL + WINDOW_HEAD) / 2, wz,
      T + 0.04, WINDOW_HEAD - WINDOW_SILL, WINDOW_W + 0.16, 'inf_window_reveal', false);
  }
}

// ------------------------------------------------------------------ ceiling
function buildCeiling(root, M) {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * HX + 2 * T, 2 * HZ + 2 * T), M.ceiling);
  ceil.name = 'inf_ceiling';
  ceil.position.set(CX, CEIL_Y, CZ);
  ceil.rotation.x = Math.PI / 2;      // faces down
  root.add(ceil);

  // plain cross-beams running x, spaced down the length
  const beams = [];
  for (let z = Z0 + 1.5; z <= Z1 - 1.5; z += 3) {
    pushBox(beams, CX, CEIL_Y - 0.18, z, 2 * HX, 0.22, 0.22);
  }
  // two purlins running z
  pushBox(beams, CX - 3, CEIL_Y - 0.30, CZ, 0.18, 0.18, 2 * HZ);
  pushBox(beams, CX + 3, CEIL_Y - 0.30, CZ, 0.18, 0.18, 2 * HZ);
  mergedMesh(root, beams, M.beam, 'inf_beams');
}

// --------------------------------------------------------------------- beds
function buildBeds(root, M) {
  for (const bz of BED_Z) {
    buildBed(root, M, WEST_X, bz, WEST_BODY.has(bz));
    buildBed(root, M, EAST_X, bz, EAST_BODY.has(bz));
  }
}

function buildBed(root, M, bx, bz, hasBody) {
  // low timber frame
  addBox(root, M.timber, bx, 0.20, bz, BED_W, BED_FRAME_TOP, BED_L, 'inf_bed_frame', false);
  // mattress / pallet (top y = 0.50)
  addBox(root, M.linen, bx, BED_MATT_TOP - 0.05, bz, BED_W - 0.08, 0.10, BED_L - 0.08, 'inf_bed_pallet', false);

  if (hasBody) {
    // a composed body: sheet drawn to the chest, a low still mound. Plain.
    // torso/legs mound under the shroud
    addBox(root, M.shroud, bx, BED_MATT_TOP + 0.09, bz + 0.15, BED_W - 0.16, 0.18, BED_L - 0.55, 'inf_body_shroud', false);
    // the head, sheet drawn over it, slightly proud at the wall end (-z)
    addBox(root, M.shroud, bx, BED_MATT_TOP + 0.11, bz - 0.78, BED_W - 0.30, 0.22, 0.34, 'inf_body_head', false);
    // hands composed on the breast (a small fold in the sheet)
    addBox(root, M.shroud, bx, BED_MATT_TOP + 0.17, bz - 0.28, 0.24, 0.10, 0.20, 'inf_body_hands', false);
    // one bared hand laid on the sheet, fingertips gone black (the one detail)
    const handX = bx + (bx < CX ? 0.30 : -0.30);   // toward the aisle
    addBox(root, M.flesh, handX, BED_MATT_TOP + 0.08, bz - 0.05, 0.10, 0.05, 0.20, 'inf_body_hand', false);
    addBox(root, M.black, handX, BED_MATT_TOP + 0.085, bz + 0.07, 0.10, 0.052, 0.06, 'inf_body_fingertips', false);
  } else {
    // made and empty: a flat drawn sheet, top y = 0.52
    addBox(root, M.linen, bx, BED_SHEET_TOP - 0.02, bz, BED_W - 0.04, 0.04, BED_L - 0.04, 'inf_bed_sheet', false);
    // a plain bolster at the wall end
    addBox(root, M.linen, bx, BED_MATT_TOP + 0.07, bz - 0.85, BED_W - 0.14, 0.14, 0.22, 'inf_bed_bolster', false);
  }

  // collider: taller than the visible frame so the player is actually stopped
  // at the bedside (band starts at knee height 0.5). One box per bed.
  collideBox(bx, 0.5, bz, BED_W, 1.0, BED_L);
}

// ------------------------------------------------------------------- bodies
// Plague victims — the ones past composing. Three lie uncovered ON empty beds
// (the linen went to someone with more need), two collapsed on the FLOOR
// between the beds ("laid out in rows, then not laid out at all"). Crude, dark,
// merged boxes. §8 plague grammar: hands & feet gone black at the terminal
// segments; three dried streaks from the face; the stain worked into the stone
// or the pallet beneath, with the brush-marks that gave out beside it; drifts of
// dead flies over them; futile lime scattered close. Each rests on a real
// surface — bed mattress top (0.50) or the floor (0). Poses vary by index only.
const BED_CORPSES = [
  { x: EAST_X, z: -6, axis: 'z', surf: BED_MATT_TOP, i: 0 },
  { x: EAST_X, z: 0,  axis: 'z', surf: BED_MATT_TOP, i: 1 },
  { x: WEST_X, z: -3, axis: 'z', surf: BED_MATT_TOP, i: 2 },
];
const FLOOR_BODIES = [
  { x: -103.6, z: -1.5, axis: 'z', surf: 0, i: 3 },
  { x: -101.5, z: 4.5,  axis: 'x', surf: 0, i: 4 },
];

// Append one crude corpse to the shared flesh / gown / black vertex arrays.
// Head lies toward -u (the wall end on a bed); u runs head→foot, v runs across.
function pushCorpse(F, G, B, ax, az, surfY, axis, i) {
  const side  = (i % 2) ? 1 : -1;
  const splay = 0.02 + 0.03 * (i % 3);        // an arm falling to the side
  const loll  = ((i % 2) ? 1 : -1) * 0.05;    // head lolled to one side
  const bend  = (i % 4 === 0) ? 0.12 : 0.0;   // one knee drawn up
  // local (u along body, v across) → world box, matched to the body's axis
  const put = (arr, u, v, y, along, across, h) => {
    if (axis === 'x') pushBox(arr, ax + u, y, az + v, along, h, across);
    else              pushBox(arr, ax + v, y, az + u, across, h, along);
  };
  const armOut = -(0.24 + splay) * (side > 0 ? 1.4 : 1.0);
  put(F, -0.60, loll, surfY + 0.10, 0.24, 0.24, 0.20);              // head
  put(G, -0.12, 0,    surfY + 0.11, 0.70, 0.40, 0.22);             // torso / gown
  put(F, -0.05,  (0.24 + splay), surfY + 0.05, 0.55, 0.10, 0.10);  // arm, at side
  put(F, -0.05,  armOut,         surfY + 0.05, 0.55, 0.10, 0.10);  // arm, flung out
  put(B,  0.24,  (0.24 + splay), surfY + 0.045, 0.12, 0.10, 0.08); // hand, blackened
  put(B,  0.24,  armOut,         surfY + 0.045, 0.12, 0.10, 0.08); // hand, blackened
  put(F,  0.45,          0.10,         surfY + 0.065, 0.60, 0.13, 0.13); // leg
  put(F,  0.45 - bend, -0.10 - bend,   surfY + 0.065, 0.60 - bend, 0.13, 0.13); // leg, knee up
  put(B,  0.80,          0.10,         surfY + 0.045, 0.14, 0.12, 0.08); // foot, blackened
  put(B,  0.80 - 2 * bend, -0.10 - bend, surfY + 0.045, 0.14, 0.12, 0.08); // foot, blackened
  // three dried streaks from the face, dark — running down toward the chin
  for (const dv of [-0.05, 0.0, 0.05]) put(B, -0.46, loll + dv, surfY + 0.205, 0.14, 0.02, 0.012);
}

function buildBodies(root, M) {
  const F = [], G = [], B = [];
  const ALL = [...BED_CORPSES, ...FLOOR_BODIES];
  for (const b of ALL) pushCorpse(F, G, B, b.x, b.z, b.surf, b.axis, b.i);
  mergedMesh(root, F, M.flesh, 'inf_corpse_flesh');
  mergedMesh(root, G, M.shroud, 'inf_corpse_garb');
  mergedMesh(root, B, M.black, 'inf_corpse_black');

  // a flat dark mark under each body; scrub-marks beside the floor stains
  // (the brush went at the stone and gave out first). Scrub detail over stain.
  const flat = (mat, x, y, z, w, d, name) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    p.position.set(x, y, z); p.rotation.x = -Math.PI / 2; p.name = name;
    root.add(p);
  };
  // bed corpses: the pallet beneath is marked where the body has lain
  for (const b of BED_CORPSES) flat(M.stain, b.x, b.surf + 0.005, b.z + 0.1, 0.42, 0.95, 'inf_corpse_mark');
  // floor bodies: stain worked into the stone + the abandoned brush-marks
  for (const b of FLOOR_BODIES) {
    const lz = b.axis === 'z';
    flat(M.stain, b.x, 0.02, b.z + (lz ? 0.15 : 0), lz ? 0.7 : 1.3, lz ? 1.3 : 0.7, 'inf_corpse_stain');
    // two faint scrub-streaks that stop short beside the stain
    for (const s of [-1, 1]) {
      const sx = b.x + (lz ? s * 0.55 : 0.35);
      const sz = b.z + (lz ? 0.1 : s * 0.55);
      flat(M.scrub, sx, 0.021, sz, lz ? 0.16 : 0.7, lz ? 0.7 : 0.16, 'inf_corpse_scrub');
    }
  }

  // drifts of dead flies over and beside the bodies
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let k = 0; k < n; k++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  for (const b of BED_CORPSES) drift(b.x, b.surf + 0.16, b.z, 0.35, 0.7, 34);
  for (const b of FLOOR_BODIES) { drift(b.x, 0.02, b.z, 0.5, 0.9, 55); drift(b.x, 0.22, b.z, 0.3, 0.5, 22); }
  mergedMesh(root, flies, M.fly, 'inf_body_flies');

  // futile lime scattered close around the bodies and their beds
  const lime = [];
  for (const b of ALL) {
    for (let k = 0; k < 22; k++) {
      pushBox(lime, b.x + rr(-0.7, 0.7), 0.012, b.z + rr(-1.0, 1.0),
        rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
    }
  }
  mergedMesh(root, lime, M.lime, 'inf_body_lime');

  // one more vinegar bowl gone to scum, set down by a floor body and left
  const fb = FLOOR_BODIES[0];
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.12, 9), M.metal);
  bowl.position.set(fb.x + 0.9, 0.06, fb.z + 1.1); bowl.name = 'inf_vinegar_bowl'; root.add(bowl);
  const scum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 9), M.scum);
  scum.position.set(fb.x + 0.9, 0.115, fb.z + 1.1); scum.name = 'inf_vinegar_scum'; root.add(scum);
}

// -------------------------------------------------------------------- table
function buildTable(root, M) {
  // top slab (surface y = 0.75)
  addBox(root, M.timber, TABLE_CX, TABLE_TOP_Y - 0.025, TABLE_CZ, 1.6, 0.05, 0.8, 'inf_table_top', false);
  // four legs
  for (const sx of [-0.7, 0.7]) for (const sz of [-0.32, 0.32]) {
    addBox(root, M.timber, TABLE_CX + sx, 0.36, TABLE_CZ + sz, 0.08, 0.72, 0.08, 'inf_table_leg', false);
  }
  // collider over the whole table footprint
  collideBox(TABLE_CX, 0.42, TABLE_CZ, 1.6, 0.85, 0.8);

  // two basins (empty, one filmed) sitting on the top
  addBox(root, M.metal, TABLE_CX - 0.5, TABLE_TOP_Y + 0.06, TABLE_CZ - 0.1, 0.34, 0.12, 0.34, 'inf_basin', false);
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 8), M.metal);
  b2.position.set(TABLE_CX - 0.05, TABLE_TOP_Y + 0.06, TABLE_CZ + 0.18);
  b2.name = 'inf_basin'; root.add(b2);

  // candle stub + flame (a warm, motivated source)
  const cx = TABLE_CX + 0.55, cz = TABLE_CZ - 0.15;
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 6), M.wax);
  stub.position.set(cx, TABLE_TOP_Y + 0.07, cz); stub.name = 'inf_candle'; root.add(stub);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), M.flame);
  flame.position.set(cx, TABLE_TOP_Y + 0.20, cz); flame.name = 'inf_candle_flame';
  root.add(flame);
  root.userData.flame = flame;
  root.userData.flameBaseY = flame.position.y;

  // a low stool set back from the table (scale cue; no collider — it's low)
  addBox(root, M.timber, TABLE_CX - 0.2, 0.23, TABLE_CZ + 0.9, 0.34, 0.06, 0.30, 'inf_stool_seat', false);
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.1, 0.1]) {
    addBox(root, M.timber, TABLE_CX - 0.2 + sx, 0.1, TABLE_CZ + 0.9 + sz, 0.05, 0.2, 0.05, 'inf_stool_leg', false);
  }
}

// ---------------------------------------------------------------- threshold
// Vinegar bowls gone to scum, scattered lime, herb bundles — the household
// trying. Just inside the door (z ≈ 8).
function buildThreshold(root, M) {
  for (const bx of [DOOR_CX - 0.7, DOOR_CX + 0.7]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.12, 9), M.metal);
    bowl.position.set(bx, 0.06, 8.3); bowl.name = 'inf_vinegar_bowl'; root.add(bowl);
    const scum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 9), M.scum);
    scum.position.set(bx, 0.115, 8.3); scum.name = 'inf_vinegar_scum'; root.add(scum);
  }
  // scattered lime around the threshold (merged flecks)
  const lime = [];
  for (let i = 0; i < 60; i++) {
    const lx = rr(DOOR_X0 - 0.4, DOOR_X1 + 0.4);
    const lz = rr(7.9, 8.9);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'inf_lime');

  // herb bundles hung at the door jambs
  addBox(root, M.herb, DOOR_X0 - 0.06, 2.0, 8.9, 0.1, 0.4, 0.1, 'inf_herb_bundle', false);
  addBox(root, M.herb, DOOR_X1 + 0.06, 2.0, 8.9, 0.1, 0.4, 0.1, 'inf_herb_bundle', false);
}

// -------------------------------------------------------------------- flies
// Drifts of dead flies: banked along the window sills, in the corners, and in
// the empty basins. Small dark specks, merged. Never labelled in the world.
function buildFlies(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // window sills (west wall)
  for (const wz of WINDOW_Z) drift(X0 + 0.12, WINDOW_SILL, wz, 0.06, WINDOW_W / 2, 70);
  // floor corners
  drift(X0 + 0.35, 0.01, Z0 + 0.35, 0.3, 0.3, 90);
  drift(X1 - 0.35, 0.01, Z0 + 0.35, 0.3, 0.3, 80);
  drift(X0 + 0.35, 0.01, Z1 - 0.35, 0.3, 0.3, 80);
  // in the empty basins on the table
  drift(TABLE_CX - 0.05, TABLE_TOP_Y + 0.09, TABLE_CZ + 0.18, 0.12, 0.12, 40);
  // a thin scatter down the central aisle by the door
  drift(DOOR_CX, 0.01, 8.2, 0.7, 0.5, 60);
  mergedMesh(root, flies, M.fly, 'inf_flies');
}

// --------------------------------------------------------------------- stain
// One dark stain worked into the floor by a bed-foot, near the shape of a man,
// ringed by the pale marks of a brush that gave out before the stain did.
const STAIN = { x: -103.8, z: 0.6 };
function buildStain(root, M) {
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.15), M.stain);
  stain.position.set(STAIN.x, 0.02, STAIN.z);
  stain.rotation.x = -Math.PI / 2;
  stain.name = 'inf_stain'; root.add(stain);
  // the pale scrub-ring around it (sand + lye, worked and abandoned)
  const scrub = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.85, 16), M.scrub);
  scrub.position.set(STAIN.x, 0.021, STAIN.z);
  scrub.rotation.x = -Math.PI / 2;
  scrub.name = 'inf_stain_scrub'; root.add(scrub);
}

// ------------------------------------------------------------------ lighting
// Local point lights only — the great hall's tuning is untouched. Every warm/
// cold pool traces to a visible source; two dim cool fills stand in for ambient.
function buildLighting(root, M, world) {
  // cold windows: emissive glow plane + a low cold point just inside each
  const windowLights = [];
  for (const wz of WINDOW_Z) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_W, WINDOW_HEAD - WINDOW_SILL), M.glass);
    glow.position.set(X0 + 0.02, (WINDOW_SILL + WINDOW_HEAD) / 2, wz);
    glow.rotation.y = Math.PI / 2;         // face into the room (+X)
    glow.name = 'inf_window_glow'; root.add(glow);

    const cold = new THREE.PointLight(0x9fb0c4, 6.5, 14, 1.7);
    cold.position.set(X0 + 0.9, 3.2, wz);
    cold.name = 'inf_light_window';
    addLight(cold);
    windowLights.push({ light: cold, base: 6.5 });
  }

  // warm candle on the physician's table
  const warm = new THREE.PointLight(0xe8a24c, 5, 5.5, 1.9);
  warm.position.set(TABLE_CX + 0.55, TABLE_TOP_Y + 0.28, TABLE_CZ - 0.15);
  warm.name = 'inf_light_candle';
  addLight(warm);

  // cool fills high in the room so the ward reads (was too dark)
  for (const fz of [-5, 0, 5]) {
    const fill = new THREE.PointLight(0x5a636f, 9, 26, 1.0);
    fill.position.set(CX, 3.9, fz);
    fill.name = 'inf_light_fill';
    addLight(fill);
  }

  // subtle candle flicker (flame scale + warm light), gentle
  const flame = root.userData.flame;
  const baseY = root.userData.flameBaseY || 0;
  onUpdate((dt, t) => {
    const n = Math.sin(t * 11.3) * 0.5 + Math.sin(t * 7.1 + 1.7) * 0.3 + Math.sin(t * 23.0) * 0.2;
    warm.intensity = 5 * (1 + 0.14 * n);
    if (flame) {
      flame.scale.y = 1 + 0.12 * n;
      flame.position.y = baseY + 0.01 * n;
    }
    // windows barely breathe (cold, steady daylight)
    for (const w of windowLights) w.light.intensity = w.base * (1 + 0.03 * Math.sin(t * 0.6 + w.base));
  });
}

// ===========================================================================
// DOCUMENTS — two readable leaves, each a parchment marker lying FLAT on a real
// surface (marker.y == surface-top Y). §9 register: plain, concrete, feast-day
// dated, the writer stops. Echo Klara's / Bohn's other extant leaves without
// copying them.
// ===========================================================================
function makeMarker(root, mat, x, y, z, name, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.rotation.set(-Math.PI / 2, 0, ry);   // lie flat
  root.add(m);
  return m;
}

const DOC_KLARA = {
  id: 'inf-klara-roll',
  type: 'Casualty roll', style: 'tally',
  voice: 'Sister Klara, infirmarian',
  dateText: 'St. Lucy to St. Thomas',
  pages:
    'Reckoning of the sick, by the bed. Sixteen beds kept.\n\n' +
    '  Lying at prime .............. sixteen\n' +
    '  On the floor between ........ four\n' +
    '  Carried down since Sunday ... nine\n\n' +
    'The good linen is spent. We shroud in what is left and tear the altar cloths after.\n\n' +
    'I set every name in this book till Tuesday. I have not the hours now, and I will ' +
    'not keep the first while I leave the last of them out, so I keep none.',
};

const DOC_BOHN = {
  id: 'inf-bohn-order',
  type: 'Physician’s leaf', style: '',
  voice: 'Magister Cyriak Bohn, physician',
  dateText: 'after St. Lucy',
  pages: [
    'Ordo curae. The order of care, set for the sisters to keep while I go bed to bed.\n\n' +
    '  Primo — the bed drawn apart, the window open to draw off the corruption.\n' +
    '  Secundo — vinegar to the hands and the sill, lime at the door.\n' +
    '  Tertio — the swelling lanced when it stands proud, and dressed.\n' +
    '  Quarto — wine with theriac against the fever.',

    'I have kept this order eleven days. Not one so treated has risen.\n\n' +
    'The lancing does nothing but pain them, and I have left it off. The vinegar and ' +
    'the lime I keep, because the sisters keep them, and it is a thing to do with the ' +
    'hands.\n\n' +
    'It goes by the hand. I carry it to the next bed on the same hand I laid on the ' +
    'last. I have no physic for that. I wash, and I go on.',
  ],
};

function buildDocuments(root, M, world) {
  // Klara's casualty roll — flat on a MADE bed (west row, z = 3), foot of bed.
  // surface = made-bed sheet top (BED_SHEET_TOP = 0.52).
  const kx = WEST_X + 0.10, kz = 3 + 0.7;
  const km = makeMarker(root, M.parchment, kx, BED_SHEET_TOP, kz, 'inf_doc_' + DOC_KLARA.id, 0.22);
  registerInteractable({
    object: km, radius: 1.8,
    label: 'A tally-roll on a made-up bed, close-lined in an infirmary hand.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_KLARA); },
  });

  // Bohn's leaf — flat on the PHYSICIAN'S TABLE top (TABLE_TOP_Y = 0.75).
  const bx = TABLE_CX - 0.15, bz = TABLE_CZ + 0.12;
  const bm = makeMarker(root, M.parchment, bx, TABLE_TOP_Y, bz, 'inf_doc_' + DOC_BOHN.id, -0.3);
  registerInteractable({
    object: bm, radius: 1.8,
    label: 'Two leaves in a physician’s hand on the table, the second hurried.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_BOHN); },
  });
}

// ===========================================================================
// EXAMINABLE PROPS — scout's plain register (§10): he describes what he sees.
// Anchor Object3D + label (shown near) + latched "more" line on E.
// ===========================================================================
function registerProp(world, name, x, y, z, radius, label, more) {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.set(x, y, z);
  if (world.scene) world.scene.add(anchor);
  registerInteractable({
    object: anchor, radius, label,
    onExamine: () => {
      const latch = world.flags.__examineLatch;
      if (typeof latch === 'function') latch(more);
    },
  });
}

function buildProps(world) {
  // 1) a made bed with a composed body (east row, z = -3)
  registerProp(world, 'inf_ix_body', EAST_X, 0.6, -3, 1.9,
    'A body laid out on the bed, the sheet drawn to the chest and the hands folded on it. Someone took the time.',
    'The face is covered. One hand lies bare on the sheet, and the fingers have gone black to the second knuckle. The linen under it is clean and lately changed.');

  // 2) the scrub-marked stain by the bed-foot
  registerProp(world, 'inf_ix_stain', STAIN.x, 0.06, STAIN.z, 2.0,
    'A dark stain worked into the floor by the bed-foot, near the shape of a man. Pale scratches ring it where a brush went at it.',
    'The scrubbing gave out before the stain did. Sand and lye still grey the stone at the edge, and no one came back to finish.');

  // 3) the fly-drift on a sill
  registerProp(world, 'inf_ix_flies', X0 + 0.4, 2.5, 4, 2.0,
    'Dead flies lie banked along the sill, drifted deep as chaff. More lie in the corners and the empty basins.',
    'They crunch underfoot by the door. No draught stirs them. The window above stands open to no purpose now.');

  // 4) an uncovered body on a bed (east row, z = 0) — no sheet drawn over it
  registerProp(world, 'inf_ix_bed_corpse', EAST_X, 0.6, 0, 1.9,
    'A body left uncovered on the bed. The linen it should have had went to a bed with more need of it.',
    'Three dark streaks have dried from the mouth. The fingers and the toes are gone black to the joint, and the pallet under it is marked where it has lain.');

  // 5) the ones on the floor, past composing (between the west beds)
  registerProp(world, 'inf_ix_floor_bodies', -103.6, 0.4, -1.5, 2.2,
    'Two more on the floor between the beds, where the beds ran out. Laid out in rows, then not laid out at all.',
    'Hands and feet blackened at the ends. The stone beneath is stained dark, and the brush-marks beside it stop short of the edge.');
}
