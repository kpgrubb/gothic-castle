import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE ORDINAL  (atlas #16 — Gen 7, the devil ASTAROTH; world-bible §5.2/§7.2
// diabolical works. "Seven concentric rings of brick in a vaulted chamber, no
// opening into the innermost. The bricklaying is flawless. Whatever the centre
// is for, it was walled in from the outside.")
//
// A low, vaulted brick chamber whose floor is SEVEN nested circular brick walls,
// each higher and tighter toward the middle so the eye is funnelled inward. The
// player enters by the one doorway in the outer wall and can walk the ~1.5 m
// annular gap between ring and ring, circling inward and inward — but every ring
// is unbroken. There is no gate, no jamb, no course left out. The centremost is
// a sealed brick drum you cannot enter or see into. The work is superbly made
// and serves no use a man can name. §7.2: the horror is the quality.
//
// Self-contained island centred C = (-160, 0, 0), well clear of the others.
// Floor at y = 0. Builds its own geometry (merged / instanced per material),
// ring colliders, a walkable disk floor, and its OWN local lighting (no global
// ambient — the great hall's tuning is untouched). §8 plague grammar is applied
// LIGHTLY: dead flies banked in the outer gaps, lime at the threshold, and one
// man who sat down against a ring and did not get up. Every object is prefixed
// `ord_`. buildOrdinal(world) returns { root, entry }; the integrator wires the
// portal. DETERMINISM: no Math.random / Date.now — a seeded LCG drives scatter.
// ===========================================================================

// --- Island frame (metres) -------------------------------------------------
const CX = -160, CZ = 0;                  // island centre
const HALF = 14.8;                        // chamber interior half-extent -> 29.6²
const X0 = CX - HALF, X1 = CX + HALF;     // interior x faces  [-174.8, -145.2]
const Z0 = CZ - HALF, Z1 = CZ + HALF;     // interior z faces  [-14.8, 14.8]
const T = 0.5;                            // outer wall thickness
const WALL_H = 5.0;                        // outer chamber wall height

// --- The seven rings -------------------------------------------------------
// radius (centreline) and height. Outer low & wide, inner tall & tight, so the
// chamber funnels toward the sealed drum. Ring 6 (r = 1.2) is the SEALED CENTRE.
const RINGS = [
  { r: 13.0, h: 1.2 },
  { r: 11.0, h: 1.5 },
  { r: 9.0, h: 1.8 },
  { r: 7.0, h: 2.1 },
  { r: 5.0, h: 2.4 },
  { r: 3.0, h: 2.7 },
];
const DRUM_R = 1.2, DRUM_H = 3.0;          // sealed centre drum

// --- The one doorway, in the -Z (south) outer wall --------------------------
const DOOR_CX = CX, DOOR_W = 1.8, DOOR_H = 2.6;
const DOOR_X0 = DOOR_CX - DOOR_W / 2, DOOR_X1 = DOOR_CX + DOOR_W / 2;

// --- Entry: just inside the doorway, in the outer gap, facing +Z inward ------
// (yaw 0 => the camera looks toward +Z, i.e. toward the rings and the centre.)
export const ORDINAL_ENTRY = { x: CX, y: 1.7, z: -14.0, yaw: 0 };

// ---------------------------------------------------------------------------
// Seeded LCG so all scatter (flies, lime, brick speckle) is stable across loads.
// ---------------------------------------------------------------------------
let _seed = 0x0ad1a17;
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
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
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

// A flat, floor-hugging quad (stains) lying in the XZ plane.
function flatQuad(root, mat, x, y, z, w, d, name, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.position.set(x, y, z);
  p.rotation.set(-Math.PI / 2, 0, ry);
  p.name = name;
  root.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Tiny canvas texture — cold running-bond brick, crunched to PS1 nearest.
// (Runs in the browser; node --check only parses this file.)  64px, <=128.
// ---------------------------------------------------------------------------
function brickTex(base, brick, mortar) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, 64, 64);
  const rows = 8, bh = 64 / rows;              // eight courses
  for (let ry = 0; ry < rows; ry++) {
    const y = ry * bh;
    const off = (ry % 2) ? -8 : 0;             // running bond: alternate offset
    for (let bx = off; bx < 64; bx += 16) {
      g.fillStyle = (rnd() < 0.5) ? brick : base;
      g.fillRect(bx + 1, y + 1, 16 - 2, bh - 2);
    }
  }
  // gritty speckle over the whole thing (cold, damp brick)
  for (let i = 0; i < 240; i++) {
    const x = Math.floor(rr(0, 64)), y = Math.floor(rr(0, 64));
    g.fillStyle = (rnd() < 0.5) ? mortar : base;
    g.globalAlpha = rr(0.12, 0.4);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return crunch(tex);
}

function makeMaterials() {
  const wallTex = brickTex('#5a4e46', '#655750', '#39322d'); wallTex.repeat.set(6, 2);
  const ringTex = brickTex('#564b44', '#61554e', '#342d29'); ringTex.repeat.set(10, 1);
  const floorTex = brickTex('#443c37', '#4c433d', '#2c2620'); floorTex.repeat.set(10, 10);

  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));

  return {
    wall: lambert({ color: 0x6a5e55, map: wallTex }),
    ring: lambert({ color: 0x655a52, map: ringTex, side: THREE.DoubleSide }),
    ringCap: lambert({ color: 0x574d46, map: ringTex }),
    drum: lambert({ color: 0x4f453f, map: ringTex }),
    floor: lambert({ color: 0x51483f, map: floorTex }),
    vault: lambert({ color: 0x3a332e, map: wallTex, side: THREE.BackSide }),
    rib: lambert({ color: 0x2e2823 }),
    dark: lambert({ color: 0x181512 }),            // the doorway reveal / grate frame
    grate: lambert({ color: 0x2a2622 }),           // iron grate bars in the vault
    flesh: lambert({ color: 0x8a7f6d }),           // the man who sat down
    garb: lambert({ color: 0x2f2b26 }),            // his clothing, dark
    black: lambert({ color: 0x14100e }),           // blackened extremities
    fly: lambert({ color: 0x17140f }),             // drifts of dead flies
    lime: lambert({ color: 0xc9c4b6 }),            // scattered lime
    stain: basic({ color: 0x1c1714, side: THREE.DoubleSide }),
    scrub: basic({ color: 0x50493f, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    shaft: basic({ color: 0x9fb0c2, transparent: true, opacity: 0.14, fog: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildOrdinal(world) {
  const root = new THREE.Group();
  root.name = 'ord_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildFloor(root, M);
  buildOuterWalls(root, M);
  buildRings(root, M);
  buildVault(root, M);
  buildBody(root, M);
  buildAmbientGrammar(root, M);
  buildLighting();
  buildExaminables(world);

  if (world.registerZone) {
    world.registerZone({ name: 'The Ordinal', min: [-176, -1, -16], max: [-144, 6, 16] });
  }

  return { root, entry: ORDINAL_ENTRY };
}

// -------------------------------------------------------------------- floor
// The whole chamber floor is one walkable brick disk at y = 0. The rings stand
// ON it; the player walks the annular gaps between them.
function buildFloor(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), M.floor);
  floor.name = 'ord_floor';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);

  // a worn brick sill under the one doorway
  addBox(root, M.ringCap, DOOR_CX, 0.02, Z0 - 0.35, DOOR_W + 0.3, 0.06, 0.5, 'ord_sill', false);
}

// --------------------------------------------------------------- outer walls
// A square brick chamber with a SINGLE doorway in the -Z wall. Solid on the
// other three sides. The rings live inside it.
function buildOuterWalls(root, M) {
  const yc = WALL_H / 2;
  // +Z, +X, -X: solid brick
  addBox(root, M.wall, CX, yc, Z1 + T / 2, 2 * HALF + 2 * T, WALL_H, T, 'ord_wall_pz', true);
  addBox(root, M.wall, X1 + T / 2, yc, CZ, T, WALL_H, 2 * HALF + 2 * T, 'ord_wall_px', true);
  addBox(root, M.wall, X0 - T / 2, yc, CZ, T, WALL_H, 2 * HALF + 2 * T, 'ord_wall_nx', true);

  // -Z wall (z = Z0): split around the one doorway
  const leftW = DOOR_X0 - (X0 - T);
  addBox(root, M.wall, ((X0 - T) + DOOR_X0) / 2, yc, Z0 - T / 2, leftW, WALL_H, T, 'ord_wall_nz_l', true);
  const rightW = (X1 + T) - DOOR_X1;
  addBox(root, M.wall, (DOOR_X1 + (X1 + T)) / 2, yc, Z0 - T / 2, rightW, WALL_H, T, 'ord_wall_nz_r', true);
  // lintel over the door (above the collision band — visual only)
  addBox(root, M.wall, DOOR_CX, (DOOR_H + WALL_H) / 2, Z0 - T / 2, DOOR_W + 0.1, WALL_H - DOOR_H, T, 'ord_wall_nz_lintel', false);
  // dark reveals in the jambs
  addBox(root, M.dark, DOOR_X0 - 0.05, DOOR_H / 2, Z0 - 0.02, 0.12, DOOR_H, T, 'ord_door_jamb_l', false);
  addBox(root, M.dark, DOOR_X1 + 0.05, DOOR_H / 2, Z0 - 0.02, 0.12, DOOR_H, T, 'ord_door_jamb_r', false);
}

// --------------------------------------------------------------------- rings
// Seven concentric brick walls. Each of the six outer rings is a faceted brick
// cylinder shell (double-sided) with a flat brick top cap giving it thickness;
// the seventh is a SOLID sealed drum. UNBROKEN: no gap, no jamb, no opening.
// Colliders: a close ring of square AABB posts stepped around each circle —
// spacing < footprint so the barrier is continuous to a 0.3 m player circle,
// while the footprint (0.8 m) is small enough to keep every annular gap walkable.
function buildRings(root, M) {
  for (let i = 0; i < RINGS.length; i++) {
    const { r, h } = RINGS[i];
    // shell
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 44, 1, true), M.ring);
    shell.position.set(CX, h / 2, CZ);
    shell.name = 'ord_ring_' + i;
    root.add(shell);
    // brick top cap (gives the wall visible thickness at its crown)
    const cap = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r + 0.22, 44), M.ringCap);
    cap.position.set(CX, h + 0.001, CZ);
    cap.rotation.x = -Math.PI / 2;
    cap.name = 'ord_ring_cap_' + i;
    root.add(cap);

    ringColliders(r, h);
  }

  // the sealed centre: a solid, closed brick drum. No way in, nothing to see.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_H, 24), M.drum);
  drum.position.set(CX, DRUM_H / 2, CZ);
  drum.name = 'ord_drum';
  root.add(drum);
  // a slightly proud brick capstone, so the top too is closed
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R + 0.12, DRUM_R + 0.12, 0.14, 24), M.ringCap);
  cap.position.set(CX, DRUM_H + 0.05, CZ);
  cap.name = 'ord_drum_cap';
  root.add(cap);
  // one square collider box enclosing the drum (its corner clears ring 5's gap)
  collideBox(CX, DRUM_H / 2, CZ, 2 * DRUM_R, DRUM_H, 2 * DRUM_R);
}

