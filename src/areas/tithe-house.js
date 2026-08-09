import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import { registerCollider, registerFloor, registerInteractable, addLight, onUpdate } from '../core/scene.js';

// ===========================================================================
// THE TITHE HOUSE — Mammon's work (world-bible §5.2 assessor / valuation &
// storage; §7.2 "racks, cradles, fitted cases for objects no longer in them,
// every case labelled in Marck's hand"; §5.3 Payment I, the works surrendered).
//
// A long racked storehouse built by the best joiners in the realm to a measure
// nobody was given. The horror is the quality: a masterwork put to the obscene
// use of inventorying what a house of makers gave away. Every case stands open
// and empty; the labels outnumber the things.
//
// SELF-CONTAINED ISLAND around centre C = (100, 0, 0), far from all other
// geometry. Room 12 wide (x[94,106]) x 24 long (z[-12,12]), floor y=0, walls to
// 5, a low beamed ceiling. Doorway on the south short wall (z=+12). Builds its
// own geometry, colliders, floor, cold + warm motivated light, and two readable
// leaves. Nothing outside this file is touched (integrator wires the call +
// portal). Meshes prefixed tithe_.
// ===========================================================================

// --- Room shell (interior faces, metres) -----------------------------------
const CX = 100;                 // island centre x
const X0 = 94, X1 = 106;        // interior x faces (12 wide)
const Z0 = -12, Z1 = 12;        // interior z faces (24 long); doorway on Z1
const FLOOR_Y = 0;
const WALL_TOP = 5;
const T = 0.6;                  // wall thickness
const CEIL_Y = 5;               // beamed ceiling underside
const DOOR_HW = 1.5;            // doorway half-width (3.0 wide)
const DOOR_H = 4.5;             // doorway head

// --- Racks (down both long walls) ------------------------------------------
const RACK_DEPTH = 0.6;                  // how far a rack reaches into the room
const RACK_Z0 = -11, RACK_Z1 = 8;        // rack run along z (clear of door + desk)
const SHELF_Y = [0.2, 1.45, 2.7, 3.95];  // shelf tops define 3 rows of cases
const SHELF_H = 0.08;
const DIVIDER_Z = [-11, -7.833, -4.667, -1.5, 1.667, 4.833, 8]; // 6 bays
const RACK_TOP = SHELF_Y[SHELF_Y.length - 1] + 0.2; // ~4.15

// --- Clerk's desk (near the door) ------------------------------------------
const DESK_X = 99, DESK_Z = 9;
const DESK_TOP_Y = 0.91;        // desk top surface — the inventory leaf rests here
const LEDGE_Y = SHELF_Y[1] + SHELF_H / 2; // 1.49 — rack ledge the joiner-note rests on

// --- Palette (art-direction §1 cool base, warm accent) ---------------------
const COLD = 0x9fb0c4;          // cold daylight / skylight
const COLD_HI = 0xcdd8e4;       // near-white skylight core
const WARM = 0xe8a24c;          // lamp glow
const FLAME = 0xffd9a0;         // flame core

// ===========================================================================

export function buildTitheHouse(world) {
  const root = new THREE.Group();
  root.name = 'tithe_root';
  if (world.scene) world.scene.add(root);

  const M = makeMaterials();

  buildShell(root, M);
  buildCeiling(root, M);
  buildRacks(root, M);
  buildDesk(root, M);
  buildLights(root, M, world);
  buildDocuments(root, M, world);
  buildProps(world);

  return root;
}

// --------------------------------------------------------------- materials
function speckle(base, spot, n = 220) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#' + base.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#' + spot.toString(16).padStart(6, '0');
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.15 + Math.random() * 0.35;
    g.fillRect((Math.random() * 64) | 0, (Math.random() * 64) | 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function makeMaterials() {
  const floorTex = speckle(0x30353c, 0x1b1e26); floorTex.repeat.set(6, 12);
  const wallTex = speckle(0x2c333d, 0x1b2029); wallTex.repeat.set(4, 3);
  const oakTex = speckle(0x453a2b, 0x241d13, 120); oakTex.repeat.set(2, 2);

  return {
    floor: ps1ify(new THREE.MeshLambertMaterial({ map: floorTex })),
    wall: ps1ify(new THREE.MeshLambertMaterial({ map: wallTex })),
    ceil: ps1ify(new THREE.MeshLambertMaterial({ color: 0x1b1e26 })),
    oak: ps1ify(new THREE.MeshLambertMaterial({ map: oakTex })),
    recess: ps1ify(new THREE.MeshLambertMaterial({ color: 0x0c0e12 })), // empty hollow
    felt: ps1ify(new THREE.MeshLambertMaterial({ color: 0x24282a })),   // cradle bed
    label: ps1ify(new THREE.MeshBasicMaterial({ color: 0xb7a06a })),    // case slips
    flies: ps1ify(new THREE.MeshBasicMaterial({ map: speckle(0x14140f, 0x000000, 300) })),
    skyGlow: ps1ify(new THREE.MeshBasicMaterial({ color: COLD_HI, fog: false })),
    doorGlow: ps1ify(new THREE.MeshBasicMaterial({ color: COLD, fog: false })),
    flame: ps1ify(new THREE.MeshBasicMaterial({ color: FLAME, fog: false })),
  };
}

// ------------------------------------------------------------------ helpers
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

function boxMesh(root, mat, cx, cy, cz, w, h, d, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.name = name;
  root.add(m);
  return m;
}

function addCollider(cx, cy, cz, w, h, d) {
  const b = new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
  );
  return registerCollider(b);
}

