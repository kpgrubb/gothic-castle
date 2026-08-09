import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE HARBOUR & THE BRANDTURM  (world-bible §2/§3 · §7.4 · castle-atlas rows
// #29 Harbour Mole & Quays [Gen 3 Mechthild], #30 Harbour Stair, #31 The
// Brandturm / lighthouse [Gen 4 Albrecht II — "far-mole light, brazier STILL
// LIT"; the keeper Old Mattheus Krug]).
//
// Mechthild the Regent out-built every man of her line in stone that faces the
// water: the mole, the quays, the harbour stair (§ character table row 3 —
// "engineering, not display"). Albrecht II raised the Brandturm on the far mole
// head and turned the house toward trade. The scout descends from the castle
// headland to a cold grey sea, a working harbour gone silent: boats that could
// not leave still at their moorings, a body or two on the quay, and — the one
// warm light in the whole grey world — the lighthouse brazier still burning
// across the water. Krug's last log records he stopped carrying fuel up eight
// days before he died, and that the fire did not care (§7.4).
//
// Self-contained island build centred on C = (280, 0, 0). Quay/mole deck at
// y=0; the sea surface heaves just below at y≈-0.4 and runs east to a fogged
// horizon. This file builds its OWN sky + overcast daylight + sea (the global
// weather system owns rain and the circling birds — not built here). It makes
// geometry + colliders + walkable floors + its own lights/fog + examinables,
// registers its own zone, and returns { root, entry:{x,y,z,yaw} }. It edits and
// imports NO other area file.
//
// TRAVERSAL: the Brandturm is CLIMBABLE by the exact Nordturm technique — a
// single continuous invisible smooth HELICAL RAMP (visible=false, raycastable)
// registerFloor'd under merged visible treads, so floor-follow glides up from
// the base (y0) to the lantern floor (y17). The harbour stair uses the same
// invisible-ramp-under-treads trick to descend the arrival landing onto the
// quay. Determinism: NO Math.random / Date.now (they THROW) — a seeded LCG
// drives every speckle; all motion is driven by world.elapsed / dt.
// ===========================================================================

// --- island frame (metres) --------------------------------------------------
const CX = 280, CZ = 0;          // island centre
const DECK_Y = 0.0;              // quay + mole walking deck
const SEA_Y = -0.4;              // still sea surface (heaves ±)

// quay apron (landward broad deck), mole (straight pier east), head plaza
const AX0 = 214, AX1 = 252, AZ0 = -30, AZ1 = 30;   // apron x[214,252] z[-30,30]
const MX0 = 252, MX1 = 328, MZ0 = -7, MZ1 = 7;     // mole x[252,328] z[-7,7]
const HX0 = 306, HX1 = 332, HZ0 = -11, HZ1 = 11;   // head plaza x[306,332] z[-11,11]

// arrival: a raised landing at the west (toward the castle headland) + a stair
// descending east onto the apron. The scout comes down from the castle here.
const LAND_Y = 2.6;                                // landing deck height
const LAND_X0 = 205, LAND_X1 = 214, LAND_Z0 = -5, LAND_Z1 = 5;
const STAIR_X0 = 214, STAIR_X1 = 222;              // stair run (down to the apron)

// the Brandturm (lighthouse) on the mole head
const BX = 320, BZ = 0;          // tower centre
const R_OUT = 3.8, WT = 0.7;     // outer radius, wall thickness
const R_IN = R_OUT - WT;         // interior radius 3.1
const R_MID = (R_OUT + R_IN) / 2;
const BASE_Y = 0.0;              // tower base floor (flush with the head deck)
const LANT_Y = 17.0;            // lantern floor
const WALL_TOP = 21.5;          // top of the (invisible) containment ring
const DOOR_A = Math.PI;          // door faces -X (landward, toward the mole)
const DOOR_HA = 0.30;            // door half-angle (~2.1 m opening at R_MID)
const DOOR_Y1 = 2.4;             // door head

// the sea plane (visual only — extends far east toward the horizon)
const SEA_CX = 440, SEA_W = 560, SEA_D = 440;      // x[160,720] z[-220,220]

// region gate: the harbour lights + sea fog only engage when the camera is out
// here (keeps the candlelit castle interiors dark, mirrors approach's swap).
const REGION_X = 200;

// ---------------------------------------------------------------------------
// Seeded LCG — stable speckle textures + prop jitter. Runs in the browser;
// node --check only parses. NEVER Math.random / Date.now (they THROW here).
// ---------------------------------------------------------------------------
let _seed = 0x9e37b1 >>> 0;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
const D2R = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// MeshBatch — accumulate axis boxes / quads / Y-rotated boxes, emit ONE merged
// mesh per material (crisp PS1 flat shading; each face carries its own verts).
// ---------------------------------------------------------------------------
class MeshBatch {
  constructor() { this.pos = []; this.uv = []; }
  quad(a, b, c, d, uvw = 1, uvh = 1) {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    this.uv.push(0, 0, uvw, 0, uvw, uvh, 0, 0, uvw, uvh, 0, uvh);
  }
  tri(a, b, c) { this.pos.push(...a, ...b, ...c); this.uv.push(0, 0, 1, 0, 0.5, 1); }
  box(cx, cy, cz, w, h, d, tile = 2.0) {
    const s = 1 / tile;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], w * s, h * s);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], w * s, h * s);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], d * s, h * s);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], d * s, h * s);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], w * s, d * s);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], w * s, d * s);
  }
  // a Y-rotated box (for angled hull planks, canted wreck timbers, the crane arm)
  rbox(cx, cy, cz, w, h, d, ry) {
    const hx = w / 2, hy = h / 2, hz = d / 2, c = Math.cos(ry), s = Math.sin(ry);
    const L = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
    const v = L.map(([x, y, z]) => [cx + x * c + z * s, cy + y, cz - x * s + z * c]);
    const q = (a, b, cc, e) => { this.pos.push(...v[a], ...v[b], ...v[cc], ...v[a], ...v[cc], ...v[e]);
      this.uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
    q(1, 2, 3, 0); q(4, 7, 6, 5); q(0, 4, 5, 1); q(3, 2, 6, 7); q(0, 3, 7, 4); q(1, 5, 6, 2);
  }
  build(root, mat, name) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.name = name; root.add(m); return m;
  }
}

// world-space AABB collider from centre + size
function aabb(cx, cy, cz, w, h, d) {
  return registerCollider(new THREE.Box3(
    new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2),
    new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2),
  ));
}

