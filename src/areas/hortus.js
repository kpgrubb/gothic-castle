import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight,
} from '../core/scene.js';

// ===========================================================================
// THE HORTUS CLAUSUS  (atlas #7 — the sealed poison garden, Gen 6 the Dowager
// Gisela. world-bible §7.3.) A small walled, gated enclosure inside the castle
// walls — thirty paces by twenty — laid on a formal southern plan that belongs
// to no northern garden: four quadrant beds around a central sundial, low box
// hedges, gravel cross-paths, an iron gate in a blind wall (locked forty years).
//
// THE ESSENTIAL FACT (§7.3): Hochmauer is DEAD — dead people, dead flies, dead
// fires, dust and silence — and behind one iron gate this garden is in FULL
// GROWTH, tended by nobody for fourteen months, unweeded and unruined, the
// lethal plants (foxglove, hemlock, monkshood, belladonna) flowering out of
// season and grown PAST their beds. Life persisting where nothing else does.
// Art direction (§7.3): it does NOT break the palette. It reads in the COLD
// family — bone-white, silver-green, pale violet, grey-blue, wet black; luminous
// not verdant, moonlit not sunlit. The most beautiful place in the castle, and
// the player's neck should prickle anyway. Bodies are absent; the only plague
// grammar (a little lime, a few drifted dead flies) is at the LOCKED GATE, where
// the dead Pleasure Garden presses in from the far side. The garden itself is
// clean and alive.
//
// Self-contained island centred C = (150, 0, 100). Ground at y=0, OPEN to the
// sky. Builds its own geometry (merged per material), colliders, walkable ground
// + paths, and its OWN cool overcast lighting (no global ambient touched).
// Registers its OWN zone. Every named object is prefixed `hor_`.
// buildHortus(world) returns { root, entry:{x,y,z,yaw} }.
// DETERMINISM: no Math.random / Date.now — a seeded LCG drives texture speckle,
// and all plant placement varies by index / constant offset arrays only.
// ===========================================================================

// --- island frame (metres) --------------------------------------------------
const CX = 150, CZ = 100;                 // island centre
const HX = 10;                            // interior half-width (x)  -> 20 wide
const ZN = 92, ZS = 108;                  // interior north / south inner faces -> 16 deep
const OX0 = CX - HX, OX1 = CX + HX;       // interior x faces [140, 160]
const T = 0.6;                            // wall thickness
const WALL_H = 4.5;                       // high enclosing wall (no view out)

const DOOR_W = 1.8, DOOR_H = 2.5;         // south entrance opening
const DOOR_X0 = CX - DOOR_W / 2, DOOR_X1 = CX + DOOR_W / 2;

// iron gate in the WEST wall (blind wall) -> the dead Pleasure Garden beyond.
const GATE_W = 1.7, GATE_H = 2.6, GATE_CZ = CZ;
const GATE_Z0 = GATE_CZ - GATE_W / 2, GATE_Z1 = GATE_CZ + GATE_W / 2;

// central cross-paths: half-widths carving the interior into four quadrant beds.
const PATH_HX = 1.2;                      // N-S path (along x=CX) half-width
const PATH_HZ = 1.2;                      // E-W path (along z=CZ) half-width
const MARGIN = 1.5;                       // perimeter walk between beds and walls

// four quadrant beds (inner faces of the surrounding walk / cross-paths)
const BEDS = [
  { x0: OX0 + MARGIN, x1: CX - PATH_HX, z0: ZN + MARGIN, z1: CZ - PATH_HZ, key: 'nw' },
  { x0: CX + PATH_HX, x1: OX1 - MARGIN, z0: ZN + MARGIN, z1: CZ - PATH_HZ, key: 'ne' },
  { x0: OX0 + MARGIN, x1: CX - PATH_HX, z0: CZ + PATH_HZ, z1: ZS - MARGIN, key: 'sw' },
  { x0: CX + PATH_HX, x1: OX1 - MARGIN, z0: CZ + PATH_HZ, z1: ZS - MARGIN, key: 'se' },
];

// --- entry (in the south doorway, facing -Z into the garden) ----------------
export const HORTUS_ENTRY = { x: CX, y: 1.7, z: 108, yaw: Math.PI };

