import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';

// ===========================================================================
// THE LONG GALLERY  (atlas #10 — the Gallery cluster, Gen 6 Dietrich. "Ancestral:
// the astronomical clock's bay (Payment I).") A LONG, narrow processional hall:
// a portrait-and-tapestry gallery of the dead lineage, tall cold windows down the
// east side, a faded runner of carpet up the centre, and at the far (up-headland,
// -Z) end a deep BAY framing the great ASTRONOMICAL CLOCK.
//
// THE FOCAL BEAT (world-bible §5.3 — Payment I). The clock is the centrepiece and
// it is WRONG. Payment I: "The great astronomical clock of the gallery, dismantled
// and its parts carried out... explained away as sold to fund the levies." So the
// case still towers, the dial still carries its sun, its moon, its zodiac ring —
// but the movement has been opened and half its wheels are GONE, bright arbors
// standing empty, one great wheel dropped on the flags. And still the hands hold an
// hour. It keeps a time it has no means left to keep. The court was told it was
// sold. Nobody knew anything. The plague grammar applies lightly — a man sat down
// before it to watch and did not get up; dead flies bank in the corners; a little
// lime at the threshold; a dark stain scrubbed at, not out. The scout names only
// what he sees (world-bible §10).
//
// Self-contained DISCRETE island, centred C = (0, 0, -160), long axis along Z,
// clear of every other island (Library (0,0,100), Cloister (100,0,-100), core
// cluster near the origin). Floor at y=0. Builds its own geometry, colliders,
// walkable floor, and OWN local lighting (a cold row of window shafts grading to a
// focused glow at the clock). Every named object is prefixed `lg_`.
// buildLongGallery(world) returns { root, entry:{x,y,z,yaw} }; the integrator
// wires the portal + reads the entry. DETERMINISM: no Math.random / Date.now — a
// seeded LCG drives all scatter, the clock hands are hard-coded angles.
// ===========================================================================

// --- Island frame (metres) -------------------------------------------------
const CZ = -160;                       // island centre in z
const RX = 4;                          // room half-width  -> 8 wide
const X0 = -RX, X1 = RX;               // x [-4, 4]
const HL = 20;                         // half-length      -> 40 long
const ZN = CZ - HL, ZS = CZ + HL;      // far (clock) wall z=-180, near (door) z=-140
const WALL_H = 5.2;
const T = 0.5;                         // wall thickness
const XW_IN = X1 - T / 2;              // inner wall face east (+3.75); west = -XW_IN
const ZN_IN = ZN + T / 2;             // inner face far  (-179.75)
const ZS_IN = ZS - T / 2;             // inner face near (-140.25)

const WIN_SILL = 1.5, WIN_HEAD = 3.7;  // tall window opening band (east wall)
const WIN_Z = [-170, -162, -154, -146]; // window centres in z (grading toward door)
const WIN_HZ = 0.9;                    // window half-width along z
const DOOR_HX = 0.85, DOOR_H = 2.6;    // near-wall doorway opening

// --- Entry: on the floor just inside the near doorway, facing -Z down the
// gallery toward the clock at the far end. (yaw = PI faces -Z per convention.) ---
const ENTRY = { x: 0, y: 1.7, z: -142, yaw: Math.PI };

// --- Clock geometry constants ----------------------------------------------
const CLK_X = 0;                       // clock centred on the gallery axis
const CLK_BACK = ZN_IN;                // case back against the far wall inner face
const CASE_D = 0.72;                   // case depth
const CLK_Z = CLK_BACK + CASE_D / 2;   // case centre z (-179.39)
const CASE_FRONT = CLK_Z + CASE_D / 2; // front face z (-179.03)
const CASE_W = 1.8, CASE_H = 4.3;      // case width / height (grounded: base y=0)
const DIAL_Y = 3.35, DIAL_R = 0.72;    // dial centre height / radius
const DIAL_Z = CASE_FRONT + 0.02;      // dial group sits just proud of the front

