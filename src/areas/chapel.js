import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// ST. URSEL'S CHAPEL  (atlas #12 — Gen 1 Otwin the Founder, the castle's FIRST
// chapel. "Ancestral: Anselm dies here (mo.13); Walburga.") The oldest built
// thing here: crude, thick rubble walls, a low dark timber deck, small deep-set
// lancets. A short single nave running N–S with a plain stone altar at the north
// end, a standing rood on the wall above it, a few rows of pews down the aisle,
// and a font by the door. Cold light bleeds through the lancets; two candles
// gutter on the altar. Nothing here is fine — it was never meant to be. Decay is
// what happened to it, not how it was made (world-bible §13.1).
//
// THE BEAT (§6 · §11 mo.13): Father Anselm Vogt died here administering the last
// rites to the sick, "as well as one man could manage before it was his turn."
// His body lies composed at the altar step in a cleric's habit; the offices are
// scattered where they fell — a spilled pyx, his stole, two candles guttered
// flat. His last leaf, set on the altar, is addressed to the Abbess Walburga.
// PLAGUE GRAMMAR applies: blackened fingers, three dark tracks from the face
// (dark, never red), a set stain with faint scrub-marks under the long-lying
// body, drifts of dead flies banked in the corners (never labelled), lime at the
// threshold. The scout's examinables name only what he sees (§10).
//
// Self-contained island centred C = (-100, 0, 100); all geometry within ~±20.
// Floor y=0. buildChapel(world) builds its own geometry/materials/colliders/
// floor/lights/one readable leaf/examinables, registers its OWN zone, and returns
// { root, entry }. It does NOT edit other files or register portals. Every named
// object is prefixed `chp_`. DETERMINISM: no Math.random / Date.now — a seeded
// LCG drives all scatter.
// ===========================================================================

// --- island frame (metres) -------------------------------------------------
const CX = -100, CZ = 100;                 // island centre
const RX = 5, RZ = 9;                      // half-extents -> 10 (x) x 18 (z)
const X0 = CX - RX, X1 = CX + RX;          // wall centrelines  x [-105, -95]
const ZN = CZ - RZ, ZS = CZ + RZ;          // north (altar) z=91 · south (door) z=109
const T = 0.7;                             // crude rubble wall thickness
const WALL_H = 4.0;                        // low Gen-1 wall height

const XE_IN = X1 - T / 2;                  // east inner face  -95.35
const XW_IN = X0 + T / 2;                  // west inner face  -104.65
const ZN_IN = ZN + T / 2;                  // north inner face  91.35
const ZS_IN = ZS - T / 2;                  // south inner face 108.65

const WIN_SILL = 1.4, WIN_HEAD = 2.8;      // deep-set lancet band
const WIN_HZ = 0.28;                       // lancet half-width (along z)
const WIN_Z = [97, 103];                   // lancet centres on each side wall

const DOOR_CX = CX, DOOR_W = 1.6, DOOR_H = 2.4;
const DOOR_X0 = DOOR_CX - DOOR_W / 2, DOOR_X1 = DOOR_CX + DOOR_W / 2;

const ALTAR_TOP = 1.1;                     // altar mensa top surface
const STEP_TOP = 0.16;                     // altar step (dais) top

// --- entry: on the floor just inside the south door, facing -Z down the nave --
// yaw = PI faces -Z (interaction convention) — north, toward the altar.
const CHAPEL_ENTRY = { position: new THREE.Vector3(-100, 1.7, 108), yaw: Math.PI };

// ---------------------------------------------------------------------------
// Seeded LCG — stable scatter (flies, lime, stone speckle, spatter).
// ---------------------------------------------------------------------------
let _seed = 0x0075e1c;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// ---------------------------------------------------------------------------
// Geometry helpers (merged boxes for bulk; single meshes where handy).
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

// One box mesh; optionally register a matching world-space AABB collider.
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (ry) m.rotation.y = ry;
  m.name = name;
  root.add(m);
  if (collide) collideBox(cx, cy, cz, w, h, d);
  return m;
}

