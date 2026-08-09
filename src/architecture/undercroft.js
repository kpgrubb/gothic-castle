import * as THREE from 'three';
import { addBox, addMesh, registerAABB } from './geom-utils.js';
import { registerFloor } from '../core/scene.js';

// ===========================================================================
// THE UNDERCROFT — a plague crypt below the chancel (scene-contract.md §2/§3;
// art-direction.md §1-6: the darkest, dampest, most oppressive beat).
//
// Reached by a straight flight descending SOUTH from the chancel (top z=-16,
// y=0.34) to a landing on the crypt floor (z=-9, y=-6). floor.js has already
// cut the matching hole in the slab. Below: a low barrel-vaulted crypt
// (floor y=-6, x[-5,5] z[-14,-3], crown y≈-3.2) on four squat piers, an iron
// grate + open light-well in the ceiling, a sealed timber-covered plague pit,
// four ossuary niches, and two story props (a child's shoe, a candle stub).
//
// Frames verification shots 7 (stair_descent), 8 (crypt_ossuary), 9 (plague_pit).
// Builds geometry + colliders + walkable floors ONLY. No lights/fog/audio.
// ===========================================================================

// --- stair flight geometry (fixed by shot 7 + the floor hole) ---------------
const TOP_Z = -16, TOP_Y = 0.34;   // stairhead, flush with the chancel floor
const BOT_Z = -9, BOT_Y = -6;      // landing, flush with the crypt floor
const RUN = BOT_Z - TOP_Z;         // +7 m (descends toward +Z / south)
const DROP = BOT_Y - TOP_Y;        // -6.34 m
const STAIR_HX = 1.5;              // half-width of the flight (x[-1.5,1.5])
const N_TREADS = 22;               // tread depth 0.318, rise 0.288 (crypt-steep)

// --- crypt shell ------------------------------------------------------------
const CX0 = -5, CX1 = 5;           // x extents (interior faces)
const CZ0 = -14, CZ1 = -3;         // z extents (N wall / S wall interior faces)
const FLOOR_Y = -6;
const CROWN_Y = -3.2;              // barrel-vault crown
const SPRING_Y = -4.4;            // vault springing at the side walls
const WALL_TOP = -3.0;             // top of the perimeter walls
const T = 0.6;                     // wall thickness

/** Interpolated ramp height at a given z along the flight. */
function rampY(z) {
  return TOP_Y + ((z - TOP_Z) / RUN) * DROP;
}

/** Push a box's 12 triangles into a flat position array (for merged buffers). */
function pushBox(arr, cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const q = (a, b, c, e) => arr.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[e]);
  q(1, 2, 3, 0); q(4, 7, 6, 5);           // -z / +z
  q(0, 4, 5, 1); q(3, 2, 6, 7);           // -y / +y
  q(0, 3, 7, 4); q(1, 5, 6, 2);           // -x / +x
}

function mergedMesh(root, positions, mat, name) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return addMesh(root, geo, mat, name);
}

export function buildUndercroft(root, M) {
  buildStairwell(root, M);
  buildCryptShell(root, M);
  buildPiers(root, M);
  buildVault(root, M);
  buildGrate(root, M);
  buildPlaguePit(root, M);
  buildOssuaries(root, M);
  buildProps(root, M);
}

