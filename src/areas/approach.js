import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import { registerCollider, registerFloor, addLight, onUpdate } from '../core/scene.js';

// ===========================================================================
// THE ARRIVAL PROCESSION — the castle's EXTERIOR SHELL (world-bible §2/§3/§7.1;
// art-direction §1-6; castle-atlas rows #8 Inner Ward, #27 Curtain, #28
// Gatehouse). The seamless overland approach the scout walks in on: up through
// the GATEHOUSE (z 48-58), across the INNER WARD courtyard (z 16-48, x ±18),
// to the GREAT HALL FAÇADE (z ≈16) and its great door (aligned to the built
// nave's south opening at z=+15, x[-1.5,1.5], y[0,4.5]).
//
// This is the OVERCAST-DAY exterior — the BRIGHTEST place in the game, a grey
// gasp of daylight after the candlelit interiors (art-direction §2: the
// contrast IS the point). Grey Otwin rubble + ashlar, blue-grey slate, ivy,
// cobbles, a flat white-grey sky. Matches refs/images.jpg.
//
// +Z = SOUTH = down-gradient toward the gate. y=0 ground. This file is a
// self-contained build: merged static geometry per material, own AABB helper,
// registerFloor for the walkable cobbles + gate passage, addLight for the
// daylight, onUpdate for the per-area exterior fog + daylight swap. Names
// prefixed appr_. Companion approach-story.js dresses the decay/props/docs to
// these same coordinates; the integrator opens the door, extends bounds south,
// moves the spawn, and adds zones.
// ===========================================================================

// --- shared envelope (COORDINATE SPEC) -------------------------------------
const DOOR_HW = 1.6;           // façade door half-width (≥ the 1.5 nave opening)
const DOOR_SPRING = 3.0;       // pointed-arch springline
const DOOR_R = 3.0;            // equilateral two-centred arch radius (span 3.0)
const FZC = 16.0;              // façade panel centre z (front face 16.2, proud of the built wall's 15.6 outer face)
const FZ_FRONT = FZC + 0.2;    // 16.2 — the +Z face the ward sees
const WALL_H = 9.0;            // hall wall height (matches walls.js H)
const WARD_Z0 = 15.0, WARD_Z1 = 48.0;   // ward cobbles (abut the nave door at z15)
const WARD_HX = 18.0;          // curtain walls at x = ±18 (interior face)
const CURTAIN_H = 9.0;         // raised — a wall you cannot see over
const GATE_Z0 = 48.0, GATE_Z1 = 58.0;   // gatehouse band
const PASS_HX = 3.0;           // gate passage x[-3,3] walkable
const TOWER_H = 17.0;          // gatehouse drum towers — taller, heavier, machicolated
const FLANK_H = 24.0;          // the two towers flanking the great door — raised, looming
const FLANK_HW = 2.1;          // flank tower half-width (footprint 4.2²)
const FLANK_X = 8.4;           // flank tower centres x = ±8.4 (just off the façade)
const FLANK_ZC = 15.0;         // flank tower centre z (projects into the ward)
const LANT_H = 32.0;           // central lantern/crossing tower top (before spire) — the dominant vertical
// REAR KEEP — a second, taller pair of corner masses set back BEHIND the façade
// (z<15, interior/north side) and OUTSIDE the nave footprint (|x|≥7), so the
// castle reads as several receding tiers of stone rather than one flat wall.
const KEEP_H = 30.0;           // keep top (before crown/spire) — taller than the flank towers in front
const KEEP_HW = 3.8;           // keep half-width (footprint 7.6², spans x[7.5,15.1] — clear of the nave x±6)
const KEEP_X = 11.3;           // keep centres x = ±11.3
const KEEP_ZC = 5.0;           // keep centre z (behind the z16 façade)
// The +X keep's footprint (x[7.5,15.1] z[1.2,8.8]) overlaps the SIDE CHAMBER
// interior (x[6,13] z[0,8]), so the keep body starts ABOVE the interior roof
// (WALL_H=9) — it looms behind the hall from the ward but never intrudes the
// rooms below (mirrors the lantern-tower base rule). No ground collider.
const KEEP_Y0 = 9.6;
const GATE_CLOSE_Z = 58.0;     // outer shut gate
const PORT_Z = 57.0;           // dropped portcullis (just inside the gate)
const EXT_Z = 16.0;            // camera.z > this ⇒ outdoors (fog + daylight swap)

// ---------------------------------------------------------------------------
// local collider helper (world-space AABB from centre + size)
// ---------------------------------------------------------------------------
function aabb(cx, cy, cz, w, h, d) {
  const min = new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2);
  const max = new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2);
  return registerCollider(new THREE.Box3(min, max));
}

// ---------------------------------------------------------------------------
// MeshBatch — accumulate axis boxes / arbitrary quads+tris (with UVs) and emit
// ONE merged mesh per material. Each face carries its own verts ⇒ crisp PS1
// flat shading; UVs tile ~1 image per `tile` metres.
// ---------------------------------------------------------------------------
class MeshBatch {
  constructor() { this.pos = []; this.uv = []; }

  quad(a, b, c, d, uvw, uvh) {
    const P = this.pos, U = this.uv;
    P.push(...a, ...b, ...c, ...a, ...c, ...d);
    U.push(0, 0, uvw, 0, uvw, uvh, 0, 0, uvw, uvh, 0, uvh);
  }

  tri(a, b, c) {
    this.pos.push(...a, ...b, ...c);
    this.uv.push(0, 0, 1, 0, 0.5, 1);
  }

  box(cx, cy, cz, w, h, d, tile = 2.0) {
    const s = 1 / tile;
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    // +Z / -Z (u=x, v=y)
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], w * s, h * s);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], w * s, h * s);
    // +X / -X (u=z, v=y)
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], d * s, h * s);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], d * s, h * s);
    // +Y / -Y (u=x, v=z)
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], w * s, d * s);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], w * s, d * s);
  }

  build(root, mat, name) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    root.add(m);
    return m;
  }
}

