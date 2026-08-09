import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';

// ===========================================================================
// THE BRIDAL HALL  (atlas #19 — Gen 7, the devil ASMODEUS · world-bible §7.2
// diabolical works · §7.2 table: "A small hall furnished for a wedding feast
// that was never held, set for two, dressed and finished in month ten.
// Adelheid ordered it locked. The key was never found.")
//
// A fine hall dressed for a wedding banquet that never happened. The tables are
// laid — plates set square, cups filled once and long since dried, cutlery,
// candlesticks gone cold, a great tiered cake now slumped to dust and mould.
// The chairs are pushed in and were never drawn out; no one sat. On the dais at
// the head, a high table is set FOR TWO — the bride's seat and the groom's, both
// empty, a veil folded over the near chair where a hand left it. The great doors
// at the head are barred and locked, with no key in the lock and none on the
// floor; the wood is scratched low on the inside, and dust and dead flies have
// drifted along the sill. Cold still light through tall windows. The horror is
// the restraint (§9): nothing gory, no bodies — the emptiness is the point.
//
// Self-contained island centred C = (-200, 0, -100); all geometry within ~±16.
// Floor y=0. buildBridalHall(world) builds its own geometry/materials/colliders/
// floor/lights, one readable leaf (Adelheid's order to lock the hall), and its
// own examinables, registers its OWN zone, and returns { root, entry }. It does
// NOT edit or import other area files and registers no portals. Every named
// object is prefixed `bhl_`. DETERMINISM: no Math.random / Date.now — a seeded
// LCG drives all scatter.
// ===========================================================================

// --- island frame (metres) -------------------------------------------------
const CX = -200;                           // island centre x
const RX = 7;                              // interior half-width -> 14 (x)
const X0 = CX - RX, X1 = CX + RX;          // wall centrelines  x [-207, -193]
const ZN = -108, ZS = -87;                 // north (dais/great doors) · south (entry)
const CZM = (ZN + ZS) / 2;                 // hall centre in z (-97.5)
const T = 0.5;                             // dressed-stone wall thickness
const WALL_H = 6.0;                        // a fine, tall hall

const XW_IN = X0 + T / 2;                  // west inner face  -206.75
const XE_IN = X1 - T / 2;                  // east inner face  -193.25
const ZN_IN = ZN + T / 2;                  // north inner face -107.75 (dais/doors)
const ZS_IN = ZS - T / 2;                  // south inner face  -87.25 (entry)

const WIN_SILL = 1.6, WIN_HEAD = 4.4;      // tall window band
const WIN_HZ = 0.8;                        // window half-width along z
const WIN_Z = [-101.5, -95.5, -89.5];      // three windows per side wall

// entry doorway (the way you got in) — south wall centre
const DOOR_CX = CX, DOOR_W = 1.6, DOOR_H = 2.6;
const DOOR_X0 = DOOR_CX - DOOR_W / 2, DOOR_X1 = DOOR_CX + DOOR_W / 2;

// the great barred doors at the head — north wall centre, in front of the dais
const GDOOR_CX = CX, GDOOR_W = 2.4, GDOOR_H = 3.6;
const GDOOR_X0 = GDOOR_CX - GDOOR_W / 2, GDOOR_X1 = GDOOR_CX + GDOOR_W / 2;

// dais at the head (low raised platform under the high table)
const DAIS_TOP = 0.2;                       // dais walking/standing surface
const DAIS_Z1 = -104;                       // dais south edge
const HIGH_TOP = DAIS_TOP + 0.78;           // high-table top surface (0.98)
const TABLE_TOP = 0.78;                     // long-table top surface

// --- entry: on the hall floor just inside the south doorway, facing -Z (north,
// down the length of the hall toward the dais). yaw = PI faces -Z. ----------
const BRIDAL_ENTRY = { x: -200, y: 1.7, z: -88, yaw: Math.PI };

// ---------------------------------------------------------------------------
// Seeded LCG — stable scatter (dust, flies, lime, stone speckle).
// ---------------------------------------------------------------------------
let _seed = 0x0b71d41;
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