// --------------------------------------------------------------------- shell
function buildShell(root, M) {
  // stone floor — walkable
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(CX, FLOOR_Y, (Z0 + Z1) / 2);
  floor.name = 'tithe_floor';
  root.add(floor);
  registerFloor(floor);

  const wallH = WALL_TOP - FLOOR_Y, wallYC = (WALL_TOP + FLOOR_Y) / 2;

  // West / East long walls
  boxMesh(root, M.wall, X0 - T / 2, wallYC, (Z0 + Z1) / 2, T, wallH, (Z1 - Z0) + T, 'tithe_wall_w');
  boxMesh(root, M.wall, X1 + T / 2, wallYC, (Z0 + Z1) / 2, T, wallH, (Z1 - Z0) + T, 'tithe_wall_e');
  addCollider(X0 - T / 2, wallYC, (Z0 + Z1) / 2, T, wallH, (Z1 - Z0) + T);
  addCollider(X1 + T / 2, wallYC, (Z0 + Z1) / 2, T, wallH, (Z1 - Z0) + T);

  // North short wall (solid)
  boxMesh(root, M.wall, CX, wallYC, Z0 - T / 2, (X1 - X0) + 2 * T, wallH, T, 'tithe_wall_n');
  addCollider(CX, wallYC, Z0 - T / 2, (X1 - X0) + 2 * T, wallH, T);

  // South short wall (z=Z1) with the doorway opening (3.0 w x 4.5 h at x=CX)
  const segW = (CX - DOOR_HW) - X0 + T;             // reach the corner + overlap
  const leftCx = (X0 - T + (CX - DOOR_HW)) / 2;
  const rightCx = (CX + DOOR_HW + X1 + T) / 2;
  boxMesh(root, M.wall, leftCx, wallYC, Z1 + T / 2, segW, wallH, T, 'tithe_wall_s_l');
  boxMesh(root, M.wall, rightCx, wallYC, Z1 + T / 2, segW, wallH, T, 'tithe_wall_s_r');
  addCollider(leftCx, wallYC, Z1 + T / 2, segW, wallH, T);
  addCollider(rightCx, wallYC, Z1 + T / 2, segW, wallH, T);
  // lintel over the doorway (above the collision band — no collider needed)
  boxMesh(root, M.wall, CX, (DOOR_H + WALL_TOP) / 2, Z1 + T / 2, 2 * DOOR_HW, WALL_TOP - DOOR_H, T, 'tithe_door_lintel');
  // dressed oak door jambs
  for (const s of [-1, 1]) {
    boxMesh(root, M.oak, CX + s * (DOOR_HW + 0.08), DOOR_H / 2, Z1, 0.16, DOOR_H, 0.2, 'tithe_door_jamb');
  }
}

// ------------------------------------------------------------------- ceiling
function buildCeiling(root, M) {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), M.ceil);
  ceil.rotation.x = Math.PI / 2;                    // underside faces down
  ceil.position.set(CX, CEIL_Y, (Z0 + Z1) / 2);
  ceil.name = 'tithe_ceiling';
  root.add(ceil);
  // oak tie-beams across the width, just under the ceiling (low beamed look)
  const beams = [];
  for (let z = Z0 + 1.5; z <= Z1 - 1.5; z += 2.4) {
    pushBox(beams, CX, CEIL_Y - 0.22, z, X1 - X0, 0.28, 0.28);
  }
  mergedMesh(root, beams, M.oak, 'tithe_beams');
}