function collideBox(cx, cy, cz, w, h, d) {
  registerCollider(new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
}

// A flat, floor-hugging quad (stains, streaks) lying in the XZ plane.
function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas PS1 textures (browser-side; node --check only parses this file).
// ---------------------------------------------------------------------------
function speckTex(base, speck, courses) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 340; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.15, 0.55);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  if (courses) {                                 // crude, uneven rubble coursing
    g.strokeStyle = 'rgba(18,16,12,0.4)'; g.lineWidth = 1;
    for (let y = 20; y < 64; y += 22) {
      g.beginPath(); g.moveTo(0, y + Math.floor(rr(-2, 2))); g.lineTo(64, y + Math.floor(rr(-2, 2))); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

// Cold devotional glass — a pale blue-white vertical gradient (fog-free glow).
function glassTex() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 48;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 48, 0, 0);
  grd.addColorStop(0, '#8fa6bd'); grd.addColorStop(1, '#c2d0dd');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 48);
  return crunch(new THREE.CanvasTexture(c));
}

function makeMaterials() {
  const wallTex = speckTex('#57514a', '#3a352e', true); wallTex.repeat.set(3, 2);
  const floorTex = speckTex('#4c473f', '#322e28', true); floorTex.repeat.set(6, 10);
  const lambert = (o) => ps1ify(new THREE.MeshLambertMaterial(o));
  const basic = (o) => ps1ify(new THREE.MeshBasicMaterial(o));
  return {
    wall: lambert({ color: 0x6a645b, map: wallTex }),
    flag: lambert({ color: 0x5b564e, map: floorTex }),
    stone: lambert({ color: 0x767065 }),           // altar, font, dressed stone
    timber: lambert({ color: 0x3d3024 }),          // pews, rood, ceiling
    ceil: lambert({ color: 0x241d16 }),            // dim deck underside
    flesh: lambert({ color: 0x8a7f6d }),           // the priest's face/hands
    garb: lambert({ color: 0x2b2822 }),            // cleric's dark habit
    black: lambert({ color: 0x14100e }),           // blackened fingers/feet
    wax: lambert({ color: 0xcabfa2 }),             // candle stubs, run wax
    metal: lambert({ color: 0x6b6e73 }),           // pyx, candlesticks
    cloth: lambert({ color: 0x3a2e38 }),           // the stole (dark, faint hue)
    fly: lambert({ color: 0x17140f }),             // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),            // lime at the threshold
    scrub: basic({ color: 0x6a655a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    stain: basic({ color: 0x241f1a, side: THREE.DoubleSide }),   // set dark stain
    streak: basic({ color: 0x201512, side: THREE.DoubleSide }),  // dark face-tracks (NOT red)
    glass: basic({ map: glassTex(), fog: false, side: THREE.DoubleSide }),
    flame: basic({ color: 0xffcf88, fog: false, transparent: true, side: THREE.DoubleSide }),
    parch: basic({
      color: 0xb7a06a, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildChapel(world) {
  const root = new THREE.Group();
  root.name = 'chp_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloorAndCeiling(root, M);
  buildWalls(root, M);
  buildLancets(root, M);
  buildAltar(root, M);
  buildPews(root, M);
  buildFont(root, M);
  buildBody(root, M);
  buildAmbientGrammar(root, M);
  buildLighting();
  buildDocument(world, root, M);
  buildExaminables(world);

  // Own zone over the whole island volume (walls + a little air above).
  world.registerZone({ name: "St. Ursel's Chapel", min: [-106, -1, 90], max: [-94, 6, 110] });

  return { root, entry: CHAPEL_ENTRY };
}

// ------------------------------------------------------------ floor / ceiling
function buildFloorAndCeiling(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ), M.flag);
  floor.name = 'chp_floor';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);

  // worn threshold sill at the south door
  addBox(root, M.stone, DOOR_CX, 0.02, ZS_IN - 0.35, DOOR_W + 0.3, 0.06, 0.5, 'chp_sill', false);

  // low, dark timber deck (crude Gen-1 roofing), with a few heavy beams below.
  addBox(root, M.ceil, CX, WALL_H + 0.1, CZ, 2 * RX + 2 * T, 0.2, 2 * RZ + 2 * T, 'chp_ceil_deck', false);
  for (let z = ZN + 1.6; z <= ZS - 1.6; z += 2.4) {
    addBox(root, M.timber, CX, WALL_H - 0.14, z, 2 * RX, 0.26, 0.22, 'chp_ceil_beam', false);
  }
}

// -------------------------------------------------------------------- walls
function buildWalls(root, M) {
  const yc = WALL_H / 2;

  // NORTH wall (altar end, z=ZN): solid rubble, no opening (Otwin, small windows).
  addBox(root, M.wall, CX, yc, ZN - T / 2, 2 * RX + 2 * T, WALL_H, T, 'chp_wall_n', false);
  collideBox(CX, yc, ZN, 2 * RX + 2 * T, WALL_H, T);

  // EAST + WEST walls (fixed x, run along z): solid but for two deep lancets.
  for (const sx of [-1, 1]) {
    const xc = (sx < 0) ? X0 : X1;                 // wall centreline
    const midY = (WIN_SILL + WIN_HEAD) / 2, midH = WIN_HEAD - WIN_SILL;
    addBox(root, M.wall, xc, WIN_SILL / 2, CZ, T, WIN_SILL, 2 * RZ, 'chp_wall_lo', false);
    addBox(root, M.wall, xc, (WIN_HEAD + WALL_H) / 2, CZ, T, WALL_H - WIN_HEAD, 2 * RZ, 'chp_wall_hi', false);
    const gaps = WIN_Z.map((z) => [z - WIN_HZ, z + WIN_HZ]);
    const segs = [[ZN, gaps[0][0]], [gaps[0][1], gaps[1][0]], [gaps[1][1], ZS]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      addBox(root, M.wall, xc, midY, (a + b) / 2, T, midH, b - a, 'chp_wall_mid', false);
    }
    collideBox(xc, yc, CZ, T, WALL_H, 2 * RZ);
  }

  // SOUTH wall (door end, z=ZS): split around the doorway + a lintel.
  const sLeftW = DOOR_X0 - (X0 - T);
  addBox(root, M.wall, ((X0 - T) + DOOR_X0) / 2, yc, ZS + T / 2, sLeftW, WALL_H, T, 'chp_wall_s_l', false);
  collideBox(((X0 - T) + DOOR_X0) / 2, yc, ZS, sLeftW, WALL_H, T);
  const sRightW = (X1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (X1 + T)) / 2, yc, ZS + T / 2, sRightW, WALL_H, T, 'chp_wall_s_r', false);
  collideBox((DOOR_X1 + (X1 + T)) / 2, yc, ZS, sRightW, WALL_H, T);
  addBox(root, M.wall, DOOR_CX, (DOOR_H + WALL_H) / 2, ZS + T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'chp_wall_s_lintel', false);
}

// ------------------------------------------------------------------- lancets
// Deep-set: a cold emissive glass leaf at the inner face + a slim stone surround.
function buildLancets(root, M) {
  const wh = WIN_HEAD - WIN_SILL, wy = (WIN_SILL + WIN_HEAD) / 2;
  for (const sx of [-1, 1]) {
    const xg = (sx < 0) ? XW_IN + 0.02 : XE_IN - 0.02;
    for (const z of WIN_Z) {
      addBox(root, M.glass, xg, wy, z, 0.04, wh, WIN_HZ * 2, 'chp_glass', false);
      // a thin stone mullion + splayed reveal, proud of the glass
      addBox(root, M.stone, xg + (sx < 0 ? -0.02 : 0.02), wy, z, 0.05, wh, 0.05, 'chp_mullion', false);
    }
  }
}

// -------------------------------------------------------------------- altar
// A plain stone mensa on a low step at the north end, a standing timber rood on
// the wall above, and two guttering candles at the mensa corners.
function buildAltar(root, M) {
  const az = ZN_IN + 1.55;                           // mensa centre in z
  // step / dais (low, walkable — visual only, body lies on the floor at its edge)
  addBox(root, M.stone, CX, STEP_TOP / 2, az + 1.05, 2.6, STEP_TOP, 1.3, 'chp_altar_step', false);
  // mensa block
  addBox(root, M.stone, CX, ALTAR_TOP / 2, az, 2.0, ALTAR_TOP, 0.9, 'chp_altar', true);
  // a plain frontal cloth edge (dark) hanging the mensa's south face
  addBox(root, M.cloth, CX, ALTAR_TOP - 0.45, az + 0.46, 1.9, 0.85, 0.03, 'chp_altar_cloth', false);

  // standing rood on the north wall above the altar (vertical + crossbar)
  const rz = ZN_IN + 0.08;
  addBox(root, M.timber, CX, 2.7, rz, 0.12, 1.7, 0.1, 'chp_rood_upright', false);
  addBox(root, M.timber, CX, 2.95, rz, 0.9, 0.12, 0.1, 'chp_rood_crossbar', false);

  // two candlesticks at the mensa corners: metal stick + wax stub + crossed flame
  for (const dx of [-0.7, 0.7]) {
    addBox(root, M.metal, CX + dx, ALTAR_TOP + 0.09, az, 0.06, 0.18, 0.06, 'chp_stick', false);
    addBox(root, M.wax, CX + dx, ALTAR_TOP + 0.24, az, 0.05, 0.12, 0.05, 'chp_candle', false);
    const f1 = addBox(root, M.flame, CX + dx, ALTAR_TOP + 0.36, az, 0.05, 0.11, 0.05, 'chp_flame', false);
    const f2 = addBox(root, M.flame, CX + dx, ALTAR_TOP + 0.36, az, 0.05, 0.11, 0.05, 'chp_flame', false);
    f2.rotation.y = Math.PI / 2;
  }
}

// --------------------------------------------------------------------- pews
// Three short rows each side of a central aisle, facing the altar (-z). One bench
// is toppled onto its side (mo.13 disorder). Seat top at 0.48; collider per pew.
function buildPews(root, M) {
  const rowsZ = [98.5, 101.0, 103.5];
  const blocks = [-2.3, 2.3];                        // aisle-side x offsets from CX
  for (const bx of blocks) {
    const cx = CX + bx;
    for (const rz of rowsZ) {
      // seat plank
      addBox(root, M.timber, cx, 0.45, rz, 3.0, 0.06, 0.4, 'chp_pew_seat', false);
      // low back rail (behind the sitter, on the +z side)
      addBox(root, M.timber, cx, 0.72, rz + 0.2, 3.0, 0.5, 0.06, 'chp_pew_back', false);
      // end legs (grounded: y 0 -> 0.42)
      for (const lx of [cx - 1.35, cx + 1.35]) {
        addBox(root, M.timber, lx, 0.21, rz, 0.12, 0.42, 0.32, 'chp_pew_leg', false);
      }
      collideBox(cx, 0.45, rz + 0.1, 3.0, 0.9, 0.6);
    }
  }
  // a toppled bench along the west wall, lying on its side (seat vertical).
  const tx = XW_IN - 0.35, tz = 106.0;
  addBox(root, M.timber, tx, 0.25, tz, 0.06, 0.5, 2.4, 'chp_pew_toppled_seat', false);
  addBox(root, M.timber, tx + 0.22, 0.1, tz, 0.4, 0.06, 2.4, 'chp_pew_toppled_back', false);
  collideBox(tx + 0.1, 0.25, tz, 0.5, 0.5, 2.4);
}

// --------------------------------------------------------------------- font
// A stone baptismal font by the door, set off the entry line to the west.
function buildFont(root, M) {
  const fx = -102.6, fz = 106.8;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.9, 8), M.stone);
  ped.position.set(fx, 0.45, fz); ped.name = 'chp_font_ped'; root.add(ped);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.34, 8), M.stone);
  basin.position.set(fx, 1.02, fz); basin.name = 'chp_font_basin'; root.add(basin);
  // dark, dry hollow
  const hollow = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.06, 8), M.ceil);
  hollow.position.set(fx, 1.17, fz); hollow.name = 'chp_font_hollow'; root.add(hollow);
  collideBox(fx, 0.6, fz, 0.9, 1.2, 0.9);
}