// A ring of square AABB posts around one circle, sealing it to the player.
function ringColliders(r, h) {
  const n = Math.max(16, Math.ceil((2 * Math.PI * r) / 0.7));  // arc spacing ~0.7 m
  for (let k = 0; k < n; k++) {
    const th = (2 * Math.PI * k) / n;
    const x = CX + r * Math.cos(th);
    const z = CZ + r * Math.sin(th);
    collideBox(x, h / 2, z, 0.8, h, 0.8);                       // 0.8 m footprint
  }
}

// --------------------------------------------------------------------- vault
// A low, oppressive brick vault: a shallow domical cap springing from the wall
// tops, its underside pressing down over the rings. A small iron grate at the
// crown lets one cold shaft fall onto the sealed centre — the only light that
// reaches the middle, onto the one place you cannot go.
function buildVault(root, M) {
  const RS = 15.0;                              // dome sphere radius
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(RS, 30, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M.vault);
  dome.scale.y = 0.10;                          // flatten -> ~1.5 m rise (low)
  dome.position.set(CX, 3.5, CZ);               // rim ~3.5, crown ~5.0
  dome.name = 'ord_vault';
  root.add(dome);

  // two concentric brick ribs on the underside (a plain groin suggestion)
  for (const rr2 of [10.5, 6.5]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(rr2, 0.10, 6, 40), M.rib);
    const rise = 3.5 + 0.10 * (RS - Math.sqrt(Math.max(0, RS * RS - rr2 * rr2))) + 0.05;
    rib.position.set(CX, rise, CZ);
    rib.rotation.x = Math.PI / 2;
    rib.name = 'ord_vault_rib';
    root.add(rib);
  }

  // the grate at the crown: a dark frame + a small cross of iron bars
  addBox(root, M.dark, CX, 4.92, CZ, 1.5, 0.14, 1.5, 'ord_grate_frame', false);
  for (const o of [-0.5, 0, 0.5]) {
    addBox(root, M.grate, CX + o, 4.9, CZ, 0.06, 0.08, 1.4, 'ord_grate_bar', false);
    addBox(root, M.grate, CX, 4.9, CZ + o, 1.4, 0.08, 0.06, 'ord_grate_bar', false);
  }

  // the cold shaft: a cone widening downward from the grate onto the drum
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 20, 1, true), M.shaft);
  shaft.position.set(CX, 2.6, CZ);              // apex up at the grate, base at floor
  shaft.name = 'ord_shaft';
  root.add(shaft);
}