// --------------------------------------------------------------------- racks
// A lattice of dark oak against each long wall: horizontal shelves + vertical
// dividers frame a grid of fitted cases, each with a dark empty recess behind
// and a parchment slip pinned to its bottom rail. A few hold cradles cut to a
// measure no thing here fits any longer.
function buildRacks(root, M) {
  const oak = [], dark = [], felt = [], labels = [], flies = [];
  buildRackSide(+1, oak, dark, felt, labels, flies);   // west (opens toward +x)
  buildRackSide(-1, oak, dark, felt, labels, flies);   // east (opens toward -x)
  mergedMesh(root, oak, M.oak, 'tithe_rack_oak');
  mergedMesh(root, dark, M.recess, 'tithe_rack_recess');
  mergedMesh(root, felt, M.felt, 'tithe_rack_cradles');
  mergedMesh(root, labels, M.label, 'tithe_rack_labels');
  mergedMesh(root, flies, M.flies, 'tithe_rack_flies');

  // one collider per rack side (covers all its cases; abuts the wall collider)
  const zc = (RACK_Z0 + RACK_Z1) / 2, len = RACK_Z1 - RACK_Z0;
  addCollider(X0 + RACK_DEPTH / 2, RACK_TOP / 2, zc, RACK_DEPTH, RACK_TOP, len);
  addCollider(X1 - RACK_DEPTH / 2, RACK_TOP / 2, zc, RACK_DEPTH, RACK_TOP, len);
}

function buildRackSide(side, oak, dark, felt, labels, flies) {
  // side +1 = west wall (interior face X0), opening plane faces +x
  const wallX = side > 0 ? X0 : X1;
  const openX = wallX + side * RACK_DEPTH;           // front plane (into room)
  const backX = wallX + side * 0.03;                 // recess back, just off wall
  const midX = wallX + side * (RACK_DEPTH / 2);

  // dark back panel spanning the whole rack (so every case reads hollow)
  pushBox(dark, backX, RACK_TOP / 2, (RACK_Z0 + RACK_Z1) / 2, 0.05, RACK_TOP, RACK_Z1 - RACK_Z0);

  // horizontal shelves at the opening plane, full length
  for (const sy of SHELF_Y) {
    pushBox(oak, midX, sy, (RACK_Z0 + RACK_Z1) / 2, RACK_DEPTH, SHELF_H, RACK_Z1 - RACK_Z0);
  }
  // vertical dividers at the opening plane
  for (const dz of DIVIDER_Z) {
    pushBox(oak, midX, RACK_TOP / 2, dz, RACK_DEPTH, RACK_TOP, 0.1);
  }

  // per case: a parchment label on the bottom rail + a few cradles / fly-drift
  const rowY = [];
  for (let r = 0; r < SHELF_Y.length - 1; r++) rowY.push((SHELF_Y[r] + SHELF_Y[r + 1]) / 2);
  for (let b = 0; b < DIVIDER_Z.length - 1; b++) {
    const bz = (DIVIDER_Z[b] + DIVIDER_Z[b + 1]) / 2;
    for (let r = 0; r < rowY.length; r++) {
      const y = rowY[r];
      // label slip pinned to the bottom rail, flush on the opening plane
      pushLabel(labels, side, openX, SHELF_Y[r] + 0.14, bz);
      // cradles cut to a measure — in a scattering of cases
      if ((b + r) % 3 === 0) pushCradle(oak, felt, side, midX, SHELF_Y[r] + SHELF_H / 2, bz);
      // a drift of dead flies collecting in one low empty case
      if (b === 1 && r === 0 && side > 0) pushFlyQuad(flies, side, openX - side * 0.02, SHELF_Y[r] + SHELF_H / 2 + 0.001, bz);
    }
  }
}

function pushLabel(arr, side, x, yc, zc) {
  // small quad in the plane x=const, facing into the room (normal = +side x)
  const hy = 0.05, hz = 0.11;
  const xx = x + side * 0.002;
  arr.push(
    xx, yc - hy, zc - hz, xx, yc - hy, zc + hz, xx, yc + hy, zc + hz,
    xx, yc - hy, zc - hz, xx, yc + hy, zc + hz, xx, yc + hy, zc - hz,
  );
}

function pushCradle(oak, felt, side, midX, sy, zc) {
  // an oak bed with two end-stops — the fitted hollow of a thing now gone
  pushBox(oak, midX, sy + 0.06, zc, RACK_DEPTH - 0.14, 0.1, 0.7);
  pushBox(felt, midX, sy + 0.115, zc, RACK_DEPTH - 0.22, 0.02, 0.5);
  for (const s of [-1, 1]) pushBox(oak, midX, sy + 0.18, zc + s * 0.32, RACK_DEPTH - 0.14, 0.22, 0.06);
}