// -------------------------------------------------------------------- body
// Father Anselm, composed at the altar step, head toward the altar (-z). Habit,
// folded hands gone black, feet black; three dark tracks from the face; a set
// stain with faint scrub-marks beneath; the offices scattered where they fell.
const BODY_X = -100;
const HEAD_Z = 94.5;      // head just where the step meets the floor
const TORSO_Z = 95.35;
const LEGS_Z = 96.2;
const FEET_Z = 96.85;

function buildBody(root, M) {
  // Father Anselm — shared low-poly corpse in a cleric's dark habit, supine and
  // composed at the altar step with the head toward the altar (north, -z), so
  // yaw = +PI/2. Origin on the floor; body lies flat where the old boxes were.
  const c = makeCorpse({ pose: 'supine', cloth: 0x2a2620, seed: 13 });
  c.position.set(BODY_X, 0, 95.2);
  c.rotation.y = Math.PI / 2;
  root.add(c);
  // a big dark-brown plague pool worked into the flags under the long-lying body
  const st = makeStain({ r: 1.35, seed: 5 });
  st.position.set(BODY_X, 0.002, 95.4);
  root.add(st);

  // set dark stain under the long-lying body (scrubbed at, never lifted)
  flatQuad(root, M.stain, BODY_X, 0.02, 95.5, 1.0, 2.3, 'chp_body_stain');
  // faint scrub-marks arced across the stain (deterministic)
  for (let k = 0; k < 5; k++) {
    const z = 94.9 + k * 0.35;
    flatQuad(root, M.scrub, BODY_X + rr(-0.15, 0.15), 0.022, z, rr(0.5, 0.8), 0.04, 'chp_scrub', rr(-0.4, 0.4));
  }
  // three dark tracks from the face to the stone (DARK, not red)
  for (let k = 0; k < 3; k++) {
    flatQuad(root, M.streak, BODY_X - 0.14 - k * 0.06, 0.021, HEAD_Z + 0.12 + k * 0.1, 0.05, 0.42 + k * 0.05, 'chp_streak');
  }

  buildLastRites(root, M);
}

