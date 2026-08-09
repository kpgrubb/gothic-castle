import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';

// ===========================================================================
// THE KEEP (interior)  (atlas #26 — Gen 1 Otwin I, the Founder. "Ancestral: the
// founder's keep, thick and dark." Band B1: highest, oldest, most defensive.
// world-bible §3: "Crude, thick, defensive. Small windows. Rubble core.")
//
// The oldest, heaviest, darkest fabric in the castle: a squat Norman-keep block
// with metre-thick rubble walls, small deep-set window slits, and almost no
// light. A GROUND HALL (the founder's hall) fills the block: a great cold hearth
// in a low alcove under the chamber, four heavy piers, the wreck of a long
// table, benches, the founder's high seat, an arms-rack. A solid stone STAIR
// climbs the east wall to an UPPER FLOOR — the lord's chamber over the hearth
// alcove: a bed, a chest, a single narrow slit. The walls carry two storeys and
// a beamed roof.
//
// PLAGUE GRAMMAR, applied LIGHTLY (this is ancestral fabric, not a diabolical
// work): one man down where he fell in the hall and one on the bed above, hands
// and feet gone black at the ends; drifts of dead flies banked in the corners
// (never labelled); a little lime at the threshold; a dark stain worked into the
// stone with the pale marks of a brush that gave out beside it.
//
// Self-contained island centred C = (-100, 0, -100). Builds all geometry (merged
// per material), colliders, the walkable ground + upper floors with a real
// climbable stair (invisible smooth ramp under the visible treads), and its OWN
// dim local lighting (no global ambient — the great hall's tuning is untouched).
// Every named object is prefixed `keep_`. buildKeep(world) returns { root, entry };
// the integrator wires the portal (this file does NOT register portals). It DOES
// register its own zone. DETERMINISM: no Math.random / Date.now — a seeded LCG
// drives all scatter.
// ===========================================================================

// --- Island frame (metres) -------------------------------------------------
const CX = -100, CZ = -100;                // island centre
const H = 8;                               // interior half-extent -> 16 x 16
const X0 = CX - H, X1 = CX + H;            // interior x faces  [-108, -92]
const Z0 = CZ - H, Z1 = CZ + H;            // interior z faces  [-108(N), -92(S)]
const T = 1.0;                             // THICK rubble wall
const ROOF_Y = 8.7;                        // beamed roof / top of the two storeys
const WALL_YC = ROOF_Y / 2;               // wall box centre (full two-storey height)

// --- Upper floor (lord's chamber deck over the north hearth-alcove) ---------
const UP_Y = 4.5;                          // deck top surface (walkable)
const DECK_T = 0.5;                        // deck slab thickness (underside 4.0)
const DECK_Z1 = -104;                      // deck SOUTH edge (the gallery lip)
// deck covers x[-108,-92], z[-108,-104]; the hearth alcove sits beneath it.

// --- Stair (solid stone flight up the EAST wall, S->N, ground -> deck) ------
const S_Z0 = -92.5, S_Z1 = DECK_Z1;        // bottom (y=0) -> top landing (y=UP_Y)
const STAIR_X0 = -94.5, STAIR_X1 = X1;     // footprint x[-94.5,-92] (against E wall)
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;
const N_TREADS = 16;
/** Ramp height at a given z along the flight, clamped flat at top and bottom. */
function rampY(z) {
  const t = (S_Z0 - z) / (S_Z0 - S_Z1);    // 0 at bottom, 1 at top
  return Math.max(0, Math.min(1, t)) * UP_Y;
}

// --- Door (plain founder's doorway, south wall z = Z1) ----------------------
const DOOR_CX = CX, DOOR_W = 1.7, DOOR_H = 2.4;
const DOOR_X0 = DOOR_CX - DOOR_W / 2, DOOR_X1 = DOOR_CX + DOOR_W / 2;

// --- Entry (just inside the south doorway, on the hall floor, facing -Z) ----
export const KEEP_ENTRY = { x: CX, y: 1.7, z: -94, yaw: Math.PI };

// --- Great hearth (cold, ashed) — north wall, under the chamber deck --------
const HEARTH_CX = CX;                       // -100
const HEARTH_W = 5.0;                        // opening width (x)
const HEARTH_PROJ = 2.0;                     // how far the hearthstone projects (+z)
const HEARTH_Z = Z0 + HEARTH_PROJ / 2;       // hearthstone centre z (-107)

// --- Windows (small, deep-set slits) ---------------------------------------
const G_SILL = 2.4, G_HEAD = 3.4, G_W = 0.55;   // ground slits
const U_SILL = 5.7, U_HEAD = 6.6, U_W = 0.45;   // upper-chamber slit