// deterministic jitter tables (index-driven; never Math.random) --------------
const JIT = [0.14, -0.19, 0.07, -0.11, 0.21, -0.05, 0.17, -0.23, 0.03, -0.16, 0.11, -0.08];
const JIT2 = [-0.09, 0.16, -0.21, 0.05, -0.13, 0.19, -0.03, 0.12, -0.18, 0.08, -0.15, 0.22];

// ---------------------------------------------------------------------------
// Seeded LCG — stable texture speckle (runs in browser; node --check parses).
// ---------------------------------------------------------------------------
let _seed = 0x40b7a55;
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

function addBox(root, mat, cx, cy, cz, w, h, d, name, collide, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
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

function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas textures — cool speckled ashlar, pale gravel, wet-black soil.
// ---------------------------------------------------------------------------
function speckTex(base, speck, courses) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 340; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.15, 0.5);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  if (courses) {
    g.strokeStyle = 'rgba(20,22,26,0.35)'; g.lineWidth = 1;
    for (let y = 16; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function makeMaterials() {
  const wallTex = speckTex('#565a61', '#3e424a', true); wallTex.repeat.set(5, 2);
  const gravTex = speckTex('#767a78', '#565a58', false); gravTex.repeat.set(9, 8);
  const soilTex = speckTex('#242a24', '#141a15', false); soilTex.repeat.set(3, 3);
  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));
  return {
    wall: lambert({ color: 0x6b6f76, map: wallTex }),        // cool ashlar
    grav: lambert({ color: 0x8a8e8c, map: gravTex }),        // pale gravel walk/path
    soil: lambert({ color: 0x2a3028, map: soilTex }),        // wet-black earth beds
    kerb: lambert({ color: 0x7a7e84 }),                      // pale stone bed kerbs
    hedge: lambert({ color: 0x49584a }),                     // low box hedge (silver-green, dark)
    stalk: lambert({ color: 0x6c7a64 }),                     // silver-green stems
    leaf: lambert({ color: 0x27322a }),                      // wet-black-green foliage
    fviolet: lambert({ color: 0xb6a6cf }),                   // foxglove — pale violet
    fwhite: lambert({ color: 0xd6d8cc }),                    // hemlock — bone-white umbel
    fblue: lambert({ color: 0x9fb0c2 }),                     // monkshood — grey-blue hood
    berry: lambert({ color: 0x16121a }),                     // belladonna — wet-black berry
    stone: lambert({ color: 0x777b82 }),                     // sundial pedestal
    metal: lambert({ color: 0x33373d }),                     // gnomon, iron gate
    timber: lambert({ color: 0x463a2c }),                    // bench, tool hafts
    tin: lambert({ color: 0x596066 }),                       // watering vessel
    fly: lambert({ color: 0x17140f }),                       // drifted dead flies (at gate)
    lime: lambert({ color: 0xc9c4b6 }),                      // scattered lime (at gate)
    stain: basic({ color: 0x1c2420, side: THREE.DoubleSide }), // damp water stain
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildHortus(world) {
  const root = new THREE.Group();
  root.name = 'hor_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildGround(root, M);
  buildWalls(root, M);
  buildGate(root, M);
  buildBeds(root, M);
  buildPlants(root, M);
  buildSundial(root, M);
  buildTended(root, M);
  buildGateGrammar(root, M);
  buildLighting();
  buildExaminables(world);

  if (world.registerZone) {
    world.registerZone({ name: 'The Hortus Clausus', min: [139, -1, 91], max: [161, 6, 109] });
  }

  return { root, entry: HORTUS_ENTRY };
}

// -------------------------------------------------------------------- ground
function buildGround(root, M) {
  // pale gravel ground over the whole interior (the walkable walk + cross-paths).
  // Extends a touch past the south face to carry the doorway threshold.
  const g = new THREE.Mesh(new THREE.PlaneGeometry(2 * HX + 0.4, (ZS - ZN) + 1.4), M.grav);
  g.name = 'hor_ground';
  g.position.set(CX, 0, (ZN + ZS) / 2 + 0.35);
  g.rotation.x = -Math.PI / 2;
  root.add(g);
  registerFloor(g);

  // worn threshold sill at the south doorway
  addBox(root, M.stone, CX, 0.02, ZS + 0.15, DOOR_W + 0.3, 0.06, 0.5, 'hor_sill', false);
}

// --------------------------------------------------------------------- walls
// High enclosing ashlar on all four sides. South wall is split around the sole
// entrance; west wall is split around the locked iron gate. No other opening.
function buildWalls(root, M) {
  const yc = WALL_H / 2;

  // NORTH (z = ZN): solid
  addBox(root, M.wall, CX, yc, ZN - T / 2, 2 * HX + 2 * T, WALL_H, T, 'hor_wall_n', true);

  // EAST (x = OX1): solid
  addBox(root, M.wall, OX1 + T / 2, yc, CZ, T, WALL_H, 2 * (ZS - ZN) / 2 + 2 * T, 'hor_wall_e', true);

  // WEST (x = OX0): split around the iron gate opening
  const wBackLen = (GATE_Z0) - (ZN - T);
  addBox(root, M.wall, OX0 - T / 2, yc, ((ZN - T) + GATE_Z0) / 2, T, WALL_H, wBackLen, 'hor_wall_w_n', true);
  const wFrontLen = (ZS + T) - GATE_Z1;
  addBox(root, M.wall, OX0 - T / 2, yc, (GATE_Z1 + (ZS + T)) / 2, T, WALL_H, wFrontLen, 'hor_wall_w_s', true);
  addBox(root, M.wall, OX0 - T / 2, (GATE_H + WALL_H) / 2, CZ, T, WALL_H - GATE_H, GATE_W + 0.1, 'hor_wall_w_lintel', false);

  // SOUTH (z = ZS): split around the entrance doorway
  const sLeftW = DOOR_X0 - (OX0 - T);
  addBox(root, M.wall, ((OX0 - T) + DOOR_X0) / 2, yc, ZS + T / 2, sLeftW, WALL_H, T, 'hor_wall_s_l', true);
  const sRightW = (OX1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (OX1 + T)) / 2, yc, ZS + T / 2, sRightW, WALL_H, T, 'hor_wall_s_r', true);
  addBox(root, M.wall, CX, (DOOR_H + WALL_H) / 2, ZS + T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'hor_wall_s_lintel', false);
}

// ---------------------------------------------------------------- iron gate
// A barred iron gate in the west wall — chained, LOCKED (per atlas, forty years).
// You cannot pass: a solid collider fills the opening. Vertical bars, two rails,
// a cross-brace, and a wrapped chain + hasp. Behind it, only darkness (the dead
// Pleasure Garden). Grammar of death (lime, flies) drifts against it — built in
// buildGateGrammar; the garden on THIS side stays clean and alive.
function buildGate(root, M) {
  const gx = OX0 - 0.04;                 // gate plane just inside the wall face
  const bars = [];
  // dark void panel behind the bars (the sealed way)
  addBox(root, M.metal, OX0 - T / 2, GATE_H / 2, CZ, 0.06, GATE_H, GATE_W, 'hor_gate_void', false);
  // vertical bars
  const nBars = 7;
  for (let i = 0; i < nBars; i++) {
    const z = GATE_Z0 + 0.14 + (i / (nBars - 1)) * (GATE_W - 0.28);
    pushBox(bars, gx, GATE_H / 2, z, 0.05, GATE_H - 0.06, 0.05);
  }
  // top & bottom rails, mid rail
  pushBox(bars, gx, GATE_H - 0.08, CZ, 0.07, 0.09, GATE_W - 0.06);
  pushBox(bars, gx, 0.12, CZ, 0.07, 0.09, GATE_W - 0.06);
  pushBox(bars, gx, GATE_H * 0.52, CZ, 0.06, 0.07, GATE_W - 0.06);
  // a stout stile at each jamb
  pushBox(bars, gx, GATE_H / 2, GATE_Z0 + 0.06, 0.08, GATE_H, 0.08);
  pushBox(bars, gx, GATE_H / 2, GATE_Z1 - 0.06, 0.08, GATE_H, 0.08);
  mergedMesh(root, bars, M.metal, 'hor_gate_bars');

  // wrapped chain + hasp across the meeting stile (the lock that has held 40 yrs)
  const chain = [];
  for (let k = 0; k < 6; k++) {
    const y = GATE_H * 0.52 + (k - 2.5) * 0.09;
    pushBox(chain, gx + 0.03, y, GATE_Z1 - 0.06 + JIT[k] * 0.04, 0.05, 0.06, 0.11);
  }
  mergedMesh(root, chain, M.metal, 'hor_gate_chain');
  addBox(root, M.metal, gx + 0.05, GATE_H * 0.52, GATE_Z1 - 0.06, 0.06, 0.14, 0.1, 'hor_gate_hasp', false);

  // LOCKED: solid collider fills the whole opening — no way through.
  collideBox(OX0 - T / 2, GATE_H / 2, CZ, T + 0.2, GATE_H, GATE_W);
}

// ----------------------------------------------------------------- beds
// Four quadrant beds: a low pale-stone kerb, wet-black soil proud of the gravel,
// and a low box hedge run just inside the kerb. One collider per bed footprint
// (waist-blocking) so the player keeps to the paths. Kerbs & hedges merged.
function buildBeds(root, M) {
  const kerb = [], hedge = [];
  const KH = 0.32, KT = 0.16;              // kerb height / thickness
  const HH = 0.5, HT = 0.28;               // hedge height / thickness
  for (const b of BEDS) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    // kerb ring (4 runs)
    pushBox(kerb, cx, KH / 2, b.z0, w + KT, KH, KT);
    pushBox(kerb, cx, KH / 2, b.z1, w + KT, KH, KT);
    pushBox(kerb, b.x0, KH / 2, cz, KT, KH, d - KT);
    pushBox(kerb, b.x1, KH / 2, cz, KT, KH, d - KT);
    // soil fill, slightly proud of the gravel
    addBox(root, M.soil, cx, 0.09, cz, w - 0.04, 0.18, d - 0.04, 'hor_soil_' + b.key, false);
    // box hedge ring just inside the kerb
    const hx0 = b.x0 + HT, hx1 = b.x1 - HT, hz0 = b.z0 + HT, hz1 = b.z1 - HT;
    const hw = hx1 - hx0, hd = hz1 - hz0, hcx = (hx0 + hx1) / 2, hcz = (hz0 + hz1) / 2;
    pushBox(hedge, hcx, HH / 2, hz0, hw + HT, HH, HT);
    pushBox(hedge, hcx, HH / 2, hz1, hw + HT, HH, HT);
    pushBox(hedge, hx0, HH / 2, hcz, HT, HH, hd - HT);
    pushBox(hedge, hx1, HH / 2, hcz, HT, HH, hd - HT);
    // one collider for the whole bed (tall enough to reliably stop the player)
    collideBox(cx, 0.5, cz, w + KT, 1.0, d + KT);
  }
  mergedMesh(root, kerb, M.kerb, 'hor_bed_kerbs');
  mergedMesh(root, hedge, M.hedge, 'hor_bed_hedges');
}