// The last offices, scattered where they fell at the step.
function buildLastRites(root, M) {
  // spilled pyx (the little host-box), tipped on its side by the right hand
  const pyx = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10), M.metal);
  pyx.position.set(-99.5, 0.06, 95.2); pyx.rotation.z = Math.PI / 2; pyx.rotation.y = 0.4;
  pyx.name = 'chp_pyx'; root.add(pyx);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), M.metal);
  lid.position.set(-99.28, 0.02, 95.35); lid.rotation.x = Math.PI / 2;
  lid.name = 'chp_pyx_lid'; root.add(lid);

  // the stole — a long narrow band, dropped from the step and trailing on the floor
  addBox(root, M.cloth, -100.55, 0.02, 95.4, 0.14, 0.03, 1.5, 'chp_stole', false, 0.12);
  addBox(root, M.cloth, -100.5, STEP_TOP + 0.02, 94.4, 0.14, 0.02, 0.5, 'chp_stole_end', false);

  // two candles guttered flat, run to their sockets on the floor
  for (const [gx, gz] of [[-99.7, 94.95], [-100.35, 96.35]]) {
    addBox(root, M.wax, gx, 0.03, gz, 0.1, 0.05, 0.14, 'chp_gutter_candle', false);
    flatQuad(root, M.wax, gx + 0.08, 0.016, gz + 0.06, 0.22, 0.16, 'chp_gutter_wax', 0.3);
  }
}