// ---------------------------------------------------------------------------
// Seeded LCG so all scatter (flies, lime, ash, stone speckle) is stable.
// ---------------------------------------------------------------------------
let _seed = 0x0742e17;
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

// A flat, surface-hugging quad (stains, scrub) lying in the XZ plane.
function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas textures — dark, coarse rubble stone. Crunched to PS1 nearest.
// (Runs in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function speckTex(base, speck, coarse) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  // coarse rubble: scatter darker blotches (irregular stones) then fine grit
  if (coarse) {
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
      const s = Math.floor(rr(3, 8));
      g.fillStyle = speck; g.globalAlpha = rr(0.2, 0.5);
      g.fillRect(x, y, s, s);
    }
  }
  for (let i = 0; i < 320; i++) {
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
  const wallTex = speckTex('#33353b', '#20222a', true); wallTex.repeat.set(3, 2);
  const floorTex = speckTex('#2b2d33', '#191b21', true); floorTex.repeat.set(4, 4);
  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));
  return {
    wall: lambert({ color: 0x44474e, map: wallTex }),      // thick rubble
    floor: lambert({ color: 0x35383e, map: floorTex }),    // worn flags
    deck: lambert({ color: 0x3a2e22 }),                    // heavy timber chamber deck
    stone: lambert({ color: 0x4c4f56 }),                   // dressed stone (piers, stair, hearth)
    dark: lambert({ color: 0x16181d }),                    // reveals / recesses / hearth void
    ash: lambert({ color: 0x2c2b28 }),                     // cold ash bed
    char: lambert({ color: 0x131110 }),                    // charred logs
    timber: lambert({ color: 0x4a3a2a }),                  // furniture
    timberDk: lambert({ color: 0x342a1e }),                // darker/older timber
    linen: lambert({ color: 0x9a988e },),                  // bed / pallet
    iron: lambert({ color: 0x54565b }),                    // arms, chest bands
    flesh: lambert({ color: 0x8a7f6d }),                   // bodies
    garb: lambert({ color: 0x2f2c27 }),                    // dark clothing
    black: lambert({ color: 0x14100e }),                   // blackened extremities
    fly: lambert({ color: 0x17140f }),                     // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),                    // scattered lime
    wax: lambert({ color: 0xcbb89a }),                     // tallow stub
    stain: basic({ color: 0x191512 }),                     // worked-in stain (flat, unlit)
    scrub: basic({ color: 0x4b463f, transparent: true, opacity: 0.32 }),
    ember: basic({ color: 0x8a3a16, fog: false }),         // faint residual ember glow
    flame: basic({ color: 0xffcf8f, fog: false }),         // tallow flame
    glass: basic({ color: 0x8fa2b8, fog: false, side: THREE.DoubleSide }), // cold slit glow
    rampHidden: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildKeep(world) {
  const root = new THREE.Group();
  root.name = 'keep_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloors(root, M);
  buildWalls(root, M);
  buildPiers(root, M);
  buildDeckAndChamber(root, M);
  buildStair(root, M);
  buildHearth(root, M);
  buildHallFurniture(root, M);
  buildChamberFurniture(root, M);
  buildBodies(root, M);
  buildAmbientGrammar(root, M);
  buildLighting(root, M);
  buildExaminables(world);

  // Own zone — the whole island volume, including the upper storey.
  world.registerZone({ name: 'The Keep', min: [-110, -1, -110], max: [-90, 10, -90] });

  return { root, entry: KEEP_ENTRY };
}

// -------------------------------------------------------------------- floors
function buildFloors(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), M.floor);
  floor.name = 'keep_floor_ground';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);
}