// ---------------------------------------------------------------------------
// textures — tiny, crunch'd, cold salt-stained greys
// ---------------------------------------------------------------------------
function speckle(base, specks, size = 64, mortar) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  if (mortar) {
    g.strokeStyle = mortar; g.lineWidth = 1;
    for (let y = 0; y < size; y += size / 4) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5); g.stroke(); }
    for (let x = 0; x < size; x += size / 4) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, size); g.stroke(); }
  }
  for (let i = 0; i < 200; i++) {
    g.fillStyle = specks[(rnd() * specks.length) | 0];
    g.fillRect((rnd() * size) | 0, (rnd() * size) | 0, 1 + ((rnd() * 2) | 0), 1 + ((rnd() * 2) | 0));
  }
  const t = new THREE.CanvasTexture(c); crunch(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// dithered slate for the sea — two cold tones, faint horizontal swell banding
function seaTex() {
  const size = 64, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#3b4650'; g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 4) { g.fillStyle = (y & 8) ? '#354049' : '#414d58'; g.fillRect(0, y, size, 2); }
  for (let i = 0; i < 160; i++) { g.fillStyle = rnd() < 0.5 ? '#2f3a43' : '#48545f'; g.fillRect((rnd() * size) | 0, (rnd() * size) | 0, 1, 1); }
  const t = new THREE.CanvasTexture(c); crunch(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function makeMaterials() {
  const stone = new THREE.MeshLambertMaterial({ map: speckle('#5c636b', ['#4f565e', '#68707a', '#464c54'], 64, '#414750'), side: THREE.DoubleSide });
  const stoneWet = new THREE.MeshLambertMaterial({ map: speckle('#464e54', ['#3a4147', '#535d64', '#333a40'], 64, '#2f353b'), side: THREE.DoubleSide });
  const darkStone = new THREE.MeshLambertMaterial({ map: speckle('#20262c', ['#181d22', '#2a323a'], 32), side: THREE.DoubleSide });
  const rock = new THREE.MeshLambertMaterial({ map: speckle('#3d4348', ['#31363b', '#4a5157', '#282c30'], 64), side: THREE.DoubleSide });
  const slate = new THREE.MeshLambertMaterial({ map: speckle('#39434f', ['#2f3a46', '#45505e'], 64), side: THREE.DoubleSide });
  const timber = new THREE.MeshLambertMaterial({ map: speckle('#463b2e', ['#3a3025', '#524634', '#2c241b'], 64), side: THREE.DoubleSide });
  const tar = new THREE.MeshLambertMaterial({ map: speckle('#2b2823', ['#211f1b', '#38342c'], 32), side: THREE.DoubleSide });
  const iron = new THREE.MeshLambertMaterial({ map: speckle('#2b2e34', ['#23262b', '#3a3f47'], 32), side: THREE.DoubleSide });
  const rope = new THREE.MeshLambertMaterial({ map: speckle('#7c6f52', ['#6a5e44', '#8a7c5c'], 32), side: THREE.DoubleSide });
  const cloth = new THREE.MeshLambertMaterial({ map: speckle('#8b8577', ['#79746a', '#9a948a', '#6a655c'], 64), side: THREE.DoubleSide });
  const lime = new THREE.MeshLambertMaterial({ map: speckle('#b9bcbe', ['#a9adb0', '#cbcecf'], 32), side: THREE.DoubleSide });
  const flesh = new THREE.MeshLambertMaterial({ map: speckle('#6a5c50', ['#584b41', '#786a5c'], 32), side: THREE.DoubleSide });
  const bone = new THREE.MeshLambertMaterial({ color: 0x9a927f, side: THREE.DoubleSide });
  const black = new THREE.MeshLambertMaterial({ color: 0x181410, side: THREE.DoubleSide }); // blackened extremities
  const stain = new THREE.MeshLambertMaterial({ color: 0x231d18, transparent: true, opacity: 0.72, side: THREE.DoubleSide });

  const seaMat = new THREE.MeshLambertMaterial({ map: seaTex(), color: 0x3b4650, side: THREE.DoubleSide });
  // brazier fire — self-lit warm emissive; the one warm surface in the grey world
  const fire = new THREE.MeshBasicMaterial({ color: 0xffb257, fog: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff7b2e, fog: false, side: THREE.DoubleSide });
  const rampHidden = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });

  for (const m of [stone, stoneWet, darkStone, rock, slate, timber, tar, iron, rope, cloth, lime, flesh, bone, black, seaMat, fire, ember]) ps1ify(m);
  return { stone, stoneWet, darkStone, rock, slate, timber, tar, iron, rope, cloth, lime, flesh, bone, black, stain, seaMat, fire, ember, rampHidden };
}

// ===========================================================================
export function buildHarbour(world) {
  const root = new THREE.Group();
  root.name = 'harbour_root';
  if (world.scene) world.scene.add(root);

  const M = makeMaterials();
  const cols = { n: 0 };

  buildSky(root, world);
  buildSea(world, root, M);
  buildDaylight(world);
  buildFog(world);

  buildDeck(root, M, cols);
  buildStair(root, M, cols);
  buildDressing(root, M, cols);
  buildBoats(root, M, cols);
  buildLighthouse(world, root, M, cols);
  buildPlagueGrammar(root, M);
  buildExaminables(world, root);

  // zone — generous, covers the whole walkable footprint AND the tower height
  if (typeof world.registerZone === 'function') {
    world.registerZone({ name: 'The Harbour', min: [205, -2, -32], max: [333, 24, 32] });
  }

  // ENTRY: on the arrival landing, facing +X (yaw=PI/2) out over the descending
  // stair — the quay, the moored/wrecked boats, the mole, and the Brandturm at
  // the far head, its brazier lit. The reveal lands the moment the player spawns.
  const entry = { x: 210, y: LAND_Y + 1.7, z: 0, yaw: Math.PI / 2 };
  return { root, entry };
}

// --------------------------------------------------------------------- SKY
// Large cool overcast gradient box (BackSide, fog:false, PS1-flat) wrapping the
// island and the sea out to the horizon. Grey, indifferent, oppressive.
function buildSky(root, world) {
  // A CAMERA-FOLLOWING gradient box: it stays centred on the player in XZ (Y
  // fixed so the horizon stays put), sized to fit inside the camera far plane
  // (220). The sea fog greys the water out well within it, so its finite extent
  // never shows. Following also stops it bleeding into other far-off islands.
  const HX = 140, Y0 = -40, Y1 = 85;
  const geo = new THREE.BoxGeometry(2 * HX, Y1 - Y0, 2 * HX);
  geo.translate(0, (Y0 + Y1) / 2, 0);
  const top = new THREE.Color(0xb4bcc6), bot = new THREE.Color(0x8c96a4);
  const pos = geo.attributes.position, col = [], tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - Y0) / (Y1 - Y0), 0, 1);
    tmp.copy(bot).lerp(top, Math.pow(t, 0.7));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  ps1ify(mat);
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'har_sky'; sky.renderOrder = -1; sky.frustumCulled = false;
  root.add(sky);
  // Only follow + show while the player is actually in the harbour (x>REGION_X);
  // otherwise a camera-following sky would fill every other area with grey.
  onUpdate(() => {
    const c = world.camera; if (!c) return;
    const here = c.position.x > REGION_X;
    sky.visible = here;
    if (here) { sky.position.x = c.position.x; sky.position.z = c.position.z; }
  });
}