// --------------------------------------------------------------------- plants
// Lethal herbs in formal rows, GROWN PAST the beds — thriving, unweeded, out of
// season. Species cycle by index; height/flower jitter from constant tables, so
// the scatter is deterministic. Stems/leaves merged; pale flowers merged per hue.
// A handful spill over the kerbs onto the path (individual, leaning) — the plants
// don't know everyone is dead. Palette: silver-green stems, wet-black leaves,
// pale-violet / bone-white / grey-blue flowers (§7.3 cold family).
function buildPlant(S, L, FV, FW, FB, BR, x, z, species, hv) {
  const base = [1.4, 1.28, 1.16, 0.98, 1.36][species];
  const h = base + hv * 0.5;
  // stem
  pushBox(S, x, h / 2, z, 0.06, h, 0.06);
  // a couple of dark leaves down the stem
  pushBox(L, x + 0.11, h * 0.32, z, 0.22, 0.05, 0.1);
  pushBox(L, x - 0.11, h * 0.55, z + 0.04, 0.22, 0.05, 0.1);
  if (species !== 3) pushBox(L, x + 0.02, h * 0.72, z - 0.1, 0.1, 0.05, 0.2);
  // flowers by species
  if (species === 0 || species === 4) {
    // foxglove — a one-sided spike of pale-violet bells up the top third
    for (let k = 0; k < 5; k++) {
      const yy = h * (0.6 + k * 0.09);
      pushBox(FV, x + 0.08, yy, z + JIT2[k] * 0.06, 0.09, 0.1, 0.09);
    }
  } else if (species === 1) {
    // hemlock — a flat bone-white umbel crowning the stem
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      pushBox(FW, x + Math.cos(a) * 0.13, h + 0.02, z + Math.sin(a) * 0.13, 0.07, 0.05, 0.07);
    }
    pushBox(FW, x, h + 0.03, z, 0.08, 0.05, 0.08);
  } else if (species === 2) {
    // monkshood — a short raceme of grey-blue hoods near the top
    for (let k = 0; k < 3; k++) {
      pushBox(FB, x + JIT[k] * 0.05, h * (0.78 + k * 0.08), z + 0.05, 0.11, 0.13, 0.1);
    }
  } else {
    // belladonna — dull, and a few wet-black berries under the leaves
    pushBox(FV, x, h - 0.05, z, 0.08, 0.09, 0.08);
    pushBox(BR, x + 0.09, h * 0.5, z + 0.06, 0.07, 0.07, 0.07);
    pushBox(BR, x - 0.07, h * 0.42, z - 0.05, 0.06, 0.06, 0.06);
  }
}