// ---------------------------------------------------------------------------
// Seeded LCG — all texture speckle and scatter are stable across loads.
// ---------------------------------------------------------------------------
let _seed = 0x10a6a11;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// --- geometry helpers -------------------------------------------------------
function mkBox(root, cx, cy, cz, w, h, d, mat, name, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (ry) m.rotation.y = ry;
  m.name = name;
  root.add(m);
  return m;
}
function addCol(cx, cy, cz, w, h, d) {
  registerCollider(new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2)));
}
function solid(root, cx, cy, cz, w, h, d, mat, name) {
  mkBox(root, cx, cy, cz, w, h, d, mat, name);
  addCol(cx, cy, cz, w, h, d);
}
// a flat quad lying in the XZ plane (runners, stains, scrub, pools)
function flatQuad(root, mat, x, y, z, w, d, name, rz = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, rz);
  p.name = name;
  root.add(p);
  return p;
}
// a disc facing +Z / -Z (axis rotated onto Z)
function disc(parent, r, thick, seg, mat, name, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.position.z = z;
  m.name = name;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Tiny canvas textures (browser-only; node --check just parses this file).
// ---------------------------------------------------------------------------
function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function stoneTex() {
  const c = cvs(64, 64), x = c.getContext('2d');
  x.fillStyle = '#5c5f66'; x.fillRect(0, 0, 64, 64);              // cool ashlar
  for (let i = 0; i < 340; i++) {
    x.fillStyle = (rnd() < 0.5) ? 'rgba(30,30,34,0.4)' : 'rgba(150,150,158,0.22)';
    x.fillRect((rr(0, 64)) | 0, (rr(0, 64)) | 0, 1, 1);
  }
  x.strokeStyle = 'rgba(22,22,26,0.35)'; x.lineWidth = 1;
  for (let y = 16; y < 64; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(64, y); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function floorTex() {
  const c = cvs(64, 64), x = c.getContext('2d');
  x.fillStyle = '#4f5258'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(24,24,28,0.5)'; x.lineWidth = 2; x.strokeRect(1, 1, 62, 62);
  x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 64); x.moveTo(0, 32); x.lineTo(64, 32); x.stroke();
  for (let i = 0; i < 260; i++) {
    x.fillStyle = (rnd() < 0.5) ? 'rgba(26,26,30,0.28)' : 'rgba(140,140,148,0.16)';
    x.fillRect((rr(0, 64)) | 0, (rr(0, 64)) | 0, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function timberTex() {
  const c = cvs(64, 64), x = c.getContext('2d');
  x.fillStyle = '#3a2c1d'; x.fillRect(0, 0, 64, 64);              // dark oak
  for (let i = 0; i < 64; i++) {
    const a = 0.05 + rr(0, 0.12);
    x.fillStyle = (rnd() < 0.5) ? `rgba(24,18,10,${a})` : `rgba(96,76,48,${a})`;
    x.fillRect(0, i, 64, 1);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}
function glassTex() {
  const c = cvs(32, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, '#8fa2ba'); g.addColorStop(1, '#c2d0df');     // cold daylight
  x.fillStyle = g; x.fillRect(0, 0, 32, 64);
  x.strokeStyle = 'rgba(40,46,56,0.5)'; x.lineWidth = 1;          // leaded quarrels
  for (let y = 8; y < 64; y += 12) { x.beginPath(); x.moveTo(0, y); x.lineTo(32, y); x.stroke(); }
  for (let xx = 8; xx < 32; xx += 12) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 64); x.stroke(); }
  return crunch(new THREE.CanvasTexture(c));
}
// A faded ancestor portrait: dark ground, a pale lolling face, dark robe, dull gilt edge.
function portraitTex(seed) {
  _seed = (0x51000 + seed * 2654435761) >>> 0;                    // stable per portrait
  const c = cvs(48, 64), x = c.getContext('2d');
  x.fillStyle = '#20201c'; x.fillRect(0, 0, 48, 64);              // aged varnish ground
  x.fillStyle = '#2c2a24'; x.fillRect(6, 30, 36, 34);            // dark robe/shoulders
  x.fillStyle = '#6f6350'; x.beginPath(); x.ellipse(24, 24, 8, 10, 0, 0, Math.PI * 2); x.fill(); // face
  x.fillStyle = '#544a3b';                                        // hollowed features
  x.fillRect(21, 22, 2, 2); x.fillRect(26, 22, 2, 2); x.fillRect(23, 28, 3, 1);
  for (let i = 0; i < 90; i++) {                                  // craquelure / grime
    x.fillStyle = (rnd() < 0.5) ? 'rgba(10,10,8,0.3)' : 'rgba(120,110,90,0.12)';
    x.fillRect((rr(0, 48)) | 0, (rr(0, 64)) | 0, 1, 1);
  }
  x.strokeStyle = '#6b5a30'; x.lineWidth = 3; x.strokeRect(2, 2, 44, 60); // dull gilt frame
  return crunch(new THREE.CanvasTexture(c));
}
// A faded verdure tapestry: muted moth-eaten bands.
function tapestryTex(seed) {
  _seed = (0x77000 + seed * 40503) >>> 0;
  const c = cvs(64, 96), x = c.getContext('2d');
  const bands = ['#3f4634', '#4a3f2c', '#3a2f2a', '#454b3a', '#2e3328'];
  for (let y = 0; y < 96; y += 6) { x.fillStyle = bands[(y / 6 | 0) % bands.length]; x.fillRect(0, y, 64, 6); }
  for (let i = 0; i < 300; i++) {                                  // wear + moth holes
    x.fillStyle = (rnd() < 0.4) ? 'rgba(0,0,0,0.4)' : 'rgba(130,120,90,0.1)';
    const s = 1 + (rr(0, 2) | 0);
    x.fillRect((rr(0, 64)) | 0, (rr(0, 96)) | 0, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return crunch(t);
}

function makeMaterials() {
  const tStone = stoneTex(); tStone.repeat.set(3, 2);
  const tFloor = floorTex(); tFloor.repeat.set(6, 12);
  const tTimber = timberTex();
  const lambert = (o) => ps1ify(new THREE.MeshLambertMaterial(o));
  const basic = (o) => ps1ify(new THREE.MeshBasicMaterial(o));
  return {
    stone: lambert({ color: 0xa9a698, map: tStone }),
    floor: lambert({ color: 0xa6a394, map: tFloor }),
    timber: lambert({ color: 0x9a8c74, map: tTimber }),   // case & framing oak
    ceil: lambert({ color: 0x2a2620 }),                   // dim plank ceiling
    glass: basic({ map: glassTex(), fog: false, side: THREE.DoubleSide }),
    brass: lambert({ color: 0x7a6a3a }),                  // dial plate, chapter ring
    gilt: lambert({ color: 0xb79a4e }),                   // sun / gilt marks
    pewter: lambert({ color: 0x8a8d92 }),                 // moon, hands
    iron: lambert({ color: 0x33353a }),                   // gear frame, arbors
    gear: lambert({ color: 0x55585d }),                   // gear wheels
    dark: lambert({ color: 0x16130f }),                   // opened movement recess
    portrait: [portraitTex(1), portraitTex(2), portraitTex(3), portraitTex(4), portraitTex(5)]
      .map((m) => basic({ map: m, fog: false })),         // faded, self-lit reads at PS1 dim
    tapestry: basic({ map: tapestryTex(9), fog: false }),
    runner: lambert({ color: 0x4a2622 }),                 // faded red carpet
    glow: basic({ color: 0x8fb6c4, fog: false }),         // visible source behind the dial
    flesh: lambert({ color: 0x83795f }),
    garb: lambert({ color: 0x2f2c26 }),
    black: lambert({ color: 0x13100d }),                  // blackened extremities
    stain: basic({ color: 0x241c14, side: THREE.DoubleSide }),
    scrub: basic({ color: 0x6d6a5c, side: THREE.DoubleSide }),
    fly: lambert({ color: 0x16130e }),
    lime: lambert({ color: 0xc7c2b4 }),
    // a resting-flat marker leaf face (kept for parity; unused readables here)
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildLongGallery(world) {
  const root = new THREE.Group();
  root.name = 'lg_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloorAndCeiling(root, M);
  buildWalls(root, M);
  buildWindows(root, M);
  buildPortraits(root, M);
  buildBay(root, M);
  buildClock(root, M);
  buildFurniture(root, M);
  buildWatcher(root, M);
  buildAmbientGrammar(root, M);
  buildLighting();
  buildExaminables(world);

  // The module owns its zone (AABB over the whole island).
  if (typeof world.registerZone === 'function') {
    world.registerZone({ name: 'The Long Gallery', min: [-5, -1, -181], max: [5, 8, -139] });
  }

  return { root, entry: ENTRY };
}

// --------------------------------------------------------------- floor/ceiling
function buildFloorAndCeiling(root, M) {
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, ZS - ZN), M.floor);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, 0, CZ);
  surf.name = 'lg_floor';
  root.add(surf);
  registerFloor(surf);

  // faded carpet runner up the centre, from the door to the foot of the clock bay
  flatQuad(root, M.runner, 0, 0.02, (ZN_IN + ZS_IN) / 2 + 1.0, 1.6, (ZS_IN - ZN_IN) - 5.0, 'lg_runner');

  // worn threshold sill at the near doorway
  mkBox(root, 0, 0.02, ZS_IN - 0.35, DOOR_HX * 2 + 0.3, 0.06, 0.5, M.stone, 'lg_sill');

  // dim plank ceiling deck + cross-beams (Gen 6 refinement)
  mkBox(root, 0, WALL_H + 0.1, CZ, X1 - X0, 0.16, ZS - ZN, M.ceil, 'lg_ceiling_deck');
  for (let z = ZN + 1.5; z <= ZS - 1.5; z += 2.0) {
    mkBox(root, 0, WALL_H - 0.14, z, X1 - X0, 0.26, 0.24, M.timber, 'lg_ceiling_beam');
  }
  mkBox(root, X0 + 0.18, WALL_H - 0.22, CZ, 0.22, 0.3, ZS - ZN, M.timber, 'lg_plate_w');
  mkBox(root, X1 - 0.18, WALL_H - 0.22, CZ, 0.22, 0.3, ZS - ZN, M.timber, 'lg_plate_e');
}

// --------------------------------------------------------------------- walls
function buildWalls(root, M) {
  const midY = (WIN_SILL + WIN_HEAD) / 2, midH = WIN_HEAD - WIN_SILL;

  // WEST wall (x=-4): solid (portrait wall).
  solid(root, X0, WALL_H / 2, CZ, T, WALL_H, ZS - ZN, M.stone, 'lg_wall_w');

  // EAST wall (x=+4): solid but for the row of tall window openings.
  {
    const xc = X1;
    mkBox(root, xc, WIN_SILL / 2, CZ, T, WIN_SILL, ZS - ZN, M.stone, 'lg_wall_e_lo');
    mkBox(root, xc, (WIN_HEAD + WALL_H) / 2, CZ, T, WALL_H - WIN_HEAD, ZS - ZN, M.stone, 'lg_wall_e_hi');
    const gaps = WIN_Z.map((z) => [z - WIN_HZ, z + WIN_HZ]);
    let prev = ZN;
    const segs = [];
    for (const [a, b] of gaps) { segs.push([prev, a]); prev = b; }
    segs.push([prev, ZS]);
    for (const [a, b] of segs) {
      if (b - a < 0.05) continue;
      mkBox(root, xc, midY, (a + b) / 2, T, midH, b - a, M.stone, 'lg_wall_e_mid');
    }
    addCol(xc, WALL_H / 2, CZ, T, WALL_H, ZS - ZN);
  }

  // FAR wall (z=-180): solid; the clock backs against it.
  solid(root, 0, WALL_H / 2, ZN, X1 - X0, WALL_H, T, M.stone, 'lg_wall_far');

  // NEAR wall (z=-140): doorway at centre — two jambs + a lintel.
  {
    const zc = ZS;
    const lw = -DOOR_HX - X0;                         // left jamb width
    solid(root, (X0 + -DOOR_HX) / 2, WALL_H / 2, zc, lw, WALL_H, T, M.stone, 'lg_wall_near_l');
    const rw = X1 - DOOR_HX;                          // right jamb width
    solid(root, (X1 + DOOR_HX) / 2, WALL_H / 2, zc, rw, WALL_H, T, M.stone, 'lg_wall_near_r');
    mkBox(root, 0, (DOOR_H + WALL_H) / 2, zc, DOOR_HX * 2, WALL_H - DOOR_H, T, M.stone, 'lg_wall_near_lintel');
    mkBox(root, -DOOR_HX - 0.03, DOOR_H / 2, ZS_IN, 0.1, DOOR_H, T, M.dark, 'lg_door_jamb_l');
    mkBox(root, DOOR_HX + 0.03, DOOR_H / 2, ZS_IN, 0.1, DOOR_H, T, M.dark, 'lg_door_jamb_r');
  }
}

// ------------------------------------------------------------------- windows
// Cold emissive leaded glass flush in each east opening, with slim stone mullions.
function buildWindows(root, M) {
  const wh = WIN_HEAD - WIN_SILL, wy = (WIN_SILL + WIN_HEAD) / 2;
  const xg = XW_IN - 0.02;
  for (const z of WIN_Z) {
    mkBox(root, xg, wy, z, 0.04, wh, WIN_HZ * 2 - 0.08, M.glass, 'lg_glass');
    mkBox(root, xg - 0.02, wy, z, 0.06, wh, 0.06, M.stone, 'lg_mullion');
    mkBox(root, xg - 0.02, wy, z, 0.06, 0.06, WIN_HZ * 2, M.stone, 'lg_transom');
    // a shallow sill inside
    mkBox(root, xg - 0.14, WIN_SILL - 0.05, z, 0.24, 0.1, WIN_HZ * 2, M.stone, 'lg_win_sill');
  }
}

// ---------------------------------------------------------------- portraits
// The dead lineage: faded framed ancestors down the WEST wall (plus a hung
// tapestry), and two portraits on the far wall flanking the clock bay. Grounded
// to the wall — hung, not floating (mounted flush to a solid wall face).
function buildPortraits(root, M) {
  const xw = -XW_IN + 0.03;                       // just proud of the west wall face
  // portrait height band; centre y ~2.3, sizes vary a touch by index
  const zs = [-172, -166, -158, -150, -144.5];
  for (let i = 0; i < zs.length; i++) {
    const w = 0.9 + (i % 2) * 0.15, h = 1.3 + (i % 3) * 0.12;
    const mat = M.portrait[i % M.portrait.length];
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(xw, 2.35, zs[i]);
    p.rotation.y = Math.PI / 2;                    // face +X into the room
    p.name = 'lg_portrait';
    root.add(p);
    // slim gilt frame edge (a thin box behind the plane)
    mkBox(root, xw - 0.02, 2.35, zs[i], 0.06, h + 0.12, w + 0.12, M.brass, 'lg_portrait_frame');
  }
  // a long faded verdure tapestry lower down the wall between two portraits
  const tap = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), M.tapestry);
  tap.position.set(xw, 1.7, -161.5);
  tap.rotation.y = Math.PI / 2;
  tap.name = 'lg_tapestry';
  root.add(tap);
  mkBox(root, xw - 0.03, 3.0, -161.5, 0.06, 0.1, 3.4, M.timber, 'lg_tapestry_rail');

  // two portraits on the far wall, flanking the clock bay (face +Z)
  for (const px of [-2.9, 2.9]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35), M.portrait[(px < 0 ? 2 : 4)]);
    q.position.set(px, 2.4, ZN_IN + 0.03);
    q.name = 'lg_portrait_far';
    root.add(q);
    mkBox(root, px, 2.4, ZN_IN + 0.01, 1.07, 1.47, 0.06, M.brass, 'lg_portrait_far_frame');
  }
}

// -------------------------------------------------------------------- the bay
// A deep framed bay at the far end: two stone pilasters carry a segmental arch,
// setting the clock back into its own recess. Pilasters are colliders.
function buildBay(root, M) {
  const bx = 1.5, bz = ZN_IN + 1.15;              // pilasters stand out from the far wall
  for (const sx of [-1, 1]) {
    solid(root, sx * bx, 2.35, bz, 0.42, 4.7, 0.42, M.stone, 'lg_bay_pilaster');
    mkBox(root, sx * bx, 0.16, bz, 0.56, 0.32, 0.56, M.stone, 'lg_bay_plinth');   // base
    mkBox(root, sx * bx, 4.55, bz, 0.56, 0.24, 0.56, M.stone, 'lg_bay_cap');      // cap
  }
  // segmental arch of stepped voussoirs spanning the pilasters
  const a0 = -bx, a1 = bx, mid = 0, half = bx;
  const N = 9;
  for (let k = 0; k <= N; k++) {
    const th = (k / N) * Math.PI;
    const ax = mid + half * Math.cos(th);
    const ay = 4.55 + 0.55 * Math.sin(th);
    mkBox(root, ax, ay, bz, 0.42, 0.3, 0.42, M.stone, 'lg_bay_voussoir');
  }
  // a low dark tympanum panel behind the arch crown
  mkBox(root, 0, 4.75, ZN_IN + 0.12, bx * 2, 0.5, 0.06, M.dark, 'lg_bay_tympanum');
}

// -------------------------------------------------------------------- clock
// THE great astronomical clock — Payment I. The case towers; the dial keeps its
// sun, moon and zodiac; but the movement is OPENED and half its wheels carried
// out, arbors standing empty, one wheel dropped on the flags. The hands are frozen
// at a hard-coded hour. Grounded: the case base sits on y=0.
function buildClock(root, M) {
  // --- case (oak) --------------------------------------------------------
  mkBox(root, CLK_X, 0.22, CLK_Z, CASE_W + 0.35, 0.44, CASE_D + 0.25, M.timber, 'lg_clk_plinth');
  mkBox(root, CLK_X, CASE_H / 2, CLK_Z, CASE_W, CASE_H, CASE_D, M.timber, 'lg_clk_body');
  // hood (dial housing), a touch wider, with a broken pediment (uncanny)
  mkBox(root, CLK_X, CASE_H - 0.15, CLK_Z, CASE_W + 0.3, 0.9, CASE_D + 0.12, M.timber, 'lg_clk_hood');
  mkBox(root, CLK_X - 0.55, CASE_H + 0.45, CLK_Z, 0.55, 0.5, CASE_D, M.timber, 'lg_clk_pediment_l');
  mkBox(root, CLK_X + 0.55, CASE_H + 0.35, CLK_Z, 0.55, 0.5, CASE_D, M.timber, 'lg_clk_pediment_r'); // askew: lower
  // slender colonnettes framing the hood
  for (const sx of [-1, 1]) mkBox(root, CLK_X + sx * (CASE_W / 2 - 0.05), CASE_H - 0.15, CASE_FRONT - 0.04, 0.1, 0.9, 0.1, M.brass, 'lg_clk_colonnette');
  addCol(CLK_X, CASE_H / 2, CLK_Z, CASE_W + 0.35, CASE_H, CASE_D + 0.25);

  // faint glow disc BEHIND the dial (the visible source of the focused light)
  disc(root, DIAL_R + 0.06, 0.02, 20, M.glow, 'lg_clk_glow', 0);
  const glowMesh = root.children[root.children.length - 1];
  glowMesh.position.set(CLK_X, DIAL_Y, DIAL_Z - 0.05);

  // --- dial group (all sub-parts face +Z) --------------------------------
  const dial = new THREE.Group();
  dial.name = 'lg_clk_dial';
  dial.position.set(CLK_X, DIAL_Y, DIAL_Z);
  root.add(dial);

  disc(dial, DIAL_R, 0.05, 24, M.brass, 'lg_dial_plate', -0.02);      // brass plate
  // chapter ring
  const chapter = new THREE.Mesh(new THREE.TorusGeometry(DIAL_R - 0.02, 0.045, 6, 24), M.gilt);
  chapter.name = 'lg_dial_chapter'; dial.add(chapter);
  // 12 hour marks (roman-hour blocks) around the chapter ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = DIAL_R - 0.1;
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.02), M.gilt);
    mk.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.03);
    mk.rotation.z = -a;
    mk.name = 'lg_dial_hour';
    dial.add(mk);
  }
  // zodiac ring (inner) — 12 small blocks, the ecliptic band
  const zring = new THREE.Mesh(new THREE.TorusGeometry(DIAL_R - 0.24, 0.02, 6, 24), M.brass);
  zring.name = 'lg_dial_zodiac_ring'; zring.position.z = 0.01; dial.add(zring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = DIAL_R - 0.24;
    const zm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.02), M.gilt);
    zm.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.04);
    zm.name = 'lg_dial_zodiac';
    dial.add(zm);
  }
  // SUN on the ecliptic — hard-coded low angle (below the horizon line: wrong)
  {
    const a = 3.86;                                  // ~221°, sunk toward lower-left
    const r = DIAL_R - 0.24;
    const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), M.gilt);
    sun.rotation.x = Math.PI / 2;
    sun.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.06);
    sun.name = 'lg_dial_sun';
    dial.add(sun);
    // short gilt rays
    for (let k = 0; k < 8; k++) {
      const ra = (k / 8) * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), M.gilt);
      ray.position.set(Math.sin(a) * r + Math.sin(ra) * 0.13, Math.cos(a) * r + Math.cos(ra) * 0.13, 0.06);
      ray.rotation.z = -ra; ray.name = 'lg_dial_sunray'; dial.add(ray);
    }
  }
  // MOON on its own smaller circle — hard-coded, and out of phase with the sun
  {
    const a = 1.15;                                  // upper-right
    const r = DIAL_R - 0.42;
    const moon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), M.pewter);
    moon.rotation.x = Math.PI / 2;
    moon.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.06);
    moon.name = 'lg_dial_moon';
    dial.add(moon);
    // a dark bite out of it (a gibbous shadow, off-true)
    const shad = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 12), M.dark);
    shad.rotation.x = Math.PI / 2;
    shad.position.set(Math.sin(a) * r + 0.05, Math.cos(a) * r, 0.07);
    shad.name = 'lg_dial_moon_shadow'; dial.add(shad);
  }
  // boss / arbor at the dial centre
  disc(dial, 0.06, 0.08, 12, M.iron, 'lg_dial_boss', 0.06);

  // HANDS — frozen at a hard-coded, incoherent reading (it keeps no true time).
  const mkHand = (len, wid, zoff, ang, mat, tail, name) => {
    const g = new THREE.Group();
    g.position.z = zoff;
    g.rotation.z = ang;
    const h = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.02), mat);
    h.position.y = len / 2 - 0.05;                   // pivot near the boss
    h.name = name;
    g.add(h);
    if (tail) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.16, 0.02), mat);
      t.position.y = -0.1; g.add(t);
    }
    dial.add(g);
  };
  mkHand(0.42, 0.05, 0.07, -2.30, M.pewter, true, 'lg_hand_hour');   // hour, hard-coded
  mkHand(0.6, 0.035, 0.09, 0.95, M.pewter, true, 'lg_hand_minute');  // minute, hard-coded

  // --- the OPENED movement: gutted, half its wheels carried out (Payment I) ---
  // A dark recess in the lower case with the door swung open.
  const movY = 1.75, movZ = CASE_FRONT - 0.03;
  mkBox(root, CLK_X, movY, CASE_FRONT - 0.16, 1.3, 1.5, 0.06, M.dark, 'lg_clk_movement_recess');
  // the case door, swung open on its hinge (hung off the left of the opening)
  const door = mkBox(root, CLK_X - 0.7, movY, CASE_FRONT + 0.28, 0.05, 1.55, 0.62, M.timber, 'lg_clk_door');
  door.rotation.y = -1.15;
  // a couple of wheels still IN the movement (fixed, arbitrary rest angles)
  const wheel = (x, y, r, teeth, ang, z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, teeth), M.gear);
    w.rotation.x = Math.PI / 2; w.rotation.z = ang;
    w.position.set(x, y, z); w.name = 'lg_clk_wheel'; root.add(w);
    // hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), M.iron);
    hub.rotation.x = Math.PI / 2; hub.position.set(x, y, z + 0.01); root.add(hub);
  };
  wheel(CLK_X - 0.28, 2.05, 0.26, 18, 0.4, movZ);
  wheel(CLK_X + 0.22, 1.55, 0.19, 14, 1.1, movZ);
  // EMPTY arbors where wheels were carried out — bright stubs, no wheel
  for (const [ax, ay] of [[CLK_X + 0.34, 2.1], [CLK_X - 0.34, 1.45], [CLK_X + 0.02, 1.9]]) {
    const arb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), M.pewter);
    arb.rotation.x = Math.PI / 2; arb.position.set(ax, ay, movZ + 0.02); arb.name = 'lg_clk_arbor';
    root.add(arb);
  }
  // one great wheel dropped on the flags at the foot of the case
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), M.gear);
  drop.position.set(CLK_X + 0.9, 0.04, CASE_FRONT + 0.55);
  drop.rotation.x = Math.PI / 2 - 0.15; drop.rotation.z = 0.6;    // lying almost flat, tilted
  drop.name = 'lg_clk_wheel_dropped';
  root.add(drop);

  // subtle unstable flicker on the clock glow — uses engine time t (NOT Date).
  const light = new THREE.PointLight(0x9fc4d2, 5.0, 9, 1.7);
  light.position.set(CLK_X, DIAL_Y - 0.2, CASE_FRONT + 0.5);
  light.name = 'lg_clk_light';
  addLight(light);
  onUpdate((dt, t) => {
    light.intensity = 5.0 * (1 + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 11.7));
  });
}