// ---------------------------------------------------------------------------
// textures — tiny (≤128), crunch'd, cool grey stone / cobble / slate speckle
// ---------------------------------------------------------------------------
function speckle(base, specks, size = 64, mortar) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  if (mortar) {
    // faint blocky course lines (rubble / ashlar joints)
    g.strokeStyle = mortar;
    g.lineWidth = 1;
    for (let y = 0; y < size; y += size / 4) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5); g.stroke();
    }
    for (let x = 0; x < size; x += size / 4) {
      g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, size); g.stroke();
    }
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = specks[(Math.random() * specks.length) | 0];
    const x = (Math.random() * size) | 0, y = (Math.random() * size) | 0;
    g.fillRect(x, y, 1 + ((Math.random() * 2) | 0), 1 + ((Math.random() * 2) | 0));
  }
  const t = new THREE.CanvasTexture(c);
  crunch(t);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function cobbleTex() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#33383f'; // wet mortar bed
  g.fillRect(0, 0, size, size);
  const stones = ['#565b62', '#4c515a', '#5f646c', '#494e56', '#606670'];
  const n = 8, cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      g.fillStyle = stones[(Math.random() * stones.length) | 0];
      const off = (r % 2) * (cell / 2);
      const x = col * cell + off + 1, y = r * cell + 1;
      g.fillRect(x, y, cell - 2, cell - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  crunch(t);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeMaterials() {
  const stone = new THREE.MeshLambertMaterial({
    map: speckle('#666b73', ['#585d65', '#727880', '#4f545c'], 64, '#4a4f57'),
    side: THREE.DoubleSide,
  });
  const slate = new THREE.MeshLambertMaterial({
    map: speckle('#39434f', ['#2f3a46', '#45505e', '#333d49'], 64),
    side: THREE.DoubleSide,
  });
  const timber = new THREE.MeshLambertMaterial({
    map: speckle('#463b2e', ['#3a3025', '#524634', '#332a20'], 64),
    side: THREE.DoubleSide,
  });
  const iron = new THREE.MeshLambertMaterial({
    map: speckle('#2b2e34', ['#23262b', '#3a3f47'], 32),
    side: THREE.DoubleSide,
  });
  const ivy = new THREE.MeshLambertMaterial({
    map: speckle('#3f4a3a', ['#33402f', '#4a5540', '#2c3628'], 64),
    side: THREE.DoubleSide, transparent: false,
  });
  const cobble = new THREE.MeshLambertMaterial({ map: cobbleTex(), side: THREE.DoubleSide });
  const darkStone = new THREE.MeshLambertMaterial({
    map: speckle('#20242b', ['#181b21', '#2a2f37'], 32), side: THREE.DoubleSide,
  });
  // rose window — self-lit cool glass (like the interior apse window)
  const glass = new THREE.MeshBasicMaterial({ color: 0xc4d2e2, fog: false, side: THREE.DoubleSide });

  for (const m of [stone, slate, timber, iron, ivy, cobble, darkStone, glass]) ps1ify(m);
  return { stone, slate, timber, iron, ivy, cobble, darkStone, glass };
}

// pointed (two-centred, equilateral) arch top height at door-opening x
function pointedTop(x) {
  const cc = x >= 0 ? -DOOR_HW + 0.1 : DOOR_HW - 0.1; // ≈ ∓1.5 opposite springing
  const dx = x - cc;
  return DOOR_SPRING + Math.sqrt(Math.max(0, DOOR_R * DOOR_R - dx * dx));
}

// ===========================================================================
export function buildApproach(world) {
  const root = new THREE.Group();
  root.name = 'appr_root';
  world.scene.add(root);

  const M = makeMaterials();

  buildFacade(root, M);
  buildFlankTowers(root, M);
  buildLanternTower(root, M);
  buildKeep(root, M);
  buildWard(root, M);
  buildGatehouse(root, M);
  buildFloors(root, M);
  buildSky(root);
  const rig = buildDaylight(world);
  buildFogAndDaylightSwap(world, rig);

  return root;
}

// --------------------------------------------------------------- GREAT HALL FAÇADE
// The exterior dress of the built nave's south wall (+Z face). Grey ashlar/
// rubble, a great pointed-arch doorway over the existing opening, flanking
// buttresses, a rose window above, a steep slate gable, ivy up the left side.
// The door opening (x[-1.6,1.6], y[0, pointedTop]) is LEFT CLEAR — the player
// walks through it into the nave. No collider spans the opening.
function buildFacade(root, M) {
  const B = new MeshBatch();      // grey stone (masonry)
  const S = new MeshBatch();      // slate (roof)

  // main panels flanking the door (collided) ------------------------------
  const panW = 7.0;               // façade spans x[-7,7]
  const lW = (panW - DOOR_HW) ;   // width from x=-7 to -1.6
  const lCx = -(panW + DOOR_HW) / 2; // centre of the left panel
  B.box(lCx, WALL_H / 2, FZC, lW, WALL_H, 0.4);
  B.box(-lCx, WALL_H / 2, FZC, lW, WALL_H, 0.4);
  aabb(lCx, WALL_H / 2, FZ_FRONT - 0.2, lW, WALL_H, 0.4);
  aabb(-lCx, WALL_H / 2, FZ_FRONT - 0.2, lW, WALL_H, 0.4);

  // north return walls sealing the ward corners (façade end x±7 → curtain x±18)
  const retW = WARD_HX - panW;    // 11
  const retCx = (panW + WARD_HX) / 2; // 12.5
  for (const sx of [-1, 1]) {
    B.box(sx * retCx, CURTAIN_H / 2, FZC + 0.2, retW, CURTAIN_H, 0.6);
    aabb(sx * retCx, CURTAIN_H / 2, FZC + 0.2, retW, CURTAIN_H, 0.6);
  }

  // pointed-arch DOORWAY spandrel + head, across x[-1.6,1.6] up to y=9 -------
  const N = 12, step = (2 * DOOR_HW) / N;
  for (let i = 0; i < N; i++) {
    const x = -DOOR_HW + step * (i + 0.5);
    const top = pointedTop(x);
    const h = WALL_H - top;
    if (h <= 0.02) continue;
    B.box(x, (top + WALL_H) / 2, FZC, step * 1.02, h, 0.4);
  }

  // steep slate GABLE above the eaves (y9 → apex 13 at x0) -----------------
  const GN = 14, gstep = (2 * panW) / GN, apex = 13.0;
  for (let i = 0; i < GN; i++) {
    const x = -panW + gstep * (i + 0.5);
    const top = WALL_H + (1 - Math.abs(x) / panW) * (apex - WALL_H);
    const h = top - WALL_H;
    if (h <= 0.02) continue;
    B.box(x, (WALL_H + top) / 2, FZC, gstep * 1.02, h, 0.45);
  }
  // slate roof planes sloping back (-Z) over the nave, from the ridge
  const ridgeZ0 = FZ_FRONT, ridgeZ1 = 8.0;
  const slope = Math.hypot(panW, apex - WALL_H); // ≈8.06
  S.quad([0, apex, ridgeZ0], [0, apex, ridgeZ1], [-panW, WALL_H, ridgeZ1], [-panW, WALL_H, ridgeZ0],
    (ridgeZ0 - ridgeZ1) / 2, slope / 2);
  S.quad([0, apex, ridgeZ1], [0, apex, ridgeZ0], [panW, WALL_H, ridgeZ0], [panW, WALL_H, ridgeZ1],
    (ridgeZ0 - ridgeZ1) / 2, slope / 2);

  B.build(root, M.stone, 'appr_facade_stone');
  S.build(root, M.slate, 'appr_facade_roof');

  // slate rake copings along the gable edges (individual rotated meshes)
  const rakeAng = Math.atan2(apex - WALL_H, panW); // ≈0.519
  for (const sx of [-1, 1]) {
    const cope = new THREE.Mesh(new THREE.BoxGeometry(slope + 0.3, 0.3, 0.6), M.slate);
    cope.position.set(sx * panW / 2, (WALL_H + apex) / 2, FZ_FRONT + 0.1);
    cope.rotation.z = -sx * rakeAng;
    cope.name = 'appr_facade_rake';
    root.add(cope);
  }

  // flanking + corner BUTTRESSES (project forward +Z, collided) ------------
  for (const sx of [-1, 1]) {
    buttress(root, M, sx * 2.65, 0.95, 6.5);   // flank the door
    buttress(root, M, sx * 6.6, 1.0, 8.0);     // façade corners
  }

  // ROSE / tracery WINDOW above the door — cool emissive glass, fog:false ---
  const roseY = 7.0, roseR = 1.25, gz = FZ_FRONT + 0.15;
  const rose = new THREE.Mesh(new THREE.CircleGeometry(roseR, 16), M.glass);
  rose.position.set(0, roseY, gz);
  rose.name = 'appr_facade_rose_glass';
  root.add(rose);
  // stone surround ring + cross mullions (in front of the glass)
  const ring = new THREE.Mesh(new THREE.RingGeometry(roseR, roseR + 0.28, 16), M.stone);
  ring.position.set(0, roseY, gz + 0.02);
  ring.name = 'appr_facade_rose_ring';
  root.add(ring);
  const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2 * roseR, 0.1), M.stone);
  mullV.position.set(0, roseY, gz + 0.04); mullV.name = 'appr_facade_rose_mull';
  root.add(mullV);
  const mullH = new THREE.Mesh(new THREE.BoxGeometry(2 * roseR, 0.12, 0.1), M.stone);
  mullH.position.set(0, roseY, gz + 0.04); mullH.name = 'appr_facade_rose_mull';
  root.add(mullH);

  // IVY creeping up the LEFT side of the façade (ref) ----------------------
  for (const [ix, iy, iw, ih] of [[-6.6, 2.6, 1.4, 5.0], [-4.6, 1.6, 1.6, 3.0], [-6.9, 5.4, 1.2, 2.4]]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), M.ivy);
    leaf.position.set(ix, iy, FZ_FRONT + 0.08);
    leaf.name = 'appr_facade_ivy';
    root.add(leaf);
  }
}