// --------------------------------------------------------------------- walls
// Metre-thick rubble perimeter, carrying two storeys to the roof. South wall is
// split around the doorway; deep window reveals punched high on E/W (ground) and
// in the N wall (upper chamber). Slit openings sit above the collision band.
function buildWalls(root, M) {
  const yc = WALL_YC, h = ROOF_Y;
  // north (z=Z0) — the hearth/chimney wall
  addBox(root, M.wall, CX, yc, Z0 - T / 2, 2 * H + 2 * T, h, T, 'keep_wall_n', true);
  // east (x=X1) — carries the stair against its inner face
  addBox(root, M.wall, X1 + T / 2, yc, CZ, T, h, 2 * H + 2 * T, 'keep_wall_e', true);
  // west (x=X0)
  addBox(root, M.wall, X0 - T / 2, yc, CZ, T, h, 2 * H + 2 * T, 'keep_wall_w', true);
  // south (z=Z1) split around the doorway
  const sLeftW = DOOR_X0 - (X0 - T);
  addBox(root, M.wall, ((X0 - T) + DOOR_X0) / 2, yc, Z1 + T / 2, sLeftW, h, T, 'keep_wall_s_l', true);
  const sRightW = (X1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (X1 + T)) / 2, yc, Z1 + T / 2, sRightW, h, T, 'keep_wall_s_r', true);
  // lintel + head over the door (above the collision band — visual only)
  addBox(root, M.wall, DOOR_CX, (DOOR_H + ROOF_Y) / 2, Z1 + T / 2, DOOR_W + 0.2, ROOF_Y - DOOR_H, T, 'keep_wall_s_head', false);
  // heavy stone door jambs
  addBox(root, M.stone, DOOR_X0 - 0.06, DOOR_H / 2, Z1 - 0.02, 0.16, DOOR_H, T + 0.04, 'keep_door_jamb_l', false);
  addBox(root, M.stone, DOOR_X1 + 0.06, DOOR_H / 2, Z1 - 0.02, 0.16, DOOR_H, T + 0.04, 'keep_door_jamb_r', false);
  addBox(root, M.dark, DOOR_CX, DOOR_H + 0.18, Z1 + T / 2, DOOR_W + 0.2, 0.3, T + 0.06, 'keep_door_lintel', false);

  // deep-set window reveals (dark stone tunnels through the thick wall). The
  // glow plane + cold light are placed in buildLighting at the same coords.
  // ground: one E, one W (high on the long walls), at z = -100.
  addBox(root, M.dark, X1 + T / 2, (G_SILL + G_HEAD) / 2, -100, T + 0.06, G_HEAD - G_SILL, G_W + 0.2, 'keep_slit_e', false);
  addBox(root, M.dark, X0 - T / 2, (G_SILL + G_HEAD) / 2, -100, T + 0.06, G_HEAD - G_SILL, G_W + 0.2, 'keep_slit_w', false);
  // upper: one narrow slit in the N wall of the chamber, offset from the flue.
  addBox(root, M.dark, -95, (U_SILL + U_HEAD) / 2, Z0 - T / 2, U_W + 0.2, U_HEAD - U_SILL, T + 0.06, 'keep_slit_u', false);

  // beamed roof deck over the whole plan
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(2 * H + 2 * T, 2 * H + 2 * T), M.dark);
  roof.name = 'keep_roof';
  roof.position.set(CX, ROOF_Y, CZ);
  roof.rotation.x = Math.PI / 2;             // faces down
  root.add(roof);
  const beams = [];
  for (let x = X0 + 2; x <= X1 - 2; x += 3) pushBox(beams, x, ROOF_Y - 0.22, CZ, 0.3, 0.34, 2 * H);
  pushBox(beams, CX, ROOF_Y - 0.4, CZ, 2 * H, 0.24, 0.3);   // one ridge purlin
  mergedMesh(root, beams, M.timberDk, 'keep_roof_beams');
}

// --------------------------------------------------------------------- piers
// Four heavy piers of dressed stone: two carry the chamber deck's south lip,
// two stand freestanding in the hall — Norman mass, oppressive close-spacing.
function buildPiers(root, M) {
  const PW = 1.2;
  const deckPiers = [[-104, DECK_Z1], [-96, DECK_Z1]];        // under the gallery lip
  for (const [px, pz] of deckPiers) {
    addBox(root, M.stone, px, UP_Y / 2, pz, PW, UP_Y, PW, 'keep_pier_deck', false);
    collideBox(px, UP_Y / 2, pz, PW, UP_Y, PW);
  }
  const hallPiers = [[-104, -98], [-96, -98]];                // freestanding, full height
  for (const [px, pz] of hallPiers) {
    addBox(root, M.stone, px, ROOF_Y / 2, pz, PW, ROOF_Y, PW, 'keep_pier_hall', false);
    // simple corbel caps for weight
    addBox(root, M.stone, px, UP_Y - 0.1, pz, PW + 0.3, 0.24, PW + 0.3, 'keep_pier_corbel', false);
    collideBox(px, ROOF_Y / 2, pz, PW, ROOF_Y, PW);
  }
}