// ---------------------------------------------------------------- furniture
// A fallen chair beneath the clock and a small console table with a dropped
// candlestick — the dropped object the beat asks for. Colliders on both.
function buildFurniture(root, M) {
  // toppled chair on its side, before the clock
  const cx = -0.9, cz = CASE_FRONT + 0.9;
  const chair = new THREE.Group(); chair.name = 'lg_chair';
  chair.position.set(cx, 0, cz);
  chair.rotation.set(0, 0.5, Math.PI / 2 - 0.15);      // tipped onto its side
  // seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), M.timber); seat.position.set(0, 0.45, 0); chair.add(seat);
  // back
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), M.timber); back.position.set(0, 0.7, -0.19); chair.add(back);
  // legs
  for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), M.timber); leg.position.set(lx, 0.22, lz); chair.add(leg);
  }
  root.add(chair);
  addCol(cx, 0.25, cz, 0.7, 0.5, 0.6);                 // low footprint of the fallen chair

  // a small console table against the west wall near the bay
  const tx = -XW_IN + 0.35, tz = -174.5;
  mkBox(root, tx, 0.74, tz, 0.7, 0.06, 1.1, M.timber, 'lg_table_top');
  for (const lz of [tz - 0.45, tz + 0.45]) {
    mkBox(root, tx, 0.36, lz, 0.08, 0.72, 0.08, M.timber, 'lg_table_leg');
    mkBox(root, tx + 0.28, 0.36, lz, 0.08, 0.72, 0.08, M.timber, 'lg_table_leg');
  }
  addCol(tx, 0.4, tz, 0.7, 0.8, 1.1);
  // a dropped brass candlestick lying on its side on the table
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.28, 8), M.brass);
  stick.position.set(tx, 0.79, tz + 0.1); stick.rotation.z = Math.PI / 2; stick.rotation.y = 0.3;
  stick.name = 'lg_candlestick'; root.add(stick);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), M.brass);
  foot.position.set(tx - 0.02, 0.79, tz - 0.05); foot.rotation.z = Math.PI / 2; root.add(foot);
}