function buttress(root, M, cx, w, h) {
  // two stacked, offset boxes projecting forward of the façade front
  const lo = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.6, 1.4), M.stone);
  lo.position.set(cx, h * 0.3, FZ_FRONT + 0.7);
  lo.name = 'appr_buttress'; root.add(lo);
  const hi = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.4, 0.9), M.stone);
  hi.position.set(cx, h * 0.6 + h * 0.2, FZ_FRONT + 0.45);
  hi.name = 'appr_buttress'; root.add(hi);
  aabb(cx, h * 0.3, FZ_FRONT + 0.7, w, h * 0.6, 1.4);
}

// ---------------------------------------------------------------------------
// FORTRESS DETAIL HELPERS — the vocabulary that reads as "castle" at a glance:
// oversailing corbel courses, machicolated battlements, and cross arrow-loops.
// ---------------------------------------------------------------------------

// Merlons (crenellations) around a rectangular parapet [x0,x1]×[z0,z1], their
// bases at height y. Gaps between them are the crenels. Corners always filled.
function battlementRect(B, x0, x1, z0, z1, y, mw = 0.7, mh = 0.95, gap = 0.6) {
  const step = mw + gap, t = 0.45;
  for (let x = x0; x <= x1 + 1e-3; x += step) {
    const xx = Math.min(x, x1);
    B.box(xx, y + mh / 2, z0, mw, mh, t);
    B.box(xx, y + mh / 2, z1, mw, mh, t);
  }
  for (let z = z0 + step; z <= z1 - step + 1e-3; z += step) {
    B.box(x0, y + mh / 2, z, t, mh, mw);
    B.box(x1, y + mh / 2, z, t, mh, mw);
  }
}

// A machicolated tower crown: an oversailing corbel course that projects beyond
// the shaft (the machicolation, from which defenders dropped things), then a
// crenellated parapet around the oversailed top. `hw,hd` = shaft half-extents.
function crown(B, cx, cz, hw, hd, topY, over = 0.45) {
  B.box(cx, topY - 0.3, cz, 2 * (hw + over), 0.62, 2 * (hd + over)); // corbel course
  battlementRect(B, cx - hw - over, cx + hw + over, cz - hd - over, cz + hd + over, topY + 0.02);
}

// A recessed cross-shaped arrow loop (arbalest loop) on a vertical face. `dir`
// is the face normal axis: 'z' for ±Z faces, 'x' for ±X faces. Drawn into the
// dark-stone batch so it reads as a shadowed slit cut into the masonry.
function crossLoop(D, x, y, z, dir) {
  const vh = 1.15, arm = 0.62, w = 0.16, t = 0.14, ay = 0.18;
  if (dir === 'z') { D.box(x, y, z, w, vh, t); D.box(x, y + ay, z, arm, w, t); }
  else { D.box(x, y, z, t, vh, w); D.box(x, y + ay, z, t, w, arm); }
}

// A DEEP, two-stage machicolated crown: a lower narrower corbel that flares out
// to the full oversailing corbel course of crown(), plus a ring of corbel teeth
// beneath — reads as a heavier, more emphatic overhang than crown() alone.
function deepCrown(B, cx, cz, hw, hd, topY, over = 0.5) {
  B.box(cx, topY - 1.05, cz, 2 * (hw + over * 0.45), 0.55, 2 * (hd + over * 0.45)); // lower stage
  // corbel teeth (the machicolation drops) around the perimeter
  for (let x = cx - hw; x <= cx + hw + 1e-3; x += (2 * hw) / 3) {
    B.box(x, topY - 0.72, cz - hd - over * 0.6, 0.34, 0.5, 0.34);
    B.box(x, topY - 0.72, cz + hd + over * 0.6, 0.34, 0.5, 0.34);
  }
  crown(B, cx, cz, hw, hd, topY, over);
}

// A steep 4-sided slate SPIRE from a square base ring up to a single apex point.
function spire(S, cx, cz, hw, hd, baseY, apexY) {
  const ap = [cx, apexY, cz];
  const ring = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    S.tri([cx + a[0], baseY, cz + a[1]], [cx + b[0], baseY, cz + b[1]], ap);
  }
}

// ---------------------------------------------------------------------------
// GREEBLE HELPERS — surface detail that breaks up the big uniform wall faces
// (world-bible: a plague-abandoned fortress; art-direction: no large area should
// read as one flat sheet of stone). All merged into the existing per-material
// batches, so they add almost no draw calls. Variation comes from a stable
// per-index hash (NEVER Math.random / Date.now — those THROW in this build), so
// the geometry is identical on every load. Greebles are ACCENTS, not a new skin.
// ---------------------------------------------------------------------------

// deterministic pseudo-random in [0,1) from an integer seed. Stable per index.
function hval(i) { const s = Math.sin((i + 1) * 12.9898) * 43758.5453; return s - Math.floor(s); }

// a flat wall-face quad on an X-normal face (x = xf), spanning y[y0,y1] z[z0,z1]
function faceQuadX(batch, xf, y0, y1, z0, z1) {
  batch.quad([xf, y0, z0], [xf, y0, z1], [xf, y1, z1], [xf, y1, z0], z1 - z0, y1 - y0);
}
// a flat wall-face quad on a Z-normal face (z = zf), spanning y[y0,y1] x[x0,x1]
function faceQuadZ(batch, zf, y0, y1, x0, x1) {
  batch.quad([x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf], x1 - x0, y1 - y0);
}