function buildPlants(root, M) {
  const S = [], L = [], FV = [], FW = [], FB = [], BR = [];
  let idx = 0;
  for (const b of BEDS) {
    // 4 cols (x) x 3 rows (z) grid inset from the kerb, with per-plant jitter
    const cols = 4, rows = 3;
    const ix0 = b.x0 + 0.55, ix1 = b.x1 - 0.55;
    const iz0 = b.z0 + 0.55, iz1 = b.z1 - 0.55;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const jx = JIT[idx % JIT.length] * 0.28;
        const jz = JIT2[idx % JIT2.length] * 0.28;
        const x = ix0 + (ix1 - ix0) * (c / (cols - 1)) + jx;
        const z = iz0 + (iz1 - iz0) * (r / (rows - 1)) + jz;
        const sp = idx % 5;
        buildPlant(S, L, FV, FW, FB, BR, x, z, sp, JIT[(idx * 3) % JIT.length]);
        idx++;
      }
    }
  }
  mergedMesh(root, S, M.stalk, 'hor_plant_stems');
  mergedMesh(root, L, M.leaf, 'hor_plant_leaves');
  mergedMesh(root, FV, M.fviolet, 'hor_plant_violet');
  mergedMesh(root, FW, M.fwhite, 'hor_plant_white');
  mergedMesh(root, FB, M.fblue, 'hor_plant_blue');
  mergedMesh(root, BR, M.berry, 'hor_plant_berry');

  // OVERGROWTH — a handful of stalks spilling over the kerbs onto the gravel
  // paths, leaning (individual meshes, tilted). They have grown where no formal
  // plan put them: the beat that the garden does not know the house is dead.
  const spill = [
    { x: CX - PATH_HX - 0.15, z: 96.5, ry: 0.3, rz: 0.22 },
    { x: CX + PATH_HX + 0.15, z: 103.6, ry: -0.4, rz: -0.2 },
    { x: OX0 + MARGIN - 0.2, z: 99.4, ry: 0.5, rz: 0.26 },
    { x: OX1 - MARGIN + 0.2, z: 100.8, ry: -0.3, rz: -0.24 },
    { x: CX - 0.4, z: CZ - PATH_HZ - 0.15, ry: 0.2, rz: 0.18 },
    { x: CX + 0.5, z: CZ + PATH_HZ + 0.2, ry: -0.25, rz: -0.19 },
  ];
  let si = 0;
  for (const s of spill) {
    const h = 1.15 + JIT[si % JIT.length] * 0.3;
    addBox(root, M.stalk, s.x, h / 2, s.z, 0.06, h, 0.06, 'hor_spill_stem', false, s.ry, s.rz);
    // a livid flower at the tip, leaned out over the path
    const tipx = s.x + Math.sin(s.rz) * h * 0.5;
    const fmat = [M.fviolet, M.fwhite, M.fblue][si % 3];
    addBox(root, fmat, tipx, h - 0.06, s.z, 0.1, 0.12, 0.1, 'hor_spill_flower', false);
    si++;
  }
}