// --------------------------------------------------------------------- SEA
// A large cold slate plane heaving gently (vertex bob driven by world.elapsed),
// fogging into the grey horizon so it never just cuts off. Visual only — NOT a
// walkable floor and NOT collided; edge barriers on the deck keep the player off.
function buildSea(world, root, M) {
  const NX = 44, NZ = 34;
  const geo = new THREE.PlaneGeometry(SEA_W, SEA_D, NX, NZ);
  const seaTexTile = M.seaMat.map; seaTexTile.repeat.set(SEA_W / 6, SEA_D / 6);
  const mesh = new THREE.Mesh(geo, M.seaMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(SEA_CX, SEA_Y, CZ);
  mesh.name = 'har_sea';
  root.add(mesh);

  // precompute each vertex's world XZ (plane local x -> world x, local y -> -z)
  const p = geo.attributes.position;
  const wx = new Float32Array(p.count), wz = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { wx[i] = p.getX(i) + SEA_CX; wz[i] = -p.getY(i) + CZ; }

  onUpdate((dt, t) => {
    const tt = (typeof world.elapsed === 'number') ? world.elapsed : t;
    for (let i = 0; i < p.count; i++) {
      // two crossed slow swells + a faster ripple — cold, heaving, indifferent
      const bob = Math.sin(wx[i] * 0.05 + tt * 0.65) * 0.20
                + Math.sin(wz[i] * 0.07 - tt * 0.85) * 0.13
                + Math.sin((wx[i] + wz[i]) * 0.11 + tt * 1.4) * 0.05;
      p.setZ(i, bob);        // local z -> world Y after the -90° x rotation
    }
    p.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ DAYLIGHT
// The harbour's own overcast day: a HemisphereLight + a soft low directional
// fill. Ramped up only when the camera is out in the harbour region (keeps the
// candlelit castle interiors dark; mirrors approach's camera-gated swap). Snaps
// on the first frame so a frozen shot reads correctly immediately.
function buildDaylight(world) {
  const hemi = new THREE.HemisphereLight(0xc2ccd6, 0x39414a, 0.0);
  hemi.position.set(BX, 60, 0); hemi.name = 'har_daylight_hemi'; addLight(hemi);
  const dir = new THREE.DirectionalLight(0xbcc6d4, 0.0);
  dir.position.set(360, 70, 90); dir.target.position.set(CX, 0, 0);
  dir.name = 'har_daylight_dir'; addLight(dir);
  if (world.scene) world.scene.add(dir.target);

  const HEMI = 0.92, DIR = 0.34;
  let seeded = false;
  onUpdate((dt) => {
    const cam = world.camera; if (!cam) return;
    const here = cam.position.x > REGION_X;
    const a = seeded ? 1 - Math.pow(0.02, dt) : 1; seeded = true;
    hemi.intensity += ((here ? HEMI : 0.0) - hemi.intensity) * a;
    dir.intensity += ((here ? DIR : 0.0) - dir.intensity) * a;
  });
}

// ---------------------------------------------------------------------- FOG
// When the camera is out in the harbour, lerp the shared scene fog to a cool
// grey sea haze so the water recedes into the horizon (and the lighthouse still
// reads across it). Only drives fog OUT HERE, so it never fights the castle's
// interior fog (that swap owns z<16 near the origin; the harbour is at x>200).
function buildFog(world) {
  const FAR = new THREE.Color(0xaab4c0);
  let seeded = false;
  onUpdate((dt) => {
    const cam = world.camera, fog = world.scene && world.scene.fog;
    if (!cam || !fog) return;
    if (cam.position.x <= REGION_X) return;
    const a = seeded ? 1 - Math.pow(0.02, dt) : 1; seeded = true;
    fog.near += (22 - fog.near) * a;
    fog.far += (128 - fog.far) * a;   // sea greys within the camera-following sky's ~140 reach
    fog.color.lerp(FAR, a);
  });
}

// --------------------------------------------------------------------- DECK
// The quay apron + the straight mole + the head plaza — one continuous grey
// stone deck at y=0 (three registerFloor'd planes). Edged all round the water
// with a low kerb (visual) backed by TALL invisible barrier colliders (the
// engine's collision band is absolute y∈[0.5,1.75], so a low kerb alone would
// not block — the barriers dip through that band). A line of stone bollards and
// iron mooring rings dresses the edge. Weathered, salt-stained, indifferent.
function buildDeck(root, M, cols) {
  // three flag planes (top faces up; the walkable surfaces the ray hits)
  const plane = (cx, cz, w, d, name) => {
    const t = M.stoneWet.map.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 3, d / 3); crunch(t);
    const mat = ps1ify(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, DECK_Y, cz); m.name = name;
    root.add(m); registerFloor(m); return m;
  };
  plane((AX0 + AX1) / 2, (AZ0 + AZ1) / 2, AX1 - AX0, AZ1 - AZ0, 'har_apron_floor');
  plane((MX0 + MX1) / 2, (MZ0 + MZ1) / 2, MX1 - MX0, MZ1 - MZ0, 'har_mole_floor');
  plane((HX0 + HX1) / 2, (HZ0 + HZ1) / 2, HX1 - HX0, HZ1 - HZ0, 'har_head_floor');

  // stone body under the deck (so the mole reads as a solid mass rising from the
  // sea, not a floating slab). Merged, no colliders (the edge barriers do that).
  const B = new MeshBatch();
  B.box((AX0 + AX1) / 2, -0.9, (AZ0 + AZ1) / 2, AX1 - AX0, 1.8, AZ1 - AZ0, 3);
  B.box((MX0 + MX1) / 2, -0.9, 0, MX1 - MX0, 1.8, MZ1 - MZ0, 3);
  B.box((HX0 + HX1) / 2, -0.9, 0, HX1 - HX0, 1.8, HZ1 - HZ0, 3);
  // a low kerb lip all along the seaward edges (visual only)
  const kerb = (cx, cz, w, d) => B.box(cx, 0.18, cz, w, 0.36, d, 2);
  kerb((AX0 + MX0) / 2, AZ0 + 0.15, MX0 - AX0, 0.3);         // apron south edge (partial)
  kerb((AX0 + MX0) / 2, AZ1 - 0.15, MX0 - AX0, 0.3);         // apron north edge
  kerb(AX0 + 0.15, 0, 0.3, AZ1 - AZ0);                       // apron west edge (below the landing)
  for (const sz of [MZ0 + 0.15, MZ1 - 0.15]) kerb((MX0 + MX1) / 2, sz, MX1 - MX0, 0.3);
  for (const sz of [HZ0 + 0.15, HZ1 - 0.15]) kerb((HX0 + HX1) / 2, sz, HX1 - HX0, 0.3);
  kerb(HX1 - 0.15, 0, 0.3, HZ1 - HZ0);                       // head east edge (mole tip)
  B.build(root, M.stone, 'har_deck_mass');

  // TALL invisible barrier colliders along every water edge (span the collision
  // band so they actually block). Kept a touch inboard of the visible kerb.
  const barrier = (cx, cz, w, d) => { aabb(cx, 1.0, cz, w, 1.7, d); cols.n++; };
  barrier((AX0 + MX0) / 2, AZ0 + 0.2, MX0 - AX0, 0.4);
  barrier((AX0 + MX0) / 2, AZ1 - 0.2, MX0 - AX0, 0.4);
  for (const sz of [MZ0 + 0.2, MZ1 - 0.2]) barrier((MX0 + MX1) / 2, sz, MX1 - MX0, 0.4);
  for (const sz of [HZ0 + 0.2, HZ1 - 0.2]) barrier((HX0 + HX1) / 2, sz, HX1 - HX0, 0.4);
  barrier(HX1 - 0.2, 0, 0.4, HZ1 - HZ0);                     // mole tip
  // apron WEST edge outside the stair gap (z beyond the landing) — no walking off
  barrier(AX0 + 0.2, (AZ0 + (-LAND_Z1)) / 2, 0.4, (-LAND_Z1) - AZ0);   // z[-30,-5]
  barrier(AX0 + 0.2, (LAND_Z1 + AZ1) / 2, 0.4, AZ1 - LAND_Z1);         // z[5,30]
  // apron -> mole width transition at x=MX0: seal the flanks where the deck
  // narrows from z±30 to z±7, so the player can't walk east off the apron edge
  barrier(MX0 - 0.2, (AZ0 + MZ0) / 2, 0.4, MZ0 - AZ0);                 // z[-30,-7]
  barrier(MX0 - 0.2, (MZ1 + AZ1) / 2, 0.4, AZ1 - MZ1);                 // z[7,30]

  // BOLLARDS + mooring rings marching the mole edge (stone drums, iron rings)
  const P = new MeshBatch(), I = new MeshBatch();
  const bollard = (x, z) => {
    P.box(x, 0.45, z, 0.5, 0.9, 0.5, 1.2);
    P.box(x, 0.95, z, 0.58, 0.16, 0.58, 1.2);   // rounded cap
    I.box(x, 0.62, z + 0.28, 0.06, 0.22, 0.06); // mooring ring stub
    aabb(x, 0.55, z, 0.6, 1.4, 0.6); cols.n++;
  };
  for (let x = MX0 + 5; x < MX1 - 4; x += 9) { bollard(x, MZ0 + 0.9); bollard(x, MZ1 - 0.9); }
  bollard(AX0 + 3, AZ0 + 2); bollard(AX0 + 3, AZ1 - 2);
  P.build(root, M.stone, 'har_bollards');
  I.build(root, M.iron, 'har_mooring_rings');
}

// --------------------------------------------------------------------- STAIR
// THE HARBOUR STAIR (atlas #30) — the arrival. A raised stone landing at the
// west (the foot of the descent from the castle headland) and a broad flight
// dropping east onto the apron. Climbed by the Nordturm trick: an invisible
// smooth RAMP (registerFloor'd) under merged visible treads, so the descent
// glides. Behind the landing, a blocked gothic arch = the way back up, sealed.
function buildStair(root, M, cols) {
  // landing deck (registerFloor) — the entry stands here
  const lw = LAND_X1 - LAND_X0, ld = LAND_Z1 - LAND_Z0, lcx = (LAND_X0 + LAND_X1) / 2, lcz = 0;
  const lt = M.stoneWet.map.clone(); lt.needsUpdate = true; lt.wrapS = lt.wrapT = THREE.RepeatWrapping;
  lt.repeat.set(lw / 3, ld / 3); crunch(lt);
  const landMat = ps1ify(new THREE.MeshLambertMaterial({ map: lt, side: THREE.DoubleSide }));
  const land = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), landMat);
  land.rotation.x = -Math.PI / 2; land.position.set(lcx, LAND_Y, lcz); land.name = 'har_landing_floor';
  root.add(land); registerFloor(land);

  // landing mass beneath + side cheeks (visual), and the sealed arch behind (-X)
  const B = new MeshBatch();
  B.box(lcx, LAND_Y / 2 - 0.1, lcz, lw, LAND_Y + 0.2, ld, 3);
  // blocked gothic archway in a short wall at the west edge (the castle way, shut)
  B.box(LAND_X0 - 0.4, LAND_Y + 2.0, 0, 0.8, 5.2, ld + 1.2, 2.4);              // wall block
  B.box(LAND_X0 - 0.1, LAND_Y + 1.3, 0, 0.3, 2.6, 2.2, 2);                     // sealed door infill (proud)
  B.build(root, M.stone, 'har_landing_stone');
  aabb(LAND_X0 - 0.4, LAND_Y + 2.6, 0, 0.9, 5.2, ld + 1.2); cols.n++;          // wall collider

  // (a) invisible smooth ramp from the landing (y=LAND_Y) down to the apron (y=0)
  const run = STAIR_X1 - STAIR_X0, halfZ = 2.6;
  const rampMesh = (() => {
    const N = 24, pos = [];
    let prevN = null, prevF = null;
    for (let j = 0; j <= N; j++) {
      const tx = STAIR_X0 + (j / N) * run;
      const y = LAND_Y * (1 - j / N);                 // linear glide LAND_Y -> 0
      const nz = [tx, y, -halfZ], fz = [tx, y, halfZ];
      if (prevN) pos.push(...prevN, ...prevF, ...fz, ...prevN, ...fz, ...nz);
      prevN = nz; prevF = fz;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.rampHidden); m.name = 'har_stair_ramp';
    root.add(m); registerFloor(m); return m;
  })();
  void rampMesh;

  // (b) visible chunky treads sitting on the ramp (tops flush; overlap so closed)
  const T = new MeshBatch();
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const f = (i + 0.5) / steps, tx = STAIR_X0 + f * run, yTop = LAND_Y * (1 - f);
    T.box(tx, yTop - 0.16, 0, run / steps + 0.12, 0.34, 2 * halfZ, 2);
  }
  // side cheeks flanking the flight
  for (const sz of [-halfZ - 0.25, halfZ + 0.25]) T.box((STAIR_X0 + STAIR_X1) / 2, LAND_Y / 2, sz, run, LAND_Y + 0.3, 0.4, 2);
  T.build(root, M.stone, 'har_stair_treads');
}