// A flat, surface-hugging quad (stains, dust, scratches) lying in the XZ plane.
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
  for (let i = 0; i < 320; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.15, 0.5);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  if (courses) {                                   // fine ashlar coursing (good stone)
    g.strokeStyle = 'rgba(30,27,22,0.32)'; g.lineWidth = 1;
    for (let y = 16; y < 64; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function timberTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#4a3826'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i++) {
    const a = 0.05 + rr(0, 0.12);
    x.fillStyle = (rnd() < 0.5) ? `rgba(28,20,12,${a})` : `rgba(104,84,56,${a})`;
    x.fillRect(0, i, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}

// Cold still daylight — a pale blue-white vertical gradient (fog-free).
function glassTex() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 48;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 48, 0, 0);
  grd.addColorStop(0, '#93a6bd'); grd.addColorStop(1, '#c6d2de');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 48);
  return crunch(new THREE.CanvasTexture(c));
}

function makeMaterials() {
  const wallTex = speckTex('#8a8375', '#5c564b', true); wallTex.repeat.set(4, 2);
  const floorTex = speckTex('#7d7668', '#524c42', true); floorTex.repeat.set(7, 10);
  const lambert = (o) => ps1ify(new THREE.MeshLambertMaterial(o));
  const basic = (o) => ps1ify(new THREE.MeshBasicMaterial(o));
  return {
    wall: lambert({ color: 0x9a9384, map: wallTex }),      // fine dressed stone
    floor: lambert({ color: 0x8b8475, map: floorTex }),    // flagstone
    stone: lambert({ color: 0x938c7e }),                   // dais, dressed stone
    timber: lambert({ color: 0x9a8c74, map: timberTex() }),// oak (tables, chairs)
    timberDk: lambert({ color: 0x3f3222 }),                // darker/older oak
    ceil: lambert({ color: 0x241d16 }),                    // dim beamed roof deck
    linen: lambert({ color: 0x9a968a }),                   // table cloth, once white
    veil: lambert({ color: 0xbcb8ac }),                    // bride's veil / gown
    metal: lambert({ color: 0x6a6c70 }),                   // candlesticks, cutlery
    plate: lambert({ color: 0x86888d }),                   // pewter plates, cups
    wax: lambert({ color: 0xbfb49a }),                     // dead candle stubs
    cake: lambert({ color: 0xa9a08d }),                    // wedding cake, gone to dust
    mould: lambert({ color: 0x6b6f55 }),                   // mould on the cake
    husk: lambert({ color: 0x5c4a30 }),                    // garlands gone to brown husk
    door: lambert({ color: 0x4a3826 }),                    // the heavy great doors
    iron: lambert({ color: 0x53555a }),                    // door bands, the lock
    fly: lambert({ color: 0x17140f }),                     // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),                    // lime at the threshold
    dust: basic({ color: 0x8f887a, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    stain: basic({ color: 0x241f1a, side: THREE.DoubleSide }),
    scratch: basic({ color: 0x241b12, side: THREE.DoubleSide }),
    glass: basic({ map: glassTex(), fog: false, side: THREE.DoubleSide }),
    flame: basic({ color: 0xe8b56a, fog: false, transparent: true, side: THREE.DoubleSide }),
    parch: basic({
      color: 0xb7a06a, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildBridalHall(world) {
  const root = new THREE.Group();
  root.name = 'bhl_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloorAndRoof(root, M);
  buildWalls(root, M);
  buildWindows(root, M);
  buildGreatDoors(root, M);
  buildDais(root, M);
  buildHighTable(root, M);
  buildCake(root, M);
  buildLongTables(root, M);
  buildGarlands(root, M);
  buildAmbientGrammar(root, M);
  buildLighting();
  buildDocument(world, root, M);
  buildExaminables(world);

  // Own zone over the whole island volume (walls + a little air above).
  world.registerZone({ name: 'The Bridal Hall', min: [-208, -1, -109], max: [-192, 8, -86] });

  return { root, entry: BRIDAL_ENTRY };
}

// ------------------------------------------------------------ floor / roof
function buildFloorAndRoof(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, ZS - ZN), M.floor);
  floor.name = 'bhl_floor';
  floor.position.set(CX, 0, CZM);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);

  // worn threshold sill at the south entry
  addBox(root, M.stone, DOOR_CX, 0.02, ZS_IN - 0.35, DOOR_W + 0.3, 0.06, 0.5, 'bhl_sill', false);

  // dim beamed roof deck with cross-beams (a fine hall, well built)
  addBox(root, M.ceil, CX, WALL_H + 0.12, CZM, (X1 - X0) + 2 * T, 0.2, (ZS - ZN) + 2 * T, 'bhl_roof_deck', false);
  for (let z = ZN + 1.4; z <= ZS - 1.4; z += 1.8) {
    addBox(root, M.timberDk, CX, WALL_H - 0.16, z, X1 - X0, 0.3, 0.24, 'bhl_roof_beam', false);
  }
  // two wall-plates the beams land on
  addBox(root, M.timberDk, XW_IN + 0.15, WALL_H - 0.24, CZM, 0.24, 0.32, ZS - ZN, 'bhl_plate_w', false);
  addBox(root, M.timberDk, XE_IN - 0.15, WALL_H - 0.24, CZM, 0.24, 0.32, ZS - ZN, 'bhl_plate_e', false);
}

// -------------------------------------------------------------------- walls
function buildWalls(root, M) {
  const yc = WALL_H / 2;
  const midY = (WIN_SILL + WIN_HEAD) / 2, midH = WIN_HEAD - WIN_SILL;

  // EAST + WEST walls (fixed x, run along z): solid but for three tall windows.
  for (const sx of [-1, 1]) {
    const xc = (sx < 0) ? X0 : X1;
    addBox(root, M.wall, xc, WIN_SILL / 2, CZM, T, WIN_SILL, ZS - ZN, 'bhl_wall_lo', false);
    addBox(root, M.wall, xc, (WIN_HEAD + WALL_H) / 2, CZM, T, WALL_H - WIN_HEAD, ZS - ZN, 'bhl_wall_hi', false);
    const gaps = WIN_Z.map((z) => [z - WIN_HZ, z + WIN_HZ]);
    const segs = [[ZN, gaps[0][0]], [gaps[0][1], gaps[1][0]], [gaps[1][1], gaps[2][0]], [gaps[2][1], ZS]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      addBox(root, M.wall, xc, midY, (a + b) / 2, T, midH, b - a, 'bhl_wall_mid', false);
    }
    collideBox(xc, yc, CZM, T, WALL_H, ZS - ZN);
  }

  // NORTH wall (dais/great-doors end, z=ZN): split around the great-door opening.
  const nLeftW = GDOOR_X0 - (X0 - T);
  addBox(root, M.wall, ((X0 - T) + GDOOR_X0) / 2, yc, ZN - T / 2, nLeftW, WALL_H, T, 'bhl_wall_n_l', false);
  collideBox(((X0 - T) + GDOOR_X0) / 2, yc, ZN, nLeftW, WALL_H, T);
  const nRightW = (X1 + T) - GDOOR_X1;
  addBox(root, M.wall, (GDOOR_X1 + (X1 + T)) / 2, yc, ZN - T / 2, nRightW, WALL_H, T, 'bhl_wall_n_r', false);
  collideBox((GDOOR_X1 + (X1 + T)) / 2, yc, ZN, nRightW, WALL_H, T);
  addBox(root, M.wall, GDOOR_CX, (GDOOR_H + WALL_H) / 2, ZN - T / 2, GDOOR_W + 0.1, WALL_H - GDOOR_H, T, 'bhl_wall_n_lintel', false);

  // SOUTH wall (entry end, z=ZS): split around the doorway + a lintel.
  const sLeftW = DOOR_X0 - (X0 - T);
  addBox(root, M.wall, ((X0 - T) + DOOR_X0) / 2, yc, ZS + T / 2, sLeftW, WALL_H, T, 'bhl_wall_s_l', false);
  collideBox(((X0 - T) + DOOR_X0) / 2, yc, ZS, sLeftW, WALL_H, T);
  const sRightW = (X1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (X1 + T)) / 2, yc, ZS + T / 2, sRightW, WALL_H, T, 'bhl_wall_s_r', false);
  collideBox((DOOR_X1 + (X1 + T)) / 2, yc, ZS, sRightW, WALL_H, T);
  addBox(root, M.wall, DOOR_CX, (DOOR_H + WALL_H) / 2, ZS + T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'bhl_wall_s_lintel', false);
}

// ------------------------------------------------------------------- windows
// Cold emissive glass flush in each opening + a slim stone mullion. Lights are
// placed in buildLighting at the same coordinates.
function buildWindows(root, M) {
  const wh = WIN_HEAD - WIN_SILL, wy = (WIN_SILL + WIN_HEAD) / 2;
  for (const sx of [-1, 1]) {
    const xg = (sx < 0) ? XW_IN + 0.02 : XE_IN - 0.02;
    for (const z of WIN_Z) {
      addBox(root, M.glass, xg, wy, z, 0.04, wh, WIN_HZ * 2 - 0.06, 'bhl_glass', false);
      addBox(root, M.stone, xg + (sx < 0 ? -0.02 : 0.02), wy, z, 0.05, wh, 0.06, 'bhl_mullion', false);
      addBox(root, M.stone, xg + (sx < 0 ? -0.02 : 0.02), wy, z, 0.05, 0.06, WIN_HZ * 2, 'bhl_transom', false);
    }
  }
}

// -------------------------------------------------------------- great doors
// The barred, locked doors at the head of the hall — two heavy leaves closed in
// the opening, iron bands, a great lock with NO key. Scratch-marks low on the
// inside, and dust and dead flies drifted at the sill. Impassable (one collider).
function buildGreatDoors(root, M) {
  const zf = ZN_IN + 0.02;                       // inner face of the doors
  for (const sx of [-1, 1]) {
    const lx = GDOOR_CX + sx * (GDOOR_W / 4);
    addBox(root, M.door, lx, GDOOR_H / 2, zf, GDOOR_W / 2 - 0.03, GDOOR_H, 0.12, 'bhl_gdoor_leaf', false);
    // iron bands across each leaf
    for (const by of [0.7, 1.8, 2.9]) {
      addBox(root, M.iron, lx, by, zf + 0.07, GDOOR_W / 2 - 0.03, 0.09, 0.03, 'bhl_gdoor_band', false);
    }
  }
  // heavy stone jambs + a lintel-head to the opening
  for (const sx of [-1, 1]) {
    addBox(root, M.stone, GDOOR_CX + sx * (GDOOR_W / 2 + 0.08), GDOOR_H / 2, zf, 0.16, GDOOR_H, 0.3, 'bhl_gdoor_jamb', false);
  }
  addBox(root, M.stone, GDOOR_CX, GDOOR_H + 0.12, zf, GDOOR_W + 0.3, 0.24, 0.3, 'bhl_gdoor_head', false);

  // the great lock and hasp at the meeting of the leaves — no key in it
  addBox(root, M.iron, GDOOR_CX, 1.35, zf + 0.09, 0.34, 0.42, 0.08, 'bhl_gdoor_lock', false);
  addBox(root, M.iron, GDOOR_CX, 1.7, zf + 0.11, 0.1, 0.26, 0.05, 'bhl_gdoor_hasp', false);
  // the empty keyhole (dark)
  addBox(root, M.ceil, GDOOR_CX, 1.28, zf + 0.14, 0.05, 0.09, 0.02, 'bhl_gdoor_keyhole', false);

  // scratch-marks low on the inside of the leaves — short strokes (dark, not red)
  for (let k = 0; k < 7; k++) {
    const sx = GDOOR_CX + rr(-0.9, 0.9);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(rr(0.03, 0.06), rr(0.25, 0.55)), M.scratch);
    q.position.set(sx, rr(0.5, 1.3), zf + 0.13);
    q.rotation.z = rr(-0.35, 0.35);
    q.name = 'bhl_gdoor_scratch';
    root.add(q);
  }

  // impassable collider across the whole opening
  collideBox(GDOOR_CX, GDOOR_H / 2, ZN, GDOOR_W, GDOOR_H, T);
}

// -------------------------------------------------------------------- dais
// A low raised platform at the head, carrying the high table. Visual (walkable
// step, no collider — the high-table collider keeps the player off it).
function buildDais(root, M) {
  const dz = (ZN_IN + DAIS_Z1) / 2, dd = ZN_IN - DAIS_Z1;
  addBox(root, M.stone, CX, DAIS_TOP / 2, dz, 10, DAIS_TOP, dd, 'bhl_dais', false);
  // a moulded nosing along the south lip
  addBox(root, M.stone, CX, DAIS_TOP - 0.03, DAIS_Z1, 10, 0.08, 0.12, 'bhl_dais_nosing', false);
}

// -------------------------------------------------------------- high table
// On the dais, laid FOR TWO and never touched: cloth, two place settings, tall
// dead candlesticks, a husk centrepiece. The bride's and groom's high seats
// behind it, empty; the near (bride's) chair carries a folded veil / gown.
function buildHighTable(root, M) {
  const hz = -105.6;                              // high-table centre in z
  const HW = 3.0, HD = 0.9;                       // top footprint
  addBox(root, M.timber, CX, HIGH_TOP - 0.05, hz, HW, 0.1, HD, 'bhl_high_top', false);
  addBox(root, M.linen, CX, HIGH_TOP - 0.12, hz + 0.02, HW + 0.1, 0.22, HD + 0.1, 'bhl_high_cloth', false);
  // legs to the dais top
  for (const lx of [CX - HW / 2 + 0.2, CX + HW / 2 - 0.2]) {
    for (const lz of [hz - HD / 2 + 0.15, hz + HD / 2 - 0.15]) {
      addBox(root, M.timberDk, lx, DAIS_TOP + 0.36, lz, 0.1, 0.72, 0.1, 'bhl_high_leg', false);
    }
  }
  collideBox(CX, HIGH_TOP / 2 + DAIS_TOP / 2, hz, HW, HIGH_TOP, HD);

  // the two high seats behind the table (north side), empty, facing the hall (+z)
  const seatZ = hz - 0.75;
  const brideX = CX - 0.8, groomX = CX + 0.8;
  for (const sxx of [brideX, groomX]) {
    // seat pan
    addBox(root, M.timberDk, sxx, DAIS_TOP + 0.46, seatZ, 0.56, 0.08, 0.5, 'bhl_high_seat', false);
    // tall carved back
    addBox(root, M.timberDk, sxx, DAIS_TOP + 1.15, seatZ - 0.24, 0.56, 1.4, 0.08, 'bhl_high_back', false);
    // legs
    for (const lx of [sxx - 0.22, sxx + 0.22]) for (const lz of [seatZ - 0.2, seatZ + 0.2]) {
      addBox(root, M.timberDk, lx, DAIS_TOP + 0.23, lz, 0.06, 0.46, 0.06, 'bhl_high_seat_leg', false);
    }
  }

  // two place settings on the high table (plate, cup, cutlery, candlestick)
  placeSetting(root, M, brideX, hz - 0.1, HIGH_TOP, 1);
  placeSetting(root, M, groomX, hz - 0.1, HIGH_TOP, 1);

  // the bride's veil / gown, folded over the near (bride's) seat back and hanging
  addBox(root, M.veil, brideX, DAIS_TOP + 1.7, seatZ - 0.2, 0.6, 0.5, 0.05, 'bhl_veil_drape', false);
  addBox(root, M.veil, brideX, DAIS_TOP + 0.95, seatZ - 0.16, 0.5, 1.1, 0.04, 'bhl_veil_fall', false);
  addBox(root, M.veil, brideX, DAIS_TOP + 0.5, seatZ + 0.05, 0.44, 0.5, 0.5, 'bhl_gown_lap', false);

  // a husk centrepiece between the settings (flowers gone to brown husk)
  const husk = [];
  for (let i = 0; i < 22; i++) {
    pushBox(husk, CX + rr(-0.35, 0.35), HIGH_TOP + rr(0.03, 0.22), hz + rr(-0.18, 0.18),
      rr(0.02, 0.05), rr(0.05, 0.2), rr(0.02, 0.05));
  }
  mergedMesh(root, husk, M.husk, 'bhl_high_husk');
  addBox(root, M.metal, CX, HIGH_TOP + 0.06, hz, 0.34, 0.12, 0.34, 'bhl_high_bowl', false);
}

// ----------------------------------------------------------- the wedding cake
// A tiered cake set before the high seats as the great centrepiece, now slumped
// to a ruin of dust and mould. Grounded on the high table.
function buildCake(root, M) {
  const cz = -105.0, cx = CX;
  const y = HIGH_TOP;
  // a stand
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 10), M.plate);
  stand.position.set(cx, y + 0.04, cz); stand.name = 'bhl_cake_stand'; root.add(stand);
  // three tiers, each a touch off-true and slumping — the top has collapsed off
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.26, 10), M.cake);
  t1.position.set(cx, y + 0.21, cz); t1.rotation.z = 0.04; t1.name = 'bhl_cake_t1'; root.add(t1);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.22, 10), M.cake);
  t2.position.set(cx + 0.05, y + 0.44, cz - 0.03); t2.rotation.z = -0.12; t2.name = 'bhl_cake_t2'; root.add(t2);
  // the top tier, fallen and broken on the cloth beside the stand
  const t3 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 10), M.cake);
  t3.position.set(cx + 0.5, y + 0.09, cz + 0.28); t3.rotation.set(1.3, 0.4, 0.2); t3.name = 'bhl_cake_top_fallen'; root.add(t3);
  // mould blooms and dust slump over the tiers
  const mould = [];
  for (let i = 0; i < 30; i++) {
    const a = rr(0, Math.PI * 2), r = rr(0.1, 0.36);
    pushBox(mould, cx + Math.cos(a) * r, y + rr(0.08, 0.5), cz + Math.sin(a) * r,
      rr(0.03, 0.08), rr(0.02, 0.05), rr(0.03, 0.08));
  }
  mergedMesh(root, mould, M.mould, 'bhl_cake_mould');
  // a fall of dust/crumb on the cloth around the base
  flatQuad(root, M.dust, cx + 0.2, y + 0.005, cz + 0.15, 1.2, 0.9, 'bhl_cake_dust');
}

