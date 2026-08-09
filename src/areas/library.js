import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';

// ===========================================================================
// THE LIBRARY  (world-bible §3 Gen 6 · §3.1 the Dowager Gisela · §7.1 the
// ancestral BEAUTY the player should love before they learn what the house did).
//
// Dietrich IV and Gisela's refined generation: good stone, good proportion,
// evidence of care. A tall reading room lined with chained bookcases, two long
// reading desks down a central aisle, a slanted lectern with an open book, cold
// daylight from tall windows. The most finished room in the castle — and then
// quietly wrong at the edges: one book gone from a chained run, damp bleeding
// down a corner. Gisela brought the southern books; ONE of them is how the
// Abbess later knew a devil's seal on sight. The room never says so. The player
// may. (world-bible §3.1 — never connect the two facts.)
//
// Self-contained island build, centred on C = (0, 0, 100), far from the great
// hall so nothing overlaps. buildLibrary(world) makes geometry + colliders +
// floor + its own cold/warm lights + two readable leaves + examinables. The
// integrator wires the call and a portal, and reads the returned entry point.
// ===========================================================================

// --- island frame (metres) --------------------------------------------------
const CZ = 100;                 // island centre in z
const RX = 8, RZ = 6;           // room half-extents -> 16 (x) x 12 (z)
const X0 = -RX, X1 = RX;        // x[-8, 8]
const ZN = CZ - RZ, ZS = CZ + RZ; // north wall z=94, south (door) wall z=106
const WALL_H = 5.0;
const T = 0.5;                  // wall thickness
const XW_IN = X1 - T / 2;       // inner wall face east (+7.75); west = -XW_IN
const ZN_IN = ZN + T / 2;       // inner face north (94.25)
const ZS_IN = ZS - T / 2;       // inner face south (105.75)

const WIN_SILL = 1.6, WIN_HEAD = 3.8;   // tall window opening band
const WIN_Z = [97, 103];                // west/east window centres (in z)
const WIN_HZ = 0.8;                     // window half-width along z
const NWIN_HX = 1.1;                    // north window half-width along x
const DOOR_HX = 0.8, DOOR_H = 2.7;      // south doorway opening

const DESK_TOP_Y = 0.78;        // reading-desk top surface (marker rests here)
const LECT_TOP_Y = 1.12;        // lectern book-rest top (open-book marker rests here)

// --- small helpers ----------------------------------------------------------
function mkBox(root, cx, cy, cz, w, h, d, mat, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.name = name;
  root.add(m);
  return m;
}
function addCol(cx, cy, cz, w, h, d) {
  const b = new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
  );
  registerCollider(b);
  return b;
}
function solid(root, cx, cy, cz, w, h, d, mat, name) {
  mkBox(root, cx, cy, cz, w, h, d, mat, name);
  addCol(cx, cy, cz, w, h, d);
}

// --- procedural PS1 textures (small canvases, nearest-filtered) -------------
function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function stoneTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#7b7566'; x.fillRect(0, 0, 128, 128);       // limestone warm-grey
  for (let i = 0; i < 1400; i++) {
    const v = Math.random();
    x.fillStyle = v < 0.5 ? 'rgba(40,38,32,0.30)' : 'rgba(160,152,132,0.22)';
    x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1, 1);
  }
  x.strokeStyle = 'rgba(35,33,28,0.35)'; x.lineWidth = 1;    // ashlar mortar courses
  for (let y = 16; y < 128; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}
function floorTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#6b6656'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(28,26,22,0.5)'; x.lineWidth = 2;     // flagstone joints
  x.strokeRect(1, 1, 126, 126);
  x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(30,28,24,0.25)' : 'rgba(150,142,122,0.18)';
    x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}