// GREEBLE the long CURTAIN-WALL inner faces (x=±18, ward side). `face` is the
// ward-facing plane x; `n` (=-sx) is the outward (ward) normal. Skips the mid-run
// wall-tower footprint (z≈28.4-33.6). Merges into stone(B)/darkStone(D)/iron(I)/
// ivy(V). Keeps clear of the existing two-tier arrow-loops (y3 & y6).
function curtainGreebles(B, D, I, V, sx, face) {
  const n = -sx;                        // outward (toward the ward) normal
  const proud = face + n * 0.06;        // ashlar blocks standing proud toward the ward
  const inTower = (z) => (z > 28.4 && z < 33.6);

  // PUTLOG HOLES — two full marching rows of scaffolding sockets + a ragged 3rd
  for (let k = 0; k < 13; k++) {
    const z = 16.6 + k * 2.4; if (z > 46.6) break; if (inTower(z)) continue;
    for (const y of [2.4, 5.6]) D.box(face, y, z, 0.09, 0.22, 0.24);
    if (hval(k * 3 + (sx > 0 ? 7 : 2)) > 0.5) D.box(face, 7.8, z + 1.2, 0.09, 0.2, 0.22);
  }
  // IRREGULAR ASHLAR — proud lighter blocks, recessed darker blocks, so the
  // coursing isn't a flat sheet
  for (let k = 0; k < 7; k++) {
    const z = 17.5 + hval(k * 2 + (sx > 0 ? 3 : 8)) * 28; if (inTower(z)) continue;
    B.box(proud, 1.6 + hval(k * 5 + 2) * 6.2, z, 0.55 + hval(k) * 0.4, 0.42 + hval(k + 9) * 0.24, 0.12);
    const dz = 17.5 + hval(k * 4 + (sx > 0 ? 5 : 6)) * 28; if (inTower(dz)) continue;
    D.box(face, 1.4 + hval(k * 3 + 4) * 6.4, dz, 0.5 + hval(k + 1) * 0.5, 0.36 + hval(k + 7) * 0.3, 0.05);
  }
  // patched-masonry rectangles (larger darker repairs)
  for (const [z, y, w, h] of [[sx > 0 ? 21.0 : 35.5, 4.3, 1.5, 1.1], [sx > 0 ? 41.5 : 26.0, 2.6, 1.3, 1.0]])
    if (!inTower(z)) D.box(face, y, z, w, h, 0.05);
  // DAMP STAINS — thin vertical streaks bleeding down from the crenellations
  for (const z of [19.4, 24.6, 36.8, 43.2]) if (!inTower(z)) D.box(face, 6.3, z, 0.05, 4.6, 0.34);
  // shorter stains below arrow-loops
  for (const z of [23.7, 39.3]) D.box(face, 3.7, z, 0.05, 2.6, 0.26);
  // CRACKS — two step-cracks per wall (short offset dark segments)
  for (const [z0, y0] of [[26.0, 8.0], [37.5, 7.4]])
    for (let s = 0; s < 6; s++) D.box(face, y0 - s * 0.55, z0 + s * 0.28 * (sx > 0 ? 1 : -1), 0.05, 0.36, 0.1);
  // IRON — a couple of tie-rings / wall-brackets + one empty torch bracket
  for (const [z, y] of [[20.5, 4.2], [43.5, 4.6]]) {
    I.box(face + n * 0.12, y, z, 0.24, 0.1, 0.1);           // stub bracket
    I.box(face + n * 0.2, y - 0.14, z, 0.08, 0.22, 0.08);   // hanging ring
  }
  const tz = sx > 0 ? 30.0 : 33.9;                          // clear of the wall-tower
  I.box(face + n * 0.14, 5.4, tz, 0.28, 0.09, 0.09);        // torch arm
  I.box(face + n * 0.22, 5.75, tz, 0.09, 0.4, 0.16);        // torch socket cup
  // MOSS / LICHEN — ivy patches creeping up the wall feet & shaded corners
  for (const [z, w, top] of [[18.5, 1.6, 1.9], [35.0, 1.4, 1.6], [45.8, 1.5, 2.2]])
    if (!inTower(z)) faceQuadX(V, face + n * 0.02, 0.05, top, z - w / 2, z + w / 2);
}

// GREEBLE a GATEHOUSE tower ward face (z=GATE_Z0) + its passage wall. `txc` is
// the tower centre x (±6); `sx` its side. Merges into stone(B)/darkStone(D)/
// iron(I)/ivy(V). Keeps the passage x[-3,3] and the gate arch clear.
function gatehouseGreebles(B, D, I, V, sx, txc) {
  const fz = GATE_Z0 - 0.02, n = -1;                       // ward-facing tower face
  // PUTLOG HOLES (3×3 grid, between the loop tiers at y 4/7.5/11/14.5)
  for (let r = 0; r < 3; r++) { const y = 2.6 + r * 4.3;
    for (let c = 0; c < 3; c++) D.box(txc - 2 + c * 2, y, fz, 0.24, 0.22, 0.08); }
  // IRREGULAR ASHLAR — proud + recessed
  for (let k = 0; k < 5; k++) {
    B.box(txc - 2.4 + hval(k * 3 + (sx > 0 ? 2 : 9)) * 4.8, 2 + hval(k * 2 + 1) * 12, fz + n * 0.06,
      0.5 + hval(k) * 0.4, 0.4, 0.12);
    D.box(txc - 2.4 + hval(k * 5 + (sx > 0 ? 4 : 7)) * 4.8, 2 + hval(k * 4 + 3) * 12, fz, 0.5, 0.4, 0.05);
  }
  // DAMP STAINS bleeding from the machicolation crown
  for (const dx of [-1.8, 0.4, 2.0]) D.box(txc + dx, TOWER_H * 0.5, fz, 0.34, TOWER_H * 0.55, 0.05);
  // CRACK — one step-crack on the +X tower only (asymmetry)
  if (sx > 0) for (let s = 0; s < 6; s++) D.box(txc + 1.2 - s * 0.2, 10 - s * 0.6, fz, 0.1, 0.34, 0.05);
  // MOSS at the tower foot (well outside the gate arch x[-3,3])
  faceQuadZ(V, fz, 0.05, 1.9, txc + (sx > 0 ? 0.8 : -2.8), txc + (sx > 0 ? 2.8 : -0.8));
  // IRON in the gate PASSAGE — tie-rings on the passage walls + a torch bracket
  const pf = sx * PASS_HX;                                  // passage wall face x=±3
  for (const z of [50.5, 54.5]) {
    I.box(pf - sx * 0.1, 2.2, z, 0.1, 0.1, 0.24);
    I.box(pf - sx * 0.16, 2.05, z, 0.08, 0.22, 0.08);
  }
  I.box(pf - sx * 0.12, 2.7, 55.8, 0.1, 0.09, 0.28);        // torch arm (clear of head height)
  I.box(pf - sx * 0.18, 3.0, 55.8, 0.09, 0.36, 0.12);       // torch socket
}

// GREEBLE a REAR-KEEP mass ward face (z=zf). ONLY above KEEP_Y0 (nothing intrudes
// the interior below). Merges into the keep's stone(B)/darkStone(D) batches.
function keepGreebles(B, D, sx, cx, zf, topY) {
  const n = 1, base = KEEP_Y0, span = topY - KEEP_Y0;
  // PUTLOG HOLES marching across the tall shaft (kept above the raised base)
  for (let r = 0; r < 3; r++) { const y = base + 1.9 + r * 5.5; if (y > topY - 2) break;
    for (let c = 0; c < 4; c++) D.box(cx - 2.4 + c * 1.6, y, zf, 0.22, 0.2, 0.08); }
  // IRREGULAR ASHLAR — proud + recessed
  for (let k = 0; k < 6; k++) {
    B.box(cx - 2.6 + hval(k * 3 + (sx > 0 ? 2 : 6)) * 5.2, base + 1 + hval(k * 2 + 1) * (span - 3), zf + n * 0.06,
      0.5 + hval(k) * 0.4, 0.4, 0.12);
    D.box(cx - 2.6 + hval(k * 5 + 3) * 5.2, base + 1 + hval(k * 4 + 2) * (span - 3), zf, 0.5, 0.38, 0.05);
  }
  // DAMP STAINS from the crown down
  for (const dx of [-1.7, 0.3, 1.9]) D.box(cx + dx, base + span * 0.5 + 3, zf, 0.32, span * 0.5, 0.05);
  // CRACK on the ruined (+X) keep
  if (sx > 0) for (let s = 0; s < 7; s++) D.box(cx + 1.4 - s * 0.22, topY - 3 - s * 0.7, zf, 0.1, 0.4, 0.05);
}