// ------------------------------------------------------------ deck + chamber
// The lord's chamber deck over the north hearth-alcove (y=UP_Y), a stone gallery
// parapet along its south lip, and a solid partition (with a doorway at the
// stairhead) closing the chamber off from the double-height hall.
function buildDeckAndChamber(root, M) {
  // deck slab: x[-108,-92], z[-108,-104]; top surface at UP_Y (walkable)
  const deck = addBox(root, M.deck, CX, UP_Y - DECK_T / 2, (Z0 + DECK_Z1) / 2,
    2 * H, DECK_T, (DECK_Z1 - Z0), 'keep_deck', false);
  registerFloor(deck);
  // joists showing on the underside (visual)
  const joists = [];
  for (let x = X0 + 1.5; x <= X1 - 1.5; x += 2) pushBox(joists, x, UP_Y - DECK_T - 0.12, (Z0 + DECK_Z1) / 2, 0.2, 0.24, DECK_Z1 - Z0);
  mergedMesh(root, joists, M.timberDk, 'keep_deck_joists');

  // gallery parapet along the deck's south lip (z=DECK_Z1), leaving the stair
  // landing gap open on the east (x[-95,-92]).
  const paraW = (-95) - (X0);                 // from west wall to the landing gap
  addBox(root, M.stone, (X0 + (-95)) / 2, UP_Y + 0.4, DECK_Z1, paraW, 0.8, 0.4, 'keep_gallery_parapet', false);
  collideBox((X0 + (-95)) / 2, UP_Y + 0.4, DECK_Z1, paraW, 0.9, 0.4);

  // partition closing the chamber from the hall, above the deck: from deck to
  // roof, split around a doorway at the stairhead (x[-94.5,-92], the E gap).
  const partW = (-94.5) - (X0);
  const partYC = (UP_Y + ROOF_Y) / 2, partH = ROOF_Y - UP_Y;
  addBox(root, M.wall, (X0 + (-94.5)) / 2, partYC, DECK_Z1, partW, partH, T * 0.6, 'keep_partition', false);
  collideBox((X0 + (-94.5)) / 2, partYC, DECK_Z1, partW, partH, T * 0.6);
  // stone doorhead over the chamber doorway
  addBox(root, M.stone, -93.25, UP_Y + DOOR_H + 0.15, DECK_Z1, 2.7, 0.3, T * 0.6, 'keep_chamber_doorhead', false);
}

// --------------------------------------------------------------------- stair
// A solid stone flight up the east wall, S->N: (a) an invisible smooth ramp
// proxy (the registered walkable surface — the climb glides), (b) visible chunky
// treads sitting on it, (c) a stone cheek wall on the open (west) side so the
// player is held on the flight. Gentle: 4.5 m rise over 11.5 m run (~21 deg).
function buildStair(root, M) {
  // (a) invisible ramp proxy: quad from the bottom line up to the top landing.
  const g = new THREE.BufferGeometry();
  const A = [STAIR_X0, 0, S_Z0], B = [STAIR_X1, 0, S_Z0];
  const C = [STAIR_X1, UP_Y, S_Z1], D = [STAIR_X0, UP_Y, S_Z1];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3));
  g.computeVertexNormals();
  const ramp = new THREE.Mesh(g, M.rampHidden);
  ramp.name = 'keep_stair_ramp';
  root.add(ramp);
  registerFloor(ramp);

  // (b) visible treads — merged dressed-stone wedges, tops flush with the ramp.
  const dz = (S_Z0 - S_Z1) / N_TREADS;        // positive step in -z
  const treads = [];
  for (let i = 0; i < N_TREADS; i++) {
    const zc = S_Z0 - (i + 0.5) * dz;
    const yTop = rampY(zc);
    // box 0.44 tall > rise (~0.28) so consecutive treads overlap (closed flight)
    pushBox(treads, STAIR_XC, yTop - 0.22, zc, STAIR_X1 - STAIR_X0, 0.44, dz + 0.02);
  }
  mergedMesh(root, treads, M.stone, 'keep_stair_treads');

  // (c) stone cheek/rail on the open (west) side of the UPPER flight only, so the
  // climber is held above the dangerous drop while the low foot (z[-92.5,-95])
  // stays open to board from the hall. Reads as the stair's mural stringer.
  const RAIL_Z0 = -95, RAIL_Z1 = S_Z1;                 // z[-104,-95]
  addBox(root, M.stone, STAIR_X0 - 0.15, 2.75, (RAIL_Z0 + RAIL_Z1) / 2, 0.3, 5.5, (RAIL_Z0 - RAIL_Z1), 'keep_stair_cheek', false);
  collideBox(STAIR_X0 - 0.15, 2.75, (RAIL_Z0 + RAIL_Z1) / 2, 0.3, 5.5, (RAIL_Z0 - RAIL_Z1));
}

