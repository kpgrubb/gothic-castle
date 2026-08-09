import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE GUILD HALL  (atlas #20 — Gen 4, Albrecht II: "the guild quarter, the
// workshops." world-bible §3: outward-facing, mercantile; the house turns to
// trade. §5.1 timeline: the guilds are put to work on plans not their own, and
// under PAYMENT III named craftsmen go to the works and do not come back —
// Balthasar KRIEG's roll survives with eleven names struck and no cause entered.
// §9: the mason measures; the smith Werner OCHS writes work orders and complains
// about metal that will not heat.)
//
// A proud, timber-roofed working hall: the seat of the castle's guild quarter,
// where the masons, joiners and smiths who built and kept Hochmauer met, drew,
// and dressed stone. Good stone, good proportion, a high king-post roof, tall
// windows of cold glass, a stone-flagged floor. A masters' dais at the north
// head with high seats; a long work table down the middle strewn with tools,
// plans, and Krieg's guild roll; benches; wall-mounted tools and the emblems of
// the three crafts; racks of dressed stone and Baltic oak; a mason's banker with
// a block left half-dressed; a small forge nook at the foot with Werner Ochs's
// anvil. The work stopped mid-task and never resumed.
//
// PLAGUE GRAMMAR, applied LIGHTLY: the smith down where he fell by his anvil,
// hands and feet gone black at the ends; a dark stain worked into the flags with
// the pale marks of a brush that gave out beside it; drifts of dead flies in the
// corners (never labelled); a little lime at the threshold. Cold window light and
// one dim warm ember still breathing in the forge.
//
// Self-contained island centred C = (200, 0, -100). Builds all geometry, its own
// colliders, the walkable floor + a low dais deck, its OWN local lighting (no
// global ambient — other areas' tuning is untouched), one readable leaf, and two
// examinables. Every named object is prefixed `guild_`. buildGuildHall(world)
// returns { root, entry }. This file registers its OWN zone and NO portals.
// DETERMINISM: no Math.random / Date.now — a seeded LCG drives all scatter.
// ===========================================================================

// --- island frame (metres) --------------------------------------------------
const CX = 200, CZ = -100;               // island centre
const RX = 8, RZ = 12;                    // half-extents -> 16 (x) x 24 (z)
const X0 = CX - RX, X1 = CX + RX;         // x[192, 208]
const ZN = CZ - RZ, ZS = CZ + RZ;         // north (dais) z=-112 · south (door) z=-88
const T = 0.5;                            // dressed-stone wall thickness
const WALL_H = 6.0;                       // eaves / top of wall
const APEX = 9.0;                         // king-post ridge height

// --- doorway (south wall) ---------------------------------------------------
const DOOR_W = 1.9, DOOR_H = 2.7;
const DOOR_X0 = CX - DOOR_W / 2, DOOR_X1 = CX + DOOR_W / 2;

// --- tall windows (cold glowing glass, on the long E/W walls) ---------------
const WIN_SILL = 1.8, WIN_HEAD = 4.3, WIN_HZ = 0.7;
const WIN_Z = [-105, -100, -95];

// --- key working heights ----------------------------------------------------
const TABLE_Y = 0.85;                     // work-table top surface (leaf rests here)
const DAIS_Y = 0.4;                       // masters' dais deck (walkable)

// --- entry: in the south doorway, facing -Z straight down the hall ----------
export const GUILD_ENTRY = { x: CX, y: 1.7, z: -88, yaw: Math.PI };

// ---------------------------------------------------------------------------
// Seeded LCG so all scatter (flies, lime, stone speckle, grain) is stable.
// ---------------------------------------------------------------------------
let _seed = 0x20a4c19;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// ---------------------------------------------------------------------------
// Geometry helpers (merged boxes for bulk scatter; single meshes where handy).
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
// Two triangles from four explicit corners (each [x,y,z]) — for the roof slopes.
function pushQuad(arr, a, b, c, d) {
  arr.push(...a, ...b, ...c, ...a, ...c, ...d);
}
function mergedMesh(root, positions, mat, name, dbl) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  if (dbl) m.material = mat;   // material may already be DoubleSide
  root.add(m);
  return m;
}
// One box mesh; optional matching world-space AABB collider; optional rotations.
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
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
// A flat, surface-hugging quad (stains, scrub, plans) lying in the XZ plane.
function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas textures — dressed stone, worn flags, oak. Crunched to PS1 nearest.
// (Runs in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function stoneTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#736c5d'; x.fillRect(0, 0, 128, 128);              // warm-grey ashlar
  for (let i = 0; i < 1200; i++) {
    x.fillStyle = (rnd() < 0.5) ? 'rgba(40,37,30,0.28)' : 'rgba(150,142,122,0.20)';
    x.fillRect((rnd() * 128) | 0, (rnd() * 128) | 0, 1, 1);
  }
  x.strokeStyle = 'rgba(34,31,25,0.35)'; x.lineWidth = 1;           // coursed joints
  for (let y = 16; y < 128; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function floorTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#615b4d'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(26,24,20,0.5)'; x.lineWidth = 2;           // flagstone joints
  x.strokeRect(1, 1, 126, 126);
  x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
  for (let i = 0; i < 800; i++) {
    x.fillStyle = (rnd() < 0.5) ? 'rgba(28,26,22,0.24)' : 'rgba(140,132,112,0.16)';
    x.fillRect((rnd() * 128) | 0, (rnd() * 128) | 0, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function timberTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#4a3a28'; x.fillRect(0, 0, 128, 128);             // Baltic oak
  for (let i = 0; i < 128; i++) {
    const a = 0.05 + rnd() * 0.12;
    x.fillStyle = (rnd() < 0.5) ? `rgba(30,22,14,${a})` : `rgba(112,90,60,${a})`;
    x.fillRect(0, i, 128, 1);                                       // horizontal grain
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function glassTex() {
  const c = cvs(32, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, '#9fb0c4'); g.addColorStop(1, '#cdd8e4');       // cold daylight
  x.fillStyle = g; x.fillRect(0, 0, 32, 64);
  x.strokeStyle = 'rgba(30,36,46,0.5)'; x.lineWidth = 1;           // leaded quarrels
  for (let y = 8; y < 64; y += 12) { x.beginPath(); x.moveTo(0, y); x.lineTo(32, y); x.stroke(); }
  return crunch(new THREE.CanvasTexture(c));
}
// A faded heraldic banner: a pale mason's square on a dull field.
function bannerTex() {
  const c = cvs(48, 80), x = c.getContext('2d');
  x.fillStyle = '#5a3a34'; x.fillRect(0, 0, 48, 80);               // faded guild crimson
  x.fillStyle = 'rgba(20,14,12,0.35)';
  for (let i = 0; i < 260; i++) x.fillRect((rnd() * 48) | 0, (rnd() * 80) | 0, 1, 1);  // moth/age
  x.strokeStyle = 'rgba(190,182,158,0.55)'; x.lineWidth = 3;       // the mason's square
  x.beginPath(); x.moveTo(14, 22); x.lineTo(14, 54); x.lineTo(36, 54); x.stroke();
  x.beginPath(); x.moveTo(18, 30); x.lineTo(30, 30); x.stroke();   // graduation bar
  const t = new THREE.CanvasTexture(c); return crunch(t);
}

function makeMaterials() {
  const wallTex = stoneTex(); wallTex.repeat.set(4, 2);
  const flrTex = floorTex(); flrTex.repeat.set(8, 8);
  const lambert = (o) => ps1ify(new THREE.MeshLambertMaterial(o));
  const basic = (o) => ps1ify(new THREE.MeshBasicMaterial(o));
  return {
    wall: lambert({ color: 0xb2ab98, map: wallTex }),               // good dressed stone
    floor: lambert({ color: 0xa79f8c, map: flrTex }),               // worn flags
    stone: lambert({ color: 0x9a9384 }),                            // dressed blocks, dais, forge
    stoneRough: lambert({ color: 0x7d7768 }),                       // undressed / rough faces
    dark: lambert({ color: 0x17181c }),                             // reveals / recesses / voids
    roof: lambert({ color: 0x3a2c1e, side: THREE.DoubleSide }),     // roof underside boarding
    timber: lambert({ color: 0x5a4531, map: timberTex() }),         // oak furniture & framing
    timberDk: lambert({ color: 0x3c2e20 }),                         // older/darker oak
    iron: lambert({ color: 0x51535a }),                             // tools, bands, anvil
    ironDk: lambert({ color: 0x33353b }),
    parch: lambert({ color: 0xb7a978 }),                            // plans / ledger leaves
    linen: lambert({ color: 0x8f8b7f }),                            // smith's apron / cloth
    flesh: lambert({ color: 0x8a7f6d }),                            // body
    garb: lambert({ color: 0x2f2c27 }),                             // dark clothing
    black: lambert({ color: 0x14100e }),                            // blackened extremities
    ash: lambert({ color: 0x2c2b28 }),                              // forge ash
    fly: lambert({ color: 0x17140f }),                              // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),                             // scattered lime
    banner: lambert({ color: 0xbdb6a2, map: bannerTex(), side: THREE.DoubleSide }),
    stain: basic({ color: 0x191512 }),                             // worked-in stain (flat)
    scrub: basic({ color: 0x4b463f, transparent: true, opacity: 0.32 }),
    ember: basic({ color: 0x8a3a16, fog: false }),                 // forge ember glow
    glass: basic({ map: glassTex(), color: 0xcdd8e4, fog: false, side: THREE.DoubleSide }),
    // leaf sits at exactly surface-top Y yet renders just in front (no z-fight).
    leaf: basic({
      color: 0xc4b587, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildGuildHall(world) {
  const root = new THREE.Group();
  root.name = 'guild_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloor(root, M);
  buildWalls(root, M);
  buildRoof(root, M);
  buildDais(root, M);
  buildBanner(root, M);
  buildTable(root, M);
  buildWallTools(root, M);
  buildRacks(root, M);
  buildBanker(root, M);
  buildForge(root, M);
  buildBody(root, M);
  buildAmbientGrammar(root, M);
  buildLighting(root, M);
  buildDocuments(world, root, M);
  buildExaminables(world);

  // Own zone — the whole island volume, up to the ridge.
  world.registerZone({ name: 'The Guild Hall', min: [190, -1, -114], max: [210, 11, -86] });

  return { root, entry: GUILD_ENTRY };
}

// -------------------------------------------------------------------- floor
function buildFloor(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ), M.floor);
  floor.name = 'guild_floor';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);
}

// --------------------------------------------------------------------- walls
// Good dressed-stone perimeter to the eaves. E/W long walls carry three tall
// window openings each (bands around the glass); N wall solid (the dais head);
// S wall split around the doorway. One collider per wall plane.
function buildWalls(root, M) {
  const midY = (WIN_SILL + WIN_HEAD) / 2, midH = WIN_HEAD - WIN_SILL;

  for (const sx of [-1, 1]) {
    const xc = CX + sx * RX;                       // centreline (thickness straddles)
    addBox(root, M.wall, xc, WIN_SILL / 2, CZ, T, WIN_SILL, 2 * RZ, 'guild_wall_lo', false);
    addBox(root, M.wall, xc, (WIN_HEAD + WALL_H) / 2, CZ, T, WALL_H - WIN_HEAD, 2 * RZ, 'guild_wall_hi', false);
    const gaps = WIN_Z.map((z) => [z - WIN_HZ, z + WIN_HZ]);
    const segs = [[ZN, gaps[0][0]], [gaps[0][1], gaps[1][0]], [gaps[1][1], gaps[2][0]], [gaps[2][1], ZS]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      addBox(root, M.wall, xc, midY, (a + b) / 2, T, midH, b - a, 'guild_wall_mid', false);
    }
    collideBox(xc, WALL_H / 2, CZ, T, WALL_H, 2 * RZ);
    // deep reveals + cold glass in each opening
    for (const z of WIN_Z) {
      addBox(root, M.dark, xc, midY, z, T + 0.04, midH, WIN_HZ * 2 + 0.2, 'guild_win_reveal', false);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_HZ * 2 - 0.1, midH), M.glass);
      glass.position.set(xc - sx * 0.02, midY, z);
      glass.rotation.y = sx * Math.PI / 2;
      glass.name = 'guild_win_glass';
      root.add(glass);
      // a slim stone mullion for the leaded-light read
      addBox(root, M.stone, xc - sx * 0.03, midY, z, 0.06, midH, 0.06, 'guild_mullion', false);
    }
  }

  // NORTH wall — solid (the masters' end, carries the banner)
  addBox(root, M.wall, CX, WALL_H / 2, ZN, 2 * RX, WALL_H, T, 'guild_wall_n', false);
  collideBox(CX, WALL_H / 2, ZN, 2 * RX, WALL_H, T);

  // SOUTH wall — split around the doorway; head + jambs + lintel
  const lw = DOOR_X0 - X0;
  addBox(root, M.wall, (X0 + DOOR_X0) / 2, WALL_H / 2, ZS, lw, WALL_H, T, 'guild_wall_s_l', false);
  collideBox((X0 + DOOR_X0) / 2, WALL_H / 2, ZS, lw, WALL_H, T);
  const rw = X1 - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + X1) / 2, WALL_H / 2, ZS, rw, WALL_H, T, 'guild_wall_s_r', false);
  collideBox((DOOR_X1 + X1) / 2, WALL_H / 2, ZS, rw, WALL_H, T);
  addBox(root, M.wall, CX, (DOOR_H + WALL_H) / 2, ZS, DOOR_W + 0.2, WALL_H - DOOR_H, T, 'guild_wall_s_head', false);
  addBox(root, M.stone, DOOR_X0 - 0.05, DOOR_H / 2, ZS, 0.16, DOOR_H, T + 0.04, 'guild_door_jamb_l', false);
  addBox(root, M.stone, DOOR_X1 + 0.05, DOOR_H / 2, ZS, 0.16, DOOR_H, T + 0.04, 'guild_door_jamb_r', false);
  addBox(root, M.stone, CX, DOOR_H + 0.18, ZS, DOOR_W + 0.4, 0.32, T + 0.06, 'guild_door_lintel', false);
}

// ---------------------------------------------------------------------- roof
// A proud king-post roof: eaves wall-plates, three trusses (tie beam · king post
// · two principal rafters), a ridge purlin, two boarded roof slopes, and gable
// in-fill closing the N/S ends. All above head height — visual only, no colliders.
function buildRoof(root, M) {
  const beams = [];
  // wall-plates along the eaves (E/W)
  for (const sx of [-1, 1]) pushBox(beams, CX + sx * (RX - 0.15), WALL_H - 0.15, CZ, 0.3, 0.3, 2 * RZ);
  // ridge purlin
  pushBox(beams, CX, APEX, CZ, 0.3, 0.3, 2 * RZ);
  const theta = Math.atan2(APEX - WALL_H, RX);
  const slopeLen = Math.hypot(RX, APEX - WALL_H);
  const trussZ = [-108, -100, -92];
  mergedMesh(root, beams, M.timberDk, 'guild_roof_purlins');
  for (const z of trussZ) {
    // tie beam across the wall-heads
    addBox(root, M.timber, CX, WALL_H, z, 2 * RX, 0.3, 0.28, 'guild_truss_tie', false);
    // king post up to the ridge
    addBox(root, M.timber, CX, (WALL_H + APEX) / 2, z, 0.28, APEX - WALL_H, 0.3, 'guild_truss_king', false);
    // two principal rafters (sloped)
    addBox(root, M.timber, CX - RX / 2, (WALL_H + APEX) / 2, z, slopeLen, 0.28, 0.24, 'guild_truss_rafter', false, 0, 0, theta);
    addBox(root, M.timber, CX + RX / 2, (WALL_H + APEX) / 2, z, slopeLen, 0.28, 0.24, 'guild_truss_rafter', false, 0, 0, -theta);
  }
  // boarded roof slopes (underside is the ceiling) + gable in-fill, merged
  const ov = 0.35;                                   // slight eaves overhang
  const zN = ZN - ov, zS = ZS + ov;
  const eW = X0 - ov, eE = X1 + ov;
  const slopes = [];
  // west slope: eave (x=eW,y=WALL_H) -> ridge (x=CX,y=APEX)
  pushQuad(slopes,
    [eW, WALL_H, zS], [CX, APEX, zS], [CX, APEX, zN], [eW, WALL_H, zN]);
  // east slope
  pushQuad(slopes,
    [CX, APEX, zS], [eE, WALL_H, zS], [eE, WALL_H, zN], [CX, APEX, zN]);
  mergedMesh(root, slopes, M.roof, 'guild_roof_slopes', true);
  // gable triangles closing N and S
  const gables = [];
  for (const z of [ZN, ZS]) {
    gables.push(X0, WALL_H, z, X1, WALL_H, z, CX, APEX, z);
  }
  mergedMesh(root, gables, M.wall, 'guild_gables', true);
}

// ---------------------------------------------------------------------- dais
// The masters' dais at the north head: a low walkable stone deck with three high
// seats facing down the hall, the centre one the guildmaster's. A step the player
// can walk onto (registered floor); the seat backs collide.
function buildDais(root, M) {
  const dz = ZN + 1.5;                               // centre z (z[-112,-109])
  const deck = addBox(root, M.stone, CX, DAIS_Y / 2, dz, 8, DAIS_Y, 3, 'guild_dais_deck', false);
  registerFloor(deck);
  // moulded front nosing
  addBox(root, M.stone, CX, DAIS_Y - 0.03, dz + 1.5, 8, 0.1, 0.12, 'guild_dais_nose', false);

  const seatZ = ZN + 1.1;
  const seats = [[CX, 1.0], [CX - 2.4, 0.75], [CX + 2.4, 0.75]];   // centre taller
  for (const [sx, backH] of seats) {
    addBox(root, M.timberDk, sx, DAIS_Y + 0.24, seatZ, 1.0, 0.14, 0.9, 'guild_seat_pan', false);
    addBox(root, M.timberDk, sx, DAIS_Y + 0.24 + backH / 2, seatZ - 0.42, 1.0, backH, 0.14, 'guild_seat_back', false);
    for (const lx of [-0.42, 0.42]) for (const lz of [-0.38, 0.38]) {
      addBox(root, M.timberDk, sx + lx, DAIS_Y + 0.12, seatZ + lz, 0.12, 0.24, 0.12, 'guild_seat_leg', false);
    }
    addBox(root, M.timberDk, sx, DAIS_Y + 0.58, seatZ - 0.02, 1.0, 0.12, 0.9, 'guild_seat_arm', false);
    collideBox(sx, DAIS_Y + 0.6, seatZ - 0.3, 1.0, 1.2, 0.6);
  }
}

// -------------------------------------------------------------------- banner
// The faded heraldic banner of the masons' guild, hung on the north wall over the
// dais — a pale square on a dull crimson field, moth-eaten but still hung square.
function buildBanner(root, M) {
  const bz = ZN + T / 2 + 0.03;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), M.banner);
  banner.position.set(CX, 3.5, bz);
  banner.name = 'guild_banner';
  root.add(banner);
  // a plain cross-pole it hangs from
  addBox(root, M.timberDk, CX, 4.85, bz + 0.03, 1.9, 0.09, 0.09, 'guild_banner_pole', false);
}