function pushFlyQuad(arr, side, x, y, zc) {
  const hz = 0.14, hx = 0.14;
  arr.push(
    x - hx, y, zc - hz, x + hx, y, zc - hz, x + hx, y, zc + hz,
    x - hx, y, zc - hz, x + hx, y, zc + hz, x - hx, y, zc + hz,
  );
}

// ----------------------------------------------------------------------- desk
function buildDesk(root, M) {
  const topW = 1.4, topD = 0.72, topT = 0.06;
  const topCy = DESK_TOP_Y - topT / 2;
  // top slab (its top face == DESK_TOP_Y)
  boxMesh(root, M.oak, DESK_X, topCy, DESK_Z, topW, topT, topD, 'tithe_desk_top');
  // two end panels + a modesty board
  for (const s of [-1, 1]) {
    boxMesh(root, M.oak, DESK_X + s * (topW / 2 - 0.05), (topCy - topT / 2) / 2, DESK_Z, 0.08, topCy - topT / 2, topD - 0.08, 'tithe_desk_leg');
  }
  boxMesh(root, M.oak, DESK_X, (topCy - topT / 2) / 2 + 0.15, DESK_Z + topD / 2 - 0.05, topW - 0.2, 0.35, 0.05, 'tithe_desk_back');
  // a closed day-book beside the open leaf
  boxMesh(root, M.oak, DESK_X + 0.42, DESK_TOP_Y + 0.03, DESK_Z + 0.12, 0.26, 0.06, 0.34, 'tithe_desk_daybook');
  // desk collider
  addCollider(DESK_X, DESK_TOP_Y / 2, DESK_Z, topW, DESK_TOP_Y, topD);
}

// --------------------------------------------------------------------- lights
// Cold + inventoried: two skylight sources with cold points, cold daylight at
// the doorway, one guttering warm lamp on the desk. Every pool has a source
// mesh. Distances are bounded so nothing leaks to the far-off main hall.
function buildLights(root, M, world) {
  // (1,2) two skylights in the ceiling
  const skyZ = [-6, 5];
  for (let i = 0; i < skyZ.length; i++) {
    const z = skyZ[i];
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), M.skyGlow);
    plane.rotation.x = Math.PI / 2;                  // faces down into the room
    plane.position.set(CX, CEIL_Y - 0.02, z);
    plane.name = 'tithe_skylight_' + i;
    root.add(plane);
    const pt = new THREE.PointLight(COLD, 7, 24, 1.5);
    pt.position.set(CX, CEIL_Y - 0.4, z);
    addLight(pt);
  }

  // cool fills down the long room so the racks read (was too dark)
  for (const fz of [-7, 0, 7]) {
    const fill = new THREE.PointLight(0x5a636f, 9, 26, 1.0);
    fill.position.set(CX, 3.6, fz);
    fill.name = 'tithe_light_fill';
    addLight(fill);
  }

  // (3) cold daylight through the doorway — a bright plane just beyond it
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(3.0, DOOR_H), M.doorGlow);
  dg.position.set(CX, DOOR_H / 2, Z1 + T + 0.05);
  dg.material.side = THREE.DoubleSide;
  dg.name = 'tithe_door_glow';
  root.add(dg);
  const dpt = new THREE.PointLight(COLD, 5.5, 18, 1.6);
  dpt.position.set(CX, 2.6, Z1 - 1.2);
  addLight(dpt);

  // (4) guttering lamp on the clerk's desk — flame mesh + low warm point
  const lampX = DESK_X - 0.42, lampZ = DESK_Z - 0.1;
  const dish = boxMesh(root, M.oak, lampX, DESK_TOP_Y + 0.03, lampZ, 0.12, 0.06, 0.12, 'tithe_lamp_dish');
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), M.flame);
  flame.position.set(lampX, DESK_TOP_Y + 0.15, lampZ);
  flame.name = 'tithe_lamp_flame';
  root.add(flame);
  const lamp = new THREE.PointLight(WARM, 4.5, 5, 1.9);
  lamp.position.set(lampX, DESK_TOP_Y + 0.18, lampZ);
  addLight(lamp);

  // gentle guttering (cheap; motivated warm source only)
  const base = lamp.intensity;
  onUpdate((dt, t) => {
    const n = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 3.1 + 1.3) * 0.5;
    lamp.intensity = base * (0.86 + 0.14 * n);
    flame.scale.y = 0.9 + 0.12 * n;
  });
}