// ---------------------------------------------------------------------- body
// §8, applied lightly: ONE man who sat down in an outer gap with his back to a
// ring and did not get up — as if he had waited for a way in. A slumped seated
// figure, grounded on the floor, hands and feet gone black. A stain worked into
// the brick under him, ringed by the pale marks of a brush that never came.
// Placed in the gap between ring 1 (r=11) and ring 2 (r=9), on the +X side.
const BODY = { x: CX + 10.0, z: 0.0 };           // (-150, 0) — back toward ring 1 (+X)

function buildBody(root, M) {
  const { x, z } = BODY;
  // The man who sat down against ring 1 and never got up — a shared low-poly
  // SEATED corpse. Origin on the floor (y=0); slumped pose sits with the back
  // over local -X and the legs/feet toward local +X. Rotate Math.PI so his back
  // is toward +X (against the ring) and his feet stretch toward -X (the centre).
  const c = makeCorpse({ pose: 'slumped', cloth: 0x30281f, seed: 71 });
  c.position.set(x, 0, z);
  c.rotation.y = Math.PI;
  root.add(c);

  // dark-brown plague STAIN pooling from where he sits, worked into the brick.
  const stain = makeStain({ r: 1.2, seed: 71 });
  stain.position.set(x - 0.05, 0.002, z);
  root.add(stain);

  // stain worked into the brick under him, and the pale brush-ring that gave out
  flatQuad(root, M.stain, x - 0.05, 0.02, z, 0.9, 1.0, 'ord_body_stain');
  const scrub = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.9, 16), M.scrub);
  scrub.position.set(x - 0.05, 0.021, z);
  scrub.rotation.x = -Math.PI / 2;
  scrub.name = 'ord_body_scrub';
  root.add(scrub);
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: drifts of dead flies banked in the outer annular gaps (never labelled),
// and a little lime scattered at the one threshold. Small dark/pale flecks,
// merged. Deterministic scatter.
function buildAmbientGrammar(root, M) {
  const flies = [];
  const driftArc = (r, th0, th1, n) => {
    for (let i = 0; i < n; i++) {
      const th = rr(th0, th1);
      const rad = r + rr(-0.35, 0.35);
      pushBox(flies, CX + rad * Math.cos(th), 0.01 + rr(0, 0.02), CZ + rad * Math.sin(th),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // banked in the outer two gaps, and a drift drawn to the seated man
  driftArc(12.0, 0.4, 2.6, 70);
  driftArc(12.0, 3.5, 5.6, 60);
  driftArc(10.0, 2.2, 4.0, 50);
  const bx = BODY.x, bz = BODY.z;
  for (let i = 0; i < 45; i++) {
    pushBox(flies, bx + rr(-0.7, 0.7), 0.01 + rr(0, 0.02), bz + rr(-0.7, 0.7),
      rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
  }
  mergedMesh(root, flies, M.fly, 'ord_flies');

  // scattered lime at the one threshold
  const lime = [];
  for (let i = 0; i < 55; i++) {
    const lx = rr(DOOR_X0 - 0.4, DOOR_X1 + 0.4), lz = rr(Z0 + 0.1, Z0 + 1.1);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'ord_lime');
}

// ------------------------------------------------------------------ lighting
// Local point lights only (no global ambient — the great hall is untouched).
// Cold, dim, wrong: a low blue-grey wash in the outer gaps, and one colder,
// slightly stronger shaft over the sealed centre where the grate lets light in.
function buildLighting() {
  // dim cold fills spaced around the outer walk, kept low and short-range
  const ring = 12.0;
  for (let k = 0; k < 6; k++) {
    const th = (2 * Math.PI * k) / 6 + 0.3;
    const l = new THREE.PointLight(0x556270, 3.0, 12, 1.7);
    l.position.set(CX + ring * Math.cos(th), 3.2, CZ + ring * Math.sin(th));
    l.name = 'ord_light_gap';
    addLight(l);
  }
  // the shaft onto the centre: a colder, brighter point high over the drum,
  // and a faint pool at its foot so the sealed brick reads out of the gloom.
  const shaft = new THREE.PointLight(0x9fb2c6, 5.5, 10, 1.9);
  shaft.position.set(CX, 4.4, CZ); shaft.name = 'ord_light_shaft'; addLight(shaft);
  const pool = new THREE.PointLight(0x8fa2b6, 2.4, 6, 2.0);
  pool.position.set(CX, 1.4, CZ); pool.name = 'ord_light_pool'; addLight(pool);
  // a little cold light at the threshold so the entrance reads
  const door = new THREE.PointLight(0x5a6572, 2.6, 8, 1.8);
  door.position.set(CX, 2.6, Z0 + 1.6); door.name = 'ord_light_door'; addLight(door);
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§9): he describes what he sees, never the meaning; no
// rhetorical questions.
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
  // 1) the rings and the sealed centre — read from the outer gap by the door.
  registerProp(world, 'ord_ix_rings', CX, 1.0, CZ - 11.5, 3.0,
    'Seven walls of brick, ring within ring, each taller than the last. The gaps between them are a stride wide and you can walk them round and round.',
    'Not one ring is broken. No door, no gap, no course left out. They close on a drum of brick at the middle that has no opening at all. Whatever the centre holds was walled in from the outside, and the work is faultless.');

  // 2) the man who sat down against a ring and never solved it.
  registerProp(world, 'ord_ix_body', BODY.x, 0.6, BODY.z, 2.4,
    'A man sat down with his back to one of the rings and did not get up. His hands are folded in his lap and his feet are stretched out toward the middle.',
    'The fingers and the toes are gone black to the joint. The brick behind him is stained where he leaned, and pale scratches ring the floor at his feet where a brush went at it and stopped.');
}