// A place setting: pewter plate, cup, knife+spoon, and a dead candlestick.
function placeSetting(root, M, x, z, top, dir) {
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 10), M.plate);
  plate.position.set(x, top + 0.02, z); plate.name = 'bhl_plate'; root.add(plate);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), M.plate);
  cup.position.set(x + 0.22, top + 0.07, z - dir * 0.05); cup.name = 'bhl_cup'; root.add(cup);
  // cutlery flanking the plate
  addBox(root, M.metal, x - 0.24, top + 0.02, z, 0.02, 0.01, 0.22, 'bhl_knife', false);
  addBox(root, M.metal, x + 0.24, top + 0.02, z, 0.02, 0.01, 0.2, 'bhl_spoon', false);
  // a dead candlestick behind the plate (metal shaft + wax stub, no flame)
  const sx = x - 0.02, sz = z + dir * 0.34;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.24, 8), M.metal);
  stick.position.set(sx, top + 0.12, sz); stick.name = 'bhl_stick'; root.add(stick);
  addBox(root, M.wax, sx, top + 0.29, sz, 0.045, 0.12, 0.045, 'bhl_candle_dead', false);
}

// ------------------------------------------------------------- long tables
// Two long banquet tables flanking a central aisle, each laid down its length,
// chairs pushed in on both sides and never drawn out. Tops at TABLE_TOP.
function buildLongTables(root, M) {
  const tz0 = -102.5, tz1 = -89.5, tcz = (tz0 + tz1) / 2, tlen = tz1 - tz0;
  const chairSeat = [], chairBack = [], chairLeg = [];  // merged chair bulk
  const settingZ = [-100, -97.5, -95, -92, -89.5].filter((z) => z >= tz0 + 0.4 && z <= tz1 - 0.4);

  for (const sx of [-1, 1]) {
    const cx = CX + sx * 3.2;                    // west (-203.2) / east (-196.8)
    const w = 1.1;
    // top slab + a draped cloth
    addBox(root, M.timber, cx, TABLE_TOP - 0.05, tcz, w, 0.1, tlen, 'bhl_table_top', false);
    addBox(root, M.linen, cx, TABLE_TOP - 0.16, tcz, w + 0.16, 0.28, tlen + 0.1, 'bhl_table_cloth', false);
    // legs
    for (const lz of [tz0 + 0.4, tcz, tz1 - 0.4]) {
      for (const lx of [cx - w / 2 + 0.1, cx + w / 2 - 0.1]) {
        addBox(root, M.timberDk, lx, 0.36, lz, 0.1, 0.72, 0.1, 'bhl_table_leg', false);
      }
    }
    collideBox(cx, TABLE_TOP / 2, tcz, w, TABLE_TOP, tlen);

    // settings + a wine jug or two down each table
    for (let i = 0; i < settingZ.length; i++) {
      const z = settingZ[i];
      // aisle-side setting faces the aisle; wall-side setting faces the wall
      placeSetting(root, M, cx - w / 2 + 0.32, z, TABLE_TOP, -1);   // aisle side
      placeSetting(root, M, cx + w / 2 - 0.32, z, TABLE_TOP, 1);    // wall side
      // chairs pushed in on both long sides (tucked hard under the cloth)
      pushChair(chairSeat, chairBack, chairLeg, cx - w / 2 - 0.28, z, +1);  // aisle-side chair
      pushChair(chairSeat, chairBack, chairLeg, cx + w / 2 + 0.28, z, -1);  // wall-side chair
    }
    // a wine jug near the middle of the table
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.26, 8), M.plate);
    jug.position.set(cx, TABLE_TOP + 0.13, tcz); jug.name = 'bhl_wine_jug'; root.add(jug);
    const jug2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 8), M.plate);
    jug2.position.set(cx, TABLE_TOP + 0.11, tz0 + 2.2); jug2.name = 'bhl_wine_jug'; root.add(jug2);
  }
  mergedMesh(root, chairSeat, M.timber, 'bhl_chairs_seat');
  mergedMesh(root, chairBack, M.timberDk, 'bhl_chairs_back');
  mergedMesh(root, chairLeg, M.timberDk, 'bhl_chairs_leg');
}