// ---------------------------------------------------------------------- table
// The long work / meeting table down the hall axis, benches to either side, and
// the working clutter it was left with: dividers, a mason's square, chisels, a
// mallet, a ledger, and a plan pinned flat with one corner curling up. Krieg's
// guild roll (the readable leaf) is placed in buildDocuments.
function buildTable(root, M) {
  const tz = -100, tlen = 10;
  addBox(root, M.timber, CX, TABLE_Y - 0.03, tz, 1.5, 0.06, tlen, 'guild_table_top', false);
  // trestle frames
  for (const lz of [tz - tlen / 2 + 0.8, tz, tz + tlen / 2 - 0.8]) {
    for (const lx of [-0.6, 0.6]) addBox(root, M.timberDk, CX + lx, 0.4, lz, 0.16, 0.8, 0.2, 'guild_table_leg', false);
    addBox(root, M.timberDk, CX, 0.6, lz, 1.3, 0.12, 0.12, 'guild_table_stretch', false);
  }
  addBox(root, M.timberDk, CX, 0.2, tz, 0.14, 0.1, tlen - 1.0, 'guild_table_footrail', false);
  collideBox(CX, TABLE_Y / 2 + 0.1, tz, 1.5, TABLE_Y + 0.2, tlen);

  // benches flanking
  for (const sx of [-1.4, 1.4]) {
    addBox(root, M.timberDk, CX + sx, 0.44, tz, 0.4, 0.1, tlen - 1.4, 'guild_bench', false);
    for (const lz of [tz - (tlen - 1.4) / 2 + 0.4, tz, tz + (tlen - 1.4) / 2 - 0.4]) {
      addBox(root, M.timberDk, CX + sx, 0.22, lz, 0.36, 0.44, 0.14, 'guild_bench_leg', false);
    }
    collideBox(CX + sx, 0.35, tz, 0.4, 0.7, tlen - 1.4);
  }

  // --- the clutter, left mid-task ---
  const yT = TABLE_Y + 0.02;
  // a plan pinned flat, one corner curling (parch quad on the table + a lifted lip)
  flatQuad(root, M.parch, CX - 0.35, yT, tz - 2.4, 0.9, 1.2, 'guild_plan', 0.1);
  addBox(root, M.parch, CX - 0.75, yT + 0.08, tz - 2.9, 0.4, 0.02, 0.3, 'guild_plan_curl', false, -0.6, 0.2, 0);
  for (const s of [-1, 1]) addBox(root, M.iron, CX - 0.35 + s * 0.42, yT + 0.01, tz - 2.9, 0.06, 0.04, 0.06, 'guild_plan_weight', false);

  // a ledger (closed book) near the head end
  addBox(root, M.timberDk, CX + 0.35, yT + 0.05, tz - 3.6, 0.5, 0.1, 0.66, 'guild_ledger', false, 0, 0.15, 0);
  addBox(root, M.parch, CX + 0.35, yT + 0.09, tz - 3.6, 0.44, 0.04, 0.6, 'guild_ledger_leaves', false, 0, 0.15, 0);

  // mason's iron square (an L of two thin bars) and dividers
  const tools = [];
  pushBox(tools, CX + 0.5, yT + 0.02, tz + 1.0, 0.05, 0.03, 0.6);       // square, long arm
  pushBox(tools, CX + 0.72, yT + 0.02, tz + 0.72, 0.4, 0.03, 0.05);     // square, short arm
  pushBox(tools, CX - 0.2, yT + 0.02, tz + 1.6, 0.04, 0.03, 0.5);       // dividers leg
  pushBox(tools, CX - 0.12, yT + 0.02, tz + 1.6, 0.04, 0.03, 0.5);      // dividers leg
  for (let i = 0; i < 4; i++) pushBox(tools, CX - 0.55 + i * 0.12, yT + 0.02, tz + 2.4, 0.03, 0.04, 0.34); // chisels
  mergedMesh(root, tools, M.iron, 'guild_table_tools');
  // a wooden mallet lying by the chisels
  addBox(root, M.timber, CX + 0.1, yT + 0.05, tz + 2.6, 0.16, 0.14, 0.3, 'guild_mallet_head', false, 0, 0.3, 0);
  addBox(root, M.timberDk, CX + 0.35, yT + 0.03, tz + 2.6, 0.4, 0.05, 0.05, 'guild_mallet_haft', false, 0, 0.3, 0);
}

