import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import {
  registerCollider, registerFloor, registerInteractable, addLight, onUpdate,
} from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE SOUNDING COURT  (castle-atlas #17 · Gen 7 the devil ASTAROTH · world-bible
// §7.2 diabolical works: "A courtyard cut so that a voice at the centre returns
// wrong — delayed, or pitched differently, or not at all. Weinhold's notes give
// the intended acoustic effect. It is not one a human throat produces.")
//
// An enclosed OPEN-AIR court: a near-elliptical ring of tall, smooth ashlar —
// a whispering-gallery cut to a focus. The floor is hard flag, and rings are
// chiselled into it that DO NOT run from the standing stone at the centre but
// from a spot three feet to the side where nothing stands: the answer gathers
// in the wrong place. The court is too deliberate, too even, listening. Grey
// overcast daylight, its own sky. One man lies at the near speaking-mark — he
// came to listen. Light plague grammar: lime at the threshold, dead flies banked
// in the leeward curve. Astaroth is "a great duke"; the mason's chiselled line
// warns against the duke's figure without the scout ever knowing whose.
//
// Self-contained island centred C = (0, 0, 200). Geometry within ~±16. Ground
// y=0, open to the sky. Builds its own merged geometry, colliders, floor, sky
// box + overcast hemisphere/directional daylight, and registers its own zone.
// Every named object is prefixed `snd_`. NO Math.random / Date.now (they THROW):
// a seeded LCG drives all scatter, and world.elapsed drives the restrained drift.
// buildSoundingCourt(world) returns { root, entry:{x,y,z,yaw} }. No portals.
// ===========================================================================

// --- island frame (metres) -------------------------------------------------
const CX = 0, CZ = 200;                 // court centre (the standing stone)
const AX = 12.5, AZ = 11.0;             // inner ellipse semi-axes (x long, z short)
const THICK = 0.8;                      // wall thickness (radial)
const WALL_H = 5.8;                     // tall, smooth, unclimbable
const N_FACET = 34;                     // faceted ring resolution
// Ellipse foci lie on the long (x) axis at ±c; c = sqrt(AX^2 - AZ^2) ≈ 5.94.
const FOCUS_C = Math.sqrt(AX * AX - AZ * AZ);
// Doorway cut in the outer wall at the -Z foot of the ellipse (z ≈ 189), facing
// +Z into the court toward the standing stone.
const DOOR_HW = 1.15;                   // half-width of the opening (~2.3 m)
const DOOR_H = 2.5;
const DOOR_Z = CZ - AZ;                 // inner face of the door bay (z=189)
// The acoustic focus the floor is cut for — deliberately OFF the centre and off
// the axis: the returned voice gathers here, wide of the man who speaks.
const ECHO_X = CX + 2.0, ECHO_Z = CZ + 3.0;

// --- ENTRY (return exact) — just outside/at the doorway, facing +Z inward -----
const ENTRY = { x: 0, y: 1.7, z: 188, yaw: 0 };

// ---------------------------------------------------------------------------
// Seeded LCG — all scatter (speckle, flies, lime, stain) is stable per load.
// ---------------------------------------------------------------------------
let _seed = 0x51d0c07 >>> 0;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// ---------------------------------------------------------------------------
// Geometry helpers — merged axis boxes, plus a Y-rotated box for the facets so
// the whole smooth ring is one draw call with crisp PS1 flat shading.
// ---------------------------------------------------------------------------
function faces(arr, v) {
  const q = (a, b, c, e) => arr.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[e]);
  q(1, 2, 3, 0); q(4, 7, 6, 5);
  q(0, 4, 5, 1); q(3, 2, 6, 7);
  q(0, 3, 7, 4); q(1, 5, 6, 2);
}
function pushBox(arr, cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  faces(arr, [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ]);
}
function pushRotBox(arr, cx, cy, cz, w, h, d, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const P = (ox, oy, oz) => [cx + ox * c - oz * s, cy + oy, cz + ox * s + oz * c];
  faces(arr, [
    P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(-hw, hh, -hd),
    P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd),
  ]);
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
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (ry) m.rotation.y = ry;
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
// A flat disc lying in the XZ plane (worn floor marks, ripple rings).
function disc(root, mat, x, z, r, name, y = 0.02) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  m.name = name;
  root.add(m);
  return m;
}
function ring(root, mat, x, z, ri, ro, name, y = 0.02) {
  const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 40), mat);
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2;
  m.name = name;
  root.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Tiny canvas textures — smooth pale ashlar (fine joints) + hard grey flag.