// --------------------------------------------------------------- FLANKING TOWERS
// Two tall square towers standing proud of the façade corners, so the great
// door sits at the foot of a pair of looming masses. Machicolated crowns, four
// tiers of cross arrow-loops up the ward-facing and side faces. These carry the
// castle's height right where the player arrives.
function buildFlankTowers(root, M) {
  const B = new MeshBatch();
  const D = new MeshBatch();      // arrow-loop shadows
  const S = new MeshBatch();      // slate spikelet caps
  const hw = FLANK_HW, hd = FLANK_HW, zc = FLANK_ZC, zf = zc + hd; // front (+Z) face
  for (const sx of [-1, 1]) {
    const cx = sx * FLANK_X;
    B.box(cx, FLANK_H / 2, zc, 2 * hw, FLANK_H, 2 * hd, 2.2);      // shaft
    aabb(cx, FLANK_H / 2, zc, 2 * hw, FLANK_H, 2 * hd);
    // two shallow string-course bands up the shaft (break the taller mass)
    B.box(cx, FLANK_H * 0.34, zc, 2 * hw + 0.18, 0.3, 2 * hd + 0.18);
    B.box(cx, FLANK_H * 0.68, zc, 2 * hw + 0.14, 0.26, 2 * hd + 0.14);
    deepCrown(B, cx, zc, hw, hd, FLANK_H, 0.5);
    // cross arrow-loops: five tiers on the ward face (+Z) and both side faces
    for (const y of [4.5, 8.5, 12.5, 16.5, 20.5]) {
      crossLoop(D, cx, y, zf - 0.02, 'z');
      crossLoop(D, cx - hw + 0.02, y, zc, 'x');   // −X side face
      crossLoop(D, cx + hw - 0.02, y, zc, 'x');   // +X side face
    }
    // a tall, emphatic slate spire from the parapet up to a point — but the +X
    // tower's cap is CRACKED/blunted (plague-abandoned decay, world-bible §):
    const cracked = sx > 0;
    const apexY = FLANK_H + (cracked ? 4.2 : 7.4);
    spire(S, cx, zc, hw, hd, FLANK_H + 1.0, apexY);
    if (cracked) {
      // a broken slate cap slab canted off the truncated spire, + a toppled
      // merlon block fallen at the tower foot (small touch, no collider)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * hw * 0.7, 0.3, 2 * hd * 0.7), M.slate);
      slab.position.set(cx + 0.4, apexY - 0.1, zc + 0.2); slab.rotation.z = 0.5; slab.rotation.x = 0.2;
      slab.name = 'appr_flank_brokencap'; root.add(slab);
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.55), M.stone);
      block.position.set(cx + hw + 0.9, 0.45, zf + 1.1); block.rotation.z = 0.35; block.rotation.y = 0.6;
      block.name = 'appr_flank_toppled_merlon'; root.add(block);
    }
  }
  B.build(root, M.stone, 'appr_flank_stone');
  D.build(root, M.darkStone, 'appr_flank_loops');
  S.build(root, M.slate, 'appr_flank_caps');

  // IVY creeping up the −X flank tower (asymmetry / abandonment)
  for (const [iy, iw, ih] of [[3.5, 1.5, 6.5], [8.5, 1.3, 4.0]]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), M.ivy);
    leaf.position.set(-FLANK_X, iy, zf + 0.06);
    leaf.name = 'appr_flank_ivy'; root.add(leaf);
  }
}

// --------------------------------------------------------------- LANTERN TOWER
// A central crossing/lantern tower rising from behind the hall gable — the
// castle's dominant vertical. Its base begins ABOVE the nave roofline (y≥WALL_H)
// so it never intrudes into the interior the player later walks; from the ward
// it reads as a great tower looming behind the great door, revealed taller the
// further back you stand. Tall lancet openings, machicolated crown, slate spire.
function buildLanternTower(root, M) {
  const B = new MeshBatch();
  const D = new MeshBatch();
  const S = new MeshBatch();
  const hw = 2.9, hd = 2.9, zc = 7.0, y0 = WALL_H + 1.0; // base clear above the roofline
  const cy = (y0 + LANT_H) / 2, h = LANT_H - y0;
  B.box(0, cy, zc, 2 * hw, h, 2 * hd, 2.4);
  // string courses (three, up the taller shaft)
  for (const y of [WALL_H + 3, WALL_H + 9, WALL_H + 16]) B.box(0, y, zc, 2 * hw + 0.2, 0.3, 2 * hd + 0.2);
  // tall paired lancet openings (dark) on the ward face (+Z) and sides — upper tier
  const zf = zc + hd;
  for (const dx of [-1.1, 1.1]) D.box(dx, LANT_H - 4.0, zf - 0.02, 0.7, 4.6, 0.16);
  for (const sx of [-1, 1]) for (const dz of [-1.1, 1.1])
    D.box(sx * (hw - 0.02), LANT_H - 4.0, zc + dz, 0.16, 4.6, 0.7);
  // a LOWER tier of paired lancets, for more vertical detail on the raised shaft
  for (const dx of [-1.1, 1.1]) D.box(dx, LANT_H - 12.5, zf - 0.02, 0.55, 3.4, 0.16);
  for (const sx of [-1, 1]) for (const dz of [-1.1, 1.1])
    D.box(sx * (hw - 0.02), LANT_H - 12.5, zc + dz, 0.16, 3.4, 0.55);
  deepCrown(B, 0, zc, hw, hd, LANT_H, 0.55);
  // corner turrets (stronger, taller pinnacles) at the four crown corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tx = sx * (hw + 0.35), tz = zc + sz * (hd + 0.35), tw = 0.45;
    B.box(tx, LANT_H + 1.6, tz, 2 * tw, 4.0, 2 * tw);          // taller shaft
    B.box(tx, LANT_H + 3.7, tz, 2 * tw + 0.22, 0.3, 2 * tw + 0.22); // corbel cap
    spire(S, tx, tz, tw + 0.15, tw + 0.15, LANT_H + 3.85, LANT_H + 6.6);
  }
  // steep slate SPIRE from the parapet to a bold point (the castle's high mark)
  spire(S, 0, zc, hw + 0.2, hd + 0.2, LANT_H + 1.0, LANT_H + 11.0);
  B.build(root, M.stone, 'appr_lantern_stone');
  D.build(root, M.darkStone, 'appr_lantern_lancets');
  S.build(root, M.slate, 'appr_lantern_spire');
}