// ------------------------------------------------------------------ wall tools
// The emblems and tools of the three crafts, mounted a touch proud of the walls:
// the mason's square + chisels (west), the joiner's saw + planes (east). The
// smith's tongs & hammers hang by the forge (buildForge).
function buildWallTools(root, M) {
  const wIn = X0 + T / 2 + 0.06;      // west inner face + a touch
  const eIn = X1 - T / 2 - 0.06;      // east inner face - a touch

  // WEST — mason's great square (mounted L) between windows, at z=-108
  const sq = [];
  pushBox(sq, wIn + 0.02, 3.7, -108.0, 0.06, 0.09, 1.4);           // stock
  pushBox(sq, wIn + 0.02, 3.05, -107.4, 0.06, 1.2, 0.09);          // blade
  mergedMesh(root, sq, M.iron, 'guild_emblem_square');
  // a hanging rack of chisels on the west wall, at z=-92
  const chis = [];
  addBox(root, M.timberDk, wIn + 0.06, 2.7, -92.0, 0.12, 0.08, 1.4, 'guild_chisel_rail', false);
  for (let i = 0; i < 6; i++) pushBox(chis, wIn + 0.14, 2.35, -92.6 + i * 0.24, 0.04, 0.5, 0.03);
  mergedMesh(root, chis, M.iron, 'guild_chisels');

  // EAST — joiner's frame-saw (long blade + oak frame) at z=-108
  addBox(root, M.timberDk, eIn - 0.04, 3.2, -108.0, 0.08, 0.1, 1.6, 'guild_saw_frame_t', false);
  addBox(root, M.timberDk, eIn - 0.04, 2.2, -108.0, 0.08, 0.1, 1.6, 'guild_saw_frame_b', false);
  for (const zz of [-108.7, -107.3]) addBox(root, M.timberDk, eIn - 0.04, 2.7, zz, 0.08, 1.1, 0.1, 'guild_saw_cheek', false);
  addBox(root, M.iron, eIn - 0.1, 2.55, -108.0, 0.02, 0.12, 1.4, 'guild_saw_blade', false);
  // joiner's planes on a small shelf at z=-96
  addBox(root, M.timberDk, eIn - 0.12, 1.5, -96.0, 0.3, 0.06, 1.2, 'guild_plane_shelf', false);
  for (let i = 0; i < 3; i++) {
    addBox(root, M.timber, eIn - 0.14, 1.62, -96.5 + i * 0.5, 0.22, 0.14, 0.34, 'guild_plane', false);
    addBox(root, M.iron, eIn - 0.14, 1.72, -96.5 + i * 0.5, 0.06, 0.1, 0.05, 'guild_plane_iron', false);
  }
}