// --------------------------------------------------------------- stairwell
function buildStairwell(root, M) {
  // (a) invisible smooth ramp proxy spanning the whole flight — the registered
  //     walkable surface, so the descent glides instead of step-snapping.
  const g = new THREE.BufferGeometry();
  const A = [-STAIR_HX, TOP_Y, TOP_Z], B = [STAIR_HX, TOP_Y, TOP_Z];
  const C = [STAIR_HX, BOT_Y, BOT_Z], D = [-STAIR_HX, BOT_Y, BOT_Z];
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [...A, ...B, ...C, ...A, ...C, ...D], 3));
  g.computeVertexNormals();
  const ramp = addMesh(root, g, M.rampHidden, 'arch_stair_ramp');
  registerFloor(ramp);

  // (b) visible chunky treads, merged into one buffer (M.cryptWall, DoubleSide).
  const dz = RUN / N_TREADS;
  const treads = [];
  for (let i = 0; i < N_TREADS; i++) {
    const zc = TOP_Z + (i + 0.5) * dz;
    const yTop = rampY(zc);
    // box height 0.45 > rise 0.288 so consecutive treads overlap (closed stair)
    pushBox(treads, 0, yTop - 0.225, zc, 2 * STAIR_HX, 0.45, dz);
  }
  mergedMesh(root, treads, M.cryptWall, 'arch_stair_treads');

  // (c) stairwell walls fully BOXING the shaft through the inter-floor gap
  //     (crypt vault crown y≈-3.2 up to the nave/chancel slab y≈0.4). The
  //     descent must read as an enclosed tunnel — the only sightlines are UP
  //     the flight (into the chancel) and DOWN into the crypt, never sideways
  //     or over the vault crown into the empty inter-floor gap / nave (bug 2).
  const SH_Y0 = -3.4, SH_Y1 = 0.4;            // gap band; overlaps vault crown + slab
  const shH = SH_Y1 - SH_Y0, shYC = (SH_Y0 + SH_Y1) / 2;
  const SH_XW = 2.0;                          // outer x of the shaft = vault-open edge
  const walls = [];
  // long-side cheeks: from the walk edge (±1.5) OUT to the vault-opening edge
  // (±2.0), so no strip of the ceiling hole is left uncovered. z[-16,-10].
  for (const s of [-1, 1]) {
    pushBox(walls, s * (STAIR_HX + SH_XW) / 2, shYC, -13.0, SH_XW - STAIR_HX, shH, 6.0);
  }
  // END caps: north (under the stairhead, z=-16) and south (over the landing,
  // z=-10, flush with the south edge of the vault drop-through). These close
  // the axial sightline so you can't look over the crypt ceiling into the void.
  pushBox(walls, 0, shYC, -16.0, 2 * SH_XW, shH, 0.2);   // north cap
  pushBox(walls, 0, shYC, -10.0, 2 * SH_XW, shH, 0.2);   // south cap
  mergedMesh(root, walls, M.cryptWall, 'arch_stair_walls');

  // side-wall colliders down the full flight (kept above the crypt floor so they
  // don't block walking around the crypt once the stair opens into it).
  for (const sx of [-STAIR_HX, STAIR_HX]) {
    // AABB: x=±1.5, z[-16,-9], y[-3.2,0.34]
    registerAABB(sx, (CROWN_Y + TOP_Y) / 2, (TOP_Z + BOT_Z) / 2, 0.3, TOP_Y - CROWN_Y, RUN);
  }
}

// -------------------------------------------------------------- crypt shell
function buildCryptShell(root, M) {
  // damp flagstone floor  x[-5,5] z[-14,-3]
  const floor = addMesh(root, new THREE.PlaneGeometry(CX1 - CX0, CZ1 - CZ0), M.cryptFloor,
    'arch_crypt_floor', [0, FLOOR_Y, (CZ0 + CZ1) / 2], [-Math.PI / 2, 0, 0]);
  registerFloor(floor);

  const wallH = WALL_TOP - FLOOR_Y;       // 3.0
  const wallYC = (WALL_TOP + FLOOR_Y) / 2; // -4.5

  // NORTH wall (z=-14) with the stair opening x[-1.5,1.5] — two segments
  const nSegW = (CX1 - CX0) / 2 - STAIR_HX + T / 2;   // reach the corner + overlap
  addBox(root, nSegW, wallH, T, M.cryptWall, (CX0 - (STAIR_HX)) / 2 - 0.15, wallYC, CZ0 - T / 2, 'arch_crypt_wall_n_l', true);
  addBox(root, nSegW, wallH, T, M.cryptWall, (CX1 + (STAIR_HX)) / 2 + 0.15, wallYC, CZ0 - T / 2, 'arch_crypt_wall_n_r', true);
  // SOUTH wall (z=-3)
  addBox(root, (CX1 - CX0) + T, wallH, T, M.cryptWall, 0, wallYC, CZ1 + T / 2, 'arch_crypt_wall_s', true);

  // EAST / WEST walls carry the ossuary niches — built (with colliders) there.
  buildSideWall(root, M, +1);
  buildSideWall(root, M, -1);
}