function timberTex() {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = '#4a3a28'; x.fillRect(0, 0, 128, 128);       // dark oak
  for (let i = 0; i < 128; i += 1) {
    const a = 0.05 + Math.random() * 0.12;
    x.fillStyle = Math.random() < 0.5 ? `rgba(30,22,14,${a})` : `rgba(110,90,60,${a})`;
    x.fillRect(0, i, 128, 1);                                 // horizontal grain
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}
// Rows of book spines: vertical bands of varied width, muted period colours.
function booksTex(seed) {
  const c = cvs(96, 48), x = c.getContext('2d');
  const spines = ['#6e2f2a', '#9c7b3a', '#3d4a5c', '#4c5f4a', '#cbb89a', '#2b2320', '#5a3326', '#6b6656'];
  x.fillStyle = '#20180f'; x.fillRect(0, 0, 96, 48);         // shelf shadow behind
  let p = (seed * 7) % 5;
  let px = 0;
  while (px < 96) {
    const w = 3 + ((p * 5 + 3) % 6);
    const col = spines[(p + seed) % spines.length];
    x.fillStyle = col;
    const top = 2 + ((p * 3) % 5);                           // uneven book heights
    x.fillRect(px, top, w - 1, 48 - top);
    x.fillStyle = 'rgba(255,240,210,0.10)';                  // faint gilt line
    if ((p % 3) === 0) x.fillRect(px, top + 4, w - 1, 1);
    px += w; p++;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}
function glassTex() {
  const c = cvs(32, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, '#9fb0c4'); g.addColorStop(1, '#cdd8e4');  // cold daylight
  x.fillStyle = g; x.fillRect(0, 0, 32, 64);
  return crunch(new THREE.CanvasTexture(c));
}

// ===========================================================================
export function buildLibrary(world) {
  const root = new THREE.Group();
  root.name = 'lib_root';
  if (world.scene) world.scene.add(root);

  // --- materials ------------------------------------------------------------
  const tStone = stoneTex(); tStone.repeat.set(4, 2);
  const tFloor = floorTex(); tFloor.repeat.set(8, 6);
  const M = {
    stone: ps1ify(new THREE.MeshLambertMaterial({ map: tStone, color: 0xb9b3a2 })),
    floor: ps1ify(new THREE.MeshLambertMaterial({ map: tFloor, color: 0xb0aa98 })),
    timber: ps1ify(new THREE.MeshLambertMaterial({ map: timberTex(), color: 0xb0a488 })),
    books: ps1ify(new THREE.MeshLambertMaterial({ map: booksTex(1), color: 0xcfc7b4 })),
    books2: ps1ify(new THREE.MeshLambertMaterial({ map: booksTex(4), color: 0xcfc7b4 })),
    iron: ps1ify(new THREE.MeshLambertMaterial({ color: 0x2a2c30 })),
    wax: ps1ify(new THREE.MeshLambertMaterial({ color: 0xcbb89a })),
    glass: ps1ify(new THREE.MeshBasicMaterial({ map: glassTex(), fog: false, side: THREE.DoubleSide })),
    flame: ps1ify(new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, side: THREE.DoubleSide })),
    // polygonOffset lets the leaf sit at EXACTLY the surface-top Y (marker.y ==
    // surface Y) yet render just in front of it — resting, not floating, no z-fight.
    parch: ps1ify(new THREE.MeshBasicMaterial({
      color: 0xb7a06a, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })),
    damp: ps1ify(new THREE.MeshLambertMaterial({ color: 0x2c2a24, transparent: true, opacity: 0.72 })),
  };

  buildFloorAndCeiling(root, M);
  buildWalls(root, M);
  buildWindows(root, M);
  buildBookcases(root, M);
  buildReadingDesks(root, M);
  const lectern = buildLectern(root, M);
  buildLights(world);
  buildDocuments(world, root, M);
  buildExaminables(world, root);

  // ENTRY: on the floor just inside the south doorway, facing into the room.
  // yaw = PI faces -Z (interaction convention), i.e. north toward the lectern.
  const entry = { position: new THREE.Vector3(0, 1.7, ZS_IN - 1.3), yaw: Math.PI };
  return { root, entry, lectern };
}

