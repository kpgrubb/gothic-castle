import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE CLOISTER  (atlas location #9 — the Ward cluster's connective refinement,
// Gen 6 Dietrich. "Ancestral: connective refinement.") A Romanesque cloister
// walk: a covered, ribbed-vaulted AMBULATORY running as a square ring around an
// open GARTH (courtyard open to the sky). The inner side of the walk is an
// ARCADE of round-shouldered arches on PAIRED SLIM COLUMNS with blocky capitals,
// a low plinth wall between them, opening onto the garth. Outer side is solid
// wall with a couple of dark (closed) doorways implying the rooms the atlas
// hangs off the cloister (Long Gallery, St. Ursel's, Pleasure Garden). A
// well-head stands in the garth. Cool, grey, overcast, quiet.
//
// THE FOCAL BEAT (world-bible §8/§10): where the walk meets the garth lie TWO
// men, a sword-length apart, fallen facing each other — they killed each other.
// A dropped blade by each hand, blood pooled on the flags between them and
// thrown up the pier that stands between them. This is fresh violence, not the
// plague; the ambient plague grammar (drifts of dead flies in corners, a little
// lime at the threshold) still applies LIGHTLY. The scout's examinable names
// only what he sees.
//
// Self-contained island centred C = (100, 0, -100) — the free quadrant (Tithe at
// (100,0,0), Library (0,0,100), Infirmary (-100,0,0)). Floor at y=0. Builds its
// own geometry (merged per material), colliders, walkable walk-ring + garth
// floors, and OWN local lighting (no global ambient — the great hall's tuning is
// untouched). Every named object is prefixed `clo_`. buildCloister(world) returns
// { root, entry }; the integrator wires the portal + zone (see areas/index.js).
// DETERMINISM: no Math.random / Date.now — a seeded LCG drives all scatter.
// ===========================================================================

// --- Island frame (metres) -------------------------------------------------
const CX = 100, CZ = -100;                 // island centre
const OH = 12;                             // outer interior half-extent  -> 24 x 24
const OX0 = CX - OH, OX1 = CX + OH;        // outer faces  x [88, 112]
const OZ0 = CZ - OH, OZ1 = CZ + OH;        // outer faces  z [-112, -88]
const GH = 8;                              // garth half-extent  -> 16 x 16 open
const GX0 = CX - GH, GX1 = CX + GH;        // garth edges  x [92, 108]
const GZ0 = CZ - GH, GZ1 = CZ + GH;        // garth edges  z [-108, -92]
// walk ring is the 4 m band between the garth square and the outer wall.

const T = 0.6;                             // outer wall thickness
const WALL_H = 4.4;                        // outer wall height (rises above vault)
const CEIL_MID = 3.85;                     // walk vault-ceiling deck centre
const CEIL_UNDER = 3.75;                   // its underside (ribs hang just below)

const PLINTH_H = 0.62;                     // low plinth wall along the garth edge
const SPRING_Y = 2.55;                     // arches spring from the capital abacus
const ARCH_RISE = 1.0;                     // segmental arch rise (crown ~3.55)

// Support stations along each garth edge: corners at ±8, three paired columns
// between. The garth is entered on the SOUTH edge where one plinth bay is left
// open (walk under the arch between x=100 and x=104).
const STATIONS = [-8, -4, 0, 4, 8];        // local offsets from an edge centre
const GARTH_GAP = [100, 104];              // south-edge x-range with no plinth

// --- Door (entry) in the south outer wall (z = OZ1) -------------------------
const DOOR_CX = CX, DOOR_W = 1.6, DOOR_H = 2.4;
const DOOR_X0 = DOOR_CX - DOOR_W / 2, DOOR_X1 = DOOR_CX + DOOR_W / 2;

// --- Entry point (just inside the south doorway, facing -Z into the garth) --
export const CLOISTER_ENTRY = { position: new THREE.Vector3(CX, 1.7, OZ1 - 1.5), yaw: Math.PI };

// ---------------------------------------------------------------------------
// Seeded LCG so all scatter (flies, lime, spatter, stone speckle) is stable.
// ---------------------------------------------------------------------------
let _seed = 0x0c105e7;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// ---------------------------------------------------------------------------
// Geometry helpers (merged boxes for the bulk; single meshes where handy).
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
  if (collide) {
    registerCollider(new THREE.Box3(
      new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
      new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
  }
  return m;
}

function collideBox(cx, cy, cz, w, h, d) {
  registerCollider(new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
}

// A flat, floor-hugging quad (blood pools, stains) lying in the XZ plane.
function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas texture — cool speckled ashlar, crunched to PS1 nearest.
// (Runs in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function speckTex(base, speck, courses) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 360; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.15, 0.5);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  if (courses) {                                 // faint ashlar mortar lines
    g.strokeStyle = 'rgba(20,20,24,0.35)'; g.lineWidth = 1;
    for (let y = 16; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function makeMaterials() {
  const wallTex = speckTex('#565a61', '#3e424a', true); wallTex.repeat.set(4, 2);
  const floorTex = speckTex('#4c5056', '#34383e', true); floorTex.repeat.set(8, 8);
  const grassTex = speckTex('#4d5642', '#39412f', false); grassTex.repeat.set(6, 6);
  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));
  return {
    wall: lambert({ color: 0x6b6f76, map: wallTex }),
    flag: lambert({ color: 0x5a5e64, map: floorTex }),
    grass: lambert({ color: 0x5b6450, map: grassTex }),
    stone: lambert({ color: 0x777b82 }),            // columns, arches, plinth
    rib: lambert({ color: 0x82868d }),              // vault ribs (a touch lighter)
    ceil: lambert({ color: 0x2c2f35 }),             // dim vault underside
    dark: lambert({ color: 0x1c1f24 }),             // blind-doorway recesses
    timber: lambert({ color: 0x4a3a2a }),           // well posts / beam
    flesh: lambert({ color: 0x8a7f6d }),            // bodies
    garb: lambert({ color: 0x35322c }),             // dark clothing
    black: lambert({ color: 0x14100e }),            // blackened extremities
    steel: lambert({ color: 0x6b6e73 }),            // dropped blades
    fly: lambert({ color: 0x17140f }),              // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),             // scattered lime
    blood: basic({ color: 0x4a0d0d, side: THREE.DoubleSide }),      // pooled, dark
    spray: basic({ color: 0x631414, side: THREE.DoubleSide }),      // arterial cast-off
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildCloister(world) {
  const root = new THREE.Group();
  root.name = 'clo_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloors(root, M);
  buildOuterWalls(root, M);
  buildArcade(root, M);
  buildVault(root, M);
  buildWell(root, M);
  buildBodies(root, M);
  buildAmbientGrammar(root, M);
  buildLighting(M);
  buildExaminables(world);

  return { root, entry: CLOISTER_ENTRY };
}

// -------------------------------------------------------------------- floors
function buildFloors(root, M) {
  // flagged walk floor: the whole 24x24 footprint at y=0 (the ring is walkable).
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(2 * OH, 2 * OH), M.flag);
  walk.name = 'clo_floor_walk';
  walk.position.set(CX, 0, CZ);
  walk.rotation.x = -Math.PI / 2;
  root.add(walk);
  registerFloor(walk);

  // garth: an earth/grass square, open to the sky, a touch proud of the flags.
  const garth = new THREE.Mesh(new THREE.PlaneGeometry(2 * GH, 2 * GH), M.grass);
  garth.name = 'clo_floor_garth';
  garth.position.set(CX, 0.03, CZ);
  garth.rotation.x = -Math.PI / 2;
  root.add(garth);
  registerFloor(garth);

  // worn threshold sill at the south doorway
  addBox(root, M.stone, DOOR_CX, 0.02, OZ1 - 0.35, DOOR_W + 0.3, 0.06, 0.5, 'clo_sill', false);
}

// --------------------------------------------------------------- outer walls
function buildOuterWalls(root, M) {
  const yc = WALL_H / 2;
  // north (z = OZ0), east (x = OX1), west (x = OX0): solid, each with a blind door
  addBox(root, M.wall, CX, yc, OZ0 - T / 2, 2 * OH + 2 * T, WALL_H, T, 'clo_wall_n', true);
  addBox(root, M.wall, OX1 + T / 2, yc, CZ, T, WALL_H, 2 * OH + 2 * T, 'clo_wall_e', true);
  addBox(root, M.wall, OX0 - T / 2, yc, CZ, T, WALL_H, 2 * OH + 2 * T, 'clo_wall_w', true);

  // south (z = OZ1): split around the entry doorway
  const sLeftW = DOOR_X0 - (OX0 - T);
  addBox(root, M.wall, ((OX0 - T) + DOOR_X0) / 2, yc, OZ1 + T / 2, sLeftW, WALL_H, T, 'clo_wall_s_l', true);
  const sRightW = (OX1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (OX1 + T)) / 2, yc, OZ1 + T / 2, sRightW, WALL_H, T, 'clo_wall_s_r', true);
  addBox(root, M.wall, DOOR_CX, (DOOR_H + WALL_H) / 2, OZ1 + T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'clo_wall_s_lintel', false);
  addBox(root, M.dark, DOOR_X0 - 0.05, DOOR_H / 2, OZ1 - 0.02, 0.12, DOOR_H, T, 'clo_door_jamb_l', false);
  addBox(root, M.dark, DOOR_X1 + 0.05, DOOR_H / 2, OZ1 - 0.02, 0.12, DOOR_H, T, 'clo_door_jamb_r', false);

  // three blind (closed, dark) doorways on the solid walls -> the rooms the
  // atlas hangs off the cloister. Recessed dark panels with a stone surround.
  blindDoor(root, M, CX, OZ0 + 0.32, 'z', +1);    // north  -> St. Ursel's
  blindDoor(root, M, OX1 - 0.32, CZ, 'x', -1);    // east   -> the Long Gallery
  blindDoor(root, M, OX0 + 0.32, CZ, 'x', +1);    // west   -> the Pleasure Garden
}

// A dark recessed doorway on an inner wall face. `axis`/`face` give the inner
// normal direction (face = +1 means the opening looks toward +axis).
function blindDoor(root, M, wx, wz, axis, face) {
  const H = 2.5, W = 1.4;
  const onZ = axis === 'z';
  const nx = onZ ? 0 : face, nz = onZ ? face : 0;
  // dark recess panel, just proud of the wall
  const px = wx + nx * 0.02, pz = wz + nz * 0.02;
  if (onZ) addBox(root, M.dark, px, H / 2, pz, W, H, 0.06, 'clo_blind_panel', false);
  else addBox(root, M.dark, px, H / 2, pz, 0.06, H, W, 'clo_blind_panel', false);
  // stone surround (two jambs + lintel), a touch proud of the panel
  const jx = wx + nx * 0.04, jz = wz + nz * 0.04;
  if (onZ) {
    addBox(root, M.stone, jx - W / 2 - 0.06, H / 2, jz, 0.12, H, 0.14, 'clo_blind_jamb', false);
    addBox(root, M.stone, jx + W / 2 + 0.06, H / 2, jz, 0.12, H, 0.14, 'clo_blind_jamb', false);
    addBox(root, M.stone, jx, H + 0.08, jz, W + 0.24, 0.16, 0.14, 'clo_blind_lintel', false);
  } else {
    addBox(root, M.stone, jx, H / 2, jz - W / 2 - 0.06, 0.14, H, 0.12, 'clo_blind_jamb', false);
    addBox(root, M.stone, jx, H / 2, jz + W / 2 + 0.06, 0.14, H, 0.12, 'clo_blind_jamb', false);
    addBox(root, M.stone, jx, H + 0.08, jz, 0.14, 0.16, W + 0.24, 'clo_blind_lintel', false);
  }
}

// -------------------------------------------------------------------- arcade
// The four garth edges. Each edge: a run of paired columns + blocky capitals on
// a low plinth, carrying segmental arches onto the garth. Corners are solid
// piers. Column/arch/plinth stone is merged per material; colliders per support.
function buildArcade(root, M) {
  const stone = [], plinth = [];
  // edges described as: fixed garth-line, the along-axis, and the run centre.
  const edges = [
    { axis: 'x', gLine: GZ1, cen: CX, name: 's' },   // south (z = -92)
    { axis: 'x', gLine: GZ0, cen: CX, name: 'n' },   // north (z = -108)
    { axis: 'z', gLine: GX1, cen: CZ, name: 'e' },   // east  (x = 108)
    { axis: 'z', gLine: GX0, cen: CZ, name: 'w' },   // west  (x = 92)
  ];

  const cornerSet = new Set();
  for (const e of edges) {
    const onX = e.axis === 'x';
    // supports
    for (const s of STATIONS) {
      const a = e.cen + s;
      if (s === -8 || s === 8) {
        // corner pier — shared; build once, key by rounded coords
        const px = onX ? a : e.gLine, pz = onX ? e.gLine : a;
        const key = `${Math.round(px)},${Math.round(pz)}`;
        if (cornerSet.has(key)) continue;
        cornerSet.add(key);
        pushCornerPier(stone, px, pz);
        collideBox(px, 1.35, pz, 0.62, 2.7, 0.62);
      } else {
        pushColumnPair(stone, e.axis, a, e.gLine);
        if (onX) collideBox(a, 1.3, e.gLine, 0.5, 2.6, 0.7);
        else collideBox(e.gLine, 1.3, a, 0.7, 2.6, 0.5);
      }
    }
    // arches + plinth per bay (between adjacent stations)
    for (let i = 0; i < STATIONS.length - 1; i++) {
      const a0 = e.cen + STATIONS[i], a1 = e.cen + STATIONS[i + 1];
      pushArch(stone, e.axis, a0, a1, e.gLine);
      // plinth in this bay unless it is the south garth-entrance gap
      const isGap = e.name === 's' && a0 >= GARTH_GAP[0] - 0.01 && a1 <= GARTH_GAP[1] + 0.01;
      if (!isGap) pushPlinth(plinth, e.axis, a0, a1, e.gLine);
    }
  }
  mergedMesh(root, stone, M.stone, 'clo_arcade_stone');
  mergedMesh(root, plinth, M.stone, 'clo_arcade_plinth');

  // plinth colliders (taller than the visual, so they reliably stop the player)
  collideBox(CX, 0.5, GZ0, 2 * GH, 1.0, 0.35);        // north run
  collideBox(GX1, 0.5, CZ, 0.35, 1.0, 2 * GH);        // east run
  collideBox(GX0, 0.5, CZ, 0.35, 1.0, 2 * GH);        // west run
  collideBox((GX0 + GARTH_GAP[0]) / 2, 0.5, GZ1, GARTH_GAP[0] - GX0, 1.0, 0.35);  // south left of gap
  collideBox((GARTH_GAP[1] + GX1) / 2, 0.5, GZ1, GX1 - GARTH_GAP[1], 1.0, 0.35);  // south right of gap
}

// A paired-column support: two slim shafts (offset in depth) with bases, blocky
// capitals, and a shared abacus block the arch springs from. Sits on the plinth.
function pushColumnPair(arr, axis, a, gLine) {
  const onX = axis === 'x';
  for (const off of [-0.2, 0.2]) {
    const cx = onX ? a : gLine + off;
    const cz = onX ? gLine + off : a;
    pushBox(arr, cx, 0.70, cz, 0.30, 0.16, 0.30);        // base (on plinth top)
    pushBox(arr, cx, 1.54, cz, 0.20, 1.52, 0.20);        // shaft
    pushBox(arr, cx, 2.42, cz, 0.30, 0.24, 0.30);        // capital
  }
  // shared abacus spanning the pair, tying it, springing the arch
  if (onX) pushBox(arr, a, 2.50, gLine, 0.36, 0.14, 0.66);
  else pushBox(arr, gLine, 2.50, a, 0.66, 0.14, 0.36);
}

function pushCornerPier(arr, px, pz) {
  pushBox(arr, px, 0.10, pz, 0.62, 0.20, 0.62);          // base
  pushBox(arr, px, 1.30, pz, 0.50, 2.20, 0.50);          // shaft
  pushBox(arr, px, 2.52, pz, 0.60, 0.24, 0.60);          // cap
}

// A segmental arch of stepped voussoir boxes between two supports on one edge.
function pushArch(arr, axis, a0, a1, gLine) {
  const onX = axis === 'x';
  const mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
  const N = 9;
  for (let k = 0; k <= N; k++) {
    const th = (k / N) * Math.PI;
    const along = mid + half * Math.cos(th);
    const y = SPRING_Y + ARCH_RISE * Math.sin(th);
    if (onX) pushBox(arr, along, y, gLine, 0.5, 0.30, 0.62);
    else pushBox(arr, gLine, y, along, 0.62, 0.30, 0.5);
  }
}

function pushPlinth(arr, axis, a0, a1, gLine) {
  const onX = axis === 'x';
  const len = (a1 - a0) - 0.4, cen = (a0 + a1) / 2;      // gap at each column
  if (onX) pushBox(arr, cen, PLINTH_H / 2, gLine, len, PLINTH_H, 0.35);
  else pushBox(arr, gLine, PLINTH_H / 2, cen, 0.35, PLINTH_H, len);
}

// --------------------------------------------------------------------- vault
// A low ribbed groin vault over the covered walk (NOT over the open garth).
// A dim ceiling deck per run, transverse ribs landing on the supports, and thin
// crossing diagonal ribs per bay cell — cheap, but reads as vaulting at PS1 res.
function buildVault(root, M) {
  // ceiling deck: north/south strips run the full width (cover the corners);
  // east/west strips are trimmed to the garth length so nothing double-stacks.
  const S = 4;                                            // walk depth (garth->wall)
  addBox(root, M.ceil, CX, CEIL_MID, GZ1 + S / 2, 2 * OH, 0.2, S, 'clo_ceil_s', false);
  addBox(root, M.ceil, CX, CEIL_MID, GZ0 - S / 2, 2 * OH, 0.2, S, 'clo_ceil_n', false);
  addBox(root, M.ceil, GX1 + S / 2, CEIL_MID, CZ, S, 0.2, 2 * GH, 'clo_ceil_e', false);
  addBox(root, M.ceil, GX0 - S / 2, CEIL_MID, CZ, S, 0.2, 2 * GH, 'clo_ceil_w', false);

  // transverse ribs (across the walk depth) at each support line + a ridge rib
  const ribs = [];
  const sCen = GZ1 + S / 2, nCen = GZ0 - S / 2, eCen = GX1 + S / 2, wCen = GX0 - S / 2;
  for (const s of STATIONS) {
    const a = CX + s;
    pushBox(ribs, a, CEIL_UNDER - 0.11, sCen, 0.16, 0.24, S);   // south run
    pushBox(ribs, a, CEIL_UNDER - 0.11, nCen, 0.16, 0.24, S);   // north run
    const z = CZ + s;
    pushBox(ribs, eCen, CEIL_UNDER - 0.11, z, S, 0.24, 0.16);   // east run
    pushBox(ribs, wCen, CEIL_UNDER - 0.11, z, S, 0.24, 0.16);   // west run
  }
  // ridge ribs down each run's centre
  pushBox(ribs, CX, CEIL_UNDER - 0.06, sCen, 2 * OH, 0.14, 0.14);
  pushBox(ribs, CX, CEIL_UNDER - 0.06, nCen, 2 * OH, 0.14, 0.14);
  pushBox(ribs, eCen, CEIL_UNDER - 0.06, CZ, 0.14, 0.14, 2 * GH);
  pushBox(ribs, wCen, CEIL_UNDER - 0.06, CZ, 0.14, 0.14, 2 * GH);
  mergedMesh(root, ribs, M.rib, 'clo_vault_ribs');

  // crossing diagonal ribs per bay cell (rotated members meeting at the piers)
  const diag = Math.SQRT2 * S;                            // corner-to-corner of a 4x4 cell
  const cy = CEIL_UNDER - 0.06;
  const cells = [];
  for (let i = 0; i < STATIONS.length - 1; i++) {         // interior bay centres
    const s = (STATIONS[i] + STATIONS[i + 1]) / 2;
    cells.push({ x: CX + s, z: sCen }, { x: CX + s, z: nCen },
      { x: eCen, z: CZ + s }, { x: wCen, z: CZ + s });
  }
  for (const c of cells) {
    addBox(root, M.rib, c.x, cy, c.z, diag, 0.12, 0.12, 'clo_vault_diag', false, Math.PI / 4);
    addBox(root, M.rib, c.x, cy, c.z, diag, 0.12, 0.12, 'clo_vault_diag', false, -Math.PI / 4);
  }
}

// ---------------------------------------------------------------------- well
// A modest well-head in the garth centre: a stone curb, a dark shaft, and a
// timber gallows over it. Colliders on the whole footprint.
function buildWell(root, M) {
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.7, 12), M.stone);
  curb.position.set(CX, 0.35, CZ); curb.name = 'clo_well_curb'; root.add(curb);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.68, 12), M.dark);
  shaft.position.set(CX, 0.37, CZ); shaft.name = 'clo_well_shaft'; root.add(shaft);
  addBox(root, M.timber, CX - 0.62, 0.95, CZ, 0.12, 1.8, 0.12, 'clo_well_post', false);
  addBox(root, M.timber, CX + 0.62, 0.95, CZ, 0.12, 1.8, 0.12, 'clo_well_post', false);
  addBox(root, M.timber, CX, 1.86, CZ, 1.5, 0.14, 0.14, 'clo_well_beam', false);
  collideBox(CX, 0.5, CZ, 1.5, 1.0, 1.5);
}