// -------------------------------------------------------------------- hearth
// The great hearth in the north alcove, gone cold: a raised hearthstone, a
// massive stone opening and lintel, the flue-breast rising into the deck above,
// and a bed of grey ash with the black wreck of a burnt-out log.
function buildHearth(root, M) {
  const hx = HEARTH_CX;
  // raised hearthstone projecting into the room
  addBox(root, M.stone, hx, 0.12, HEARTH_Z, HEARTH_W + 1.2, 0.24, HEARTH_PROJ, 'keep_hearth_stone', false);
  collideBox(hx, 0.3, HEARTH_Z, HEARTH_W + 1.2, 0.6, HEARTH_PROJ);
  // jambs framing the fire-opening (against the N wall)
  for (const s of [-1, 1]) {
    addBox(root, M.stone, hx + s * (HEARTH_W / 2 + 0.35), 1.35, Z0 + 0.35, 0.7, 2.7, 0.7, 'keep_hearth_jamb', false);
    collideBox(hx + s * (HEARTH_W / 2 + 0.35), 1.35, Z0 + 0.35, 0.7, 2.7, 0.7);
  }
  // heavy stone lintel across the opening
  addBox(root, M.stone, hx, 2.95, Z0 + 0.4, HEARTH_W + 1.4, 0.6, 0.8, 'keep_hearth_lintel', false);
  // flue-breast rising from the lintel up into the deck (batters back to the wall)
  addBox(root, M.stone, hx, (3.25 + UP_Y) / 2, Z0 + 0.3, HEARTH_W, UP_Y - 3.25, 0.6, 'keep_hearth_breast', false);
  // the dark fire-back recess
  addBox(root, M.dark, hx, 1.4, Z0 + 0.08, HEARTH_W - 0.4, 2.2, 0.2, 'keep_hearth_back', false);
  // cold ash bed + charred logs on the hearthstone
  addBox(root, M.ash, hx, 0.27, Z0 + 0.55, HEARTH_W - 0.6, 0.08, 1.0, 'keep_hearth_ash', false);
  for (let i = 0; i < 3; i++) {
    const lx = hx - 0.9 + i * 0.9;
    addBox(root, M.char, lx, 0.34, Z0 + 0.55, 0.14, 0.14, rr(0.6, 0.9), 'keep_hearth_log', false, rr(-0.3, 0.3));
  }
}

// ---------------------------------------------------------- hall furniture
// The wreck of the long table, heavy benches, the founder's high seat facing the
// hearth, and an arms-rack against the west wall.
function buildHallFurniture(root, M) {
  // long table down the hall axis (x=CX), z[-101,-96]; one end has given way.
  const TZ = -98.5, TLEN = 4.6, TTOP = 0.78;
  addBox(root, M.timber, CX, TTOP - 0.05, TZ, 1.2, 0.1, TLEN, 'keep_table_top', false);
  // trestle legs — the south pair collapsed (that end of the top droops via a prop)
  for (const sz of [TZ - TLEN / 2 + 0.5, TZ + TLEN / 2 - 0.5]) {
    for (const sx of [-0.45, 0.45]) addBox(root, M.timberDk, CX + sx, 0.36, sz, 0.14, 0.72, 0.18, 'keep_table_leg', false);
  }
  // a fallen trestle + a slumped board at the broken south end
  addBox(root, M.timberDk, CX + 0.3, 0.12, TZ + TLEN / 2 + 0.4, 1.0, 0.16, 0.4, 'keep_table_wreck', false, 0.4);
  addBox(root, M.timber, CX - 0.2, 0.3, TZ + TLEN / 2 + 0.2, 1.0, 0.08, 0.9, 'keep_table_board', false, 0.25);
  collideBox(CX, 0.5, TZ, 1.2, 1.0, TLEN);

  // heavy benches flanking the table
  for (const sx of [-1.05, 1.05]) {
    addBox(root, M.timberDk, CX + sx, 0.24, TZ, 0.4, 0.14, TLEN - 1.2, 'keep_bench', false);
    for (const sz of [TZ - (TLEN - 1.2) / 2 + 0.3, TZ + (TLEN - 1.2) / 2 - 0.3]) {
      addBox(root, M.timberDk, CX + sx, 0.12, sz, 0.36, 0.24, 0.2, 'keep_bench_leg', false);
    }
    collideBox(CX + sx, 0.3, TZ, 0.4, 0.6, TLEN - 1.2);
  }

  // the founder's high seat — a great blocky chair before the hearth, facing N.
  const FSZ = -102.6;
  addBox(root, M.timberDk, CX, 0.28, FSZ, 1.0, 0.14, 0.9, 'keep_seat_pan', false);      // seat pan
  addBox(root, M.timberDk, CX, 1.1, FSZ - 0.42, 1.0, 1.8, 0.14, 'keep_seat_back', false); // tall back
  for (const sx of [-0.42, 0.42]) for (const sz of [-0.38, 0.38]) {
    addBox(root, M.timberDk, CX + sx, 0.14, FSZ + sz, 0.14, 0.28, 0.14, 'keep_seat_leg', false);
  }
  addBox(root, M.timberDk, CX, 0.62, FSZ - 0.02, 1.0, 0.14, 0.9, 'keep_seat_arms', false); // arm rail
  collideBox(CX, 0.9, FSZ - 0.2, 1.0, 1.8, 1.0);

  // arms-rack against the west wall: a rack post-rail holding a few polearms.
  const AX = X0 + 0.5, AZ = -96;
  addBox(root, M.timberDk, AX, 1.1, AZ, 0.18, 0.14, 2.4, 'keep_rack_rail', false);
  addBox(root, M.timberDk, AX, 0.4, AZ, 0.18, 0.8, 0.18, 'keep_rack_post', false);
  const rack = [];
  for (let i = 0; i < 4; i++) {
    const sz = AZ - 0.9 + i * 0.6;
    pushBox(rack, AX + 0.28, 1.35, sz, 0.05, 2.6, 0.05);          // shaft
    pushBox(rack, AX + 0.28, 2.62, sz, 0.09, 0.34, 0.12);        // head
  }
  mergedMesh(root, rack, M.iron, 'keep_rack_arms');
  collideBox(AX + 0.15, 1.3, AZ, 0.5, 2.6, 2.4);
}