// --------------------------------------------------------------- floor / ceiling
function buildFloorAndCeiling(root, M) {
  // flagstone floor at y=0 — visible top face AND the walkable surface interaction
  // raycasts down onto (a single plane; normal faces up).
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, ZS - ZN), M.floor);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, 0, CZ);
  surf.name = 'lib_floor';
  root.add(surf);
  registerFloor(surf);

  // worn threshold stone at the door — a sill dished by two centuries of feet.
  const sill = mkBox(root, 0, 0.02, ZS_IN - 0.35, 1.9, 0.06, 0.5, M.stone, 'lib_sill');
  sill.scale.y = 0.9;

  // fine timber ceiling: a plank deck with cross-beams (Gen 6 refinement).
  mkBox(root, 0, WALL_H + 0.12, CZ, X1 - X0, 0.16, ZS - ZN, M.timber, 'lib_ceiling_deck');
  for (let z = ZN + 1.0; z <= ZS - 1.0; z += 1.6) {
    mkBox(root, 0, WALL_H - 0.12, z, X1 - X0, 0.28, 0.24, M.timber, 'lib_ceiling_beam');
  }
  // two moulded wall-plates the beams land on
  mkBox(root, X0 + 0.2, WALL_H - 0.2, CZ, 0.24, 0.3, ZS - ZN, M.timber, 'lib_plate_w');
  mkBox(root, X1 - 0.2, WALL_H - 0.2, CZ, 0.24, 0.3, ZS - ZN, M.timber, 'lib_plate_e');

  // DAMP on one wall (decoration) — a stain bleeding down the SE corner, and a
  // dark bloom on the flags beneath it. The one thing quietly wrong at the edge.
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), M.damp);
  stain.rotation.y = -Math.PI / 2;
  stain.position.set(XW_IN - 0.02, 1.5, ZS - 1.6);
  stain.scale.x = 0.9;
  stain.name = 'lib_damp';
  root.add(stain);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), M.damp);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(XW_IN - 0.8, 0.015, ZS - 1.6);
  pool.name = 'lib_damp_pool';
  root.add(pool);
}

// --------------------------------------------------------------------- walls
function buildWalls(root, M) {
  const midY = (WIN_SILL + WIN_HEAD) / 2, midH = WIN_HEAD - WIN_SILL;

  // WEST + EAST walls: solid but for two tall window openings (at WIN_Z).
  for (const sx of [-1, 1]) {
    const xc = sx * X1;                       // wall centreline (thickness straddles)
    // bottom band (floor -> sill) and top band (head -> ceiling), full length
    mkBox(root, xc, WIN_SILL / 2, CZ, T, WIN_SILL, ZS - ZN, M.stone, 'lib_wall_lo');
    mkBox(root, xc, (WIN_HEAD + WALL_H) / 2, CZ, T, WALL_H - WIN_HEAD, ZS - ZN, M.stone, 'lib_wall_hi');
    // middle band: fill z around the two openings
    const gaps = WIN_Z.map((z) => [z - WIN_HZ, z + WIN_HZ]);
    const segs = [[ZN, gaps[0][0]], [gaps[0][1], gaps[1][0]], [gaps[1][1], ZS]];
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      mkBox(root, xc, midY, (a + b) / 2, T, midH, b - a, M.stone, 'lib_wall_mid');
    }
    // one collider for the whole wall plane
    addCol(xc, WALL_H / 2, CZ, T, WALL_H, ZS - ZN);
  }

  // NORTH wall (z=94): solid but for one tall central window.
  {
    const zc = ZN;
    mkBox(root, 0, WIN_SILL / 2, zc, X1 - X0, WIN_SILL, T, M.stone, 'lib_wall_n_lo');
    mkBox(root, 0, (WIN_HEAD + WALL_H) / 2, zc, X1 - X0, WALL_H - WIN_HEAD, T, M.stone, 'lib_wall_n_hi');
    for (const [a, b] of [[X0, -NWIN_HX], [NWIN_HX, X1]]) {
      mkBox(root, (a + b) / 2, midY, zc, b - a, midH, T, M.stone, 'lib_wall_n_mid');
    }
    addCol(0, WALL_H / 2, zc, X1 - X0, WALL_H, T);
  }

  // SOUTH wall (z=106): doorway at centre. Two full-height jambs + a lintel.
  {
    const zc = ZS;
    const lw = -DOOR_HX - X0;                    // left jamb width (x[-8,-0.8] -> 7.2)
    solid(root, (X0 + -DOOR_HX) / 2, WALL_H / 2, zc, lw, WALL_H, T, M.stone, 'lib_wall_s_l');
    const rw = X1 - DOOR_HX;                     // right jamb width (x[0.8,8] -> 7.2)
    solid(root, (X1 + DOOR_HX) / 2, WALL_H / 2, zc, rw, WALL_H, T, M.stone, 'lib_wall_s_r');
    mkBox(root, 0, (DOOR_H + WALL_H) / 2, zc, DOOR_HX * 2, WALL_H - DOOR_H, T, M.stone, 'lib_wall_s_lintel');
  }
}