// -------------------------------------------------------------------- bodies
// TWO men where the south walk meets the garth, a sword-length apart, fallen
// facing each other — they killed each other. A dropped blade by each hand.
// Blood pooled on the flags between them and thrown up the pier between. Crude
// dark box-figures, ground flat on the flags. §8 grammar; NOT the plague.
const BODY_A = { cx: 99.0, cz: -90.4, dir: 1 };    // head toward +x (toward B)
const BODY_B = { cx: 101.6, cz: -89.8, dir: -1 };  // head toward -x (toward A)

function buildBodies(root, M) {
  // The two fallen men — shared low-poly corpses. Origin on the floor (y=0),
  // head toward local +X; rotate so each faces the other. Muted garments.
  const a = makeCorpse({ pose: 'supine', cloth: 0x45403a, seed: 91 });
  a.position.set(BODY_A.cx, 0, BODY_A.cz);
  a.rotation.y = 0;                       // head toward +X (toward B)
  root.add(a);
  const b = makeCorpse({ pose: 'side', cloth: 0x39414c, seed: 47 });
  b.position.set(BODY_B.cx, 0, BODY_B.cz);
  b.rotation.y = Math.PI;                 // head toward -X (toward A)
  root.add(b);

  // dark-brown plague STAIN pooled under each man (the rot since the killing;
  // the red blood below is the fresh violence). Laid flat on the flags.
  const sa = makeStain({ r: 1.2, seed: 91 });
  sa.position.set(BODY_A.cx, 0.002, BODY_A.cz);
  root.add(sa);
  const sb = makeStain({ r: 1.2, seed: 47 });
  sb.position.set(BODY_B.cx, 0.002, BODY_B.cz);
  root.add(sb);

  // a dropped blade by each reaching hand, flung to the flags between them
  addBox(root, M.steel, 100.0, 0.04, -90.15, 0.52, 0.03, 0.06, 'clo_blade_a', false, 0.5);
  addBox(root, M.steel, 100.0, 0.06, -90.15, 0.10, 0.05, 0.09, 'clo_blade_a_hilt', false, 0.5);
  addBox(root, M.steel, 100.75, 0.04, -89.7, 0.5, 0.03, 0.06, 'clo_blade_b', false, -0.8);
  addBox(root, M.steel, 100.75, 0.06, -89.7, 0.10, 0.05, 0.09, 'clo_blade_b_hilt', false, -0.8);

  // --- blood ---------------------------------------------------------------
  // pooling under each man
  flatQuad(root, M.blood, BODY_A.cx - 0.1, 0.021, BODY_A.cz + 0.05, 0.9, 0.6, 'clo_blood_pool_a', 0.3);
  flatQuad(root, M.blood, BODY_B.cx + 0.05, 0.021, BODY_B.cz - 0.05, 0.8, 0.55, 'clo_blood_pool_b', -0.4);
  // thrown across the flags between them (cast-off spatter, deterministic scatter)
  const spat = [];
  for (let k = 0; k < 26; k++) {
    const x = rr(99.7, 100.9), z = rr(-90.5, -89.6);
    pushBox(spat, x, 0.023, z, rr(0.04, 0.14), 0.01, rr(0.04, 0.14));
  }
  mergedMesh(root, spat, M.blood, 'clo_blood_spatter');

  // ARTERIAL spray thrown UP the pier standing between them (the paired column
  // at x=100 on the garth line, z=-92). A fan up its walk-facing face + droplets.
  const pierZ = GZ1 - 0.22;                              // front face toward the walk
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.3), M.spray);
  fan.position.set(100.0, 0.78, pierZ + 0.02);
  fan.rotation.set(0, 0, 0.12);                          // faces +z, toward the bodies
  fan.name = 'clo_blood_fan'; root.add(fan);
  // droplets fanning up the pier face, wider as they rise (arterial cast-off)
  for (let k = 0; k < 18; k++) {
    const yy = rr(0.2, 1.5);
    const xx = 100.0 + rr(-0.32, 0.32) * (0.3 + yy / 1.5);
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(rr(0.03, 0.09), rr(0.05, 0.16)), M.spray);
    dp.position.set(xx, yy, pierZ + 0.05);
    dp.name = 'clo_blood_drop'; root.add(dp);
  }
  // a little spray caught on the plinth beside the pier too
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), M.spray);
  pl.position.set(100.7, 0.32, GZ1 - 0.19); pl.rotation.set(0, 0, 0); pl.name = 'clo_blood_plinth';
  root.add(pl);
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: drifts of dead flies banked in the covered corners (never labelled) and
// a little lime scattered at the entry threshold. The blood is the focal detail.
function buildAmbientGrammar(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // the four covered corners of the walk
  drift(OX0 + 0.6, 0.01, OZ0 + 0.6, 0.4, 0.4, 55);
  drift(OX1 - 0.6, 0.01, OZ0 + 0.6, 0.4, 0.4, 50);
  drift(OX0 + 0.6, 0.01, OZ1 - 0.6, 0.4, 0.4, 50);
  drift(OX1 - 0.6, 0.01, OZ1 - 0.6, 0.4, 0.4, 55);
  // a thin drift drawn to the two bodies (fresh, but the flies find it)
  drift(100.3, 0.02, -90.0, 0.7, 0.6, 40);
  mergedMesh(root, flies, M.fly, 'clo_flies');

  // scattered lime at the south threshold
  const lime = [];
  for (let i = 0; i < 50; i++) {
    const lx = rr(DOOR_X0 - 0.4, DOOR_X1 + 0.4), lz = rr(OZ1 - 1.0, OZ1 - 0.1);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'clo_lime');
}