// ---------------------------------------------------------------------- racks
// Racks of raw material flanking the dais: dressed stone blocks (NW) and Baltic
// oak timber baulks (NE) — the guild's stock-in-trade, squared and stacked.
function buildRacks(root, M) {
  // NW: a low rack of dressed stone blocks, coursed and squared
  const bz = ZN + 1.6, bx = X0 + 1.2;
  const blocks = [];
  const rows = [[0.0, 3], [0.62, 2], [1.14, 1]];        // a settling pyramid
  for (const [y0, n] of rows) {
    for (let i = 0; i < n; i++) {
      blocks.push(bx, 0.3 + y0, bz - 0.9 + i * 0.9 + y0 * 0.3, 0.9, 0.58, 0.8);
    }
  }
  const arr = [];
  for (let i = 0; i < blocks.length; i += 6) pushBox(arr, blocks[i], blocks[i + 1], blocks[i + 2], blocks[i + 3], blocks[i + 4], blocks[i + 5]);
  mergedMesh(root, arr, M.stone, 'guild_stone_rack');
  collideBox(bx, 0.8, bz, 1.1, 1.6, 2.6);

  // NE: a timber rack — squared oak baulks leaning in a cradle
  const tx = X1 - 1.2, tzc = ZN + 1.6;
  addBox(root, M.timberDk, tx, 0.9, tzc - 1.2, 0.16, 1.8, 0.2, 'guild_timber_post', false);
  addBox(root, M.timberDk, tx, 0.9, tzc + 1.2, 0.16, 1.8, 0.2, 'guild_timber_post', false);
  const baulks = [];
  for (let i = 0; i < 5; i++) {
    const yy = 0.35 + i * 0.28;
    pushBox(baulks, tx - i * 0.05, yy, tzc, 0.26, 0.24, 2.4);
  }
  mergedMesh(root, baulks, M.timber, 'guild_timber_baulks');
  collideBox(tx, 1.0, tzc, 0.7, 2.0, 2.6);
}