// ------------------------------------------------------------------- windows
// Each window: a cold emissive glass plane (fog:false) flush in the opening,
// plus a slim stone mullion for a leaded-light read. Lights added separately.
function buildWindows(root, M) {
  const wh = WIN_HEAD - WIN_SILL, wy = (WIN_SILL + WIN_HEAD) / 2;
  // west / east
  for (const sx of [-1, 1]) {
    const xg = sx * (XW_IN - 0.02);
    for (const z of WIN_Z) {
      const g = mkBox(root, xg, wy, z, 0.04, wh, WIN_HZ * 2 - 0.08, M.glass, 'lib_glass');
      void g;
      mkBox(root, sx * (XW_IN - 0.03), wy, z, 0.06, wh, 0.06, M.stone, 'lib_mullion');
      mkBox(root, sx * (XW_IN - 0.03), wy, z, 0.06, 0.06, WIN_HZ * 2, M.stone, 'lib_transom');
    }
  }
  // north central window
  {
    const zg = ZN_IN + 0.02;
    mkBox(root, 0, wy, zg, NWIN_HX * 2 - 0.08, wh, 0.04, M.glass, 'lib_glass_n');
    mkBox(root, 0, wy, zg + 0.01, 0.06, wh, 0.06, M.stone, 'lib_mullion_n');
    mkBox(root, 0, wy, zg + 0.01, NWIN_HX * 2, 0.06, 0.06, M.stone, 'lib_transom_n');
  }
}

// ---------------------------------------------------------------- bookcases
// Tall chained cases lining the walls, in the wall segments between windows.
// One case, one shelf, carries the missing book (Payment I — the illuminated
// psalter). The examinable anchor is registered over that gap in buildExaminables.
const GAP = { fixed: 0, c: 4.5, w: 0.5, shelf: 1 };   // north-right case, 2nd shelf

function buildBookcases(root, M) {
  // WEST wall (fixed x, run along z), room side = +x
  for (const [a, b] of [[ZN + 0.35, 96.1], [97.9, 102.1], [103.9, ZS - 0.35]]) {
    bookcase(root, M, 'z', -XW_IN + 0.2, +1, a, b, null);
  }
  // EAST wall, room side = -x
  for (const [a, b] of [[ZN + 0.35, 96.1], [97.9, 102.1], [103.9, ZS - 0.35]]) {
    bookcase(root, M, 'z', XW_IN - 0.2, -1, a, b, null);
  }
  // NORTH wall (fixed z, run along x), room side = +z; right case carries the gap
  bookcase(root, M, 'x', ZN_IN + 0.2, +1, X0 + 0.35, -NWIN_HX - 0.1, null);
  bookcase(root, M, 'x', ZN_IN + 0.2, +1, NWIN_HX + 0.1, X1 - 0.35, GAP);
}