// A crypt side wall (east x=+5 / west x=-5) with two arched niche openings at
// z=-6 and z=-11. Lower + upper solid bands run the full length; the middle band
// (y[-5.9,-4.5]) is broken into segments around the openings. One AABB collider
// covers the whole wall. Recess boxes + bones are added by buildOssuaries().
const NICHE_Z = [-6, -11];
const NICHE_HZ = 0.6;        // half depth in z of an opening (1.2 wide)
const NICHE_Y0 = -5.9, NICHE_Y1 = -4.5;

function buildSideWall(root, M, side) {
  const xFace = side * CX1;             // interior face at ±5
  const xc = side * (CX1 + T / 2);      // wall box centre at ±5.3
  const zc = (CZ0 + CZ1) / 2, len = CZ1 - CZ0;
  const wallH = WALL_TOP - FLOOR_Y;
  const suffix = side > 0 ? 'e' : 'w';

  // lower band  y[-6,-5.9]
  addBox(root, T, NICHE_Y0 - FLOOR_Y, len, M.cryptWall, xc, (FLOOR_Y + NICHE_Y0) / 2, zc, `arch_crypt_wall_${suffix}_low`, false);
  // upper band  y[-4.5,-3]
  addBox(root, T, WALL_TOP - NICHE_Y1, len, M.cryptWall, xc, (NICHE_Y1 + WALL_TOP) / 2, zc, `arch_crypt_wall_${suffix}_up`, false);
  // middle band segments filling z around the two openings
  const mYC = (NICHE_Y0 + NICHE_Y1) / 2, mH = NICHE_Y1 - NICHE_Y0;
  const gaps = NICHE_Z.map((z) => [z - NICHE_HZ, z + NICHE_HZ]).sort((a, b) => a[0] - b[0]);
  let cursor = CZ0;
  const segs = [];
  for (const [a, b] of gaps) { if (a > cursor) segs.push([cursor, a]); cursor = Math.max(cursor, b); }
  if (cursor < CZ1) segs.push([cursor, CZ1]);
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue;
    addBox(root, T, mH, b - a, M.cryptWall, xc, mYC, (a + b) / 2, `arch_crypt_wall_${suffix}_mid`, false);
  }

  // single collider for the whole wall (full height, full length)
  registerAABB(xc, (FLOOR_Y + WALL_TOP) / 2, zc, T, wallH, len);
  return { xFace };
}

// -------------------------------------------------------------------- piers
// Four squat thick piers carrying the vault, at (±2.5,·,-6) and (±2.5,·,-10).
function buildPiers(root, M) {
  const PIER = 0.9, pierTop = SPRING_Y;         // shaft top at the springing
  const shaftH = pierTop - FLOOR_Y;             // 1.6
  for (const px of [-2.5, 2.5]) {
    for (const pz of [-6, -10]) {
      addBox(root, PIER, shaftH, PIER, M.cryptPier, px, FLOOR_Y + shaftH / 2, pz, 'arch_crypt_pier', false);
      // chunky capital block just under the springing
      addBox(root, PIER + 0.25, 0.28, PIER + 0.25, M.cryptPier, px, pierTop - 0.14, pz, 'arch_crypt_pier_cap', false);
      registerAABB(px, FLOOR_Y + shaftH / 2, pz, PIER, shaftH, PIER);
    }
  }
}

