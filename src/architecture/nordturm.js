import * as THREE from 'three';
import { addBox, addMesh, registerAABB } from './geom-utils.js';
import { registerFloor } from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE NORDTURM — the north tower + Siegmund's study at the top. The emotional
// climax (world-bible §4/§5.5). SEAM-connected to the Great Hall cluster: a
// doorway is cut in the chancel's west wall (x=-6, z=-17, chancel floor y=0.34)
// and the player walks into the tower base and climbs.
//
// FABRIC (world-bible §3): Gen 1 Otwin — the OLDEST stone in the castle. Crude,
// thick, rubble-cored, small arrow-slit windows. A round keep tower.
//
// FORM: a full-circle tower, centre (-8.5,-18.25), R_out 2.5 (interior R_in 1.9,
// wall 0.6 thick). Footprint x[-11,-6] z[-20.75,-15.75] — inside the atlas
// envelope x[-11.5,-6] z[-21,-15.5], offset to the NW so the apse tracery
// window's north sky stays clear (atlas §9 confirmation 3). A tight spiral stair
// winds 3 turns around a central newel from the base (y=0.34) to the STUDY FLOOR
// at y=+13 (atlas claims y≈+18 — a reported deviation for reconciliation).
//
// The study is quiet. Siegmund is an ordinary corpse slumped over the desk by the
// north-west window, mid-letter, pen fallen, ink dried — NOT twisted, NOT gory.
// The one plague detail is blackened fingertips on his visible hand. Nothing to
// fight or solve; the integrator places the keystone-letter marker on the desktop.
//
// TRAVERSAL: exactly the undercroft pattern — a single continuous invisible
// smooth HELICAL RAMP (M.rampHidden, visible=false but raycastable, DoubleSide)
// under the visible stepped treads is registerFloor'd, so the eye glides up.
// The study floor and the base floor are registerFloor'd too. Ramp/treads/floors
// are NEVER collided; the tower wall, newel, desk and chair are.
//
// Builds geometry + colliders + walkable floors ONLY. No lights/fog/audio.
// ===========================================================================

const D2R = (d) => (d * Math.PI) / 180;

// --- tower shell ------------------------------------------------------------
const TX = -8.5, TZ = -18.25;      // tower centre (x,z)
const R_OUT = 2.5, WT = 0.6;       // outer radius, wall thickness
const R_IN = R_OUT - WT;           // interior radius 1.9
const R_MID = (R_OUT + R_IN) / 2;  // wall box centre radius 2.2
const BASE_Y = 0.34;               // tower base floor (flush with the chancel)
const STUDY_Y = 13.0;              // study floor  (atlas says +18 — see report)
const CEIL_Y = 15.9;               // study ceiling cap
const WALL_TOP = 16.5;             // top of the tower wall

// --- doorway (cut in BOTH the chancel wall @x=-6 and the tower arc) ----------
const DOOR_Z = -17.0, DOOR_HZ = 0.6;     // z-centre / half-width  -> 1.2 wide
const DOOR_Y0 = BASE_Y, DOOR_Y1 = BASE_Y + 2.2;  // 0.34 -> 2.54 (2.2 tall)
// tower-wall segments facing the door (derived: z[-17.6,-16.4] at R_MID, east)
const DOOR_A0 = D2R(13), DOOR_A1 = D2R(67);

// --- spiral stair -----------------------------------------------------------
const A_START = Math.atan2(DOOR_Z - TZ, -6 - TX);  // start at the door (~26.6deg)
const TURNS = 3;
const A_SPAN = TURNS * 2 * Math.PI;                // 6*PI
const RISE = STUDY_Y - BASE_Y;                     // 12.66 m
const N_TREADS = 54;                               // 18 per turn, ~0.235 rise
const R_TREAD_IN = 0.30, R_TREAD_OUT = 1.60;       // tread inner/outer radius
const NEWEL_R = 0.28;

// --- study window (opening only; atmosphere adds the cold glowing glass) -----
const WIN_A = D2R(225);                            // north-west facing
const WIN_HALF_A = D2R(13.5);                      // ~0.9 m wide at R_IN
const WIN_Y0 = 13.6, WIN_Y1 = 15.4;                // sill / head (1.8 tall)

// --- arrow slits down the stair (narrow, dim light; N/W exposed sides) -------
const SLITS = [
  { a: D2R(270), y0: 2.2, y1: 2.9 },
  { a: D2R(200), y0: 4.6, y1: 5.3 },
  { a: D2R(250), y0: 7.2, y1: 7.9 },
  { a: D2R(195), y0: 9.8, y1: 10.5 },
];

// helical ramp height at any stair angle
function rampY(a) {
  const t = Math.min(1, Math.max(0, (a - A_START) / A_SPAN));
  return BASE_Y + t * RISE;
}