// -------------------------------------------------------------------- sundial
// The central feature where the cross-paths meet: a stepped stone pedestal
// carrying a canted bronze gnomon on a round dial. Formal, southern, and dry —
// the still point the whole plan turns around. Collider on the base.
function buildSundial(root, M) {
  addBox(root, M.stone, CX, 0.15, CZ, 1.5, 0.3, 1.5, 'hor_dial_step', false);       // lowest step
  addBox(root, M.stone, CX, 0.45, CZ, 1.1, 0.34, 1.1, 'hor_dial_step2', false);     // second step
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.9, 12), M.stone);
  col.position.set(CX, 1.05, CZ); col.name = 'hor_dial_column'; root.add(col);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 16), M.stone);
  dial.position.set(CX, 1.55, CZ); dial.name = 'hor_dial_plate'; root.add(dial);
  // canted gnomon (a triangle-ish thin blade) rising from the dial plate
  addBox(root, M.metal, CX, 1.8, CZ, 0.04, 0.5, 0.42, 'hor_dial_gnomon', false, 0, 0.5);
  collideBox(CX, 0.8, CZ, 1.5, 1.6, 1.5);
}

// -------------------------------------------------------- tended, then abandoned
// A gardener's things, left where they were set down fourteen months ago: a
// bench against the east wall, tools leaning by it, and an overturned watering
// vessel with a dry stain run out of it. No body — only the work interrupted.
function buildTended(root, M) {
  // bench against the east wall, facing the beds
  const bx = OX1 - 0.9, bz = CZ + 3.4;
  addBox(root, M.timber, bx, 0.44, bz, 0.5, 0.08, 1.7, 'hor_bench_seat', false);
  addBox(root, M.timber, bx, 0.72, bz, 0.12, 0.5, 1.7, 'hor_bench_back', false);
  for (const lz of [bz - 0.7, bz + 0.7]) {
    addBox(root, M.timber, bx, 0.22, lz, 0.44, 0.44, 0.1, 'hor_bench_leg', false);
  }
  collideBox(bx, 0.4, bz, 0.5, 0.9, 1.7);

  // two tools leaning against the wall by the bench (a hoe + a rake haft)
  addBox(root, M.timber, bx + 0.3, 0.95, bz - 1.2, 0.05, 1.9, 0.05, 'hor_tool_hoe', false, 0, 0.16);
  addBox(root, M.metal, bx + 0.02, 1.82, bz - 1.35, 0.16, 0.06, 0.14, 'hor_tool_hoe_head', false);
  addBox(root, M.timber, bx + 0.25, 0.95, bz - 0.9, 0.05, 1.9, 0.05, 'hor_tool_rake', false, 0, 0.19);
  addBox(root, M.metal, bx - 0.08, 1.84, bz - 1.06, 0.18, 0.05, 0.2, 'hor_tool_rake_head', false);

  // overturned watering vessel on the SW path edge, tipped on its side, dry
  const wx = CX - 2.6, wz = CZ + 1.9;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 12), M.tin);
  can.position.set(wx, 0.2, wz);
  can.rotation.z = Math.PI / 2;             // lying on its side
  can.name = 'hor_watering_can'; root.add(can);
  addBox(root, M.tin, wx - 0.3, 0.16, wz, 0.4, 0.05, 0.06, 'hor_can_spout', false, 0, 0.1);
  collideBox(wx, 0.2, wz, 0.6, 0.4, 0.5);
  // a dry stain run out of the fallen mouth
  flatQuad(root, M.stain, wx + 0.5, 0.014, wz + 0.1, 1.1, 0.5, 'hor_can_stain', 0.2);
}