// ------------------------------------------------------------------- DRESSING
// The working-harbour dress: a capstan, a timber crane/derrick, crates, fish
// barrels, coils of rope, net piles. Weathered and salt-bleached. Merged per
// material; standing props get colliders, ground clutter mostly does not.
function buildDressing(root, M, cols) {
  const W = new MeshBatch();   // timber
  const R = new MeshBatch();   // rope
  const C = new MeshBatch();   // cloth / nets
  const I = new MeshBatch();   // iron
  const S = new MeshBatch();   // stone (capstan drum)

  // CAPSTAN — a stone-and-timber drum on the apron with radiating push-bars
  const capX = 236, capZ = -10;
  S.box(capX, 0.55, capZ, 1.1, 1.1, 1.1, 1.2);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    W.rbox(capX + Math.cos(a) * 1.15, 0.85, capZ + Math.sin(a) * 1.15, 1.9, 0.14, 0.14, -a);
  }
  aabb(capX, 0.7, capZ, 1.3, 1.4, 1.3); cols.n++;

  // CRANE / DERRICK — a raked timber jib over the quay edge with a hanging block
  const crX = 246, crZ = 22;
  W.box(crX, 2.3, crZ, 0.5, 4.6, 0.5, 2);                       // mast
  W.rbox(crX + 1.6, 4.0, crZ, 4.4, 0.4, 0.4, D2R(28));         // raked jib arm
  W.box(crX, 0.35, crZ, 1.3, 0.7, 1.3, 2);                      // footing block
  R.box(crX + 3.2, 2.6, crZ, 0.05, 2.4, 0.05);                 // fall rope
  I.box(crX + 3.2, 1.3, crZ, 0.22, 0.5, 0.16);                 // hook block
  aabb(crX, 2.3, crZ, 0.7, 4.6, 0.7); cols.n++;

  // CRATES + FISH BARRELS scattered along the mole (stacked, some knocked over)
  const crate = (x, y, z, s, ry) => { W.rbox(x, y, z, s, s, s, ry); aabb(x, y, z, s + 0.1, s, s + 0.1); cols.n++; };
  crate(258, 0.5, -4.6, 1.0, 0.1);
  crate(258.4, 1.45, -4.4, 0.9, 0.25);       // stacked
  crate(259.5, 0.5, 4.4, 1.1, -0.2);
  crate(276, 0.5, -4.8, 0.95, 0.15);
  crate(300, 0.5, 5.0, 1.0, 0.3);
  const barrel = (x, z, ry = 0) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.95, 10), M.timber);
    b.position.set(x, 0.48, z); b.rotation.y = ry; b.name = 'har_barrel'; root.add(b);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 6, 12), M.iron);
    h.position.set(x, 0.7, z); h.rotation.x = Math.PI / 2; root.add(h);
    aabb(x, 0.48, z, 1.0, 0.95, 1.0); cols.n++;
  };
  barrel(263, -4.9); barrel(263.9, -4.6, 0.5); barrel(288, 4.9); barrel(268, 5.0, 0.8);
  // one barrel rolled onto its side by the crates (no collider — ground clutter)
  const rolled = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10), M.timber);
  rolled.position.set(260.5, 0.42, -3.2); rolled.rotation.z = Math.PI / 2; rolled.rotation.y = 0.3;
  rolled.name = 'har_barrel_rolled'; root.add(rolled);

  // COILS OF ROPE on the deck (flat torus rings) + NET PILES (draped cloth heaps)
  const coil = (x, z) => { for (let r = 0; r < 3; r++) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.35 - r * 0.09, 0.06, 5, 12), M.rope);
    c.position.set(x, 0.06 + r * 0.05, z); c.rotation.x = Math.PI / 2; c.name = 'har_rope_coil'; root.add(c);
  } };
  coil(242, 6); coil(272, -5.4); coil(296, 5.6);
  // net piles — low draped heaps + a couple of hung panels off the crane mast
  for (const [x, z, s] of [[266, 5.2, 1.4], [284, -5.2, 1.6], [250, 8, 1.5]]) {
    C.box(x, 0.22, z, s, 0.4, s * 0.8, 2);
    C.box(x + 0.2, 0.5, z - 0.1, s * 0.7, 0.3, s * 0.5, 2);
  }
  C.quad([crX + 0.1, 3.6, crZ - 0.9], [crX + 0.1, 3.6, crZ + 0.9], [crX + 0.1, 1.2, crZ + 0.9], [crX + 0.1, 1.2, crZ - 0.9], 1, 1); // hung net

  S.build(root, M.stone, 'har_dress_stone');
  W.build(root, M.timber, 'har_dress_timber');
  R.build(root, M.rope, 'har_dress_rope');
  C.build(root, M.cloth, 'har_dress_nets');
  I.build(root, M.iron, 'har_dress_iron');
}