// --------------------------------------------------------------- REAR KEEP
// A second, taller pair of great square masses set BEHIND the façade (z<15,
// north/interior side) and clear of the nave (x[7.5,15.1], |x|≥7). Seen from the
// ward they rise over and behind the flank towers, so the fortress reads as
// several receding tiers of stone climbing toward the lantern tower — not one
// flat wall. Flat crenellated tops with corner turrets (a keep silhouette,
// distinct from the spired towers in front). Base sits on the ground behind the
// wall the player can't reach, but colliders are added for completeness.
function buildKeep(root, M) {
  const B = new MeshBatch();
  const D = new MeshBatch();
  const S = new MeshBatch();
  const hw = KEEP_HW, hd = KEEP_HW, zc = KEEP_ZC, zf = zc + hd;
  for (const sx of [-1, 1]) {
    const cx = sx * KEEP_X;
    const ruined = sx > 0;           // the +X keep is part-slumped (abandonment)
    const topY = ruined ? KEEP_H - 2.5 : KEEP_H;   // the ruined keep sits a touch lower
    B.box(cx, (KEEP_Y0 + topY) / 2, zc, 2 * hw, topY - KEEP_Y0, 2 * hd, 2.2);   // shaft (base above the roofs)
    // string courses up the tall shaft (measured from the raised base)
    for (const f of [0.3, 0.55, 0.8]) {
      const y = KEEP_Y0 + (topY - KEEP_Y0) * f;
      B.box(cx, y, zc, 2 * hw + 0.2, 0.3, 2 * hd + 0.2);
    }
    // cross arrow-loops on the ward-facing (+Z) and outward side face (skip any
    // below the raised base)
    for (const y of [12, 18, 23]) {
      if (y > topY - 2 || y < KEEP_Y0 + 1) continue;
      crossLoop(D, cx, y, zf - 0.02, 'z');
      crossLoop(D, cx + sx * hw - sx * 0.02, y, zc, 'x');
    }
    // GREEBLES on the tall keep ward face (only ABOVE KEEP_Y0 — nothing below)
    keepGreebles(B, D, sx, cx, zf, topY);
    deepCrown(B, cx, zc, hw, hd, topY, 0.55);
    // corner turrets with little slate spirelets (a spikier crown)
    for (const sx2 of [-1, 1]) for (const sz2 of [-1, 1]) {
      const tx = cx + sx2 * (hw + 0.35), tz = zc + sz2 * (hd + 0.35), tw = 0.45;
      // the ruined keep is missing its far corner turret (broken stump instead)
      if (ruined && sx2 > 0 && sz2 < 0) {
        B.box(tx, topY + 0.6, tz, 2 * tw, 1.2, 2 * tw);   // snapped-off stump
        continue;
      }
      B.box(tx, topY + 1.3, tz, 2 * tw, 3.2, 2 * tw);
      B.box(tx, topY + 3.0, tz, 2 * tw + 0.2, 0.28, 2 * tw + 0.2);
      spire(S, tx, tz, tw + 0.12, tw + 0.12, topY + 3.15, topY + 5.4);
    }
    // a shallow slate hip roof rising from inside the parapet (not a full spire)
    spire(S, cx, zc, hw - 0.1, hd - 0.1, topY + 0.6, topY + 3.6);
  }
  B.build(root, M.stone, 'appr_keep_stone');
  D.build(root, M.darkStone, 'appr_keep_loops');
  S.build(root, M.slate, 'appr_keep_caps');

  // IVY climbing the ruined (+X) keep's ward-facing wall (above the raised base)
  for (const [iy, iw, ih] of [[15.0, 1.8, 9.0], [22.0, 1.5, 5.0]]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), M.ivy);
    leaf.position.set(KEEP_X, iy, KEEP_ZC + KEEP_HW + 0.06);
    leaf.name = 'appr_keep_ivy'; root.add(leaf);
  }
}

// --------------------------------------------------------------- INNER WARD
// Cobbled open-air court z[16,48], x[-18,18]. Crude Otwin curtain walls at
// x=±18 (~7 m, rampart top, arrow slits). A stone well + a mounting block for
// scale. Everything grey, weathered.
function buildWard(root, M) {
  const B = new MeshBatch();      // curtain + rampart stone
  const D = new MeshBatch();      // arrow-loop shadows + recesses/stains
  const I = new MeshBatch();      // iron fittings (rings, brackets, torch)
  const V = new MeshBatch();      // moss / lichen (ivy material)
  const zc = (WARD_Z0 + WARD_Z1) / 2, len = WARD_Z1 - WARD_Z0; // 31.5, 33
  const th = 1.1;                 // thicker, heavier wall

  for (const sx of [-1, 1]) {
    const xc = sx * (WARD_HX + th / 2);       // wall centre (interior face at ±18)
    const face = sx * WARD_HX + 0.03;         // ward-facing inner face
    // main rubble wall body — taller and thicker
    B.box(xc, CURTAIN_H / 2, zc, th, CURTAIN_H, len, 2.0);
    aabb(xc, CURTAIN_H / 2, zc, th, CURTAIN_H, len);
    // oversailing corbel course + a wall-walk lip
    B.box(xc, CURTAIN_H - 0.3, zc, th + 0.5, 0.55, len);
    B.box(xc, CURTAIN_H + 0.12, zc, th + 0.2, 0.28, len);
    // machicolated merlons along the walk, with crenel gaps — with DECAY: a few
    // merlons toppled (wider crenels) and one chipped down, asymmetric per wall.
    let mi = 0;
    for (let z = WARD_Z0 + 0.9; z < WARD_Z1 - 0.4; z += 1.85) {
      const toppled = sx > 0 ? (mi === 4 || mi === 11) : (mi === 8);
      if (!toppled) {
        const chip = (sx < 0 && mi === 3) ? 0.5 : 1.0;   // one chipped-down merlon
        B.box(xc, CURTAIN_H + 0.65 - (1 - chip) * 0.35, z, 0.55, 0.95 * chip, 1.05);
      }
      mi++;
    }
    // a fallen merlon block lying on the wall-walk where the +X wall toppled one
    if (sx > 0) {
      const fb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), M.stone);
      fb.position.set(xc - 0.1, CURTAIN_H + 0.4, WARD_Z0 + 0.9 + 4 * 1.85 + 0.35);
      fb.rotation.set(0.15, 0.5, 0.25);
      fb.name = 'appr_ward_fallen_merlon'; root.add(fb);
    }
    // GREEBLES breaking up the big flat curtain face
    curtainGreebles(B, D, I, V, sx, face);
    // regularly-spaced cross arrow-loops in two tiers down the inner face
    for (let z = WARD_Z0 + 3.5; z < WARD_Z1 - 2; z += 5.2) {
      crossLoop(D, face, 3.0, z, 'x');
      crossLoop(D, face, 6.0, z, 'x');
    }
    // a squat half-round wall-tower breaking the run midway (buttress-tower)
    const wtz = 31.0, wth = CURTAIN_H + 2.5;
    B.box(sx * (WARD_HX - 0.6), wth / 2, wtz, 1.8, wth, 3.0, 2.0);
    aabb(sx * (WARD_HX - 0.6), wth / 2, wtz, 1.8, wth, 3.0);
    crown(B, sx * (WARD_HX - 0.6), wtz, 0.9, 1.5, wth, 0.35);
    for (const y of [3.2, 6.2, 9.0]) crossLoop(D, sx * (WARD_HX - 1.55), y, wtz, 'x');
  }
  B.build(root, M.stone, 'appr_ward_stone');
  D.build(root, M.darkStone, 'appr_ward_loops');
  I.build(root, M.iron, 'appr_ward_iron');
  V.build(root, M.ivy, 'appr_ward_moss');

  buildWell(root, M, -12.5, 30);
  buildMountingBlock(root, M, 12.5, 22);
}

function buildWell(root, M, cx, cz) {
  const g = new THREE.Group(); g.name = 'appr_well'; root.add(g);
  // circular stone rim
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.85, 12), M.stone);
  rim.position.set(cx, 0.42, cz); g.add(rim);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 12), M.darkStone);
  inner.position.set(cx, 0.5, cz); g.add(inner);
  // two posts + a little pitched timber roof
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), M.timber);
    post.position.set(cx + sx * 0.85, 1.5, cz); g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), M.slate);
  roof.position.set(cx, 2.6, cz); roof.rotation.z = 0.15; g.add(roof);
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), M.slate);
  roof2.position.set(cx, 2.6, cz); roof2.rotation.z = -0.15; g.add(roof2);
  aabb(cx, 0.42, cz, 2.1, 0.85, 2.1);
}