// ---------------------------------------------------------------- the watcher
// One man sat down before the clock to watch it and did not get up. Slumped on the
// flags a few metres out, facing the bay; blackened hands and feet; a dark stain
// pooled and scrubbed at beneath him. Plague grammar; grounded flat.
function buildWatcher(root, M) {
  const cx = 0.5, cz = CASE_FRONT + 2.6;               // a few metres before the clock
  // slumped seated torso, leaning back toward -X, head lolled
  mkBox(root, cx, 0.42, cz, 0.5, 0.62, 0.32, M.garb, 'lg_watch_torso').rotation.x = 0.35;
  mkBox(root, cx - 0.05, 0.78, cz - 0.18, 0.24, 0.24, 0.24, M.flesh, 'lg_watch_head');
  // legs out toward the clock (-Z)
  mkBox(root, cx - 0.12, 0.1, cz - 0.5, 0.16, 0.16, 0.7, M.garb, 'lg_watch_leg');
  mkBox(root, cx + 0.14, 0.1, cz - 0.48, 0.16, 0.16, 0.66, M.garb, 'lg_watch_leg');
  // blackened feet (toward the clock) and one hand fallen in the lap
  mkBox(root, cx - 0.12, 0.08, cz - 0.9, 0.14, 0.1, 0.16, M.black, 'lg_watch_foot');
  mkBox(root, cx + 0.14, 0.08, cz - 0.86, 0.14, 0.1, 0.16, M.black, 'lg_watch_foot');
  mkBox(root, cx + 0.24, 0.3, cz + 0.02, 0.12, 0.1, 0.12, M.black, 'lg_watch_hand');
  // arm resting along the side
  mkBox(root, cx + 0.26, 0.4, cz - 0.12, 0.1, 0.1, 0.42, M.garb, 'lg_watch_arm');

  // dark stain pooled under him, and a paler patch scrubbed at (not out)
  flatQuad(root, M.stain, cx, 0.021, cz + 0.1, 1.0, 0.8, 'lg_watch_stain', 0.2);
  flatQuad(root, M.scrub, cx - 0.5, 0.022, cz + 0.5, 0.6, 0.5, 'lg_watch_scrub', -0.3);
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: drifts of dead flies banked in the far corners of the bay, and a little
// lime scattered at the near threshold. Never labelled.
function buildAmbientGrammar(root, M) {
  const flies = new THREE.Group(); flies.name = 'lg_flies'; root.add(flies);
  const drift = (cx, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(rr(0.02, 0.045), 0.02, rr(0.02, 0.045)), M.fly);
      f.position.set(cx + rr(-rx, rx), 0.012 + rr(0, 0.02), cz + rr(-rz, rz));
      flies.add(f);
    }
  };
  drift(X0 + 0.5, ZN_IN + 0.5, 0.4, 0.5, 46);          // far corners of the bay
  drift(X1 - 0.5, ZN_IN + 0.5, 0.4, 0.5, 42);
  drift(0.5, CASE_FRONT + 2.6, 0.6, 0.6, 34);          // drawn to the watcher

  const lime = new THREE.Group(); lime.name = 'lg_lime'; root.add(lime);
  for (let i = 0; i < 46; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(rr(0.03, 0.1), 0.02, rr(0.03, 0.1)), M.lime);
    l.position.set(rr(-DOOR_HX - 0.4, DOOR_HX + 0.4), 0.012, rr(ZS_IN - 1.0, ZS_IN - 0.1));
    lime.add(l);
  }
}