// -------------------------------------------------------------------- vault
// Low barrel vault over the crypt: crown y=-3.2 at x=0, springing y=-4.4 at the
// walls. Dark-crown vertex colours (value structure). Two openings skipped: the
// stairwell drop (north) and the grate light-well (centre) — left open above.
function vaultY(x) {
  const t = 1 - (x / CX1) * (x / CX1);       // 1 at crown, 0 at walls
  return SPRING_Y + (CROWN_Y - SPRING_Y) * t;
}
function vaultOpen(cx, cz) {
  // stairwell drop-through: open the ceiling until the descent clears headroom.
  // On the 1 m vault grid this opens cells spanning x[-2,2] × z[-14,-10]; the
  // stair-shaft cheeks are extended out to x=±2 so the cut is no wider than the
  // enclosed shaft (bug 2) — never widen this past the shaft box.
  if (cx > -1.7 && cx < 1.7 && cz > -14 && cz < -10) return true;
  // grate light-well ≈ (0,·,-5), ~1.5×1.5
  if (cx > -0.75 && cx < 0.75 && cz > -5.75 && cz < -4.25) return true;
  return false;
}
function buildVault(root, M) {
  const Nu = 11, Nv = 12;
  const xs = [], zs = [];
  for (let i = 0; i < Nu; i++) xs.push(CX0 + (CX1 - CX0) * i / (Nu - 1));
  for (let j = 0; j < Nv; j++) zs.push(CZ0 + (CZ1 - CZ0) * j / (Nv - 1));

  const pos = [], col = [], idx = [];
  const cLow = new THREE.Color(0x3a4048);    // damp lit springing
  const cHigh = new THREE.Color(0x0d1014);   // near-black crown
  const tmp = new THREE.Color();
  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      const y = vaultY(xs[i]);
      pos.push(xs[i], y, zs[j]);
      const t = (y - SPRING_Y) / (CROWN_Y - SPRING_Y);
      tmp.copy(cLow).lerp(cHigh, t);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const at = (i, j) => i * Nv + j;
  for (let i = 0; i < Nu - 1; i++) {
    for (let j = 0; j < Nv - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      if (vaultOpen(cx, cz)) continue;
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  addMesh(root, geo, M.vault, 'arch_crypt_vault');
}

// --------------------------------------------------------------------- grate
// Low-poly iron grate set in the ceiling light-well at ≈(0,-3.2,-5), ~1.5×1.5.
// Ceiling is left open above it (vault hole) for the atmosphere moonlight shaft.
const GRATE = { cx: 0, cy: -3.25, cz: -5, half: 0.75 };
function buildGrate(root, M) {
  const { cx, cy, cz, half } = GRATE;
  const bars = [];
  // frame
  pushBox(bars, cx, cy, cz - half, 2 * half + 0.16, 0.1, 0.1);
  pushBox(bars, cx, cy, cz + half, 2 * half + 0.16, 0.1, 0.1);
  pushBox(bars, cx - half, cy, cz, 0.1, 0.1, 2 * half);
  pushBox(bars, cx + half, cy, cz, 0.1, 0.1, 2 * half);
  // bars running along x (varied z) and along z (varied x)
  for (const t of [-0.375, -0.125, 0.125, 0.375]) {
    pushBox(bars, cx, cy, cz + t, 2 * half, 0.05, 0.05);
    pushBox(bars, cx + t, cy, cz, 0.05, 0.05, 2 * half);
  }
  mergedMesh(root, bars, M.iron, 'arch_crypt_grate');
}

// ----------------------------------------------------------------- plague pit
// Sealed pit centred (0,-6,-8): 2.4×2.4 stone rim (top y=-5.4), heavy timber
// cover, pale quicklime dusting. AABB collider so the player can't cross it.
const PIT = { cx: 0, cz: -8, outer: 1.2, inner: 0.8, rimTop: -5.4 };
function buildPlaguePit(root, M) {
  const { cx, cz, outer, inner, rimTop } = PIT;
  const rimH = rimTop - FLOOR_Y;            // 0.6
  const rimYC = (rimTop + FLOOR_Y) / 2;     // -5.7
  const band = outer - inner;              // 0.4
  const rimBox = [];
  // N / S rims (run along x)
  pushBox(rimBox, cx, rimYC, cz - (inner + band / 2), 2 * outer, rimH, band);
  pushBox(rimBox, cx, rimYC, cz + (inner + band / 2), 2 * outer, rimH, band);
  // E / W rims (run along z, between the N/S pieces)
  pushBox(rimBox, cx - (inner + band / 2), rimYC, cz, band, rimH, 2 * inner);
  pushBox(rimBox, cx + (inner + band / 2), rimYC, cz, band, rimH, 2 * inner);
  mergedMesh(root, rimBox, M.cryptWall, 'arch_pit_rim');

  // heavy timber-plank cover across the 1.6×1.6 opening, at rim top
  const planks = [];
  const pw = (2 * inner) / 4;
  for (let i = 0; i < 4; i++) {
    const pz = cz - inner + pw * (i + 0.5);
    pushBox(planks, cx, rimTop - 0.04, pz, 2 * inner + 0.06, 0.08, pw - 0.03);
  }
  mergedMesh(root, planks, M.timber, 'arch_pit_cover');

  // pale quicklime dusting over the planks
  addBox(root, 2 * inner - 0.05, 0.03, 2 * inner - 0.05, M.quicklime, cx, rimTop + 0.02, cz, 'arch_pit_quicklime', false);

  // collider: a solid block over the whole rim footprint (y -6 → -5.2)
  registerAABB(cx, -5.6, cz, 2 * outer, 0.8, 2 * outer);
}

// ------------------------------------------------------------------ ossuaries
// Four arched niches (east + west walls, z=-6 and z=-11), each a recessed void
// with a distinct, specific arrangement of low-poly bones (Decay specificity).
function buildOssuaries(root, M) {
  buildNiche(root, M, +1, -6, 0);   // east, near — the "hero" (shot 8)
  buildNiche(root, M, +1, -11, 1);  // east, far — collapsed jumble
  buildNiche(root, M, -1, -6, 2);   // west, near — long bones stacked like wood
  buildNiche(root, M, -1, -11, 3);  // west, far — nearly emptied
}

function buildNiche(root, M, side, z, variant) {
  const xFace = side * CX1;          // opening flush with the interior wall face
  const inward = -side;              // bones sit in front of the wall (into crypt)
  const shelfY = NICHE_Y0;           // -5.9
  const backX = side * (CX1 + 0.45); // recess back, 0.45 into the wall
  const midX = side * (CX1 + 0.22);
  // recess void (dark) — back + top + bottom + two sides
  addBox(root, 0.06, NICHE_Y1 - NICHE_Y0, 2 * NICHE_HZ, M.cryptNiche, backX, (NICHE_Y0 + NICHE_Y1) / 2, z, 'arch_ossuary_back', false);
  addBox(root, 0.5, 0.06, 2 * NICHE_HZ, M.cryptNiche, midX, NICHE_Y1, z, 'arch_ossuary_top', false);
  addBox(root, 0.5, 0.06, 2 * NICHE_HZ, M.cryptNiche, midX, NICHE_Y0, z, 'arch_ossuary_sill', false);
  addBox(root, 0.5, NICHE_Y1 - NICHE_Y0, 0.06, M.cryptNiche, midX, (NICHE_Y0 + NICHE_Y1) / 2, z - NICHE_HZ, 'arch_ossuary_side', false);
  addBox(root, 0.5, NICHE_Y1 - NICHE_Y0, 0.06, M.cryptNiche, midX, (NICHE_Y0 + NICHE_Y1) / 2, z + NICHE_HZ, 'arch_ossuary_side', false);

  // stone arch frame on the wall face (two jambs + a lintel)
  addBox(root, 0.14, NICHE_Y1 - NICHE_Y0 + 0.1, 0.16, M.cryptWall, xFace, (NICHE_Y0 + NICHE_Y1) / 2, z - NICHE_HZ - 0.05, 'arch_ossuary_jamb', false);
  addBox(root, 0.14, NICHE_Y1 - NICHE_Y0 + 0.1, 0.16, M.cryptWall, xFace, (NICHE_Y0 + NICHE_Y1) / 2, z + NICHE_HZ + 0.05, 'arch_ossuary_jamb', false);
  addBox(root, 0.14, 0.16, 2 * NICHE_HZ + 0.3, M.cryptWall, xFace, NICHE_Y1 + 0.08, z, 'arch_ossuary_lintel', false);

  buildBones(root, M, side * (CX1 - 0.25), shelfY, z, inward, variant);

  // collider capping the niche MOUTH so the player is stopped at the opening
  // instead of walking into/through the bones that protrude in front of the
  // wall face (bug 3). Covers the opening (NICHE_HZ in z, NICHE_Y0..Y1 in y)
  // and ~0.5 m of protrusion in x, from the wall face (|x|=5) into the crypt,
  // abutting the existing full-wall collider at |x|=5. Invisible → shots 8/9
  // (ossuary + pit views) are unaffected.
  registerAABB(side * (CX1 - 0.25), (NICHE_Y0 + NICHE_Y1) / 2, z,
    0.5, NICHE_Y1 - NICHE_Y0, 2 * NICHE_HZ);
}

// Shared low-poly bone geometry
let SKULL_GEO = null, BONE_GEO = null;
function skullGeo() { return SKULL_GEO || (SKULL_GEO = new THREE.SphereGeometry(0.12, 6, 5)); }
function longBoneGeo() { return BONE_GEO || (BONE_GEO = new THREE.BoxGeometry(0.34, 0.055, 0.055)); }

function skull(root, M, x, y, z, ry = 0) {
  const m = new THREE.Mesh(skullGeo(), M.bone);
  m.position.set(x, y, z); m.rotation.y = ry; m.scale.set(1, 0.92, 1.08);
  m.name = 'arch_ossuary_skull'; root.add(m); return m;
}
function longBone(root, M, x, y, z, rot) {
  const m = new THREE.Mesh(longBoneGeo(), M.bone);
  m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.name = 'arch_ossuary_bone'; root.add(m); return m;
}

// px is the front x of the pile; inward pushes deeper stacks toward the wall.
function buildBones(root, M, px, sy, z, inward, variant) {
  const dx = (d) => px + inward * d;   // deeper into the niche as d grows
  if (variant === 0) {
    // east near — a neat row of 3 skulls, crossed long bones beneath, one on top
    longBone(root, M, dx(0.08), sy + 0.04, z, [0, 0.5, 0.08]);
    longBone(root, M, dx(0.08), sy + 0.04, z, [0, -0.5, -0.08]);
    skull(root, M, dx(0.06), sy + 0.15, z - 0.28, 0.3);
    skull(root, M, dx(0.10), sy + 0.15, z, -0.1);
    skull(root, M, dx(0.06), sy + 0.15, z + 0.28, 0.2);
    skull(root, M, dx(0.16), sy + 0.34, z + 0.02, -0.2);
  } else if (variant === 1) {
    // east far — a collapsed jumble, one femur poking out toward the viewer
    skull(root, M, dx(0.05), sy + 0.13, z - 0.22, 0.6);
    skull(root, M, dx(0.20), sy + 0.14, z + 0.10, -0.4);
    skull(root, M, dx(0.02), sy + 0.30, z + 0.18, 0.1);
    skull(root, M, dx(0.24), sy + 0.32, z - 0.10, 0.9);
    longBone(root, M, px - inward * 0.14, sy + 0.10, z + 0.05, [0.2, 0.15, 0.0]); // juts out
    longBone(root, M, dx(0.12), sy + 0.05, z - 0.10, [0, 0.9, 0.0]);
    longBone(root, M, dx(0.16), sy + 0.22, z + 0.24, [0, -0.3, 0.5]);
  } else if (variant === 2) {
    // west near — long bones stacked like firewood, a single skull on top
    for (let i = 0; i < 5; i++) {
      longBone(root, M, dx(0.10), sy + 0.05 + i * 0.075, z + (i % 2 ? 0.03 : -0.03), [Math.PI / 2, 0, 0]);
    }
    skull(root, M, dx(0.12), sy + 0.5, z, 0.15);
  } else {
    // west far — nearly emptied: two skulls, one lonely bone, dust
    skull(root, M, dx(0.08), sy + 0.13, z - 0.12, -0.5);
    skull(root, M, dx(0.05), sy + 0.13, z + 0.20, 0.4);
    longBone(root, M, dx(0.06), sy + 0.04, z + 0.02, [0, 0.2, 0.04]);
  }
}

// ------------------------------------------------------------------- props
// Small story props (interaction/atmosphere add the text + candle flame later).
function buildProps(root, M) {
  // child's shoe resting on a lower stair tread ≈(0.5,-5.6,-10)
  // (raised to sit ON the tread surface at z=-10; see report for the deviation)
  const shoeY = rampY(-10) + 0.04;                 // ≈ -5.05
  const shoe = new THREE.Group();
  shoe.name = 'arch_prop_shoe';
  shoe.position.set(0.5, shoeY, -10);
  shoe.rotation.y = -0.4;
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.24), M.shoeLeather);
  sole.position.y = 0.025; shoe.add(sole);
  const toe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.11), M.shoeLeather);
  toe.position.set(0, 0.07, 0.06); shoe.add(toe);
  root.add(shoe);

  // guttered candle stub on the east lip of the pit rim ≈(1.0,-5.3,-8)
  const candle = new THREE.Group();
  candle.name = 'arch_prop_candle';
  candle.position.set(1.0, PIT.rimTop, -8);        // base on the rim top (-5.4)
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 6), M.quicklime);
  stub.position.y = 0.08; candle.add(stub);
  const puddle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.02, 7), M.quicklime);
  puddle.position.y = 0.01; candle.add(puddle);
  root.add(candle);
}