// A chair tucked in against a table edge. `face` = +1 chair on the -x side facing
// +x (toward table), -1 chair on the +x side facing -x. Grounded on the floor.
function pushChair(seat, back, leg, x, z, face) {
  pushBox(seat, x, 0.46, z, 0.44, 0.06, 0.44);                       // seat pan
  pushBox(back, x - face * 0.19, 0.78, z, 0.06, 0.62, 0.44);         // upright back
  for (const lx of [x - 0.18, x + 0.18]) for (const lz of [z - 0.18, z + 0.18]) {
    pushBox(leg, lx, 0.23, lz, 0.06, 0.46, 0.06);
  }
}

// ---------------------------------------------------------------- garlands
// Flowers gone to brown husks, strung in slack swags along the side walls
// between the windows and over the great doors. Merged husk bulk.
function buildGarlands(root, M) {
  const g = [];
  const swag = (x, z, along, ry) => {
    // a shallow catenary of husk segments; ends high, sag in the middle
    const n = 7;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const sag = Math.sin(u * Math.PI) * 0.35;
      const px = (ry ? x : x + (u - 0.5) * along);
      const pz = (ry ? z + (u - 0.5) * along : z);
      pushBox(g, px, 4.1 - sag, pz, ry ? 0.1 : along / n, rr(0.1, 0.22), ry ? along / n : 0.1);
    }
  };
  // side walls, one swag between each pair of windows (four spans a side)
  for (const [xc, ry] of [[XW_IN + 0.1, true], [XE_IN - 0.1, true]]) {
    swag(xc, -104.5, 3.4, ry);
    swag(xc, -98.5, 3.4, ry);
    swag(xc, -92.5, 3.4, ry);
  }
  // over the great doors
  swag(CX, ZN_IN + 0.15, 4.5, false);
  mergedMesh(root, g, M.husk, 'bhl_garlands');
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT (the emptiness is the point): dust filmed over the tables, drifts of
// dead flies and a little lime banked at the sill of the locked doors and in the
// corners, and one faint set stain on the flags. No bodies.
function buildAmbientGrammar(root, M) {
  // a film of dust over each long table and the high table
  flatQuad(root, M.dust, CX - 3.2, TABLE_TOP + 0.02, -96, 1.2, 12.5, 'bhl_dust_w');
  flatQuad(root, M.dust, CX + 3.2, TABLE_TOP + 0.02, -96, 1.2, 12.5, 'bhl_dust_e');

  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // banked along the sill of the locked great doors (on the dais)
  drift(CX, DAIS_TOP + 0.01, ZN_IN + 0.1, 1.1, 0.18, 48);
  // the four corners
  drift(XW_IN + 0.5, 0.01, ZN_IN + 0.5, 0.4, 0.4, 30);
  drift(XE_IN - 0.5, 0.01, ZN_IN + 0.5, 0.4, 0.4, 28);
  drift(XW_IN + 0.5, 0.01, ZS_IN - 0.5, 0.4, 0.4, 26);
  drift(XE_IN - 0.5, 0.01, ZS_IN - 0.5, 0.4, 0.4, 26);
  mergedMesh(root, flies, M.fly, 'bhl_flies');

  // a little lime at the entry threshold
  const lime = [];
  for (let i = 0; i < 40; i++) {
    const lx = rr(DOOR_X0 - 0.4, DOOR_X1 + 0.4), lz = rr(ZS_IN - 0.85, ZS_IN - 0.05);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'bhl_lime');

  // one faint set stain worked into the flags near the locked doors
  flatQuad(root, M.stain, CX + 1.6, 0.02, -105.5, 0.8, 1.1, 'bhl_stain', 0.2);
}