// ------------------------------------------------------ ambient plague grammar
// Drifts of dead flies banked in the corners (never labelled) + lime at the door.
function buildAmbientGrammar(root, M) {
  const flies = [];
  const drift = (cx, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), 0.01 + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  drift(XW_IN - 0.55, ZN_IN + 0.55, 0.4, 0.4, 46);   // NW corner
  drift(XE_IN + 0.55, ZN_IN + 0.55, 0.4, 0.4, 44);   // NE corner
  drift(XW_IN - 0.55, ZS_IN - 0.55, 0.4, 0.4, 40);   // SW corner
  drift(XE_IN + 0.55, ZS_IN - 0.55, 0.4, 0.4, 42);   // SE corner
  drift(-99.3, 95.4, 0.6, 0.7, 34);                  // banked to the body
  mergedMesh(root, flies, M.fly, 'chp_flies');

  const lime = [];
  for (let i = 0; i < 46; i++) {
    const lx = rr(DOOR_X0 - 0.4, DOOR_X1 + 0.4), lz = rr(ZS_IN - 0.9, ZS_IN - 0.05);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'chp_lime');
}

// ------------------------------------------------------------------ lighting
// Local lights only (no global ambient — other areas' tuning is untouched).
// Cold light bleeding through the lancets, grading to warm guttering candlelight
// at the altar so the beat reads on entry.
function buildLighting() {
  // cold lancet pools — one just inside each of the four openings
  for (const sx of [-1, 1]) {
    const xg = (sx < 0) ? XW_IN - 0.5 : XE_IN + 0.5;
    for (const z of WIN_Z) {
      const w = new THREE.PointLight(0x8fa6bd, 3.4, 8.5, 1.7);
      w.position.set(xg, (WIN_SILL + WIN_HEAD) / 2, z);
      w.name = 'chp_light_lancet';
      addLight(w);
    }
  }
  // a low, cool contemplative fill along the nave centre
  const nave = new THREE.PointLight(0x5b6470, 2.0, 12, 1.8);
  nave.position.set(CX, 3.2, 100); nave.name = 'chp_light_nave'; addLight(nave);

  // warm guttering candlelight at the altar (two, flickering out of phase)
  const az = ZN_IN + 1.55;
  const c1 = new THREE.PointLight(0xe8a24c, 2.6, 5.5, 2.0);
  c1.position.set(CX - 0.7, ALTAR_TOP + 0.4, az); c1.name = 'chp_light_candle'; addLight(c1);
  const c2 = new THREE.PointLight(0xe8a24c, 2.4, 5.0, 2.0);
  c2.position.set(CX + 0.7, ALTAR_TOP + 0.4, az); c2.name = 'chp_light_candle'; addLight(c2);
  // a faint dying glow off the guttered wax by the body
  const g = new THREE.PointLight(0xc98a3e, 0.9, 3.0, 2.2);
  g.position.set(-99.9, 0.35, 95.4); g.name = 'chp_light_gutter'; addLight(g);

  onUpdate((_dt, t) => {
    const n1 = Math.sin(t * 8.1) * 0.6 + Math.sin(t * 21.7) * 0.4;
    const n2 = Math.sin(t * 6.7 + 1.9) * 0.6 + Math.sin(t * 18.3 + 0.7) * 0.4;
    c1.intensity = 2.6 * (1 + 0.18 * n1);
    c2.intensity = 2.4 * (1 + 0.2 * n2);
    g.intensity = 0.9 * (1 + 0.25 * Math.sin(t * 5.3 + 0.4));
  });
}