function buildMountingBlock(root, M, cx, cz) {
  const g = new THREE.Group(); g.name = 'appr_mounting_block'; root.add(g);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.2 - i * 0.3, 0.34, 0.9), M.stone);
    s.position.set(cx, 0.17 + i * 0.34, cz + i * 0.28); g.add(s);
  }
  aabb(cx, 0.5, cz, 1.2, 1.0, 1.5);
}

// --------------------------------------------------------------- GATEHOUSE
// z[48,58]. Two square towers x∈[-9,-3] & [3,9], ~10 m, blue-grey pyramidal
// slate caps. A vaulted gate PASSAGE x[-3,3] between them. The gap between the
// towers and the curtain (x[9,18]) is sealed. Outer end (z58) CLOSED: a dropped
// iron portcullis (z57) + a shut timber gate (z58) so the player can't leave.
function buildGatehouse(root, M) {
  const B = new MeshBatch();      // tower + wall stone
  const S = new MeshBatch();      // slate caps
  const D = new MeshBatch();      // arrow-loop shadows + recesses/stains
  const I = new MeshBatch();      // iron fittings (passage rings, torch brackets)
  const V = new MeshBatch();      // moss / lichen (ivy material)
  const gzc = (GATE_Z0 + GATE_Z1) / 2, gd = GATE_Z1 - GATE_Z0;

  // two square towers (solid rubble masses; inner face x=±3 = passage walls)
  for (const sx of [-1, 1]) {
    const txc = sx * 6.0;         // centre of x[3,9] / x[-9,-3]
    B.box(txc, TOWER_H / 2, gzc, 6.0, TOWER_H, gd, 2.0);
    aabb(txc, TOWER_H / 2, gzc, 6.0, TOWER_H, gd);
    // string course a third up
    B.box(txc, TOWER_H * 0.42, gzc, 6.3, 0.32, gd + 0.3);
    // deep machicolated crown, then a steep pyramidal slate cap above it
    deepCrown(B, txc, gzc, 3.0, gd / 2, TOWER_H, 0.5);
    const cy = TOWER_H + 1.5, x0 = txc - 3, x1 = txc + 3, z0 = GATE_Z0, z1 = GATE_Z1;
    const ap = [txc, TOWER_H + 5.5, gzc];
    S.tri([x0, cy, z0], [x1, cy, z0], ap);
    S.tri([x1, cy, z1], [x0, cy, z1], ap);
    S.tri([x0, cy, z1], [x0, cy, z0], ap);
    S.tri([x1, cy, z0], [x1, cy, z1], ap);
    // cross arrow-loops in tiers on the ward (+Z), outer (−Z) and side faces
    for (const y of [4.0, 7.5, 11.0, 14.5]) {
      crossLoop(D, txc, y, GATE_Z0 - 0.02, 'z');
      crossLoop(D, txc, y, GATE_Z1 + 0.02, 'z');
      crossLoop(D, sx * 9.0 - sx * 0.02, y, gzc, 'x');   // outward side face
    }
    // GREEBLES on the tower ward face + iron in the passage
    gatehouseGreebles(B, D, I, V, sx, txc);
  }
  // central DAMP STAINS bleeding from the murder-hole gallery down the over-
  // passage block (above the gate arch head, so the entry mouth stays clear)
  for (const dx of [-2.1, 2.1]) D.box(dx, 11.0, GATE_Z0 - 0.02, 0.32, 4.2, 0.05);
  // a toppled merlon fallen from the passage-roof parapet (decay, no collider)
  const gfb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), M.stone);
  gfb.position.set(1.6, TOWER_H + 0.35, gzc - 1.0); gfb.rotation.set(0.2, 0.4, 0.3);
  gfb.name = 'appr_gatehouse_fallen_merlon'; root.add(gfb);

  // seal the corners between tower (x=±9) and curtain (x=±18) at the gate line
  for (const sx of [-1, 1]) {
    const w = WARD_HX - 9.0;      // 9
    const xc = sx * (9.0 + WARD_HX) / 2; // 13.5
    B.box(xc, CURTAIN_H / 2, GATE_Z0 + 0.6, w, CURTAIN_H, 1.2);
    aabb(xc, CURTAIN_H / 2, GATE_Z0 + 0.6, w, CURTAIN_H, 1.2);
  }

  // over-passage gatehouse block (above the vault) — the mass spanning the two
  // towers; solid, no collider (overhead). Now full tower height so the centre
  // reads as one great gate-mass rather than a gap between two towers.
  B.box(0, (5.4 + TOWER_H) / 2, gzc, 2 * PASS_HX, TOWER_H - 5.4, gd, 2.0);
  // a projecting MACHICOLATION gallery oversailing the gate on the ward face —
  // the box with murder-holes above the arch, the single most castle-legible
  // detail on a gatehouse. Corbelled out over the passage mouth.
  const machY = TOWER_H - 2.2;
  B.box(0, machY, GATE_Z0 - 0.55, 2 * PASS_HX + 0.6, 1.4, 1.1);           // gallery mass
  for (let x = -PASS_HX; x <= PASS_HX + 1e-3; x += 1.0)                    // corbel teeth beneath
    B.box(x, machY - 1.0, GATE_Z0 - 0.75, 0.45, 0.6, 0.7);
  battlementRect(B, -PASS_HX - 0.3, PASS_HX + 0.3, GATE_Z0 - 1.05, GATE_Z0 - 0.05, machY + 0.7, 0.6, 0.8, 0.5);
  // battlemented parapet over the passage roof
  battlementRect(B, -PASS_HX, PASS_HX, GATE_Z0 + 0.4, GATE_Z1 - 0.4, TOWER_H + 0.02, 0.7, 0.85, 0.6);
  // a great pointed gate ARCH cut on the ward face (stone voussoir head over the
  // passage mouth), framing the dark entry the player walks toward from the ward
  const AN = 12, aspan = PASS_HX, aspring = 5.0, aface = GATE_Z0 - 0.02;
  for (let i = 0; i < AN; i++) {
    const x = -aspan + (2 * aspan) * (i + 0.5) / AN;
    const cc = x >= 0 ? -aspan + 0.1 : aspan - 0.1;
    const top = aspring + Math.sqrt(Math.max(0, (aspan * 1.15) ** 2 - (x - cc) ** 2));
    const yb = aspring - 0.3, h = top - yb;
    if (h <= 0.02) continue;
    B.box(x, (yb + top) / 2, aface, (2 * aspan / AN) * 1.03, h, 0.4);
  }

  // vaulted gate PASSAGE ceiling (barrel over x[-3,3], spring y3.5 → crown y5)
  const NV = 8;
  for (let i = 0; i < NV; i++) {
    const t0 = Math.PI * i / NV, t1 = Math.PI * (i + 1) / NV;
    const p = (t) => [PASS_HX * Math.cos(t), 3.5 + 1.5 * Math.sin(t)];
    const [xa, ya] = p(t0), [xb, yb] = p(t1);
    B.quad([xa, ya, GATE_Z0], [xb, yb, GATE_Z0], [xb, yb, GATE_Z1], [xa, ya, GATE_Z1], 1, gd / 2);
  }

  B.build(root, M.stone, 'appr_gatehouse_stone');
  S.build(root, M.slate, 'appr_gatehouse_caps');
  D.build(root, M.darkStone, 'appr_gatehouse_loops');
  I.build(root, M.iron, 'appr_gatehouse_iron');
  V.build(root, M.ivy, 'appr_gatehouse_moss');

  // dropped iron PORTCULLIS at z57 (grid across x[-3,3], y[0,5]) ------------
  const P = new MeshBatch();
  for (let x = -PASS_HX; x <= PASS_HX + 0.01; x += 0.5) P.box(x, 2.5, PORT_Z, 0.07, 5.0, 0.07);
  for (let y = 0.3; y <= 5.0; y += 0.7) P.box(0, y, PORT_Z, 2 * PASS_HX, 0.07, 0.07);
  P.build(root, M.iron, 'appr_portcullis');
  aabb(0, 2.5, PORT_Z, 2 * PASS_HX + 0.2, 5.0, 0.2);

  // shut timber outer GATE at z58 (two leaves) — blocks the exit ------------
  const T = new MeshBatch();
  const pw = (2 * PASS_HX) / 6;
  for (let i = 0; i < 6; i++) {
    const x = -PASS_HX + pw * (i + 0.5);
    T.box(x, 2.75, GATE_CLOSE_Z, pw - 0.03, 5.5, 0.16);
  }
  for (const y of [1.0, 4.5]) T.box(0, y, GATE_CLOSE_Z - 0.09, 2 * PASS_HX, 0.28, 0.12); // braces
  T.build(root, M.timber, 'appr_outer_gate');
  aabb(0, 2.75, GATE_CLOSE_Z, 2 * PASS_HX + 0.2, 5.5, 0.2);
}