// (Runs in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function speckTex(base, speck, courses, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(rr(0, size)), y = Math.floor(rr(0, size));
    g.fillStyle = (rnd() < 0.5) ? speck : base;
    g.globalAlpha = rr(0.1, 0.4);
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  if (courses) {                                   // fine, even ashlar joints
    g.strokeStyle = 'rgba(24,24,28,0.3)'; g.lineWidth = 1;
    for (let y = 16; y < size; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return crunch(t);
}

function makeMaterials() {
  const wallTex = speckTex('#5c6068', '#474b53', true); wallTex.repeat.set(6, 2);
  const flagTex = speckTex('#4e525a', '#383c43', true, 128); flagTex.repeat.set(10, 10);
  const lambert = (o) => ps1ify(new THREE.MeshLambertMaterial(o));
  const basic = (o) => ps1ify(new THREE.MeshBasicMaterial(o));
  return {
    wall: lambert({ color: 0x71757d, map: wallTex }),      // smooth pale ashlar
    flag: lambert({ color: 0x565a61, map: flagTex }),      // hard grey flag
    stone: lambert({ color: 0x7c808a }),                   // standing stone, jambs, discs
    worn: lambert({ color: 0x878b95 }),                    // polished-worn stone
    dark: lambert({ color: 0x1a1d22 }),                    // reveals, cut grooves
    flesh: lambert({ color: 0x8a7f6d }),
    garb: lambert({ color: 0x322f2a }),
    black: lambert({ color: 0x131110 }),                   // blackened extremities
    fly: lambert({ color: 0x16130f }),
    lime: lambert({ color: 0xc9c4b6 }),
    stain: basic({ color: 0x241d18, side: THREE.DoubleSide }),   // old dark stain
    mote: basic({ color: 0xb9c0c9, fog: false, transparent: true, opacity: 0.5 }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildSoundingCourt(world) {
  const root = new THREE.Group();
  root.name = 'snd_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildSky(root);
  buildDaylight(world);
  buildFloor(root, M);
  buildRing(root, M);
  buildFocus(root, M);
  buildBody(root, M);
  buildGrammar(root, M);
  buildMotes(root, M, world);
  buildExaminables(world);

  if (world.registerZone) {
    world.registerZone({ name: 'The Sounding Court', min: [-14, -1, 187], max: [14, 7, 213] });
  }

  return { root, entry: ENTRY };
}

// ------------------------------------------------------------------- sky box
// Own overcast sky: a BackSide gradient box around the court (grey top → paler
// horizon), emissive + fog:false so the open court reads as flat grey daylight.
function buildSky(root) {
  const HX = 60, Y0 = -10, Y1 = 60, Z0 = CZ - 60, Z1 = CZ + 60;
  const geo = new THREE.BoxGeometry(2 * HX, Y1 - Y0, Z1 - Z0);
  geo.translate(0, (Y0 + Y1) / 2, (Z0 + Z1) / 2);
  const top = new THREE.Color(0xbfc6d0), bot = new THREE.Color(0x9198a3);
  const pos = geo.attributes.position, col = [], tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - Y0) / (Y1 - Y0), 0, 1);
    tmp.copy(bot).lerp(top, Math.pow(t, 0.7));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = ps1ify(new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'snd_sky';
  sky.renderOrder = -1;
  root.add(sky);
}

// ------------------------------------------------------------------ daylight
// Flat overcast: a HemisphereLight + a soft, low, diffuse directional fill (no
// harsh sun) + a couple of local cool point fills pooling over the flags.
function buildDaylight(world) {
  const hemi = new THREE.HemisphereLight(0xc4cdd8, 0x35393f, 0.85);
  hemi.position.set(CX, 30, CZ);
  hemi.name = 'snd_daylight_hemi';
  addLight(hemi);

  const dir = new THREE.DirectionalLight(0xb4c0d0, 0.35);
  dir.position.set(CX - 20, 26, CZ - 14);
  dir.target.position.set(CX, 0, CZ);
  dir.name = 'snd_daylight_dir';
  addLight(dir);
  if (world.scene) world.scene.add(dir.target);

  // local overcast pools so the enclosed court reads grey from within
  for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 5], [5, 5], [0, 0]]) {
    const p = new THREE.PointLight(0xaab2be, 5.5, 20, 1.5);
    p.position.set(CX + dx, 6.5, CZ + dz);
    p.name = 'snd_light_pool';
    addLight(p);
  }
}