// axis 'z' -> case length runs along z at fixed x; axis 'x' -> along x at fixed z.
// room = +1/-1 sign pointing from the wall into the room (books face the room).
function bookcase(root, M, axis, fixed, room, c0, c1, gap) {
  const L = c1 - c0, cc = (c0 + c1) / 2;
  const D = 0.42, H = 3.4;
  const zSide = axis === 'z';
  // place a box by (runCentre, y, sizeAlongRun, height, sizeDepth, depthCentre, mat, name)
  const put = (runC, y, sRun, h, sDep, depC, mat, name) =>
    (zSide ? mkBox(root, depC, y, runC, sDep, h, sRun, mat, name)
           : mkBox(root, runC, y, depC, sRun, h, sDep, mat, name));

  const backC = fixed - room * (D / 2 - 0.03);   // back panel hard against wall
  const bookC = fixed + room * 0.05;             // spines a touch proud of centre
  // frame
  put(cc, 0.08, L, 0.16, D, fixed, M.timber, 'lib_case_base');
  put(cc, H - 0.08, L, 0.16, D, fixed, M.timber, 'lib_case_cornice');
  put(c0 + 0.07, H / 2, 0.14, H, D, fixed, M.timber, 'lib_case_end');
  put(c1 - 0.07, H / 2, 0.14, H, D, fixed, M.timber, 'lib_case_end');
  put(cc, H / 2, L, H, 0.05, backC, M.timber, 'lib_case_back');

  const shelfY = [0.55, 1.35, 2.15, 2.9];
  for (let s = 0; s < shelfY.length; s++) {
    const y = shelfY[s];
    put(cc, y - 0.03, L, 0.06, D, fixed, M.timber, 'lib_shelf_board');
    const bMat = (s % 2) ? M.books2 : M.books;
    const rows = (gap && gap.shelf === s)
      ? [[c0 + 0.1, gap.c - gap.w / 2], [gap.c + gap.w / 2, c1 - 0.1]]  // split around the gap
      : [[c0 + 0.1, c1 - 0.1]];
    for (const [ra, rb] of rows) {
      if (rb - ra < 0.15) continue;
      put((ra + rb) / 2, y + 0.15, rb - ra, 0.28, 0.26, bookC, bMat, 'lib_books');
    }
    // a hanging chain-rail with a few links (chained library — Gen 6 care)
    put(cc, y + 0.32, L, 0.03, 0.03, fixed + room * (D / 2 - 0.02), M.iron, 'lib_chain_rail');
  }
  // one collider for the whole case footprint
  if (zSide) addCol(fixed, H / 2, cc, D, H, L);
  else addCol(cc, H / 2, fixed, L, H, D);
}

// --------------------------------------------------------------- reading desks
// Two long desks flanking the central aisle, benches outboard. Top at DESK_TOP_Y.
function buildReadingDesks(root, M) {
  for (const sx of [-1, 1]) {
    const cx = sx * 3.0, z0 = 97.3, z1 = 102.7, cz = (z0 + z1) / 2, len = z1 - z0;
    const w = 1.0;
    // top slab: centre 0.75, half-height 0.03 -> top face exactly at DESK_TOP_Y,
    // left clear/flat so the leaf rests on it (no ledge clipping the marker).
    mkBox(root, cx, DESK_TOP_Y - 0.03, cz, w, 0.06, len, M.timber, 'lib_desk_top');
    // a low back-rail along the wall edge (Gen 6 detail; clear of the reading leaf)
    mkBox(root, cx + sx * (w / 2 - 0.05), DESK_TOP_Y + 0.06, cz, 0.06, 0.12, len - 0.4, M.timber, 'lib_desk_rail_back');
    // legs
    for (const lz of [z0 + 0.3, z1 - 0.3]) {
      for (const lx of [cx - w / 2 + 0.1, cx + w / 2 - 0.1]) {
        mkBox(root, lx, 0.36, lz, 0.1, 0.72, 0.1, M.timber, 'lib_desk_leg');
      }
    }
    // rail
    mkBox(root, cx, 0.6, cz, w - 0.1, 0.1, 0.06, M.timber, 'lib_desk_rail');
    addCol(cx, DESK_TOP_Y / 2, cz, w, DESK_TOP_Y, len);

    // outboard bench
    const bx = sx * 4.2;
    mkBox(root, bx, 0.45, cz, 0.34, 0.08, len - 0.6, M.timber, 'lib_bench_seat');
    for (const lz of [z0 + 0.4, z1 - 0.4]) {
      mkBox(root, bx, 0.22, lz, 0.34, 0.44, 0.1, M.timber, 'lib_bench_leg');
    }
    addCol(bx, 0.45 / 2 + 0.02, cz, 0.34, 0.5, len - 0.6);
  }
}