// ------------------------------------------------------------------- document
// Anselm's last leaf, set on the altar mensa (rests flat at ALTAR_TOP), addressed
// to the Abbess Walburga — the required Walburga reference (§6). Latin-inflected,
// unsteady; names no mechanism, summarises nothing (§13.2).
const DOC_ANSELM = {
  id: 'chp-anselm-last-leaf',
  type: 'Leaf', style: '',
  voice: 'Father Anselm Vogt, confessor',
  dateText: 'the thirteenth month',
  pages:
    'To the Abbess Walburga of St. Ursel, if any hand carries this down.\n\n' +
    'I have said the offices over as many as I could reach, while I could still ' +
    'hold the pyx steady. There are more than there is oil, and more than there ' +
    'is day. I have not kept the count. I set the last of them in God’s hands ' +
    'without their names, and I trust He knows what I have forgotten.\n\n' +
    'I broke the seal to you too late, and you told me you had known since ' +
    'Candlemas, and we were neither of us in time. That is between us and Him now.\n\n' +
    'I will lie here a while at the step. Do not have the stone scrubbed on my ' +
    'account. There is no one left to mind it, and it will not come out.',
};

function buildDocument(world, root, M) {
  const az = ZN_IN + 1.55;
  const geo = new THREE.PlaneGeometry(0.3, 0.4);
  const leaf = new THREE.Mesh(geo, M.parch);
  leaf.name = 'chp_doc_' + DOC_ANSELM.id;
  leaf.position.set(CX + 0.35, ALTAR_TOP, az - 0.05);   // y === mensa top (rests flat)
  leaf.rotation.set(-Math.PI / 2, 0, 0.25);
  root.add(leaf);
  registerInteractable({
    object: leaf,
    radius: 1.8,
    label: 'A single leaf set square on the altar, in a Latin-inflected hand gone unsteady.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_ANSELM); },
  });
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§10): describe what he sees, never the meaning.
function registerProp(world, name, x, y, z, radius, label, more) {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.set(x, y, z);
  if (world.scene) world.scene.add(anchor);
  registerInteractable({
    object: anchor, radius, label,
    onExamine: () => {
      const latch = world.flags && world.flags.__examineLatch;
      if (typeof latch === 'function') latch(more);
    },
  });
}

function buildExaminables(world) {
  registerProp(world, 'chp_ix_body', BODY_X, 0.5, 95.4, 2.4,
    'The priest is where the altar step meets the floor, laid out as well as one man could manage before it was his turn.',
    'His hands are folded and gone black at the fingers, and three dark tracks run from his face down to the stone. Someone has scrubbed at the stain under him and given it up.');

  registerProp(world, 'chp_ix_rites', -99.9, 0.4, 95.3, 2.0,
    'The offices are scattered where they fell — the little host-box tipped open, a stole trailed off the step, two candles run flat to their sockets.',
    'The box is empty and the wax has set hard across the flags. Whoever laid these out meant to keep them in order, and did, until he could not.');
}