// ---------------------------------------------------------------- merge utils
/** Push a Y-rotated box's 12 triangles into a flat position array. */
function pushRotBox(arr, cx, cy, cz, w, h, d, ry) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ];
  const v = L.map(([x, y, z]) => [cx + x * c + z * s, cy + y, cz - x * s + z * c]);
  const q = (a, b, cc, e) => arr.push(...v[a], ...v[b], ...v[cc], ...v[a], ...v[cc], ...v[e]);
  q(1, 2, 3, 0); q(4, 7, 6, 5);
  q(0, 4, 5, 1); q(3, 2, 6, 7);
  q(0, 3, 7, 4); q(1, 5, 6, 2);
}

function mergedMesh(root, positions, mat, name) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return addMesh(root, geo, mat, name);
}

/** Subtract [a,b] from a list of [s,e] vertical spans. */
function subtractSpans(spans, [a, b]) {
  const out = [];
  for (const [s, e] of spans) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}

// angular distance (radians) between two angles, wrapped to [0,PI]
function angDist(a, b) {
  let d = Math.abs(((a - b) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

export function buildNordturm(root, M) {
  buildTowerShell(root, M);
  buildBaseFloor(root, M);
  buildSpiral(root, M);
  buildStudyFloor(root, M);
  buildStudy(root, M);
  buildColliders(root, M);
}

// --------------------------------------------------------------- tower shell
// One merged rubble-stone ring (48 tall segments) from the base to the wall top,
// with the door, the study window, and four arrow slits cut out as span gaps.
function buildTowerShell(root, M) {
  const NSEG = 48;
  const segArc = (2 * Math.PI) / NSEG;
  const segW = R_MID * segArc * 1.12;   // slight tangential overlap between segs
  const boxes = [];
  const winA0 = WIN_A - WIN_HALF_A, winA1 = WIN_A + WIN_HALF_A;

  for (let k = 0; k < NSEG; k++) {
    const a = k * segArc;
    let spans = [[BASE_Y, WALL_TOP]];

    // door: subtract the opening (leaving a lintel above)
    if (a >= DOOR_A0 && a <= DOOR_A1) spans = subtractSpans(spans, [DOOR_Y0 - 0.01, DOOR_Y1]);
    // study window opening
    if (angDist(a, WIN_A) <= WIN_HALF_A) spans = subtractSpans(spans, [WIN_Y0, WIN_Y1]);
    // arrow slits
    for (const s of SLITS) {
      if (angDist(a, s.a) <= segArc * 0.6) spans = subtractSpans(spans, [s.y0, s.y1]);
    }

    const cx = TX + R_MID * Math.cos(a);
    const cz = TZ + R_MID * Math.sin(a);
    const ry = Math.PI / 2 - a;         // box depth (local Z) points radially
    for (const [y0, y1] of spans) {
      if (y1 - y0 < 0.02) continue;
      pushRotBox(boxes, cx, (y0 + y1) / 2, cz, segW, y1 - y0, WT, ry);
    }
  }
  mergedMesh(root, boxes, M.rubble, 'arch_nord_wall');

  // study ceiling cap (faces down into the study)
  addMesh(root, new THREE.CircleGeometry(R_IN, 24), M.rubble, 'arch_nord_ceiling',
    [TX, CEIL_Y, TZ], [Math.PI / 2, 0, 0]);
}

// ----------------------------------------------------------------- base floor
// Old flagged floor disk at the base + a patch bridging the door throat out to
// the chancel wall face (x=-6). Both registerFloor'd (continuous with chancel).
function buildBaseFloor(root, M) {
  const disk = addMesh(root, new THREE.CircleGeometry(R_IN, 28), M.chancel,
    'arch_nord_base_floor', [TX, BASE_Y, TZ], [-Math.PI / 2, 0, 0]);
  registerFloor(disk);

  // throat patch: x[-7.1,-5.95] z[-17.63,-16.38] — links the disk to the chancel
  const throat = addMesh(root, new THREE.PlaneGeometry(1.15, 1.25), M.chancel,
    'arch_nord_throat_floor', [-6.52, BASE_Y, DOOR_Z], [-Math.PI / 2, 0, 0]);
  registerFloor(throat);

  // door reveal jambs (visual + soft guide colliders) across the throat depth
  for (const dz of [DOOR_Z - DOOR_HZ, DOOR_Z + DOOR_HZ]) {
    addBox(root, 1.1, DOOR_Y1 - DOOR_Y0, 0.14, M.rubble, -6.55, (DOOR_Y0 + DOOR_Y1) / 2, dz,
      'arch_nord_door_jamb', true);
  }
  // lintel over the door throat
  addBox(root, 1.1, 0.35, 2 * DOOR_HZ + 0.28, M.rubble, -6.55, DOOR_Y1 + 0.175, DOOR_Z,
    'arch_nord_door_lintel', false);
}

// --------------------------------------------------------------------- spiral
// (a) invisible smooth helical RAMP proxy (the registered walkable surface),
// (b) visible chunky merged treads sitting on it, (c) the central newel.
function buildSpiral(root, M) {
  // (a) helical ramp ribbon: r[R_TREAD_IN-.., R_TREAD_OUT+..], sampled fine.
  // Sweeps 3 turns PLUS a flat top landing (rampY clamps to STUDY_Y past the
  // top), so the walkable surface bridges the last tread onto the study floor —
  // without it the player emerges over a gap between the top step and the floor
  // sector edge and falls through. The landing overlaps the widened floor arc.
  const rIn = R_TREAD_IN - 0.02, rOut = R_TREAD_OUT + 0.03;
  const A_LAND = D2R(22);               // flat landing past the top, into the room
  const A_TOT = A_SPAN + A_LAND;
  const N = 132;                        // samples across 3 turns + landing
  const pos = [];
  let prevIn = null, prevOut = null;
  for (let j = 0; j <= N; j++) {
    const a = A_START + (j / N) * A_TOT;
    const y = rampY(a);                 // clamps to STUDY_Y across the landing
    const inn = [TX + rIn * Math.cos(a), y, TZ + rIn * Math.sin(a)];
    const out = [TX + rOut * Math.cos(a), y, TZ + rOut * Math.sin(a)];
    if (prevIn) {
      // quad (prevIn, prevOut, out, inn)
      pos.push(...prevIn, ...prevOut, ...out, ...prevIn, ...out, ...inn);
    }
    prevIn = inn; prevOut = out;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const ramp = addMesh(root, g, M.rampHidden, 'arch_nord_stair_ramp');
  registerFloor(ramp);

  // (b) visible treads — merged dressed-stone wedges, tops flush with the ramp.
  const dA = A_SPAN / N_TREADS;
  const rMid = (R_TREAD_IN + R_TREAD_OUT) / 2;
  const treads = [];
  for (let i = 0; i < N_TREADS; i++) {
    const a = A_START + (i + 0.5) * dA;
    const yTop = rampY(a);
    const cx = TX + rMid * Math.cos(a), cz = TZ + rMid * Math.sin(a);
    const ry = Math.PI / 2 - a;
    const tanW = rMid * dA * 1.35;      // overlap neighbours (closed stair)
    // box 0.42 tall > rise 0.235 so consecutive treads overlap
    pushRotBox(treads, cx, yTop - 0.21, cz, tanW, 0.42, R_TREAD_OUT - R_TREAD_IN + 0.1, ry);
  }
  mergedMesh(root, treads, M.stone, 'arch_nord_treads');

  // (c) central newel column
  const newelH = STUDY_Y - BASE_Y;
  addMesh(root, new THREE.CylinderGeometry(NEWEL_R, NEWEL_R + 0.05, newelH, 8), M.column,
    'arch_nord_newel', [TX, BASE_Y + newelH / 2, TZ]);
}

// ----------------------------------------------------------------- study floor
// Disk at STUDY_Y with a ~107deg opening sector on the E/NE/SE where the stair
// arrives, so the player emerges onto solid floor. registerFloor'd.
function buildStudyFloor(root, M) {
  const solid0 = D2R(23), solid1 = D2R(285);   // solid arc begins just before the
  // stair arrival (~26.6°) so the player emerges directly onto floor (was 32°,
  // which left a fall-through wedge between the top step and the floor edge).
  const steps = 40;
  const pos = [];
  for (let i = 0; i < steps; i++) {
    const a0 = solid0 + (solid1 - solid0) * (i / steps);
    const a1 = solid0 + (solid1 - solid0) * ((i + 1) / steps);
    const p0 = [TX + R_IN * Math.cos(a0), STUDY_Y, TZ + R_IN * Math.sin(a0)];
    const p1 = [TX + R_IN * Math.cos(a1), STUDY_Y, TZ + R_IN * Math.sin(a1)];
    // reversed winding (center, p1, p0) -> upward-facing normal
    pos.push(TX, STUDY_Y, TZ, ...p1, ...p0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const floor = addMesh(root, g, M.chancel, 'arch_nord_study_floor');
  registerFloor(floor);
}

// ---------------------------------------------------------------------- study
// Siegmund's desk against the NW wall below the window, a chair pushed back, the
// seated corpse slumped forward, an inkwell and a fallen pen. All in one group
// rotated so local -Z faces the window (NW) and local +Z faces the room (SE).
function buildStudy(root, M) {
  // anchor on the floor, set in from the NW wall under the window
  const ax = TX + 1.35 * Math.cos(WIN_A), az = TZ + 1.35 * Math.sin(WIN_A);
  const g = new THREE.Group();
  g.name = 'arch_nord_study';
  g.position.set(ax, STUDY_Y, az);
  g.rotation.y = Math.PI / 4;   // local +Z -> SE (room), local -Z -> NW (window)
  root.add(g);

  const box = (w, h, d, mat, x, y, z, name, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.name = name; g.add(m); return m;
  };

  // --- desk (top surface local y=0.75), pushed toward the wall (local -z) ---
  box(1.2, 0.06, 0.55, M.wood, 0, 0.75, -0.05, 'arch_nord_desk_top');
  box(0.07, 0.72, 0.5, M.wood, -0.55, 0.37, -0.05, 'arch_nord_desk_leg');
  box(0.07, 0.72, 0.5, M.wood, 0.55, 0.37, -0.05, 'arch_nord_desk_leg');
  box(1.1, 0.5, 0.06, M.wood, 0, 0.42, -0.28, 'arch_nord_desk_back'); // modesty panel

  // --- chair pushed back from the desk (local +z) ---
  box(0.45, 0.05, 0.42, M.wood, 0, 0.45, 0.5, 'arch_nord_chair_seat');
  box(0.45, 0.55, 0.06, M.wood, 0, 0.72, 0.7, 'arch_nord_chair_back');
  box(0.05, 0.45, 0.05, M.wood, -0.19, 0.22, 0.32, 'arch_nord_chair_leg');
  box(0.05, 0.45, 0.05, M.wood, 0.19, 0.22, 0.32, 'arch_nord_chair_leg');
  box(0.05, 0.45, 0.05, M.wood, -0.19, 0.22, 0.68, 'arch_nord_chair_leg');
  box(0.05, 0.45, 0.05, M.wood, 0.19, 0.22, 0.68, 'arch_nord_chair_leg');

  // --- Siegmund: the SHARED low-poly corpse (../content/corpse.js), 'slumped'
  // — seated on the chair, back low, head fallen FORWARD toward the desk (-z),
  // in a scholar's dark robe. Origin on the study floor (local y=0, since the
  // group sits at STUDY_Y=13). Head runs toward corpse-local +X; a +90° yaw
  // turns that toward the desk/window (group local -z). A small dark-brown
  // plague pool soaks the floor beneath the seat. The blackened extremities
  // (world-bible §8) are carried by the corpse's own materials.
  const siegStain = makeStain({ r: 0.6, seed: 9 });
  siegStain.position.set(0, 0, 0.25);   // under the seat, local floor
  g.add(siegStain);
  const siegmund = makeCorpse({ pose: 'slumped', cloth: 0x2c2a30, seed: 7 });
  siegmund.position.set(0, 0, 0.42);    // seated on the chair (seat at local z≈0.5)
  siegmund.rotation.y = Math.PI / 2;    // head falls forward toward the desk (-z)
  g.add(siegmund);

  // --- desk objects (leave the desktop centre clear for the letter marker) ---
  const inkwell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 6), M.iron);
  inkwell.position.set(0.34, 0.785, 0.06); inkwell.name = 'arch_nord_inkwell'; g.add(inkwell);
  box(0.012, 0.012, 0.15, M.iron, 0.2, 0.756, 0.12, 'arch_nord_pen', 0, 0.6); // fallen pen
}

// ------------------------------------------------------------------ colliders
// Tower wall ring (24 AABBs, door arc left open), the newel, desk and chair.
// Ramp / treads / floors are deliberately NOT collided.
function buildColliders(root, M) {
  let count = 0;
  const N = 24;
  const yC = (BASE_Y + STUDY_Y) / 2, yH = STUDY_Y - BASE_Y + 0.4;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * 2 * Math.PI;
    if (a >= DOOR_A0 - D2R(4) && a <= DOOR_A1 + D2R(4)) continue; // door gap
    registerAABB(TX + R_MID * Math.cos(a), yC, TZ + R_MID * Math.sin(a), 0.8, yH, 0.8);
    count++;
  }
  // newel
  registerAABB(TX, yC, TZ, 2 * NEWEL_R + 0.1, STUDY_Y - BASE_Y, 2 * NEWEL_R + 0.1);
  count++;
  // desk + chair (world-space AABBs over the rotated study group)
  registerAABB(-9.49, 13.4, -19.24, 1.3, 0.85, 1.3); count++;   // desk
  registerAABB(-9.10, 13.45, -18.85, 0.7, 0.95, 0.7); count++;  // chair
  return count;
}