// ------------------------------------------------------- chamber furniture
// The lord's chamber over the alcove: a heavy bed against the west wall, a
// banded chest at its foot, a low stool with a tallow stub. All on the deck.
function buildChamberFurniture(root, M) {
  const BX = X0 + 1.3, BZ = -106, BW = 1.5, BL = 2.3;      // bed footprint
  const top = UP_Y;                                        // deck surface
  // frame + posts
  addBox(root, M.timberDk, BX, top + 0.28, BZ, BW, 0.5, BL, 'keep_bed_frame', false);
  for (const sx of [-BW / 2 + 0.1, BW / 2 - 0.1]) for (const sz of [-BL / 2 + 0.1, BL / 2 - 0.1]) {
    addBox(root, M.timberDk, BX + sx, top + 0.6, BZ + sz, 0.16, 1.2, 0.16, 'keep_bed_post', false);
  }
  // pallet + a drawn cover (body added in buildBodies)
  addBox(root, M.linen, BX, top + 0.56, BZ, BW - 0.2, 0.12, BL - 0.2, 'keep_bed_pallet', false);
  addBox(root, M.linen, BX, top + 0.62, BZ - BL / 2 + 0.35, BW - 0.3, 0.14, 0.4, 'keep_bed_bolster', false);
  collideBox(BX, top + 0.5, BZ, BW, 1.0, BL);

  // banded chest at the foot of the bed (south end)
  const CHZ = BZ + BL / 2 + 0.5;
  addBox(root, M.timber, BX, top + 0.3, CHZ, 1.2, 0.6, 0.7, 'keep_chest', false);
  addBox(root, M.iron, BX, top + 0.3, CHZ, 1.24, 0.12, 0.74, 'keep_chest_band', false);
  addBox(root, M.iron, BX, top + 0.62, CHZ, 1.24, 0.06, 0.74, 'keep_chest_lid_band', false);
  collideBox(BX, top + 0.35, CHZ, 1.2, 0.7, 0.7);

  // low stool + a burnt-down tallow stub beside the bed
  const STX = BX + 1.5, STZ = -106;
  addBox(root, M.timber, STX, top + 0.24, STZ, 0.4, 0.1, 0.4, 'keep_stool', false);
  for (const sx of [-0.14, 0.14]) for (const sz of [-0.14, 0.14]) {
    addBox(root, M.timber, STX + sx, top + 0.11, STZ + sz, 0.06, 0.24, 0.06, 'keep_stool_leg', false);
  }
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6), M.wax);
  stub.position.set(STX, top + 0.34, STZ); stub.name = 'keep_chamber_tallow'; root.add(stub);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), M.flame);
  fl.position.set(STX, top + 0.44, STZ); fl.name = 'keep_chamber_flame'; root.add(fl);
  root.userData.chamberFlame = fl; root.userData.chamberFlameY = fl.position.y;
}

// -------------------------------------------------------------------- bodies
// TWO of them, ancestrally, where they fell: one collapsed in the hall by the
// west wall, one composed on the bed above. Hands & feet gone black at the ends.
// Crude merged box-figures, each grounded on its surface (hall floor / deck).
const HALL_BODY = { cx: -105.2, cz: -97, dir: 1, surf: 0 };        // on the flags
const BED_BODY = { cx: X0 + 1.3, cz: -106, dir: 1, surf: UP_Y + 0.62 }; // on the pallet