// ------------------------------------------------------------------ documents
// Two readable leaves (world-bible §9 register). Markers lie flat on a real
// surface top (desk top / rack ledge) — marker.y == that surface top Y.
const DOC_MARCK = {
  id: 'tithe-marck-inventory',
  type: 'Inventory', style: 'ledger', voice: 'Dietrich Marck, Chancellor',
  dateText: 'Michaelmas to Martinmas',
  pages: [
    'Inventory of the Tithe House, taken by my own hand and entered as I go.\n\n' +
    'Rack the first, upper case: the reliquary of St. Ursel, silver-gilt, four ' +
    'pound eleven ounce, the gift of Reinhold the Elder. Rendered to the account ' +
    'at the second head. The case stands empty. No receipt.\n\n' +
    'Rack the first, lower: the great clock of the long gallery, that told the ' +
    'feasts and the tides together. Taken down in its parts over three days and ' +
    'carried out at the water gate. I did not see it go whole.',

    'Rack the third: the psalter of the Dowager’s library, illuminated, the ' +
    'gold in it still bright. Valued to the head. The cradle was cut to hold it ' +
    'and holds nothing now.\n\n' +
    'Against each I have set the same: no coin returned, no bill of sale, no hand ' +
    'but the one that came to fetch it. His Grace bids the account stand open, and ' +
    'it stands open.',

    'I have entered the empty cases by their measures, as I enter all things. One ' +
    'and thirty this day, and the joiners still at their benches.\n\n' +
    'The fit of them is very fine.',
  ],
};

const DOC_WEINHOLD = {
  id: 'tithe-weinhold-cradles',
  type: 'Work-note', style: '', voice: 'Jost Weinhold, Master of Works',
  dateText: 'the eve of St. Andrew',
  pages:
    'I was given the measures for the cradles and not the things they are to hold. ' +
    'This is not how a case is made. A man measures the object and cuts the wood to ' +
    'it.\n\nThese were cut to a figure sent down on a paper, to the half-line. When ' +
    'the thing was brought to be laid in, it lay in as if the wood had grown around ' +
    'it. I have made cases forty years and never made one that close, nor was asked ' +
    'to.\n\nI set them where I was told and entered nothing.',
};

function buildDocuments(root, M, world) {
  // Marck's inventory — flat on the DESK TOP (y == DESK_TOP_Y)
  placeLeaf(root, world, DOC_MARCK, DESK_X - 0.15, DESK_TOP_Y, DESK_Z - 0.05, 0.35,
    'A long inventory left open on the writing-desk, close-written in one hand.');

  // Weinhold's note — flat on a RACK LEDGE (shelf top y == LEDGE_Y), west side
  placeLeaf(root, world, DOC_WEINHOLD, X0 + 0.28, LEDGE_Y, 3.25, -0.2,
    'A joiner’s note left on a rack ledge, the corner gone soft with handling.');
}

function placeLeaf(root, world, doc, x, surfaceTopY, z, yaw, label) {
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.44),
    ps1ify(new THREE.MeshBasicMaterial({ color: 0xb7a06a, side: THREE.DoubleSide })),
  );
  marker.name = 'tithe_doc_' + doc.id;
  marker.position.set(x, surfaceTopY, z);            // rests ON the surface top
  marker.rotation.set(-Math.PI / 2, 0, yaw);         // lies flat
  root.add(marker);
  registerInteractable({
    object: marker,
    radius: 1.8,
    label,
    onExamine: () => { if (world.reader) world.reader.open(doc); },
  });
}

// ---------------------------------------------------------------------- props
// Examinable props (scout's plain register, §10 — describes form, not meaning).
// A second detail line is latched via interaction's __examineLatch on E.
function buildProps(world) {
  const defs = [
    {
      name: 'ix_tithe_case', pos: [X0 + RACK_DEPTH, 2.075, 6.417], radius: 1.9,
      label: 'A fitted case, its frame open and the bed inside it empty. A paper slip is pinned to the rail, marked in a clean hand.',
      more: 'The recess is cut close, to no shape the scout can name. Whatever was laid here was laid deep, and lifted out whole.',
    },
    {
      name: 'ix_tithe_rack', pos: [X1 - RACK_DEPTH, 1.5, -3.0], radius: 2.2,
      label: 'A rack of dark oak runs the length of the wall, shelved and cased, every case standing open and empty.',
      more: 'Good joinery, pegged and not nailed. The cases are labelled each in the one hand, and the labels outnumber the things.',
    },
  ];
  for (const d of defs) {
    const anchor = new THREE.Object3D();
    anchor.name = d.name;
    anchor.position.set(d.pos[0], d.pos[1], d.pos[2]);
    if (world.scene) world.scene.add(anchor);
    registerInteractable({
      object: anchor,
      radius: d.radius,
      label: d.label,
      onExamine: () => { world.flags.__examineLatch?.(d.more); },
    });
  }
}