// --------------------------------------------------------------------- BOATS
// The boats that could not leave. One still MOORED and intact at the mole; one
// HALF-SUNK at its mooring, bow tipped up; one CAPSIZED on the rocks, keel to
// the sky. Simple planked hulls (keel, canted sides, a mast, oars). They float
// on the heaving sea but sit low and dead. Moored boat is roped to a bollard.
function buildBoats(root, M, cols) {
  const H = new MeshBatch();   // hull planking (timber)
  const K = new MeshBatch();   // tarred keel / dark timber
  const Rk = new MeshBatch();  // rocks (for the wreck)
  const Rp = new MeshBatch();  // rope

  // a simple hull: keel box + two canted side strakes + transom, at (cx,cy,cz),
  // heading `ry`, length len, beam beam, with an optional list roll via canting.
  function hull(cx, cy, cz, len, beam, ry, sideCant) {
    K.rbox(cx, cy - 0.15, cz, len, 0.3, beam * 0.5, ry);                       // keel/bottom
    // port + starboard strakes, leaning outboard
    const c = Math.cos(ry + Math.PI / 2), s = Math.sin(ry + Math.PI / 2);
    for (const side of [-1, 1]) {
      const ox = Math.cos(ry + Math.PI / 2) * side * beam * 0.42;
      const oz = -Math.sin(ry + Math.PI / 2) * side * beam * 0.42;
      H.rbox(cx + ox, cy + 0.28, cz + oz, len * 0.96, 0.55, 0.14, ry);
    }
    void c; void s;
    // stem + stern posts
    H.rbox(cx + Math.cos(ry) * len * 0.5, cy + 0.35, cz - Math.sin(ry) * len * 0.5, 0.2, 0.7, beam * 0.5, ry);
    H.rbox(cx - Math.cos(ry) * len * 0.5, cy + 0.3, cz + Math.sin(ry) * len * 0.5, 0.2, 0.6, beam * 0.5, ry);
    void sideCant;
  }
  function mast(cx, cy, cz, h, tiltRy, tiltAng) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 6), M.timber);
    m.position.set(cx, cy + h / 2, cz);
    m.rotation.z = Math.sin(tiltRy) * tiltAng; m.rotation.x = Math.cos(tiltRy) * tiltAng;
    m.name = 'har_boat_mast'; root.add(m);
  }
  function oar(cx, cy, cz, ry) { H.rbox(cx, cy, cz, 2.2, 0.08, 0.08, ry); }

  // 1) MOORED + intact — floats level beside the mole, roped fore to a bollard
  {
    const cx = 268, cz = -13.5, cy = SEA_Y + 0.35, ry = D2R(6);
    hull(cx, cy, cz, 6.5, 2.2, ry, 0);
    mast(cx + 0.6, cy + 0.4, cz, 3.4, 0, 0.03);
    oar(cx - 1.0, cy + 0.5, cz + 1.0, ry + 0.4);
    oar(cx - 1.6, cy + 0.5, cz - 1.0, ry - 0.4);
    // mooring line up to the nearest mole bollard (MZ0 edge)
    Rp.rbox((cx + 260) / 2, cy + 0.5, (cz + (MZ0 - 0.9)) / 2, 6.0, 0.05, 0.05, D2R(58));
  }

  // 2) HALF-SUNK at its mooring — stern gone under, bow tipped up out of the water
  {
    const cx = 258, cz = 12.5, cy = SEA_Y - 0.15, ry = D2R(-14);
    hull(cx, cy, cz, 6.0, 2.1, ry, 0);
    // bow lifted: a raised stem block breaking the surface
    H.rbox(cx + 2.6, SEA_Y + 0.55, cz - 0.6, 1.4, 1.1, 1.6, ry);
    mast(cx - 0.4, SEA_Y - 0.2, cz, 3.0, Math.PI / 2, 0.5);   // mast canted low, half-drowned
    // dark flooded water inside (a low dark quad at the waterline)
    K.box(cx - 0.6, SEA_Y - 0.02, cz, 3.6, 0.05, 1.7, 2);
  }

  // 3) CAPSIZED on the rocks — keel to the sky, hove up on a black rock cluster
  {
    const rx = 302, rz = 22, ry = D2R(40);
    // rock cluster it foundered on
    for (const [dx, dy, dz, s] of [[0, 0.1, 0, 2.4], [1.6, -0.1, 0.8, 1.8], [-1.4, 0.0, -0.6, 2.0], [0.5, 0.5, -1.2, 1.3]])
      Rk.box(rx + dx, SEA_Y + dy, rz + dz, s, 1.6, s * 0.9, 2.5);
    const cx = rx, cz = rz - 0.3, cy = SEA_Y + 0.9;
    // upturned hull — the keel box on top, strakes below, whole thing rolled
    K.rbox(cx, cy + 0.55, cz, 6.2, 0.34, 1.2, ry);           // keel now uppermost
    for (const side of [-1, 1]) {
      const ox = Math.cos(ry + Math.PI / 2) * side * 0.95;
      const oz = -Math.sin(ry + Math.PI / 2) * side * 0.95;
      H.rbox(cx + ox, cy + 0.15, cz + oz, 6.0, 0.5, 0.14, ry);
    }
    // a snapped mast fallen across the rocks
    H.rbox(cx + 1.8, SEA_Y + 0.7, cz + 1.6, 3.2, 0.12, 0.12, D2R(70));
    aabb(rx, 0.4, rz, 4.6, 1.8, 3.6); cols.n++;               // the wreck+rocks block passage
  }

  H.build(root, M.timber, 'har_boats_hull');
  K.build(root, M.tar, 'har_boats_keel');
  Rk.build(root, M.rock, 'har_wreck_rocks');
  Rp.build(root, M.rope, 'har_boats_rope');
}