// -------------------------------------------------------------------- floor
// Hard grey flag over the whole footprint (walkable), a proud worn sill at the
// door, and the WRONG acoustic figure cut into the flags: concentric rings that
// run not from the standing stone but from ECHO (off centre, off axis).
function buildFloor(root, M) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * AX + 2, 2 * AZ + 2), M.flag);
  floor.name = 'snd_floor';
  floor.position.set(CX, 0, CZ);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  registerFloor(floor);

  // worn threshold sill at the doorway
  addBox(root, M.stone, CX, 0.02, DOOR_Z - 0.3, 2 * DOOR_HW + 0.4, 0.06, 0.6, 'snd_sill', false);

  // the chiselled rings — centred on the WRONG focus, thin dark grooves
  for (let k = 0; k < 6; k++) {
    const ro = 0.9 + k * 1.35;
    ring(root, M.dark, ECHO_X, ECHO_Z, ro - 0.06, ro, 'snd_echo_ring', 0.021);
  }
  // a small worn disc AT the wrong focus (where the answer gathers) — polished
  disc(root, M.worn, ECHO_X, ECHO_Z, 0.5, 'snd_echo_disc', 0.023);
}

// ------------------------------------------------------------------ the ring
// The enclosing wall: a faceted ellipse of tall smooth ashlar, merged to one
// mesh, with a doorway cut at the -Z foot. Colliders per facet + door jambs.
function buildRing(root, M) {
  const wall = [];
  let facets = 0;
  const rWall = (AX + AZ) / 2;                    // mean radius (mote/facet sizing)
  void rWall;
  for (let i = 0; i < N_FACET; i++) {
    const a0 = (i / N_FACET) * Math.PI * 2;
    const a1 = ((i + 1) / N_FACET) * Math.PI * 2;
    const p0 = [CX + AX * Math.cos(a0), CZ + AZ * Math.sin(a0)];
    const p1 = [CX + AX * Math.cos(a1), CZ + AZ * Math.sin(a1)];
    const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
    // doorway gap at the -Z foot (sin ≈ -1): skip facets there
    if (mz < CZ - AZ + 0.6 && Math.abs(mx - CX) < DOOR_HW + 0.15) continue;
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const len = Math.hypot(dx, dz) + 0.35;         // overlap so the ring is closed
    const yaw = Math.atan2(-dz, dx);               // align long axis with the chord
    // push the wall mass a touch OUTWARD from the chord midpoint (radial normal)
    const nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
    const cx = mx + nx * THICK * 0.5, cz = mz + nz * THICK * 0.5;
    pushRotBox(wall, cx, WALL_H / 2, cz, len, WALL_H, THICK, yaw);
    // a shallow smooth capping course, a touch proud — reads as a deliberate rim
    pushRotBox(wall, cx, WALL_H + 0.12, cz, len, 0.24, THICK + 0.18, yaw);
    collideBox(cx, WALL_H / 2, cz, Math.abs(dx) + THICK, WALL_H, Math.abs(dz) + THICK);
    facets++;
  }
  mergedMesh(root, wall, M.wall, 'snd_wall_ring');

  // doorway jambs + lintel + dark reveal at the -Z foot
  const jz = DOOR_Z + 0.1;
  addBox(root, M.stone, CX - DOOR_HW - 0.18, DOOR_H / 2, jz, 0.36, DOOR_H, THICK + 0.2, 'snd_jamb_l', true);
  addBox(root, M.stone, CX + DOOR_HW + 0.18, DOOR_H / 2, jz, 0.36, DOOR_H, THICK + 0.2, 'snd_jamb_r', true);
  addBox(root, M.stone, CX, (DOOR_H + WALL_H) / 2 + 0.1, jz, 2 * DOOR_HW + 0.72, WALL_H - DOOR_H + 0.2, THICK + 0.2, 'snd_lintel', false);
  addBox(root, M.dark, CX, DOOR_H / 2, DOOR_Z - 0.02, 2 * DOOR_HW, DOOR_H, 0.1, 'snd_door_reveal', false);

  root.userData.snd_facets = facets;
}