// --------------------------------------------------------------------- banker
// A mason's banker (heavy low stone bench) on the west side, with a block of
// stone left HALF-DRESSED where the work stopped — one face squared and true,
// the rest still rough — a mallet and a chisel where they were set down.
function buildBanker(root, M) {
  const bx = X0 + 1.7, bz = -100;
  addBox(root, M.stoneRough, bx, 0.4, bz, 1.5, 0.8, 1.0, 'guild_banker', false);
  collideBox(bx, 0.4, bz, 1.5, 0.8, 1.0);
  // the half-dressed block: a rough core with one clean dressed face and a chamfer
  addBox(root, M.stoneRough, bx, 1.1, bz, 0.8, 0.6, 0.8, 'guild_block_rough', false);
  addBox(root, M.stone, bx + 0.42, 1.1, bz, 0.02, 0.56, 0.72, 'guild_block_face', false);     // the true face
  addBox(root, M.stone, bx, 1.42, bz, 0.7, 0.04, 0.7, 'guild_block_top', false);              // squared top
  // stone dust / chippings banked at the foot of the banker
  const chips = [];
  for (let i = 0; i < 40; i++) pushBox(chips, bx + rr(0.4, 1.0), 0.02, bz + rr(-0.6, 0.6), rr(0.03, 0.09), 0.02, rr(0.03, 0.09));
  mergedMesh(root, chips, M.stoneRough, 'guild_chippings');
  // the mallet and chisel set down on the block, mid-cut
  addBox(root, M.timber, bx + 0.1, 1.5, bz + 0.35, 0.16, 0.14, 0.3, 'guild_banker_mallet', false, 0, 0.5, 0);
  addBox(root, M.iron, bx - 0.05, 1.48, bz - 0.2, 0.05, 0.28, 0.05, 'guild_banker_chisel', false, 0.5, 0, 0);
}