// ---------------------------------------------------------------- LIGHTHOUSE
// THE BRANDTURM (atlas #31) — the payoff. A tall round stone tower on the mole
// head, CLIMBABLE by the Nordturm technique: an invisible smooth helical RAMP
// (registerFloor'd) under merged visible treads winds from the base (y=0) to the
// lantern floor (y=17). Arrow-slit windows down the shaft. The lantern room is
// open to the sea, the iron BRAZIER still lit (emissive + a warm flickering
// point-light — the one warm light in the grey world). Krug's body + his last
// log at the top. An INVISIBLE tall collider ring (door gap only) encloses the
// whole tower incl. the open lantern, so the player can lean at the view but
// never fall — the engine's collision band forbids a top-only rail.
function buildLighthouse(world, root, M, cols) {
  buildTowerShell(root, M);
  buildTowerBaseFloor(root, M);
  buildTowerSpiral(root, M);
  buildLanternRoom(world, root, M);
  buildTowerColliders(cols);
}

// arrow slits down the shaft (azimuth + vertical span)
const SLITS = [
  { a: D2R(0), y0: 4.5, y1: 5.4 },     // seaward (+X)
  { a: D2R(90), y0: 7.0, y1: 7.9 },
  { a: D2R(0), y0: 10.5, y1: 11.4 },
  { a: D2R(270), y0: 8.0, y1: 8.9 },
  { a: D2R(90), y0: 13.0, y1: 13.9 },
];

function subtract(spans, [a, b]) {
  const out = [];
  for (const [s, e] of spans) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}