// ------------------------------------------------------------- the focus stone
// A single standing stone at the true centre — where you are meant to speak —
// worn smooth at the height of a man's mouth, dished into the flags at its foot.
// A chiselled plaque set in its base carries the mason's warning.
function buildFocus(root, M) {
  // dished worn disc under the feet (two centuries of standing to speak)
  disc(root, M.worn, CX, CZ, 1.0, 'snd_focus_disc', 0.022);
  // a low plinth step, then the monolith
  addBox(root, M.stone, CX, 0.12, CZ, 1.3, 0.24, 1.3, 'snd_focus_plinth', true);
  addBox(root, M.stone, CX, 1.35, CZ, 0.62, 2.4, 0.5, 'snd_focus_stone', true);
  // a polished band at mouth height (worn brighter where the breath fell)
  addBox(root, M.worn, CX, 1.55, CZ, 0.64, 0.34, 0.52, 'snd_focus_worn', false);
  // two faint speaking-marks at the ellipse foci (feet placed to raise the echo)
  disc(root, M.worn, CX - FOCUS_C, CZ, 0.42, 'snd_focus_west', 0.022);
  disc(root, M.worn, CX + FOCUS_C, CZ, 0.42, 'snd_focus_east', 0.022);

  // the chiselled plaque, low on the stone's base, facing the door (+Z... reads
  // as a small cut panel). Registered as a readable if the world has a reader.
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), M.dark);
  plaque.name = 'snd_plaque';
  plaque.position.set(CX, 0.55, CZ - 0.26);
  plaque.rotation.y = Math.PI;
  root.add(plaque);
}

// -------------------------------------------------------------------- the body
// One man at the WEST speaking-mark — he came to listen. Crude dark box-figure,
// flat on the flags, blackened hands and feet, an old dark stain scrubbed at.
const BODY = { cx: CX - FOCUS_C, cz: CZ, dir: 1 };

function buildBody(root, M) {
  const { cx, cz } = BODY;
  // The man who came to listen — a shared low-poly corpse at the west speaking-
  // mark. Origin on the floor (y=0), head toward local +X; no rotation keeps his
  // head toward +X as the crude figure lay. Muted garment.
  const c = makeCorpse({ pose: 'supine', cloth: 0x4b4535, seed: 33 });
  c.position.set(cx, 0, cz);
  c.rotation.y = 0;
  root.add(c);

  // dark-brown plague STAIN pooled under him, laid flat on the flags.
  const stain = makeStain({ r: 1.2, seed: 33 });
  stain.position.set(cx, 0.002, cz);
  root.add(stain);

  // an old dark stain under him, and a paler arc where someone scrubbed and gave up
  const st = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), M.stain);
  st.rotation.x = -Math.PI / 2; st.rotation.z = 0.4;
  st.position.set(cx + 0.1, 0.02, cz + 0.05); st.name = 'snd_body_stain';
  root.add(st);
  const scrub = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), M.worn);
  scrub.rotation.x = -Math.PI / 2; scrub.rotation.z = -0.3;
  scrub.position.set(cx + 0.7, 0.021, cz - 0.35); scrub.name = 'snd_body_scrub';
  root.add(scrub);
}