// ---------------------------------------------------------------------- forge
// A small forge nook at the SOUTH-EAST foot: a raised stone hearth against two
// walls with a hood and flue, a bed of cold ash with one dim ember still in it,
// Werner Ochs's anvil on an oak stump, and his tongs & hammers hung by the fire.
function buildForge(root, M) {
  const hx = X1 - 1.2, hz = ZS - 1.6;                 // hearth centre (~207-ish, -89.6)
  // raised hearth mass against the east + south walls
  addBox(root, M.stone, hx, 0.6, hz, 2.0, 1.2, 1.8, 'guild_forge_base', false);
  collideBox(hx, 0.6, hz, 2.0, 1.2, 1.8);
  // fire bed recess + cold ash + the live ember (glow plane, warm)
  addBox(root, M.dark, hx, 1.24, hz, 1.2, 0.2, 1.0, 'guild_forge_bed', false);
  addBox(root, M.ash, hx, 1.28, hz, 1.0, 0.06, 0.8, 'guild_forge_ash', false);
  const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), M.ember);
  ember.position.set(hx, 1.33, hz); ember.rotation.x = -Math.PI / 2; ember.name = 'guild_forge_ember';
  root.add(ember);
  // hood + flue rising to the roof (batters back to the corner)
  addBox(root, M.stone, hx, 2.4, hz - 0.2, 1.8, 1.2, 1.0, 'guild_forge_hood', false);
  addBox(root, M.stone, hx, 4.2, hz - 0.4, 1.0, 2.4, 0.8, 'guild_forge_flue', false);
  // a hand-bellows nozzle into the fire's side
  addBox(root, M.timberDk, hx - 1.2, 1.0, hz, 0.9, 0.4, 0.5, 'guild_bellows', false, 0, 0, 0.1);
  addBox(root, M.iron, hx - 0.7, 1.1, hz, 0.4, 0.06, 0.06, 'guild_bellows_pipe', false);

  // the anvil on an oak stump, out in front of the fire
  const ax = hx - 2.4, az = hz - 0.2;
  addBox(root, M.timberDk, ax, 0.35, az, 0.55, 0.7, 0.55, 'guild_anvil_stump', false);
  addBox(root, M.iron, ax, 0.82, az, 0.7, 0.26, 0.34, 'guild_anvil_body', false);        // face
  addBox(root, M.iron, ax, 0.72, az, 0.4, 0.14, 0.24, 'guild_anvil_waist', false);       // waist
  addBox(root, M.iron, ax + 0.5, 0.85, az, 0.4, 0.14, 0.16, 'guild_anvil_horn', false);  // horn
  collideBox(ax, 0.55, az, 0.6, 1.1, 0.6);
  // a hammer left on the anvil face, and a bar of iron half-worked
  addBox(root, M.iron, ax - 0.05, 0.98, az, 0.14, 0.14, 0.26, 'guild_hammer_head', false);
  addBox(root, M.timberDk, ax - 0.05, 0.95, az + 0.34, 0.05, 0.05, 0.42, 'guild_hammer_haft', false);
  addBox(root, M.ironDk, ax + 0.2, 0.97, az, 0.5, 0.05, 0.08, 'guild_workbar', false, 0, 0.3, 0);

  // smith's tools hung on the east wall by the fire: tongs + hammers
  const eIn = X1 - T / 2 - 0.06;
  const smith = [];
  for (const zz of [ZS - 3.2, ZS - 3.6]) {                 // two pairs of tongs
    pushBox(smith, eIn - 0.02, 2.4, zz, 0.05, 1.0, 0.04);
    pushBox(smith, eIn - 0.02, 2.9, zz - 0.06, 0.05, 0.1, 0.16);
  }
  for (const zz of [ZS - 4.2, ZS - 4.5]) {                 // two hammers
    pushBox(smith, eIn - 0.02, 2.5, zz, 0.05, 0.9, 0.04);
    pushBox(smith, eIn - 0.02, 3.0, zz, 0.12, 0.14, 0.16);
  }
  mergedMesh(root, smith, M.iron, 'guild_smith_tools');
}