function angDist(a, b) { let d = Math.abs(((a - b) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; }

// One merged rubble ring (tall segments) from base to lantern floor, with the
// door and the arrow slits cut out as vertical span gaps. A batten string-course
// and a corbelled lip under the lantern break the shaft.
function buildTowerShell(root, M) {
  const NSEG = 40, segArc = (2 * Math.PI) / NSEG, segW = R_MID * segArc * 1.14;
  const B = new MeshBatch(), D = new MeshBatch();
  for (let k = 0; k < NSEG; k++) {
    const a = k * segArc;
    let spans = [[BASE_Y, LANT_Y]];
    if (angDist(a, DOOR_A) <= DOOR_HA) spans = subtract(spans, [BASE_Y - 0.01, DOOR_Y1]);
    for (const s of SLITS) if (angDist(a, s.a) <= segArc * 0.6) spans = subtract(spans, [s.y0, s.y1]);
    const cx = BX + R_MID * Math.cos(a), cz = BZ + R_MID * Math.sin(a), ry = Math.PI / 2 - a;
    for (const [y0, y1] of spans) { if (y1 - y0 < 0.02) continue; B.rbox(cx, (y0 + y1) / 2, cz, segW, y1 - y0, WT, ry); }
    // recessed dark reveal behind each slit (reads as a shadowed cut)
    for (const s of SLITS) if (angDist(a, s.a) <= segArc * 0.6) D.rbox(cx - Math.cos(a) * 0.18, (s.y0 + s.y1) / 2, cz - Math.sin(a) * 0.18, segW * 0.5, s.y1 - s.y0, 0.1, ry);
  }
  // string-courses around the shaft (rings of short proud boxes)
  for (const y of [6.0, 11.5]) for (let k = 0; k < NSEG; k++) {
    const a = k * segArc, cx = BX + (R_OUT + 0.12) * Math.cos(a), cz = BZ + (R_OUT + 0.12) * Math.sin(a);
    B.rbox(cx, y, cz, segW, 0.3, 0.24, Math.PI / 2 - a);
  }
  // corbelled oversailing lip just under the lantern floor
  for (let k = 0; k < NSEG; k++) {
    const a = k * segArc, cx = BX + (R_OUT + 0.4) * Math.cos(a), cz = BZ + (R_OUT + 0.4) * Math.sin(a);
    B.rbox(cx, LANT_Y - 0.4, cz, segW * 1.05, 0.7, 0.5, Math.PI / 2 - a);
  }
  // door jambs + lintel (landward, -X)
  const jd = DOOR_HA * R_MID;
  for (const side of [-1, 1]) {
    const ja = DOOR_A + side * DOOR_HA;
    B.rbox(BX + R_MID * Math.cos(ja), (BASE_Y + DOOR_Y1) / 2, BZ + R_MID * Math.sin(ja), 0.35, DOOR_Y1, WT + 0.1, Math.PI / 2 - ja);
  }
  B.rbox(BX + R_MID * Math.cos(DOOR_A), DOOR_Y1 + 0.25, BZ + R_MID * Math.sin(DOOR_A), 2 * jd + 0.4, 0.5, WT + 0.1, Math.PI / 2 - DOOR_A);
  B.build(root, M.stoneWet, 'har_bt_shell');
  D.build(root, M.darkStone, 'har_bt_slits');
}

// interior base flag disk (flush with the head deck at y=0), registerFloor'd
function buildTowerBaseFloor(root, M) {
  const disk = new THREE.Mesh(new THREE.CircleGeometry(R_IN, 28), M.stoneWet);
  disk.rotation.x = -Math.PI / 2; disk.position.set(BX, BASE_Y + 0.01, BZ); disk.name = 'har_bt_base_floor';
  root.add(disk); registerFloor(disk);
}

const NEWEL_R = 0.36;
const T_IN = 0.5, T_OUT = 2.9;                 // tread inner/outer radius
const TURNS = 4, A_SPAN = TURNS * 2 * Math.PI;
const A_START = DOOR_A;                          // start the climb at the door
function bt_rampY(a) { const t = Math.min(1, Math.max(0, (a - A_START) / A_SPAN)); return BASE_Y + t * (LANT_Y - BASE_Y); }

// (a) invisible helical ramp + landing, (b) merged visible treads, (c) newel.
function buildTowerSpiral(root, M) {
  // (a) ramp ribbon, sweeping the turns PLUS a flat landing clamped to LANT_Y so
  // the walkable surface bridges the last tread onto the lantern floor (no gap).
  const rIn = T_IN - 0.02, rOut = T_OUT + 0.04, A_LAND = D2R(26), A_TOT = A_SPAN + A_LAND, N = 200;
  const pos = []; let pIn = null, pOut = null;
  for (let j = 0; j <= N; j++) {
    const a = A_START + (j / N) * A_TOT, y = bt_rampY(a);
    const inn = [BX + rIn * Math.cos(a), y, BZ + rIn * Math.sin(a)];
    const out = [BX + rOut * Math.cos(a), y, BZ + rOut * Math.sin(a)];
    if (pIn) pos.push(...pIn, ...pOut, ...out, ...pIn, ...out, ...inn);
    pIn = inn; pOut = out;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const ramp = new THREE.Mesh(g, M.rampHidden); ramp.name = 'har_bt_stair_ramp';
  root.add(ramp); registerFloor(ramp);

  // (b) visible treads — merged wedges, tops flush with the ramp, overlapping
  const N_TREADS = 72, dA = A_SPAN / N_TREADS, rMid = (T_IN + T_OUT) / 2, T = new MeshBatch();
  for (let i = 0; i < N_TREADS; i++) {
    const a = A_START + (i + 0.5) * dA, yTop = bt_rampY(a);
    const cx = BX + rMid * Math.cos(a), cz = BZ + rMid * Math.sin(a);
    const tanW = rMid * dA * 1.4;
    T.rbox(cx, yTop - 0.22, cz, tanW, 0.44, T_OUT - T_IN + 0.1, Math.PI / 2 - a);
  }
  T.build(root, M.stone, 'har_bt_treads');

  // (c) central newel column
  const h = LANT_Y - BASE_Y;
  const newel = new THREE.Mesh(new THREE.CylinderGeometry(NEWEL_R, NEWEL_R + 0.06, h, 8), M.stoneWet);
  newel.position.set(BX, BASE_Y + h / 2, BZ); newel.name = 'har_bt_newel'; root.add(newel);
}

// The lantern room: a solid floor disk, a ring of stone piers open to the sea,
// a slate cap, and the still-lit brazier on a plinth (emissive + warm flicker
// point-light). Krug slumped against the landward pier with his last log.
function buildLanternRoom(world, root, M) {
  // solid floor disk (full disk for safe footing; the ramp landing merges at y17)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R_IN + 0.15, 28), M.stone);
  floor.rotation.x = -Math.PI / 2; floor.position.set(BX, LANT_Y, BZ); floor.name = 'har_bt_lantern_floor';
  root.add(floor); registerFloor(floor);

  const B = new MeshBatch(), S = new MeshBatch();
  // a low sill ring (parapet base) around the perimeter — visual; the invisible
  // collider ring does the actual containment
  const NP = 8;
  for (let k = 0; k < NP; k++) {
    const a = (k / NP) * 2 * Math.PI;
    const px = BX + (R_IN + 0.05) * Math.cos(a), pz = BZ + (R_IN + 0.05) * Math.sin(a);
    B.rbox(px, LANT_Y + 0.45, pz, 0.7, 0.9, 0.5, Math.PI / 2 - a);     // sill segment
    B.rbox(px, LANT_Y + 2.6, pz, 0.55, 3.6, 0.55, Math.PI / 2 - a);   // corner pier up to the cap
  }
  // cap ring the piers carry + a slate cone above (open lantern read)
  B.box(BX, LANT_Y + 4.5, BZ, 2 * (R_IN + 0.4), 0.4, 2 * (R_IN + 0.4), 2);
  const capBase = LANT_Y + 4.7, apex = LANT_Y + 7.6;
  const NC = 12;
  for (let i = 0; i < NC; i++) {
    const a0 = (i / NC) * 2 * Math.PI, a1 = ((i + 1) / NC) * 2 * Math.PI, r = R_IN + 0.5;
    S.tri([BX + r * Math.cos(a0), capBase, BZ + r * Math.sin(a0)], [BX + r * Math.cos(a1), capBase, BZ + r * Math.sin(a1)], [BX, apex, BZ]);
  }
  B.build(root, M.stoneWet, 'har_bt_lantern_stone');
  S.build(root, M.slate, 'har_bt_lantern_cap');

  // --- THE BRAZIER (still lit) — iron basket on a stone plinth, at centre ---
  const G = new MeshBatch();
  G.box(BX, LANT_Y + 0.4, BZ, 1.0, 0.8, 1.0, 1.5);              // stone plinth
  G.build(root, M.stone, 'har_bt_plinth');
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.42, 0.7, 8, 1, true), M.iron);
  basket.position.set(BX, LANT_Y + 1.15, BZ); basket.name = 'har_bt_brazier'; root.add(basket);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), M.iron);
    leg.position.set(BX + Math.cos(a) * 0.4, LANT_Y + 0.9, BZ + Math.sin(a) * 0.4); root.add(leg);
  }
  // fire — nested emissive cones (warm), + a hot ember core. Flicker in onUpdate.
  const flame1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 7), M.fire);
  flame1.position.set(BX, LANT_Y + 1.9, BZ); flame1.name = 'har_bt_flame'; root.add(flame1);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 6), M.ember);
  flame2.position.set(BX, LANT_Y + 1.7, BZ); root.add(flame2);
  // warm point light — the one warm light in the whole grey world (local falloff
  // so it never leaks to the castle). Gentle flicker driven by world.elapsed.
  const glow = new THREE.PointLight(0xffa24a, 3.4, 34, 1.7);
  glow.position.set(BX, LANT_Y + 2.0, BZ); glow.name = 'har_bt_brazier_light'; addLight(glow);

  onUpdate((dt, t) => {
    const tt = (typeof world.elapsed === 'number') ? world.elapsed : t;
    const fl = 1 + 0.10 * (Math.sin(tt * 8.3) * 0.6 + Math.sin(tt * 21.7) * 0.4);
    glow.intensity = 3.4 * fl;
    flame1.scale.y = fl; flame1.scale.x = 1 + (fl - 1) * 0.4;
    flame2.scale.y = 1 + (fl - 1) * 1.3;
    flame1.rotation.y = tt * 0.6; flame2.rotation.y = -tt * 0.9;
  });

  // --- KRUG — the keeper, slumped against the landward pier, and his last log ---
  // Shared low-poly corpse, seated/slumped on the lantern floor (y=17) with his
  // back to the landward pier, legs and head fallen forward toward the brazier.
  const kx = BX + (R_IN - 0.6) * Math.cos(DOOR_A), kz = BZ + (R_IN - 0.6) * Math.sin(DOOR_A);
  const krug = makeCorpse({ pose: 'slumped', cloth: 0x40382a, seed: 31 });
  krug.position.set(kx, LANT_Y, kz); krug.rotation.y = 0; krug.name = 'har_bt_krug'; root.add(krug);
  // a small dark-brown stain pooled under him on the lantern floor
  const kstain = makeStain({ r: 0.9, seed: 32 });
  kstain.position.set(kx, LANT_Y + 0.002, kz); root.add(kstain);
  // the log — a small board/book laid open on the floor by his hand (examinable anchor)
  const log = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.24), M.timber);
  log.position.set(kx + 0.35, LANT_Y + 0.03, kz + 0.28); log.name = 'har_bt_log'; root.add(log);
}