// ------------------------------------------------------------------ lighting
// Local point lights only (no global ambient — the great hall is untouched).
// Soft OVERCAST over the open garth, grading to a dimmer, cooler, contemplative
// light under the covered, vaulted walk.
function buildLighting(M) {
  void M;
  // overcast garth sky: broad cool fills high over the four garth quadrants + centre
  for (const [gx, gz] of [[CX - 4, CZ - 4], [CX + 4, CZ - 4], [CX - 4, CZ + 4], [CX + 4, CZ + 4]]) {
    const sky = new THREE.PointLight(0xaeb6c2, 9, 22, 1.4);
    sky.position.set(gx, 6.5, gz);
    sky.name = 'clo_light_sky';
    addLight(sky);
  }
  const centre = new THREE.PointLight(0x9fa8b4, 6, 18, 1.4);
  centre.position.set(CX, 5.0, CZ); centre.name = 'clo_light_sky_c'; addLight(centre);

  // dim, cool fills under the covered walk (one per side), kept low/shadowed
  for (const [wx, wz] of [[CX, GZ1 + 2], [CX, GZ0 - 2], [GX1 + 2, CZ], [GX0 - 2, CZ]]) {
    const walk = new THREE.PointLight(0x59616b, 3.0, 9, 1.6);
    walk.position.set(wx, 3.0, wz);
    walk.name = 'clo_light_walk';
    addLight(walk);
  }
  // a slightly stronger cool wash over the tableau so the beat reads at entry
  const beat = new THREE.PointLight(0x7c828c, 3.2, 8, 1.5);
  beat.position.set(100.4, 2.6, -90.2); beat.name = 'clo_light_beat'; addLight(beat);
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§10): he describes what he sees, never the meaning.
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
  // THE required beat — the two dead who killed each other.
  registerProp(world, 'clo_ix_bodies', 100.3, 0.6, -90.0, 2.4,
    'Two of them, a sword-length apart, and the blood thrown up the pier between. Whatever this was, it was not the plague that did it.',
    'Each has a blade fallen from his hand, out toward the other. The spray up the stone is fresh and still bright at its edge, and both men are turned to face the man who did it.');

  // a quieter one — the well, standing on in the empty garth.
  registerProp(world, 'clo_ix_well', CX, 0.6, CZ, 2.0,
    'A well-head at the middle of the garth, the timber gallows over it still standing square.',
    'The rope is gone from the beam and the curb is dry. Grass has come up through the flags around its foot, uncut for a season or more.');
}