// -------------------------------------------------------------------- lectern
// A slanted lectern at the front of the aisle, under the north window's cold
// light. The open book on it IS the Gisela-marginalia marker (rests flat on the
// book-rest top, LECT_TOP_Y). A worn candle stands beside it.
function buildLectern(root, M) {
  const lx = 0, lz = 96.3;
  mkBox(root, lx, 0.06, lz, 0.62, 0.12, 0.5, M.timber, 'lib_lect_base');   // stepped foot
  mkBox(root, lx, 0.55, lz, 0.22, 1.0, 0.22, M.timber, 'lib_lect_post');    // column
  // flat book-rest board: centre so its top face sits exactly at LECT_TOP_Y
  mkBox(root, lx, LECT_TOP_Y - 0.03, lz, 0.72, 0.06, 0.52, M.timber, 'lib_lect_rest');
  mkBox(root, lx, LECT_TOP_Y - 0.02, lz + 0.28, 0.72, 0.1, 0.05, M.timber, 'lib_lect_lip'); // page stop
  // a carved acanthus corbel under the rest — care nobody would look for (§7.1)
  const corbel = mkBox(root, lx, 0.98, lz + 0.18, 0.5, 0.16, 0.16, M.timber, 'lib_lect_corbel');
  corbel.scale.set(1, 0.8, 1);
  addCol(lx, 0.6, lz, 0.62, 1.2, 0.5);

  // candle stub + flame beside the book (warm reading light; source for the point)
  mkBox(root, 0.45, LECT_TOP_Y + 0.02, lz, 0.05, 0.16, 0.05, M.wax, 'lib_candle');
  const flame = mkBox(root, 0.45, LECT_TOP_Y + 0.16, lz, 0.05, 0.12, 0.05, M.flame, 'lib_flame');
  const flame2 = mkBox(root, 0.45, LECT_TOP_Y + 0.16, lz, 0.05, 0.12, 0.05, M.flame, 'lib_flame');
  flame2.rotation.y = Math.PI / 2;
  return { flame, flame2, pos: new THREE.Vector3(0.45, LECT_TOP_Y + 0.16, lz) };
}

// --------------------------------------------------------------------- lights
// Every pool has a visible source in frame: cold from the glowing window planes,
// warm from the lectern flame. Ambient stays low + cool (art-direction §2/§3).
function buildLights(world) {
  addLight(new THREE.AmbientLight(0x2a323e, 0.5));                 // cool fill only

  // cold daylight pools, one per window group (sources = the emissive planes)
  const nWin = new THREE.PointLight(0xbcd2e8, 11, 12, 1.7); nWin.position.set(0, 3.0, ZN_IN + 0.6); addLight(nWin);
  const wWin = new THREE.PointLight(0x9fb4cc, 9, 11, 1.8); wWin.position.set(-XW_IN + 0.6, 2.8, CZ); addLight(wWin);
  const eWin = new THREE.PointLight(0x9fb4cc, 9, 11, 1.8); eWin.position.set(XW_IN - 0.6, 2.8, CZ); addLight(eWin);

  // warm reading candle on the lectern (its flame mesh is the visible source)
  const cand = new THREE.PointLight(0xe8a24c, 3.2, 5, 1.9);
  cand.position.set(0.45, LECT_TOP_Y + 0.18, 96.3);
  addLight(cand);

  onUpdate((dt, t) => {
    const n = Math.sin(t * 7.5) * 0.6 + Math.sin(t * 19.3) * 0.4;
    cand.intensity = 3.2 * (1 + 0.14 * n);
  });
}