// ---------------------------------------------------------------------- body
// Werner Ochs, down where he fell between the anvil and the fire. Hands and feet
// gone black at the ends; a dark stain worked into the flags and the pale marks
// of a brush that gave out beside it. Crude merged box-figure, grounded.
const OCHS = { cx: X1 - 3.7, cz: ZS - 2.6, dir: -1, surf: 0 };   // by the anvil

function buildBody(root, M) {
  // Werner Ochs — shared low-poly corpse, fallen on his side where he worked,
  // between the anvil and the cold forge (y=0). Head toward +Z, leather apron.
  const c = makeCorpse({ pose: 'side', cloth: 0x4a3b28, seed: 17 });
  c.position.set(OCHS.cx, OCHS.surf, OCHS.cz); c.rotation.y = -Math.PI / 2; c.name = 'guild_body'; root.add(c);
  // the smith's leather apron cast to one side
  addBox(root, M.linen, OCHS.cx + 0.5, 0.05, OCHS.cz + 0.4, 0.7, 0.04, 0.9, 'guild_apron', false, 0, 0.3, 0);
  // a generous dark-brown stain worked into the flags, the brush that gave out
  // beside it, and the pale scrub marks that ring it
  const stain = makeStain({ r: 1.2, seed: 18 });
  stain.position.set(OCHS.cx, OCHS.surf + 0.002, OCHS.cz); root.add(stain);
  for (const s of [-1, 1]) flatQuad(root, M.scrub, OCHS.cx + s * 0.6, 0.021, OCHS.cz + 0.2, 0.16, 0.8, 'guild_scrub');
  addBox(root, M.timberDk, OCHS.cx + 0.75, 0.05, OCHS.cz - 0.3, 0.06, 0.05, 0.3, 'guild_brush', false, 0, 0.6, 0);
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: drifts of dead flies banked in the corners (never labelled), and a
// little lime scattered at the south threshold. Nothing labelled, nothing floats.
function buildAmbientGrammar(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz), rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
  };
  drift(X0 + 0.7, 0.01, ZN + 0.7, 0.5, 0.5, 52);
  drift(X1 - 0.7, 0.01, ZN + 0.7, 0.5, 0.5, 46);
  drift(X0 + 0.7, 0.01, ZS - 0.7, 0.5, 0.5, 50);
  drift(X1 - 0.7, 0.01, ZS - 0.7, 0.5, 0.5, 44);
  drift(OCHS.cx + 0.3, 0.02, OCHS.cz, 0.7, 0.8, 42);   // banked to the body
  drift(X1 - 1.2, 1.34, ZS - 1.6, 0.4, 0.4, 22);        // in the cold ash
  mergedMesh(root, flies, M.fly, 'guild_flies');

  const lime = [];
  for (let i = 0; i < 60; i++) {
    const lx = rr(DOOR_X0 - 0.5, DOOR_X1 + 0.5), lz = rr(ZS - 1.1, ZS - 0.1);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'guild_lime');
}