// ------------------------------------------------------------------ lighting
// Local lights only (no global ambient — other areas' tuning is untouched).
// Cold still daylight through the tall windows, a low cool fill so the mass
// reads, and one faint dying remnant at the high table (the rest is long dead).
function buildLighting() {
  for (const sx of [-1, 1]) {
    const xg = (sx < 0) ? XW_IN + 0.6 : XE_IN - 0.6;
    for (const z of WIN_Z) {
      const w = new THREE.PointLight(0x93a6bd, 3.6, 10, 1.7);
      w.position.set(xg, (WIN_SILL + WIN_HEAD) / 2, z);
      w.name = 'bhl_light_win';
      addLight(w);
    }
  }
  // low cool fills down the length so the empty hall reads
  for (const z of [-102, -95, -89]) {
    const fill = new THREE.PointLight(0x5b6470, 1.8, 14, 1.6);
    fill.position.set(CX, WALL_H - 1.0, z);
    fill.name = 'bhl_light_fill';
    addLight(fill);
  }
  // a faint, dying remnant over the high table (barely alive — everything else
  // guttered out long ago)
  const rem = new THREE.PointLight(0xc98a3e, 0.8, 5.5, 2.2);
  rem.position.set(CX, HIGH_TOP + 0.6, -105.4);
  rem.name = 'bhl_light_remnant';
  addLight(rem);

  onUpdate((_dt, t) => {
    rem.intensity = 0.8 * (1 + 0.22 * Math.sin(t * 4.7 + 0.3));
  });
}