// ------------------------------------------------------------------- documents
// Two readable leaves resting on surfaces (never floating): the Abbess's leaf on
// the west reading desk, and Gisela's marginalia AS the open book on the lectern.
function buildDocuments(world, root, M) {
  const geo = new THREE.PlaneGeometry(0.34, 0.44);

  const place = (x, y, z, yaw, doc) => {
    const marker = new THREE.Mesh(geo, M.parch);
    marker.name = 'lib_doc_' + doc.id;
    marker.position.set(x, y, z);               // y === surface-top Y (rests flat)
    marker.rotation.set(-Math.PI / 2, 0, yaw);  // lying flat on the surface
    root.add(marker);
    registerInteractable({
      object: marker,
      radius: 1.8,
      label: doc.prompt,
      onExamine: () => { if (world.reader) world.reader.open(doc); },
    });
    return marker;
  };

  // 1. Abbess Walburga's leaf — on the WEST reading desk top (DESK_TOP_Y).
  place(-3.0, DESK_TOP_Y, 100.0, 0.22, {
    id: 'lib_walburga_seal',
    type: 'Leaf', style: '', voice: 'Abbess Walburga of St. Ursel',
    dateText: 'before Martinmas',
    prompt: 'A leaf set square on the desk, in a firm scholar’s hand.',
    pages:
      'To Father Anselm, and to no other hand.\n\n' +
      'I have seen the mark twice, cut into good stone where no mason’s mark belongs: ' +
      'a ring broken at the crown, a bar laid across the break, and under it letters in ' +
      'no alphabet taught in this see.\n\n' +
      'I have read of the figure. The book is old, and not mine by birth, and it is plain ' +
      'about what is done before such a thing is cut.\n\n' +
      'Come to me before you go up. Do not trust this to a hand that is not your own.',
  });

  // 2. Gisela marginalia — the open book ON the lectern book-rest (LECT_TOP_Y).
  place(0, LECT_TOP_Y, 96.3, 0, {
    id: 'lib_gisela_margin',
    type: 'Marginalia', style: '', voice: 'a foreign hand',
    dateText: 'in the margin of a southern book',
    prompt: 'A small book lies open on the lectern, a note run down its margin.',
    pages:
      'For the wakeful, when the night will not turn:\n\n' +
      'three grains of the grey seed in warm wine, no more than three. At four the hands ' +
      'go cold. At five, do not count.\n\n' +
      'Below, in a smaller hand:\n\n' +
      'I keep this leaf for the hand it is written in, which was my mother’s, and not ' +
      'for the physic.',
  });
}

// ---------------------------------------------------------------- examinables
// Two examinable props: the gap where a chained book was taken (the quiet wrong,
// Payment I) and a carved case-end (the beauty). Plain scout register (§10) —
// describe form, never meaning. Damp is built as decoration only, below.
function buildExaminables(world, root) {
  const defs = [
    {
      name: 'lib_ix_gap', pos: [GAP.c, 1.5, ZN_IN + 0.45], radius: 1.8,
      label: 'One book gone from the middle of a chained run. Its neighbours stand pushed square to close the space.',
      more: 'The chain that held it hangs open and empty. The leather to either side is bright where a broad spine kept the dust off. It was a large book, and well kept.',
    },
    {
      name: 'lib_ix_carving', pos: [-XW_IN + 0.5, 1.4, 102.0], radius: 1.7,
      label: 'The end of the case is carved into a spray of oak, every leaf and acorn cut true.',
      more: 'It faces the wall, where no reader would ever stand to see it. Whoever set this to a bookcase was a master, and did it for no one.',
    },
  ];
  for (const d of defs) {
    const anchor = new THREE.Object3D();
    anchor.name = d.name;
    anchor.position.set(d.pos[0], d.pos[1], d.pos[2]);
    root.add(anchor);
    registerInteractable({
      object: anchor,
      radius: d.radius,
      label: d.label,
      onExamine: () => {
        const latch = world.flags && world.flags.__examineLatch;
        if (typeof latch === 'function') latch(d.more);
      },
    });
  }
}