// ------------------------------------------------------------------ lighting
// Local point lights only (no global ambient — other areas' tuning is untouched).
// Cold daylight pools at the tall windows (sources = the glowing glass planes),
// one dim warm ember in the forge, and a couple of low cool fills so the high
// timber roof reads. The ember breathes; the cold light barely stirs.
function buildLighting(root, M) {
  const cold = [];
  for (const sx of [-1, 1]) {
    const xc = CX + sx * (RX - 0.6);
    for (const z of WIN_Z) {
      const l = new THREE.PointLight(0x9fb4cc, 6.0, 11, 1.7);
      l.position.set(xc, (WIN_SILL + WIN_HEAD) / 2, z);
      l.name = 'guild_light_win'; addLight(l);
      cold.push({ light: l, base: 6.0 });
    }
  }
  // the forge ember (warm, very dim, motivated by the glow plane)
  const hx = X1 - 1.2, hz = ZS - 1.6;
  const ember = new THREE.PointLight(0xb2531e, 2.6, 6.5, 2.2);
  ember.position.set(hx, 1.5, hz); ember.name = 'guild_light_ember'; addLight(ember);

  // low cool fills so the roof timbers read (kept dim — a cold, still hall)
  for (const fz of [-105, -95]) {
    const fill = new THREE.PointLight(0x53606e, 6.0, 22, 1.2);
    fill.position.set(CX, WALL_H - 0.6, fz); fill.name = 'guild_light_fill'; addLight(fill);
  }
  const daisFill = new THREE.PointLight(0x53606e, 4.5, 16, 1.3);
  daisFill.position.set(CX, WALL_H - 0.8, ZN + 2.5); daisFill.name = 'guild_light_fill_dais'; addLight(daisFill);

  onUpdate((dt, t) => {
    const n = Math.sin(t * 8.9) * 0.5 + Math.sin(t * 5.7 + 1.1) * 0.3 + Math.sin(t * 17.0) * 0.2;
    ember.intensity = 2.6 * (1 + 0.2 * Math.sin(t * 1.6) + 0.08 * n);   // slow, dying pulse
    for (const c of cold) c.light.intensity = c.base * (1 + 0.03 * Math.sin(t * 0.5 + c.base));
  });
}

// ------------------------------------------------------------------- documents
// One readable leaf: Krieg's guild roll, open on the work table (rests flat on
// TABLE_Y). The masons' roll of the third quarter's payment, eleven names struck
// and no cause entered — Payment III's evidence (world-bible §5.1 / §9). It never
// says what happened. The register is Krieg's: proud, exact about craft.
function buildDocuments(world, root, M) {
  const geo = new THREE.PlaneGeometry(0.5, 0.66);
  const marker = new THREE.Mesh(geo, M.leaf);
  marker.name = 'guild_doc_roll';
  marker.position.set(CX - 0.45, TABLE_Y, -103.4);         // y === surface top (rests flat)
  marker.rotation.set(-Math.PI / 2, 0, 0.12);
  root.add(marker);

  const doc = {
    id: 'guild_krieg_roll',
    type: 'Guild roll', style: '', voice: 'Guildmaster Balthasar Krieg',
    dateText: 'the third payment',
    prompt: 'A guild roll lies open on the table, a column of names down it, a fair few struck through.',
    pages:
      'Masons’ Guild of Hochmauer. Roll of the Yard.\n' +
      'Kept in my own hand, this being the reckoning of the third payment.\n\n' +
      'Sent up to the high works, and not come down again:\n\n' +
      '   Henne Vend, dresser        — struck\n' +
      '   Clas Ruter, layer         — struck\n' +
      '   Merten Approll, layer      — struck\n' +
      '   Ambros Steyn, dresser      — struck\n' +
      '   Lorenz Bant, layer         — struck\n' +
      '   ( and six more below, each struck )\n\n' +
      'Eleven names, and against no one of them a cause. I am told to enter none. ' +
      'A roll with no cause is not a roll; it is a hole in the book. I have kept clean ' +
      'books in this hall for thirty years and I will not sign this one clean.\n\n' +
      'Below, in a smaller hand run down the margin:\n\n' +
      'The east courses run to no plan I was taught. I set them as I am given them. ' +
      'My father would have put down his hammer and gone home.',
  };
  registerInteractable({
    object: marker, radius: 2.0, label: doc.prompt,
    onExamine: () => { if (world.reader) world.reader.open(doc); },
  });
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§10): he names what he sees, never the meaning.
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
  // the half-dressed block on the banker
  registerProp(world, 'guild_ix_block', X0 + 1.7, 1.1, -100, 2.0,
    'A block of stone stood on the banker, dressed true on one face and left rough on the other three. The mallet and chisel lie on it where they were set down.',
    'The cut stops clean in the middle of a stroke. Stone dust is banked at the foot of the bench and has not been swept. Whoever was squaring this walked away between one blow and the next, and did not come back for the tools.');

  // Werner Ochs, down by his anvil
  registerProp(world, 'guild_ix_ochs', OCHS.cx, 0.5, OCHS.cz, 2.4,
    'A big man down on the flags between the anvil and the fire, an apron cast off beside him. The stone under him is stained dark, with pale scratches ringing it where a brush went at it.',
    'His hands and feet are gone black at the ends. A hammer still lies on the anvil face and a bar half-worked beside it. The scrubbing gave out before the stain did, and the fire he kept has burned down to one ember.');
}