// ------------------------------------------------------------------ lighting
// Local point lights only (no global ambient touch beyond a low cool fill). A
// COLD row of window shafts down the east side, grading to a FOCUSED glow at the
// clock (the clock's own light is added in buildClock so it can flicker).
function buildLighting() {
  addLight(new THREE.AmbientLight(0x262d38, 0.42));    // low, cool fill

  // one cold daylight shaft per east window (sources = the emissive glass planes)
  for (let i = 0; i < WIN_Z.length; i++) {
    const z = WIN_Z[i];
    const win = new THREE.PointLight(0x93aecb, 7.5, 11, 1.8);
    win.position.set(XW_IN - 0.7, 2.7, z);
    win.name = 'lg_light_window';
    addLight(win);
  }
  // a dim cool wash over the door end so the entry reads
  const doorFill = new THREE.PointLight(0x5a6470, 3.0, 9, 1.7);
  doorFill.position.set(0, 2.6, ZS_IN - 2.0);
  doorFill.name = 'lg_light_door';
  addLight(doorFill);

  // a soft cool fill in the bay so the watcher/clock read on approach
  const bayFill = new THREE.PointLight(0x6d7c88, 2.6, 8, 1.6);
  bayFill.position.set(0, 2.4, CASE_FRONT + 2.4);
  bayFill.name = 'lg_light_bay';
  addLight(bayFill);
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
  // THE focal beat — the clock (tie to Payment I without over-explaining).
  registerProp(world, 'lg_ix_clock', CLK_X, 1.9, CASE_FRONT + 1.1, 2.6,
    'A great clock fills the bay — a dial of sun, moon and zodiac over a case tall as two men. The little door in it stands open, and the works behind are half empty.',
    'Where wheels should mesh there are bright bare spindles, and one broad wheel lies dropped on the flags. Whatever was taken was taken carefully, and lately. The hands have not been touched. They hold their hour over a movement that can no longer turn them.');

  // a quieter one — the row of ancestors watching down the wall.
  registerProp(world, 'lg_ix_portraits', -XW_IN + 0.4, 2.3, -158, 2.0,
    'A line of painted faces down the wall, gone dark under old varnish, each in its dull gilt frame.',
    'They are one family over many hands — the same long jaw, the same set mouth, sitting for painter after painter. The last frame in the run is empty of anyone; the canvas in it was cut out close to the edge.');
}