// ------------------------------------------------- plague grammar (AT THE GATE)
// The ONLY death in the garden, and it does not belong to the garden — it drifts
// through the locked gate from the dead Pleasure Garden beyond: a little lime
// scattered at the threshold and a few dead flies banked against the bars. The
// living beds do not touch it. Deterministic scatter (LCG).
function buildGateGrammar(root, M) {
  const flies = [];
  for (let i = 0; i < 44; i++) {
    const z = rr(GATE_Z0 - 0.1, GATE_Z1 + 0.1);
    const x = OX0 + rr(0.08, 0.55);
    pushBox(flies, x, 0.01 + rr(0, 0.03), z, rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
  }
  mergedMesh(root, flies, M.fly, 'hor_gate_flies');

  const lime = [];
  for (let i = 0; i < 40; i++) {
    const z = rr(GATE_Z0 - 0.2, GATE_Z1 + 0.2);
    const x = OX0 + rr(0.1, 0.7);
    pushBox(lime, x, 0.012, z, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'hor_gate_lime');
}

// ------------------------------------------------------------------ lighting
// Local lights only (no global ambient — other areas' tuning untouched). Soft,
// COOL OVERCAST daylight from a blank white sky: this is open to the air and
// must read LIGHTER and greener than the dead interiors — but never warm, never
// saturated. Luminous, not verdant (§7.3): a broad even sky wash, a faint
// silver-green fill breathing up out of the living beds, and a dead grey pool at
// the locked gate where nothing grows.
function buildLighting() {
  // even overcast sky wash — several broad cool fills high over the quadrants
  for (const [gx, gz] of [
    [CX - 5, CZ - 4], [CX + 5, CZ - 4], [CX - 5, CZ + 4], [CX + 5, CZ + 4], [CX, CZ, 0],
  ]) {
    const sky = new THREE.PointLight(0xc2ccd4, 9, 26, 1.3);
    sky.position.set(gx, 7.5, gz);
    sky.name = 'hor_light_sky';
    addLight(sky);
  }
  // a soft hemispheric fill lifts the whole enclosure (open-air, lighter feel)
  const hemi = new THREE.HemisphereLight(0xcdd6dd, 0x3b4640, 0.55);
  hemi.name = 'hor_light_hemi'; addLight(hemi);

  // faint silver-green breath rising out of the living beds (the eerie glow)
  for (const b of BEDS) {
    const g = new THREE.PointLight(0x7d9a86, 2.2, 7, 1.7);
    g.position.set((b.x0 + b.x1) / 2, 1.1, (b.z0 + b.z1) / 2);
    g.name = 'hor_light_bed';
    addLight(g);
  }

  // a dead, colder grey pool at the locked gate — no life leaks in there
  const gate = new THREE.PointLight(0x59626b, 2.6, 8, 1.8);
  gate.position.set(OX0 + 1.4, 2.0, CZ);
  gate.name = 'hor_light_gate'; addLight(gate);
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
  // THE beat — a garden in full growth in a castle where everything else is dead.
  registerProp(world, 'hor_ix_garden', CX, 1.0, CZ, 3.0,
    'Everything here is growing. The stems stand green, the beds are thick, flowers out on a plant nobody has watered since last autumn — pale violet, bone-white, a grey-blue hood. In the whole dead house, this is the one thing still alive.',
    'The plants have run past their borders and leaned out over the paths, but nothing is choked or brown; it is only untended, not abandoned. The tools are still leaning where they were set down. Whatever kept this alive is not in the ground I can see.');

  // the locked gate — the only death in the garden, and it comes from outside it.
  registerProp(world, 'hor_ix_gate', OX0 + 0.5, 1.3, CZ, 2.2,
    'A barred iron gate in a blind wall, chained shut. It does not give. On its stone a little lime has been scattered, and dead flies have banked against the bars — drifted in from whatever lies on the far side.',
    'The chain is rusted into one piece and the hasp has not been opened in a very long time. Beyond the bars there is only dark. The lime and the flies stop at the threshold; on this side of the gate, nothing has died at all.');
}