function pushFigure(F, G, B, b) {
  const { cx, cz, dir, surf } = b;
  const put = (arr, u, v, yy, along, h, across) => pushBox(arr, cx + dir * v, surf + yy, cz + u, across, h, along);
  // u runs head(+)->foot(-) along z; v is the sideways sprawl along x.
  put(G, -0.02, 0, 0.13, 0.66, 0.22, 0.42);           // torso / clothing
  put(F, 0.52, dir * 0.05, 0.12, 0.24, 0.22, 0.22);   // head (lolled)
  put(F, 0.30, 0.24, 0.06, 0.5, 0.10, 0.10);          // arm, flung
  put(F, 0.28, -0.22, 0.06, 0.48, 0.10, 0.10);        // arm, at side
  put(B, 0.55, 0.24, 0.05, 0.12, 0.10, 0.10);         // hand, black
  put(B, 0.52, -0.22, 0.05, 0.12, 0.10, 0.10);        // hand, black
  put(F, -0.42, 0.11, 0.07, 0.56, 0.13, 0.13);        // leg
  put(F, -0.40, -0.13, 0.07, 0.54, 0.13, 0.13);       // leg (askew)
  put(B, -0.72, 0.11, 0.05, 0.14, 0.10, 0.10);        // foot, black
  put(B, -0.70, -0.13, 0.05, 0.14, 0.10, 0.10);       // foot, black
}