// ------------------------------------------------------ ambient plague grammar
// LIGHT: dead flies banked in the leeward curve of the wall, and a little lime
// scattered at the threshold. Restrained — the court itself is the beat.
function buildGrammar(root, M) {
  const flies = [];
  const drift = (a, n) => {
    // bank against the inner wall at ellipse angle a (the still, leeward curve)
    const wx = CX + (AX - 0.5) * Math.cos(a), wz = CZ + (AZ - 0.5) * Math.sin(a);
    for (let i = 0; i < n; i++) {
      pushBox(flies, wx + rr(-0.8, 0.8), 0.01 + rr(0, 0.03), wz + rr(-0.8, 0.8),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  drift(Math.PI * 0.62, 60);          // banked in one flank curve
  drift(Math.PI * 0.30, 44);          // and lighter in the other
  mergedMesh(root, flies, M.fly, 'snd_flies');

  const lime = [];
  for (let i = 0; i < 55; i++) {
    const lx = rr(CX - DOOR_HW - 0.5, CX + DOOR_HW + 0.5);
    const lz = rr(DOOR_Z - 0.9, DOOR_Z + 0.6);
    pushBox(lime, lx, 0.012, lz, rr(0.03, 0.1), 0.02, rr(0.03, 0.1));
  }
  mergedMesh(root, lime, M.lime, 'snd_lime');
}

// ---------------------------------------------------------------- dust motes
// A faint, very slow drift of motes in the enclosed still air — the one uneasy
// motion. Restrained (few, pale, near-transparent). Driven by world.elapsed.
function buildMotes(root, M, world) {
  const grp = new THREE.Group();
  grp.name = 'snd_motes';
  root.add(grp);
  const motes = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), M.mote);
    const bx = rr(CX - 6, CX + 6), by = rr(0.6, 3.4), bz = rr(CZ - 5, CZ + 5);
    m.position.set(bx, by, bz);
    m.name = 'snd_mote';
    grp.add(m);
    motes.push({ m, bx, by, bz, ph: rr(0, Math.PI * 2), sp: rr(0.05, 0.13) });
  }
  onUpdate(() => {
    const t = world.elapsed || 0;
    for (const o of motes) {
      o.m.position.y = o.by + Math.sin(t * o.sp + o.ph) * 0.4;
      o.m.position.x = o.bx + Math.sin(t * o.sp * 0.5 + o.ph) * 0.35;
    }
  });
}

// ---------------------------------------------------------------- examinables
// Scout's plain register (§9/§10): describe form, never meaning. The plaque is a
// readable (mason's warning) if the world has a reader; otherwise it examines.
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
  // 1. THE FOCUS STONE — where you are meant to speak.
  registerProp(world, 'snd_ix_focus', CX, 1.0, CZ, 2.2,
    'A single stone stands at the middle of the court, worn pale at the height of a man’s mouth.',
    'The flags are dished under the feet by long standing, and the stone is rubbed smooth where breath after breath has fallen. A man was meant to come here and speak.');

  // 2. THE WRONG ECHO — the acoustic figure cut off centre.
  registerProp(world, 'snd_ix_echo', ECHO_X, 0.4, ECHO_Z, 2.0,
    'The rings cut in the flags do not run from the standing stone, but from a patch off to the side where nothing stands.',
    'A man at the centre speaks toward the far wall, yet the floor is worn as though the answer came back from here, three feet wide of him. Whoever cut these stones knew where the sound would gather.');

  // The mason’s chiselled plaque — a warning, as a readable document.
  if (world.reader && typeof world.reader.open === 'function') {
    const anchor = new THREE.Object3D();
    anchor.name = 'snd_ix_plaque';
    anchor.position.set(CX, 0.55, CZ - 0.35);
    if (world.scene) world.scene.add(anchor);
    registerInteractable({
      object: anchor,
      radius: 1.8,
      label: 'A small panel is cut into the base of the stone, the letters chiselled deep and even.',
      onExamine: () => world.reader.open({
        id: 'snd_weinhold_court',
        type: 'Inscription', style: '', voice: 'a mason’s hand',
        dateText: 'cut into the base of the standing stone',
        prompt: 'A small panel cut into the base of the stone.',
        pages:
          'Set to the duke’s figure and to no plan of mine. The courses are true; I will answer for the stone and for nothing else.\n\n' +
          'Do not stand at the centre and call out, whatever is promised of the answer. I stood there once and heard my own voice come back a beat late and in another man’s throat, and I have not',
      }),
    });
  }
}