// TALL invisible containment ring (door gap only). Because the collision band is
// absolute y∈[0.5,1.75], each box must run the FULL height (base→above the cap)
// to block at every level — this single ring bounds the base, the shaft, AND the
// open lantern room (so the player leans at the sea view but cannot fall out).
function buildTowerColliders(cols) {
  const N = 24, yC = (BASE_Y + WALL_TOP) / 2, yH = WALL_TOP - BASE_Y;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * 2 * Math.PI;
    if (angDist(a, DOOR_A) <= DOOR_HA + D2R(4)) continue;      // leave the door open
    aabb(BX + R_MID * Math.cos(a), yC, BZ + R_MID * Math.sin(a), 0.85, yH, 0.85); cols.n++;
  }
  // newel
  aabb(BX, (BASE_Y + LANT_Y) / 2, BZ, 2 * NEWEL_R + 0.1, LANT_Y - BASE_Y, 2 * NEWEL_R + 0.1); cols.n++;
}

// -------------------------------------------------------------- PLAGUE GRAMMAR
// Light and canonical: a body or two on the quay (blackened extremities, a dark
// stain scrubbed at), dead flies drifted in the lee of the crates, lime dusted
// at the stair head. The sea took no one away. Everything GROUNDED on y=0.
function buildPlagueGrammar(root, M) {
  // two fallen dock-hands on the quay deck (y=0) — shared low-poly corpses,
  // weather-worn cloth, each in a generous dark-brown plague stain.
  const fallen = (cx, cz, yaw, pose, seed) => {
    const c = makeCorpse({ pose, cloth: 0x40382a, seed });
    c.position.set(cx, DECK_Y, cz); c.rotation.y = yaw; c.name = 'har_corpse'; root.add(c);
    const st = makeStain({ r: 1.3, seed: seed + 1 });
    st.position.set(cx, DECK_Y + 0.002, cz); root.add(st);
  };
  fallen(228, -6, D2R(20), 'facedown', 11);      // near the stair foot
  fallen(272, 3.5, D2R(-70), 'supine', 13);      // a second, out on the mole by the crates

  // LIME dusted at the stair head (the sea took no one away — they limed instead)
  for (const [x, z, s] of [[224, 3, 1.4], [226, -2, 1.1], [222, 0.5, 0.9]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.8), M.lime);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.02, z); root.add(p);
  }

  // DEAD FLIES drifted into the lee of the crates — a thin dark scatter
  const flies = new MeshBatch();
  for (let i = 0; i < 40; i++) {
    const x = 258 + (rnd() - 0.5) * 4, z = -3.4 + (rnd() - 0.5) * 2.2;
    flies.box(x, 0.03, z, 0.05, 0.02, 0.05, 1);
  }
  flies.build(root, M.black, 'har_dead_flies');
}

// --------------------------------------------------------------- EXAMINABLES
// Scout's plain register (§10): he describes what he sees, never the meaning.
// Three beats — the lit brazier, the boats that stayed, and Krug.
function registerProp(world, root, name, x, y, z, radius, label, more) {
  const anchor = new THREE.Object3D(); anchor.name = name; anchor.position.set(x, y, z);
  root.add(anchor);
  registerInteractable({
    object: anchor, radius, label,
    onExamine: () => { const latch = world.flags && world.flags.__examineLatch; if (typeof latch === 'function') latch(more); },
  });
}

function buildExaminables(world, root) {
  // 1) THE BRAZIER — the one warm light. Canon §7.4: burns without fuel, no heat.
  registerProp(world, root, 'har_ix_brazier', BX, LANT_Y + 1.6, BZ, 3.0,
    'The brazier is burning. A fire stands up in the iron basket, warm and steady, throwing the only colour for a mile — everything else out here is grey water and grey stone. It is the light a ship would steer by.',
    'There is no wood in the basket, and no ash under it. The iron is cold to within a hand of the flames. Whatever this fire is eating, it is not fuel, and it gives out no heat at all. It has plainly been burning a long time, and looks in no hurry to stop.');

  // 2) THE BOATS THAT STAYED
  registerProp(world, root, 'har_ix_boats', 268, 1.2, -13.0, 5.0,
    'Boats still at their moorings. One rides level and whole, lines fast to the bollard. One has gone down by the stern where it sat, only the bow still up. One is over on the rocks with its keel to the sky.',
    'Not one of them was taken out. The oars are shipped, the nets stowed, the lines made fast as if for a night that never ended. A working harbour does not leave its boats like this unless the men who crewed them did not come back down to the water.');

  // 3) KRUG — the keeper
  registerProp(world, root, 'har_ix_krug', BX + (R_IN - 0.6) * Math.cos(DOOR_A), LANT_Y + 0.6, BZ + (R_IN - 0.6) * Math.sin(DOOR_A), 2.4,
    'A man is sitting against the pier by the light, gone a long while. His hands have blackened to the wrist, the same as the rest. A board lies open by his hand, written on to the last line.',
    'The log keeps a keeper\'s plain account, and then it stops. The last entry says he had carried no fuel up for eight days, and that the fire did not care whether he did or not. He wrote it in a steady hand. Then he seems to have sat down by the flames and stayed.');
}