function buildBodies(root, M) {
  const F = [], G = [], B = [];
  pushFigure(F, G, B, HALL_BODY);
  pushFigure(F, G, B, BED_BODY);
  mergedMesh(root, F, M.flesh, 'keep_bodies_flesh');
  mergedMesh(root, G, M.garb, 'keep_bodies_garb');
  mergedMesh(root, B, M.black, 'keep_bodies_black');

  // a drawn sheet half over the bed body (composed, up on the pallet)
  addBox(root, M.linen, BED_BODY.cx, BED_BODY.surf + 0.15, BED_BODY.cz + 0.25, 1.1, 0.16, 1.2, 'keep_bed_shroud', false);

  // the dark stain worked into the flags under the hall body + brush-marks that
  // gave out beside it.
  flatQuad(root, M.stain, HALL_BODY.cx, 0.02, HALL_BODY.cz, 0.8, 1.5, 'keep_stain', 0.15);
  for (const s of [-1, 1]) {
    flatQuad(root, M.scrub, HALL_BODY.cx + s * 0.55, 0.021, HALL_BODY.cz + 0.2, 0.16, 0.8, 'keep_stain_scrub');
  }
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: drifts of dead flies banked in the dark corners (never labelled), and a
// little lime scattered at the threshold. Nothing labelled, nothing floating.
function buildAmbientGrammar(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // the four ground corners
  drift(X0 + 0.6, 0.01, Z0 + 0.6, 0.4, 0.4, 55);
  drift(X1 - 0.6, 0.01, Z0 + 0.6, 0.4, 0.4, 48);
  drift(X0 + 0.6, 0.01, Z1 - 0.6, 0.4, 0.4, 50);
  drift(X1 - 0.6, 0.01, Z1 - 0.6, 0.4, 0.4, 46);
  // banked to the hall body, and on the hearthstone in the cold ash
  drift(HALL_BODY.cx + 0.3, 0.02, HALL_BODY.cz, 0.6, 0.7, 40);
  drift(HEARTH_CX, 0.3, Z0 + 0.55, 1.2, 0.4, 30);
  // a thin drift in the upper chamber corner + by the bed body
  drift(X0 + 0.6, UP_Y + 0.01, Z0 + 0.6, 0.4, 0.4, 34);
  drift(BED_BODY.cx + 0.2, BED_BODY.surf + 0.02, BED_BODY.cz, 0.5, 0.6, 26);
  mergedMesh(root, flies, M.fly, 'keep_flies');

  // scattered lime at the south threshold
  const lime = [];
  for (let i = 0; i < 55; i++) {
    const lx = rr(DOOR_X0 - 0.5, DOOR_X1 + 0.5), lz = rr(Z1 - 1.0, Z1 - 0.1);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'keep_lime');
}

// ------------------------------------------------------------------ lighting
// Local point lights only (no global ambient — the great hall's tuning is
// untouched). Almost dark and oppressive: a faint residual EMBER in the cold
// hearth, one tallow stub in the chamber, thin COLD shafts at the deep slits,
// and a couple of very low cool fills so the mass reads at all.
function buildLighting(root, M) {
  // cold slit glow planes + a low cold point just inside each (E/W ground, N upper)
  const slitLights = [];
  const mkSlit = (gx, gy, gz, ry, lx, ly, lz, w, h) => {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
    glow.position.set(gx, gy, gz); glow.rotation.y = ry; glow.name = 'keep_slit_glow';
    root.add(glow);
    const cold = new THREE.PointLight(0x8fa2b8, 4.0, 11, 1.8);
    cold.position.set(lx, ly, lz); cold.name = 'keep_light_slit'; addLight(cold);
    slitLights.push({ light: cold, base: 4.0 });
  };
  mkSlit(X1 - 0.02, (G_SILL + G_HEAD) / 2, -100, -Math.PI / 2, X1 - 1.2, 3.0, -100, G_W, G_HEAD - G_SILL);
  mkSlit(X0 + 0.02, (G_SILL + G_HEAD) / 2, -100, Math.PI / 2, X0 + 1.2, 3.0, -100, G_W, G_HEAD - G_SILL);
  mkSlit(-95, (U_SILL + U_HEAD) / 2, Z0 + 0.02, 0, -95, 6.0, Z0 + 1.2, U_W, U_HEAD - U_SILL);

  // faint residual ember in the cold hearth (a warm, very dim, motivated glow)
  const emberMesh = new THREE.Mesh(new THREE.PlaneGeometry(HEARTH_W - 0.8, 0.3), M.ember);
  emberMesh.position.set(HEARTH_CX, 0.3, Z0 + 0.5);
  emberMesh.rotation.x = -Math.PI / 2; emberMesh.name = 'keep_hearth_ember'; root.add(emberMesh);
  const ember = new THREE.PointLight(0xb2531e, 2.2, 6.5, 2.2);
  ember.position.set(HEARTH_CX, 0.6, Z0 + 0.8); ember.name = 'keep_light_ember'; addLight(ember);

  // the chamber tallow stub (warm, small)
  const tallow = new THREE.PointLight(0xe8a24c, 3.0, 4.5, 2.0);
  tallow.position.set(X0 + 2.8, UP_Y + 0.5, -106); tallow.name = 'keep_light_tallow'; addLight(tallow);

  // very low cool fills so the heavy mass reads (kept dim — this place is dark)
  for (const [fx, fz] of [[CX, -98], [CX, -104]]) {
    const fill = new THREE.PointLight(0x4b535d, 5.5, 20, 1.2);
    fill.position.set(fx, ROOF_Y - 1.0, fz); fill.name = 'keep_light_fill'; addLight(fill);
  }
  const upFill = new THREE.PointLight(0x4b535d, 3.5, 14, 1.3);
  upFill.position.set(CX, ROOF_Y - 0.8, -106); upFill.name = 'keep_light_fill_up'; addLight(upFill);

  // gentle flicker: ember + chamber tallow flame, and a barely-breathing slit.
  const flame = root.userData.chamberFlame;
  const flameY = root.userData.chamberFlameY || 0;
  onUpdate((dt, t) => {
    const n = Math.sin(t * 9.7) * 0.5 + Math.sin(t * 6.1 + 1.3) * 0.3 + Math.sin(t * 19.0) * 0.2;
    ember.intensity = 2.2 * (1 + 0.18 * Math.sin(t * 1.7));   // slow, dying pulse
    tallow.intensity = 3.0 * (1 + 0.14 * n);
    if (flame) { flame.scale.y = 1 + 0.12 * n; flame.position.y = flameY + 0.01 * n; }
    for (const s of slitLights) s.light.intensity = s.base * (1 + 0.03 * Math.sin(t * 0.5 + s.base));
  });
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§10): he names what he sees, never the meaning. Anchor
// Object3D + label (shown near) + latched "more" line on E.
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
  // the great cold hearth
  registerProp(world, 'keep_ix_hearth', HEARTH_CX, 1.0, Z0 + 1.2, 2.6,
    'A hearth wide enough to roast an ox, and cold. The ash in it is grey to the back, banked and undisturbed.',
    'A burnt-out log lies where it fell to embers and no one raked it. Dead flies have drifted into the cold ash. Nothing has been lit here in a long while.');

  // the founder's high seat
  registerProp(world, 'keep_ix_seat', HEARTH_CX, 0.9, -102.6, 2.2,
    'A great blocky chair set square before the hearth, the oldest thing in the room and black with age.',
    'The arms are worn pale where hands have gripped them. It faces the fire and the length of the hall both, and it is empty.');

  // the man down in the hall
  registerProp(world, 'keep_ix_hall_body', HALL_BODY.cx, 0.5, HALL_BODY.cz, 2.2,
    'A man down by the west wall, where he fell. The stone under him is stained dark, and pale scratches ring it where a brush went at it.',
    'His hands and feet are gone black at the ends. The scrubbing gave out before the stain did, and no one came back to finish it.');

  // the one on the bed above
  registerProp(world, 'keep_ix_bed_body', BED_BODY.cx, UP_Y + 0.6, BED_BODY.cz, 2.2,
    'Someone lies on the bed in the upper chamber, a sheet drawn half over. This one was laid out with care.',
    'The bared hand on the cover has blackened to the knuckle. A tallow stub burned down beside the bed and guttered out on its own.');
}