// --------------------------------------------------------------- FLOORS
// Cobbled ward + gate passage, one continuous y=0 surface abutting the nave
// door at z=15. Two registered walkable planes (interaction raycasts them for
// eye height); a floor-follow player glides seamlessly nave → ward → passage.
function buildFloors(root, M) {
  // ward cobbles x[-18,18] z[15,48]
  const wardT = M.cobble.map.clone(); wardT.needsUpdate = true;
  wardT.wrapS = wardT.wrapT = THREE.RepeatWrapping;
  wardT.repeat.set((2 * WARD_HX) / 2, (WARD_Z1 - WARD_Z0) / 2);
  crunch(wardT);
  const wardMat = ps1ify(new THREE.MeshLambertMaterial({ map: wardT, side: THREE.DoubleSide }));
  const ward = new THREE.Mesh(new THREE.PlaneGeometry(2 * WARD_HX, WARD_Z1 - WARD_Z0), wardMat);
  ward.rotation.x = -Math.PI / 2;
  ward.position.set(0, 0, (WARD_Z0 + WARD_Z1) / 2);
  ward.name = 'appr_ward_floor';
  root.add(ward);
  registerFloor(ward);

  // gate passage cobbles x[-3,3] z[48,58]
  const passT = M.cobble.map.clone(); passT.needsUpdate = true;
  passT.wrapS = passT.wrapT = THREE.RepeatWrapping;
  passT.repeat.set((2 * PASS_HX) / 2, (GATE_Z1 - GATE_Z0) / 2);
  crunch(passT);
  const passMat = ps1ify(new THREE.MeshLambertMaterial({ map: passT, side: THREE.DoubleSide }));
  const pass = new THREE.Mesh(new THREE.PlaneGeometry(2 * PASS_HX, GATE_Z1 - GATE_Z0), passMat);
  pass.rotation.x = -Math.PI / 2;
  pass.position.set(0, 0.0, (GATE_Z0 + GATE_Z1) / 2);
  pass.name = 'appr_passage_floor';
  root.add(pass);
  registerFloor(pass);
}

// --------------------------------------------------------------- SKY
// Large backdrop box (BackSide) beyond the walls: cool flat overcast grey with
// a vertical gradient (#c8d0da top → #9aa4b2 horizon). Emissive MeshBasicMaterial,
// fog:false, PS1-flat. Reads as an oppressive white-grey sky above the fortress.
function buildSky(root) {
  const X = 90, Y0 = -8, Y1 = 72, Z0 = -55, Z1 = 118;
  const geo = new THREE.BoxGeometry(2 * X, Y1 - Y0, Z1 - Z0);
  geo.translate(0, (Y0 + Y1) / 2, (Z0 + Z1) / 2);
  const top = new THREE.Color(0xc8d0da), bot = new THREE.Color(0x9aa4b2);
  const pos = geo.attributes.position, col = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - Y0) / (Y1 - Y0), 0, 1);
    // bias so the gradient reads mostly at the horizon band
    tmp.copy(bot).lerp(top, Math.pow(t, 0.7));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  ps1ify(mat);
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'appr_sky';
  sky.renderOrder = -1;
  root.add(sky);
  return sky;
}

// --------------------------------------------------------------- DAYLIGHT
// Cool overcast DAYLIGHT — the exterior is the brightest place in the game.
// A HemisphereLight (flat overcast) + a soft low cool directional fill (diffuse,
// no harsh sun). Gated to the exterior by camera.z so the candlelit interiors
// stay dark (the contrast is the point). addLight tracks both.
function buildDaylight(world) {
  const hemi = new THREE.HemisphereLight(0xc9d2dc, 0x3a3f47, 0.0); // ramped by the swap
  hemi.position.set(0, 40, 30);
  hemi.name = 'appr_daylight_hemi';
  addLight(hemi);

  const dir = new THREE.DirectionalLight(0xb8c4d4, 0.0);
  dir.position.set(-26, 30, 54);
  dir.target.position.set(0, 0, 30);
  dir.name = 'appr_daylight_dir';
  addLight(dir);
  world.scene.add(dir.target);

  return { hemi, dir, HEMI: 1.0, DIR: 0.4 };
}

// --------------------------------------------------------------- FOG + DAYLIGHT SWAP
// Per-area exterior atmosphere. When camera.z > 16 (ward / gate) lerp the scene
// fog to an overcast haze and ramp the daylight up; otherwise lerp back to the
// interior fog and dim the daylight to 0 (interior stays candlelit). Snaps on
// the first frame so a frozen exterior shot is correct immediately (mirrors the
// crypt fog-swap in atmosphere/undercroft-atmo.js).
const FOG_EXT = { near: 12, far: 84, color: new THREE.Color(0xaeb6c2) };
const FOG_INT = { near: 7, far: 46, color: new THREE.Color(0x0c0f16) };

function buildFogAndDaylightSwap(world, rig) {
  let seeded = false;
  onUpdate((dt) => {
    const cam = world.camera;
    if (!cam) return;
    const ext = cam.position.z > EXT_Z;
    const a = seeded ? 1 - Math.pow(0.02, dt) : 1; // exp smoothing; snap first frame
    seeded = true;

    // daylight
    rig.hemi.intensity += ((ext ? rig.HEMI : 0.0) - rig.hemi.intensity) * a;
    rig.dir.intensity += ((ext ? rig.DIR : 0.0) - rig.dir.intensity) * a;

    // fog — only drive it OUTDOORS. Indoors, the atmosphere/undercroft swap owns
    // the fog (incl. the crypt's damp fog), so don't fight it here.
    const fog = world.scene.fog;
    if (fog && ext) {
      fog.near += (FOG_EXT.near - fog.near) * a;
      fog.far += (FOG_EXT.far - fog.far) * a;
      fog.color.lerp(FOG_EXT.color, a);
    }
  });
}