// ------------------------------------------------------------------- document
// Adelheid's order to lock the hall (§7.2: "Adelheid ordered it locked. The key
// was never found."). Rests flat on the high table by the bride's setting.
// Plain, concrete, ends because she stopped (§9).
const DOC_LOCK = {
  id: 'bhl-lock-order',
  type: 'Leaf', style: '',
  voice: 'Queen Adelheid, of the house of Kirchmar',
  dateText: 'the tenth month',
  pages:
    'To the steward Reinmar.\n\n' +
    'The hall is finished and I have seen it. It is not to be used. Lock the ' +
    'doors and bring me the key, and let no one lay another cover in it.\n\n' +
    'My daughter is not to be brought to the room. If she asks after it, tell ' +
    'her the work is not done.\n\n' +
    'I will not give my reason to a page. You have kept this house long enough ' +
    'to do a thing without it.',
};

function buildDocument(world, root, M) {
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), M.parch);
  leaf.name = 'bhl_doc_' + DOC_LOCK.id;
  leaf.position.set(CX - 0.8, HIGH_TOP, -105.9);       // on the high table, bride's place
  leaf.rotation.set(-Math.PI / 2, 0, 0.2);
  root.add(leaf);
  registerInteractable({
    object: leaf,
    radius: 1.8,
    label: 'A folded leaf set square by the near place, in a firm court hand.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_LOCK); },
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
  registerProp(world, 'bhl_ix_feast', CX, HIGH_TOP, -105.4, 2.6,
    'The high table is laid for two, the plates set square and the cups filled once and long since dried. Neither seat was ever drawn out.',
    'A veil is folded over the near chair where a hand left it. The cake in the middle has slumped in on itself under its own dust, and no one has taken so much as a spoon. The dust lies even over all of it.');

  registerProp(world, 'bhl_ix_doors', CX, 1.4, ZN_IN + 0.5, 2.8,
    'The great doors at the head of the hall are barred and locked. There is no key in the lock, and none on the floor.',
    'The wood is scratched on this side, low down, in short strokes. Dust and dead flies have drifted along the sill in a line. Whoever was shut out of the feast, or shut into it, the key was never put back.');
}
