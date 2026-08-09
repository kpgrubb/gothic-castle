import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';
import { registerCollider, registerInteractable, addLight, onUpdate } from '../core/scene.js';
import { makeCorpse, makeStain } from '../content/corpse.js';

// ===========================================================================
// THE ARRIVAL STORY  (story layer over the approach SHELL — another agent owns
// approach.js: walls/ground/gate/sky/overcast daylight, to the SAME coordinate
// spec below. This module adds the human tragedy and the readable leaves ON TOP
// of that shell, at the shared coordinates. A separate integrator wires it in.)
//
// world-bible §8 (THE BLACK WEEPING: blackened extremities, dried blood tracks
// dark-not-red, the STAIN with scrub-marks, DRIFTS OF DEAD FLIES everywhere and
// never labelled, vinegar + lime; CORPSE DOCTRINE — the VIOLENT tableau of month
// 14 / the gate killings of month 12: "small clusters, evidence of what happened
// between two or three people, reconstructible from position and what is in their
// hands, never explained by any text — the player does the forensics"; RARE,
// SPECIFIC, restrained). §5.3 / §11 (month 12: QUARANTINE, "the gate killings",
// the wall sealed with the living inside). §6 voices: Marshal Gerhart Stolz
// (blunt, military, poor speller, honest — killed men at the gate on order and it
// broke him) and Lenhart Vogel, gate sergeant (tallies). §9 WRITING REGISTER
// (plain, concrete, feast-day dated, the writer STOPS — he does not conclude).
//
// It is OVERCAST DAYLIGHT here — the shell lights the yard bright and grey — so
// this is all seen plainly, in daylight, which makes it worse. This module adds
// NO lights of its own. Mesh names are prefixed `apprstory_`, examinable anchors
// `ix_appr_`.
//
// COORDINATE SPEC (+Z = SOUTH toward the gate; y=0 ground):
//   INNER WARD  z∈[+16,+48], x∈[-18,+18]; curtain walls at x=±18; hall façade
//               at z≈+15 (north); gatehouse at z≈+48 (south).
//   GATEHOUSE   gate passage walkable x[-3,+3], z∈[+48,+58]; shut gate at z≈+58.
//   Player arrives at the gate (~0,1.7,+55) facing −Z (north) and walks up
//   through the ward to the great door. First seen: the gate; then the crossing.
// ===========================================================================

// --- Deterministic RNG so scatter (flies, lime) is stable across loads --------
let _seed = 0x51a7c3;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 0x100000000; }
function rr(a, b) { return a + (b - a) * rnd(); }

// --- Geometry helpers (merged-box scatter, single boxes, colliders) -----------
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

// A single box mesh; optionally register a matching world-space AABB collider.
function addBox(root, mat, cx, cy, cz, w, h, d, name, collide) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
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

// A child box placed in a sub-group's local frame (for the tipped cart / bodies).
function localBox(group, mat, cx, cy, cz, w, h, d, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.name = name;
  group.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Tiny canvas texture — weathered cobble / timber speckle, crunched to PS1.
// (Runs in the browser; node --check only parses this file.)
// ---------------------------------------------------------------------------
function makeSpeckTexture(base, speck) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 300; i++) {
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
  const timberTex = makeSpeckTexture('#4a3a2a', '#2c2018');
  timberTex.repeat.set(2, 1);

  const lambert = (opts) => ps1ify(new THREE.MeshLambertMaterial(opts));
  const basic = (opts) => ps1ify(new THREE.MeshBasicMaterial(opts));

  return {
    timber: lambert({ color: 0x4a3a2a, map: timberTex }), // cart, table, shafts
    plank: lambert({ color: 0x5a4a38 }),                  // nailed boards
    leather: lambert({ color: 0x3f342a }),                // satchel, boots
    metal: lambert({ color: 0x55585c }),                  // helm, bill head, bowls
    cloth: lambert({ color: 0x6b6656 }),                  // clothing / bundles
    cloth2: lambert({ color: 0x5c606a }),                 // a second, cooler bundle
    cloth3: lambert({ color: 0x6e2f2a }),                 // one oxblood bundle (§4 accent, tiny)
    flesh: lambert({ color: 0x8a7f6d }),                  // a bared hand / face
    black: lambert({ color: 0x14100e }),                  // blackened extremities (§8)
    blood: lambert({ color: 0x2f1512 }),                  // dried blood, dark not red (§8)
    door: lambert({ color: 0x3a2e22 }),                   // sealed door leaf
    chalk: lambert({ color: 0xbfb8a6 }),                  // chalk cross + date
    wax: lambert({ color: 0xcbb89a }),
    scum: lambert({ color: 0x3f4a3a }),                   // vinegar gone to scum (§8)
    lime: lambert({ color: 0xcfcabb }),                   // scattered lime (§8)
    fly: lambert({ color: 0x17140f }),                    // drifts of dead flies (§8)
    stain: basic({ color: 0x1c1815 }),                    // the stain (flat dark, §8)
    scrub: basic({ color: 0x544f47, transparent: true, opacity: 0.35 }),
    parchment: basic({ color: 0xb7a06a, side: THREE.DoubleSide }),
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export function buildApproachStory(world) {
  const root = new THREE.Group();
  root.name = 'apprstory_root';
  if (world.scene) world.scene.add(root);
  const M = makeMaterials();

  buildGatePost(root, M, world);   // the ward-post: table + barrel (doc surfaces)
  buildGateKillings(root, M);      // the tableau of month 12
  buildCart(root, M);             // the abandoned handcart in the ward
  buildWardClutter(root, M, world); // refugee/flight debris banked to the sides
  buildWardDead(root, M);           // more dead where they fell, with stains
  buildWardFliesLime(root, M);      // drifts of flies + scattered lime, ward-wide
  buildSealedDoors(root, M);      // boarded doors, chalk crosses + dates
  buildFlies(root, M);            // drifts of dead flies (gate, cart, corners)
  buildThreshold(root, M);        // vinegar bowls + lime at the gate threshold
  buildDocuments(root, M, world); // the two readable leaves, flat on surfaces
  buildExaminables(world);        // scout-register anchors

  return root;
}

// ---------------------------------------------------------------------------
// THE GATE-WARD'S POST — a plain table and a barrel just inside the passage
// (z≈+50). These are the SURFACES the two leaves rest on. Both solid → collide.
// Surface tops are the constants used by buildDocuments (no floating).
// ---------------------------------------------------------------------------
const TABLE = { cx: -2.0, cz: 50.2, topY: 0.75 };
const BARREL = { cx: 2.1, cz: 49.6, topY: 0.86, r: 0.32 };

function buildGatePost(root, M) {
  // gate-ward's table (top surface y = TABLE.topY)
  addBox(root, M.timber, TABLE.cx, TABLE.topY - 0.025, TABLE.cz, 1.4, 0.05, 0.7, 'apprstory_table_top', false);
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.28, 0.28]) {
    addBox(root, M.timber, TABLE.cx + sx, 0.36, TABLE.cz + sz, 0.08, 0.72, 0.08, 'apprstory_table_leg', false);
  }
  collideBox(TABLE.cx, 0.42, TABLE.cz, 1.4, 0.85, 0.7);

  // a barrel by the post (top surface y = BARREL.topY)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL.r, BARREL.r + 0.03, BARREL.topY, 10),
    M.timber);
  barrel.position.set(BARREL.cx, BARREL.topY / 2, BARREL.cz);
  barrel.name = 'apprstory_barrel';
  root.add(barrel);
  // a couple of hoop bands
  for (const hy of [0.22, 0.64]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(BARREL.r + 0.02, BARREL.r + 0.02, 0.05, 10), M.metal);
    hoop.position.set(BARREL.cx, hy, BARREL.cz);
    hoop.name = 'apprstory_barrel_hoop';
    root.add(hoop);
  }
  collideBox(BARREL.cx, 0.45, BARREL.cz, 2 * BARREL.r + 0.1, 0.9, 2 * BARREL.r + 0.1);
}

// ---------------------------------------------------------------------------
// A collapsed figure, laid flat where it fell (NOT composed — §8 late/violent).
// Now the SHARED low-poly corpse (../content/corpse.js): a posed body with its
// own materials, origin ON THE FLOOR (y=0 here), head toward local +X, set by
// caller position + yaw. A big soft dark-brown plague pool is pooled beneath it
// (§8 the STAIN, generous around the plague dead). Existing scrub-mark decals
// and dropped weapons are kept alongside.
//   pose  'supine'|'facedown'|'side' — fell where they stood
//   cloth garment hex   seed int   stainR pool radius (≈1.1–1.4 on the cobbles)
// ---------------------------------------------------------------------------
function placeDead(root, cx, cz, ry, opts = {}) {
  const { pose = 'supine', cloth = 0x6b6656, seed = 1, stainR = 1.25 } = opts;
  // the dark-brown plague pool first (flat on the cobbles, its own y≈0.02)
  const stain = makeStain({ r: stainR, seed: seed * 7 + 1 });
  stain.position.set(cx, 0, cz);
  root.add(stain);
  // the corpse on top, dropped where it fell
  const c = makeCorpse({ pose, cloth, seed });
  c.position.set(cx, 0, cz);
  c.rotation.y = ry;
  root.add(c);
  return c;
}

// ---------------------------------------------------------------------------
// THE GATE-KILLINGS (month 12). A small, specific violent tableau near the gate
// passage. Three plain bodies where they fell: a gate-ward against the shut gate;
// one just inside with a dropped bill; a townsperson at the mouth of the passage
// with a spilled satchel — someone trying to leave. The plague-black fingertips
// and a little dried blood are the only detail. Reconstructible without a word.
// A dark scrub-ringed stain marks the cobbles by the second body. NOT explained.
// ---------------------------------------------------------------------------
function buildGateKillings(root, M) {
  // Body A — the gate-ward, fallen against the shut gate (head toward the gate).
  placeDead(root, -1.2, 56.6, Math.PI + 0.20, { pose: 'supine', cloth: 0x6b6656, seed: 11, stainR: 1.3 });
  // his helm in the dirt, knocked off (a dome, upturned lip toward the yard)
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.metal);
  helm.position.set(-0.45, 0.02, 57.05);
  helm.rotation.x = -0.5;
  helm.name = 'apprstory_helm';
  root.add(helm);

  // Body B — one just inside, a dropped bill where the hand let go of it.
  placeDead(root, 1.2, 51.2, 0.5, { pose: 'facedown', cloth: 0x5c606a, seed: 22, stainR: 1.2 });
  // the bill: a long shaft lying diagonal on the cobbles + a metal head at one end
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.7), M.timber);
  shaft.position.set(1.95, 0.05, 51.7);
  shaft.rotation.y = 0.9;
  shaft.name = 'apprstory_bill_shaft';
  root.add(shaft);
  const billhead = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.34), M.metal);
  billhead.position.set(1.32, 0.05, 51.10);
  billhead.rotation.y = 0.9;
  billhead.name = 'apprstory_bill_head';
  root.add(billhead);

  // the STAIN by body B — worked into the cobbles, ringed by a brush that gave out
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05), M.stain);
  stain.position.set(1.35, 0.02, 50.7);
  stain.rotation.x = -Math.PI / 2;
  stain.name = 'apprstory_stain';
  root.add(stain);
  const scrub = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.8, 16), M.scrub);
  scrub.position.set(1.35, 0.021, 50.7);
  scrub.rotation.x = -Math.PI / 2;
  scrub.name = 'apprstory_stain_scrub';
  root.add(scrub);

  // Body C — a townsperson at the mouth of the passage, a satchel burst open
  // beside them. Someone who was trying to leave. No blood; the black hand only.
  placeDead(root, -1.7, 48.7, -0.6, { pose: 'side', cloth: 0x6b6656, seed: 33, stainR: 1.15 });
  buildSpilledSatchel(root, M, -1.15, 48.1);
}

// A leather satchel tipped open, a household's small goods spilled across cobbles.
function buildSpilledSatchel(root, M, cx, cz) {
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.26), M.leather);
  bag.position.set(cx, 0.08, cz);
  bag.rotation.y = 0.4;
  bag.name = 'apprstory_satchel';
  root.add(bag);
  // spilled goods: a bundle, a wooden bowl, a small stub of candle
  addBox(root, M.cloth3, cx + 0.28, 0.06, cz + 0.20, 0.20, 0.12, 0.16, 'apprstory_satchel_bundle', false);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.06, 8), M.wax);
  bowl.position.set(cx - 0.24, 0.03, cz + 0.16); bowl.name = 'apprstory_satchel_bowl'; root.add(bowl);
  addBox(root, M.wax, cx + 0.10, 0.03, cz - 0.24, 0.04, 0.06, 0.04, 'apprstory_satchel_candle', false);
}

// ---------------------------------------------------------------------------
// THE ABANDONED CART — a handcart gone over on its side in the ward (≈ 0..6, +30),
// a household's bundled belongings burst across the cobbles. They tried to flee
// and did not. Solid → collider over the wreck footprint.
// ---------------------------------------------------------------------------
function buildCart(root, M) {
  const CENTER = { x: 2.6, z: 30 };
  const g = new THREE.Group();
  g.position.set(CENTER.x, 0.10, CENTER.z);
  g.rotation.y = 0.4;        // askew to the yard
  g.rotation.z = 1.15;       // tipped over onto its side
  g.name = 'apprstory_cart';
  root.add(g);

  // bed floor + rails (length along local z; wheels on the local x axle)
  localBox(g, M.timber, 0, 0.50, 0, 1.10, 0.10, 1.40, 'apprstory_cart_bed');
  for (const sx of [-0.55, 0.55]) localBox(g, M.timber, sx, 0.65, 0, 0.06, 0.34, 1.40, 'apprstory_cart_railx');
  for (const sz of [-0.70, 0.70]) localBox(g, M.timber, 0, 0.65, sz, 1.10, 0.34, 0.06, 'apprstory_cart_railz');
  // two wheels (axle along local x)
  for (const wx of [-0.62, 0.62]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.10, 12), M.timber);
    w.position.set(wx, 0.42, 0.30);
    w.rotation.z = Math.PI / 2;     // round face toward ±x
    w.name = 'apprstory_cart_wheel';
    g.add(w);
  }
  // two pulling shafts reaching past the bed (+local z)
  for (const sx of [-0.34, 0.34]) localBox(g, M.timber, sx, 0.55, 1.25, 0.05, 0.05, 0.95, 'apprstory_cart_shaft');

  // collider over the tipped-cart footprint (world space)
  collideBox(CENTER.x, 0.5, CENTER.z, 1.7, 1.0, 1.9);

  // spilled load — bundles, a bedroll, a bowl — scattered on the cobbles toward
  // the gate side (+z), NOT children of the tilted cart so they read as fallen out.
  const spill = [
    [M.cloth,  2.0, 0.11, 31.1, 0.44, 0.22, 0.30, 0.3],
    [M.cloth2, 3.3, 0.10, 31.0, 0.40, 0.20, 0.28, -0.4],
    [M.cloth3, 2.7, 0.09, 31.6, 0.30, 0.18, 0.24, 0.8],
    [M.cloth,  3.6, 0.12, 30.2, 0.52, 0.24, 0.34, 0.1],  // a larger bedroll
    [M.leather,1.7, 0.10, 30.4, 0.30, 0.20, 0.22, -0.2],
  ];
  for (let i = 0; i < spill.length; i++) {
    const [mat, x, y, z, w, h, d, ry] = spill[i];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z); b.rotation.y = ry;
    b.name = 'apprstory_cart_bundle';
    root.add(b);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.07, 9), M.wax);
  bowl.position.set(2.3, 0.035, 31.5); bowl.name = 'apprstory_cart_bowl'; root.add(bowl);
}

// ===========================================================================
// WARD CLUTTER — the courtyard as a place a whole town tried to flee through and
// died in. Refugee debris is banked toward the walls, the well, and the corners;
// the CENTRAL LANE x∈[-2.5,2.5] is left clear (the player walks it to the door),
// the great door (x0,z16) and gate mouth (x[-3,3],z≈48) kept open. EVERYTHING
// sits ON the cobbles: y=0 ground → a box's centre is at half its height, a
// cylinder-on-its-side centres at its radius. Cool desaturated greys, PS1 boxes
// /cylinders. Solid waist-or-taller props get an AABB collider; flat debris does
// not. Variation is derived from loop index / fixed arrays only (no randomness).
// ---------------------------------------------------------------------------

// a slumped sack (grain / a household's small goods), grounded, lumpy.
function buildSack(root, M, cx, cz, mat, s, ry, collide) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  g.name = 'apprstory_sack'; root.add(g);
  localBox(g, mat, 0, 0.22 * s, 0, 0.44 * s, 0.44 * s, 0.34 * s, 'apprstory_sack_body');
  localBox(g, mat, 0, 0.50 * s, 0.02 * s, 0.20 * s, 0.16 * s, 0.16 * s, 'apprstory_sack_neck');
  if (collide) collideBox(cx, 0.25 * s, cz, 0.5 * s, 0.5 * s, 0.42 * s);
}

// a broken crate; `staved` gives a shorter, stove-in box with a sprung plank.
function buildCrate(root, M, cx, cz, ry, staved) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  g.name = 'apprstory_crate'; root.add(g);
  const h = staved ? 0.42 : 0.58, w = 0.6, d = 0.6;
  localBox(g, M.plank, 0, h / 2, 0, w, h, d, 'apprstory_crate_box');
  for (const sy of [h * 0.28, h * 0.72]) {
    localBox(g, M.timber, 0, sy, d / 2 + 0.01, w + 0.02, 0.06, 0.02, 'apprstory_crate_slat');
  }
  if (staved) {
    const p = localBox(g, M.plank, 0.36, 0.05, 0.30, 0.5, 0.05, 0.14, 'apprstory_crate_plank');
    p.rotation.y = 0.6;
  }
  collideBox(cx, h / 2, cz, w + 0.1, h, d + 0.1);
}

// a barrel gone over on its side (axis → local x); `staved` sprints a stove head.
function buildTippedBarrel(root, M, cx, cz, ry, staved) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  g.name = 'apprstory_tbarrel'; root.add(g);
  const r = 0.32, len = 0.86;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), M.timber);
  b.rotation.z = Math.PI / 2; b.position.set(0, r, 0);
  b.name = 'apprstory_tbarrel_body'; g.add(b);
  for (const hx of [-len * 0.32, len * 0.32]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.05, 10), M.metal);
    hoop.rotation.z = Math.PI / 2; hoop.position.set(hx, r, 0);
    hoop.name = 'apprstory_tbarrel_hoop'; g.add(hoop);
  }
  if (staved) {
    for (const sd of [-0.12, 0.06]) {
      const st = localBox(g, M.timber, len * 0.5 + 0.02, r + sd, sd, 0.10, 0.05, 0.30, 'apprstory_tbarrel_stave');
      st.rotation.z = 0.3;
    }
  }
  collideBox(cx, r, cz, len + 0.1, 2 * r, 2 * r + 0.1);
}

// an upright barrel (top surface ~0.86), matching the gate-post barrel.
function buildStandBarrel(root, M, cx, cz) {
  const H = 0.86, r = 0.32;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.03, H, 10), M.timber);
  b.position.set(cx, H / 2, cz); b.name = 'apprstory_barrel2'; root.add(b);
  for (const hy of [0.22, 0.64]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.05, 10), M.metal);
    hoop.position.set(cx, hy, cz); hoop.name = 'apprstory_barrel2_hoop'; root.add(hoop);
  }
  collideBox(cx, 0.45, cz, 2 * r + 0.1, 0.9, 2 * r + 0.1);
}

// a coil of rope dropped flat on the cobbles (hemp = cloth grey).
function buildRopeCoil(root, M, cx, cz) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), M.cloth);
  t.rotation.x = Math.PI / 2; t.position.set(cx, 0.05, cz);
  t.name = 'apprstory_rope'; root.add(t);
}

// a wooden bucket knocked onto its side.
function buildBucket(root, M, cx, cz, ry) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  g.name = 'apprstory_bucket'; root.add(g);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.30, 10), M.timber);
  b.rotation.z = Math.PI / 2; b.position.set(0, 0.15, 0); b.name = 'apprstory_bucket_body'; g.add(b);
  for (const hx of [-0.08, 0.08]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10), M.metal);
    hoop.rotation.z = Math.PI / 2; hoop.position.set(hx, 0.15, 0); hoop.name = 'apprstory_bucket_hoop'; g.add(hoop);
  }
}

// a cartwheel off its axle, lying flat with a stub hub.
function buildCartwheel(root, M, cx, cz, ry) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 12), M.timber);
  w.position.set(cx, 0.045, cz); w.rotation.x = Math.PI / 2; w.rotation.z = ry;
  w.name = 'apprstory_cartwheel'; root.add(w);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.12, 8), M.timber);
  h.position.set(cx, 0.06, cz); h.rotation.x = Math.PI / 2; h.name = 'apprstory_cartwheel_hub'; root.add(h);
}

// a bedroll unrolled on the cobbles.
function buildBedroll(root, M, cx, cz, mat, ry) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 1.1), mat);
  b.position.set(cx, 0.08, cz); b.rotation.y = ry; b.name = 'apprstory_bedroll'; root.add(b);
}

// strewn planks — several thin boards at angles, flat on the ground (no collider).
function buildPlanks(root, M, cx, cz) {
  const set = [
    [0.0, 0.04, 0.0, 1.6, 0.2], [0.4, 0.09, 0.3, 1.4, -0.5],
    [-0.3, 0.05, -0.4, 1.2, 0.9], [0.2, 0.13, 0.6, 1.0, 0.1],
  ];
  for (let i = 0; i < set.length; i++) {
    const [ox, oy, oz, len, ry] = set[i];
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, len), (i % 2) ? M.plank : M.timber);
    p.position.set(cx + ox, oy, cz + oz); p.rotation.y = ry;
    p.name = 'apprstory_plank'; root.add(p);
  }
}

// a snapped ladder down on the cobbles — one rail broken short and sprung aside.
function buildLadder(root, M, cx, cz, ry) {
  const g = new THREE.Group(); g.position.set(cx, 0.05, cz); g.rotation.y = ry;
  g.name = 'apprstory_ladder'; root.add(g);
  localBox(g, M.timber, -0.22, 0, 0, 0.07, 0.07, 2.6, 'apprstory_ladder_rail');
  localBox(g, M.timber, 0.22, 0, -0.5, 0.07, 0.07, 1.5, 'apprstory_ladder_rail');
  const snap = localBox(g, M.timber, 0.30, 0, 0.9, 0.07, 0.07, 0.7, 'apprstory_ladder_rail_snap');
  snap.rotation.y = 0.4;
  for (let i = 0; i < 6; i++) {
    localBox(g, M.timber, 0, 0, -1.15 + i * 0.46, 0.5, 0.06, 0.06, 'apprstory_ladder_rung');
  }
}

// a broken bench, collapsed to one side where a leg gave out.
function buildBrokenBench(root, M, cx, cz, ry) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; g.rotation.z = 0.18;
  g.name = 'apprstory_bench'; root.add(g);
  localBox(g, M.plank, 0, 0.42, 0, 1.5, 0.08, 0.34, 'apprstory_bench_seat');
  for (const sx of [-0.6, 0.6]) localBox(g, M.timber, sx, 0.21, 0, 0.08, 0.42, 0.30, 'apprstory_bench_leg');
  const off = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.10), M.timber);
  off.position.set(cx + 0.9, 0.05, cz + 0.3); off.rotation.z = Math.PI / 2;
  off.name = 'apprstory_bench_leg_off'; root.add(off);
  collideBox(cx, 0.35, cz, 1.6, 0.6, 0.5);
}

// abandoned tools dropped flat — an axe and a spade (no collider).
function buildTools(root, M, cx, cz) {
  const ah = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.70), M.timber);
  ah.position.set(cx, 0.05, cz); ah.rotation.y = 0.5; ah.name = 'apprstory_axe_haft'; root.add(ah);
  const abl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.18), M.metal);
  abl.position.set(cx + 0.30, 0.05, cz + 0.16); abl.rotation.y = 0.5; abl.name = 'apprstory_axe_head'; root.add(abl);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.80), M.timber);
  sh.position.set(cx + 0.60, 0.05, cz - 0.50); sh.rotation.y = -0.3; sh.name = 'apprstory_spade_haft'; root.add(sh);
  const sbl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.22), M.metal);
  sbl.position.set(cx + 0.72, 0.03, cz - 0.86); sbl.rotation.y = -0.3; sbl.name = 'apprstory_spade_blade'; root.add(sbl);
}

// a tipped iron brazier with its fire long cold — spilled black char + grey ash.
function buildBrazier(root, M, cx, cz) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.name = 'apprstory_brazier'; root.add(g);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.26, 10), M.metal);
  bowl.rotation.z = 1.0; bowl.position.set(0, 0.30, 0); bowl.name = 'apprstory_brazier_bowl'; g.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.09;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.metal);
    leg.position.set(Math.cos(a) * 0.18 - 0.10, 0.16, Math.sin(a) * 0.18); leg.rotation.z = 0.6;
    leg.name = 'apprstory_brazier_leg'; g.add(leg);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.40, 12), M.stain);
  ash.rotation.x = -Math.PI / 2; ash.position.set(0.45, 0.012, 0.10); ash.name = 'apprstory_brazier_ash'; g.add(ash);
  for (let i = 0; i < 4; i++) {
    localBox(g, M.black, 0.35 + (i % 2) * 0.20, 0.03, -0.10 + i * 0.12, 0.08, 0.06, 0.08, 'apprstory_brazier_char');
  }
  collideBox(cx, 0.25, cz, 0.7, 0.5, 0.7);
}

// a butcher's block — a thick worked stump, a dark-worked top, a cleaver left in it.
function buildButcherBlock(root, M, cx, cz) {
  const blk = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.80, 0.60), M.timber);
  blk.position.set(cx, 0.40, cz); blk.name = 'apprstory_butcher_block'; root.add(blk);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.48), M.stain);
  top.rotation.x = -Math.PI / 2; top.position.set(cx, 0.805, cz); top.name = 'apprstory_butcher_stain'; root.add(top);
  const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), M.timber);
  hnd.position.set(cx + 0.10, 0.86, cz + 0.18); hnd.name = 'apprstory_cleaver_haft'; root.add(hnd);
  const bld = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.16), M.metal);
  bld.position.set(cx + 0.10, 0.86, cz - 0.02); bld.rotation.x = 0.4; bld.name = 'apprstory_cleaver_blade'; root.add(bld);
  collideBox(cx, 0.40, cz, 0.72, 0.80, 0.70);
}

// a small bowl of vinegar gone to scum (the §8 counter-measure), grounded.
function buildVinegarBowl(root, M, cx, cz) {
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.12, 9), M.metal);
  bowl.position.set(cx, 0.06, cz); bowl.name = 'apprstory_vinegar_bowl2'; root.add(bowl);
  const scum = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 9), M.scum);
  scum.position.set(cx, 0.115, cz); scum.name = 'apprstory_vinegar_scum2'; root.add(scum);
}

// a second handcart tipped over, its load burst out; one wheel thrown off entirely.
function buildCart2(root, M) {
  const C = { x: 7.4, z: 37.5 };
  const g = new THREE.Group();
  g.position.set(C.x, 0.10, C.z);
  g.rotation.y = -0.5; g.rotation.z = 1.2;   // over on its side, askew
  g.name = 'apprstory_cart2'; root.add(g);
  localBox(g, M.timber, 0, 0.48, 0, 1.0, 0.10, 1.30, 'apprstory_cart2_bed');
  for (const sx of [-0.5, 0.5]) localBox(g, M.timber, sx, 0.62, 0, 0.06, 0.30, 1.30, 'apprstory_cart2_railx');
  for (const sz of [-0.64, 0.64]) localBox(g, M.timber, 0, 0.62, sz, 1.0, 0.30, 0.06, 'apprstory_cart2_railz');
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.10, 12), M.timber);
  w.position.set(-0.58, 0.40, 0.28); w.rotation.z = Math.PI / 2; w.name = 'apprstory_cart2_wheel'; g.add(w);
  for (const sx of [-0.30, 0.30]) localBox(g, M.timber, sx, 0.52, 1.15, 0.05, 0.05, 0.90, 'apprstory_cart2_shaft');
  collideBox(C.x, 0.5, C.z, 1.7, 1.0, 1.8);
  // spilled load on the cobbles (not children of the tilted cart → fallen out)
  const spill = [
    [M.cloth,  6.4, 0.11, 38.6, 0.46, 0.22, 0.30, 0.30],
    [M.cloth2, 8.3, 0.10, 38.4, 0.40, 0.20, 0.28, -0.50],
    [M.cloth,  6.9, 0.12, 39.2, 0.52, 0.24, 0.34, 0.15],
    [M.leather, 8.0, 0.10, 36.7, 0.30, 0.20, 0.22, -0.20],
  ];
  for (let i = 0; i < spill.length; i++) {
    const [mat, x, y, z, ww, hh, dd, ry] = spill[i];
    const b = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), mat);
    b.position.set(x, y, z); b.rotation.y = ry; b.name = 'apprstory_cart2_bundle'; root.add(b);
  }
  const off = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.10, 12), M.timber);
  off.position.set(9.0, 0.05, 39.6); off.rotation.x = Math.PI / 2; off.name = 'apprstory_cart2_wheeloff'; root.add(off);
}

// a dead draft beast collapsed in its harness near the second cart. A grey, box
// -figure body on its side, legs thrown out downhill, muzzle + hooves gone black.
function buildDeadAnimal(root, M, cx, cz, ry) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  g.name = 'apprstory_deadhorse'; root.add(g);
  const hide = M.cloth2;   // a grey draft beast, desaturated
  localBox(g, hide, 0, 0.38, 0.10, 0.78, 0.74, 1.70, 'apprstory_horse_body');
  localBox(g, hide, 0, 0.30, -0.85, 0.44, 0.44, 0.50, 'apprstory_horse_neck');
  localBox(g, hide, 0.05, 0.22, -1.25, 0.36, 0.34, 0.50, 'apprstory_horse_head');
  localBox(g, M.black, 0.06, 0.18, -1.55, 0.30, 0.28, 0.22, 'apprstory_horse_muzzle');
  const legZ = [-0.5, -0.2, 0.5, 0.8];
  for (let i = 0; i < legZ.length; i++) {
    const reach = 0.55 + (i % 2) * 0.12;
    localBox(g, hide, reach * 0.5, 0.16, legZ[i], reach, 0.16, 0.16, 'apprstory_horse_leg');
    localBox(g, M.black, reach + 0.06, 0.14, legZ[i], 0.12, 0.14, 0.16, 'apprstory_horse_hoof');
  }
  // collar + a broken shaft still lashed to it, reaching toward the cart (+local z)
  localBox(g, M.leather, 0, 0.42, -0.70, 0.50, 0.10, 0.14, 'apprstory_horse_collar');
  localBox(g, M.timber, 0, 0.30, 0.95, 0.06, 0.06, 0.90, 'apprstory_horse_shaft');
  collideBox(cx, 0.38, cz, 1.5, 0.74, 2.0);
}

// a dark stain worked into the cobbles under a long-lying body, with the faint
// scrub-marks of a brush that gave out (the mark matters more than the stain, §8).
function buildStainScrub(root, M, cx, cz, w, d, ry, scrubR) {
  const st = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.stain);
  st.rotation.set(-Math.PI / 2, 0, ry); st.position.set(cx, 0.014, cz);
  st.name = 'apprstory_stain'; root.add(st);
  const sc = new THREE.Mesh(new THREE.RingGeometry(scrubR * 0.6, scrubR, 14), M.scrub);
  sc.rotation.x = -Math.PI / 2; sc.position.set(cx + w * 0.4, 0.016, cz);
  sc.name = 'apprstory_stain_scrub'; root.add(sc);
  const mk = new THREE.Mesh(new THREE.PlaneGeometry(scrubR * 1.4, 0.12), M.scrub);
  mk.rotation.x = -Math.PI / 2; mk.position.set(cx + w * 0.8, 0.016, cz + 0.10);
  mk.name = 'apprstory_stain_scrub'; root.add(mk);
}

// --- the master scatter: refugee/flight debris banked to the sides & corners ---
function buildWardClutter(root, M, world) {
  // WEST WALL — a market stall gone over (x≈-15..-16.5, z≈20..24)
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.85), M.timber);
  board.position.set(-15.4, 0.07, 20.4); board.rotation.y = 0.30; board.name = 'apprstory_stall_board'; root.add(board);
  collideBox(-15.4, 0.20, 20.4, 1.8, 0.5, 1.0);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.90), M.cloth);
  awn.position.set(-15.9, 0.04, 21.3); awn.rotation.y = -0.40; awn.name = 'apprstory_stall_awning'; root.add(awn);
  buildPlanks(root, M, -14.4, 20.9);
  buildCrate(root, M, -15.6, 21.6, 0.40, true);
  buildCrate(root, M, -16.2, 22.7, -0.30, false);
  buildSack(root, M, -14.6, 22.1, M.cloth, 1.00, 0.50, true);
  buildSack(root, M, -15.1, 23.2, M.cloth2, 0.90, -0.40, false);

  // WEST WALL — broken crates + barrels (z≈33..40)
  buildTippedBarrel(root, M, -16.3, 34.0, 0.15, true);
  buildStandBarrel(root, M, -16.6, 35.4);
  buildCrate(root, M, -16.0, 36.7, 0.50, false);
  buildSack(root, M, -15.4, 35.2, M.cloth, 1.00, 0.30, true);
  buildSack(root, M, -16.2, 38.1, M.cloth3, 0.85, -0.60, false); // one oxblood accent, tiny
  buildBedroll(root, M, -15.6, 33.0, M.cloth2, 0.40);

  // THE WELL (-12.5,30) — dropped bucket, rope coils, spilled goods, vinegar bowl
  buildBucket(root, M, -11.0, 31.6, 0.70);
  buildRopeCoil(root, M, -13.6, 28.6);
  buildRopeCoil(root, M, -11.4, 28.9);
  buildSack(root, M, -13.8, 31.4, M.cloth, 0.90, 0.20, false);
  buildVinegarBowl(root, M, -13.9, 30.7);

  // EAST WALL near the mounting block (12.5,22) — wheel, bench, planks, ladder, tools
  buildCartwheel(root, M, 14.6, 25.0, 0.20);
  buildBrokenBench(root, M, 15.8, 27.6, -0.30);
  buildPlanks(root, M, 14.3, 30.2);
  buildLadder(root, M, 16.4, 20.6, 0.50);
  buildTools(root, M, 13.8, 24.2);
  buildCrate(root, M, 15.4, 22.6, 0.30, true);
  buildSack(root, M, 16.2, 29.1, M.cloth2, 1.00, 0.40, true);

  // EAST — a second tipped cart + a dead beast collapsed in its harness (x≈6..9)
  buildCart2(root, M);
  buildDeadAnimal(root, M, 6.8, 34.3, 0.15);

  // NW corner at the façade (x≈-14..-16, z≈17..19) — brazier, butcher's block, bundles
  buildBrazier(root, M, -14.5, 18.2);
  buildButcherBlock(root, M, -16.2, 18.4);
  buildBedroll(root, M, -14.0, 17.6, M.cloth, 0.20);
  buildSack(root, M, -15.5, 19.2, M.cloth, 1.00, -0.30, true);

  // NE corner at the façade (x≈14..16.5, z≈17..20) — barrels, a broken crate, sacks
  buildStandBarrel(root, M, 16.2, 18.2);
  buildTippedBarrel(root, M, 15.0, 18.6, -0.15, true);
  buildCrate(root, M, 16.4, 20.0, -0.40, false);
  buildSack(root, M, 14.4, 18.0, M.cloth2, 0.95, 0.50, true);

  // scout's register anchors over the notable new tableaux
  registerProp(world, 'ix_appr_deadhorse', 6.8, 0.6, 34.3, 2.6,
    'A draft beast down in its harness, still lashed to a broken shaft, the cart it drew tipped behind it.',
    'It went down where it stood and was never cut loose. The muzzle and the hooves have gone black. Whoever drove it did not come back for the cart.');
  registerProp(world, 'ix_appr_market', -15.5, 0.6, 21.6, 2.6,
    'A market stall gone over — the board down, the awning torn off, crates stove in and sacks split beside it.',
    'A day’s stall abandoned mid-trade and never righted. The grain has spilled and the flies are thick in it. Nobody came back to gather any of it up.');
  registerProp(world, 'ix_appr_well', -12.2, 0.6, 31.6, 2.6,
    'The well, a bucket knocked on its side and rope coiled by it, and one more fallen close against the stones.',
    'They came to the well and did not leave it. A bowl of vinegar sits scummed over at the rim — someone’s guard against the sickness, for all the good it did.');
}

// ---------------------------------------------------------------------------
// MORE DEAD, where they fell — slumped against the curtain walls, by the well,
// and by the second cart. Crude box-figures in the file's body style, some with
// the §8 dark blood-streaks, dark stains + scrub-marks worked in beneath them.
// ---------------------------------------------------------------------------
function buildWardDead(root, M) {
  // against the WEST curtain wall (head toward the wall), a stain scrubbed at
  placeDead(root, -16.6, 40.5, Math.PI / 2 + 0.12, { pose: 'facedown', cloth: 0x6b6656, seed: 44, stainR: 1.25 });
  buildStainScrub(root, M, -16.3, 40.7, 0.66, 1.0, 0.15, 0.7);

  // against the EAST curtain wall, cooler cloth, no blood — just the black hand
  placeDead(root, 16.6, 44.0, -Math.PI / 2 - 0.10, { pose: 'supine', cloth: 0x5c606a, seed: 55, stainR: 1.2 });
  buildStainScrub(root, M, 16.3, 44.2, 0.60, 0.95, -0.15, 0.65);

  // fallen at the WELL, close against the rim
  placeDead(root, -11.3, 31.9, 2.55, { pose: 'side', cloth: 0x6b6656, seed: 66, stainR: 1.2 });
  buildStainScrub(root, M, -11.5, 31.7, 0.62, 0.9, 0.30, 0.6);

  // by the tipped second cart / the dead beast
  placeDead(root, 8.5, 39.2, -0.70, { pose: 'facedown', cloth: 0x5c606a, seed: 77, stainR: 1.3 });

  // in the NW corner, among the bundles at the façade foot
  placeDead(root, -15.1, 17.7, 0.35, { pose: 'supine', cloth: 0x6b6656, seed: 88, stainR: 1.2 });
}

// ---------------------------------------------------------------------------
// DRIFTS OF DEAD FLIES + SCATTERED LIME, across the new clutter and corners and
// at the wall-feet and thresholds. Merged dark specks (flies, §8, NEVER named)
// and pale lime flecks. Stable scatter via the deterministic rr() above.
// ---------------------------------------------------------------------------
function buildWardFliesLime(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  drift(-15.5, 0.02, 22.0, 1.2, 1.0, 70);   // west market wreck
  drift(-16.2, 0.02, 36.0, 0.9, 1.4, 70);   // west barrels/crates
  drift(-12.5, 0.02, 31.0, 1.2, 1.0, 70);   // the well
  drift(15.6, 0.02, 27.6, 1.0, 1.4, 60);    // east bench/planks
  drift(7.4, 0.05, 38.3, 1.2, 1.1, 100);    // second cart's spilled load
  drift(6.8, 0.06, 34.3, 1.0, 1.1, 100);    // the dead beast
  drift(-15.0, 0.02, 18.3, 1.2, 0.8, 60);   // NW corner
  drift(15.5, 0.02, 18.4, 1.2, 0.8, 60);    // NE corner
  drift(-16.5, 0.03, 40.5, 0.6, 0.9, 45);   // west-wall body
  drift(16.6, 0.03, 44.0, 0.6, 0.9, 45);    // east-wall body
  mergedMesh(root, flies, M.fly, 'apprstory_flies2');

  const lime = [];
  const fleck = (cx, cz) => pushBox(lime, cx, 0.012, cz, rr(0.03, 0.10), 0.02, rr(0.03, 0.10));
  // banked along the west & east wall-feet the length of the ward
  for (let i = 0; i < 90; i++) fleck(-17.6 + rr(-0.3, 0.3), 16.5 + rr(0, 31));
  for (let i = 0; i < 90; i++) fleck(17.6 + rr(-0.3, 0.3), 16.5 + rr(0, 31));
  // at the great-door threshold — to the SIDES of the opening (lane kept clear)
  for (let i = 0; i < 40; i++) fleck(rr(-6.0, -2.7), 16.2 + rr(-0.3, 0.3));
  for (let i = 0; i < 40; i++) fleck(rr(2.7, 6.0), 16.2 + rr(-0.3, 0.3));
  // at the feet of the two sealed doors
  for (const [dx, dz] of [[-17.4, 26], [17.4, 38]]) {
    for (let i = 0; i < 26; i++) fleck(dx + rr(-0.4, 0.4), dz + rr(-0.9, 0.9));
  }
  mergedMesh(root, lime, M.lime, 'apprstory_lime2');
}

// ---------------------------------------------------------------------------
// SEALED DOORS (month 12) — boards nailed crosswise FROM THE YARD, a chalk cross,
// a chalked date. §8 sealed-door grammar: the living shut in, not out. Two of
// them, set into the curtain walls (x≈±17.7) facing into the ward.
// ---------------------------------------------------------------------------
function buildSealedDoor(root, M, wx, wz, faceX) {
  // faceX = +1 → leaf faces +x (west wall); -1 → faces −x (east wall)
  const g = new THREE.Group();
  g.position.set(wx, 0, wz);
  g.rotation.y = faceX > 0 ? Math.PI / 2 : -Math.PI / 2;  // leaf normal → into ward
  g.name = 'apprstory_sealeddoor';
  root.add(g);

  // door leaf, recessed a touch, framed by plain jambs (local: width along x, up y)
  localBox(g, M.door, 0, 1.15, 0.0, 1.10, 2.30, 0.10, 'apprstory_door_leaf');
  localBox(g, M.plank, -0.62, 1.15, 0.02, 0.14, 2.30, 0.10, 'apprstory_door_jamb');
  localBox(g, M.plank, 0.62, 1.15, 0.02, 0.14, 2.30, 0.10, 'apprstory_door_jamb');
  localBox(g, M.plank, 0, 2.38, 0.02, 1.40, 0.16, 0.10, 'apprstory_door_lintel');

  // boards nailed crosswise over the leaf (from the yard side, +local z)
  const b1 = localBox(g, M.plank, 0, 1.05, 0.09, 1.30, 0.16, 0.05, 'apprstory_door_board');
  b1.rotation.z = 0.42;
  const b2 = localBox(g, M.plank, 0, 1.35, 0.09, 1.30, 0.16, 0.05, 'apprstory_door_board');
  b2.rotation.z = -0.42;

  // chalk cross + a chalked date beneath it (thin planes on the leaf face)
  const crossGeo = new THREE.PlaneGeometry(0.05, 0.7);
  const cv = new THREE.Mesh(crossGeo, M.chalk);
  cv.position.set(0, 1.5, 0.12); cv.name = 'apprstory_door_chalk'; g.add(cv);
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.05), M.chalk);
  ch.position.set(0, 1.62, 0.12); ch.name = 'apprstory_door_chalk'; g.add(ch);
  const date = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.09), M.chalk);
  date.position.set(0, 1.05, 0.12); date.name = 'apprstory_door_date'; g.add(date);

  // the door reads as a wall stop already, but give the boards a thin collider
  collideBox(wx - faceX * 0.05, 1.1, wz, 0.2, 1.6, 1.2);
}

function buildSealedDoors(root, M) {
  buildSealedDoor(root, M, -17.7, 26, +1);   // west curtain wall, facing +x
  buildSealedDoor(root, M, +17.7, 38, -1);   // east curtain wall, facing −x
}

// ---------------------------------------------------------------------------
// DRIFTS OF DEAD FLIES — banked at the gate threshold, on the spilled cart load,
// and in the ward corners. Small merged dark specks. NEVER labelled (§8).
// ---------------------------------------------------------------------------
function buildFlies(root, M) {
  const flies = [];
  const drift = (cx, cy, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      pushBox(flies, cx + rr(-rx, rx), cy + rr(0, 0.03), cz + rr(-rz, rz),
        rr(0.02, 0.045), 0.02, rr(0.02, 0.045));
    }
  };
  // banked along the shut gate threshold (z≈+57.5), across the passage width
  drift(0, 0.01, 57.4, 2.6, 0.35, 150);
  // among the bodies
  drift(1.2, 0.02, 51.2, 0.6, 0.7, 70);
  drift(-1.4, 0.02, 48.6, 0.5, 0.5, 50);
  // on the spilled cart load
  drift(2.7, 0.05, 31.0, 1.0, 0.9, 90);
  // ward corners (curtain-wall meets façade / gatehouse)
  drift(-17.2, 0.01, 16.6, 0.5, 0.5, 60);
  drift(17.2, 0.01, 16.6, 0.5, 0.5, 60);
  drift(-17.2, 0.01, 47.4, 0.5, 0.5, 50);
  drift(17.2, 0.01, 47.4, 0.5, 0.5, 50);
  mergedMesh(root, flies, M.fly, 'apprstory_flies');
}

// ---------------------------------------------------------------------------
// VINEGAR + LIME at the gate threshold — the household's futile counter-measures.
// Bowls of vinegar gone to scum, scattered lime across the threshold (§8).
// ---------------------------------------------------------------------------
function buildThreshold(root, M) {
  for (const bx of [-1.6, 1.6]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.12, 9), M.metal);
    bowl.position.set(bx, 0.06, 56.9); bowl.name = 'apprstory_vinegar_bowl'; root.add(bowl);
    const scum = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 9), M.scum);
    scum.position.set(bx, 0.115, 56.9); scum.name = 'apprstory_vinegar_scum'; root.add(scum);
  }
  // scattered lime across the gate threshold (merged flecks)
  const lime = [];
  for (let i = 0; i < 80; i++) {
    pushBox(lime, rr(-2.7, 2.7), 0.012, rr(56.2, 57.6), rr(0.03, 0.11), 0.02, rr(0.03, 0.11));
  }
  mergedMesh(root, lime, M.lime, 'apprstory_lime');
}

// ===========================================================================
// DOCUMENTS — two readable leaves, each a parchment marker lying FLAT on a real
// surface (marker.y == surface-top Y — NO floating). §9 register: plain,
// concrete, feast-day dated, the writer STOPS. §6 voices: Stolz and Vogel.
// ===========================================================================
function makeMarker(root, mat, x, y, z, name, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.rotation.set(-Math.PI / 2, 0, ry);   // lie flat
  root.add(m);
  return m;
}

// 1) Marshal Stolz's order — carried out at the gate. Blunt, honest, a poor
//    speller. States what was done and stops; does not philosophise (§6, §9).
const DOC_STOLZ = {
  id: 'appr-stolz-order',
  type: 'Order', style: '',
  voice: 'Marshal Gerhart Stolz',
  dateText: 'the day after St. Nicholas',
  pages:
    'By the Kings hand the gate is shut and stays shut. None in nor out, sick or hole, ' +
    'by my word or his.\n\n' +
    'We turned them thre days. On the ferth they came in a croud and would not turn, and ' +
    'I gave the order, and it was done. I will not writ here what was done.\n\n' +
    'I have kild men at this gate that did no wrong but wish to leve. I set my name so no ' +
    'other man carries what is mine.\n\n' +
    'Gerhart Stolz, Marshal',
};

// 2) Vogel's running gate-tally — plain, official, chilling by its administration.
//    The count that stops (§6 Lenhart Vogel, style 'tally'; §9 the writer stops).
const DOC_VOGEL = {
  id: 'appr-vogel-gatetally',
  type: 'Gate tally', style: 'tally',
  voice: 'Lenhart Vogel, gate sergeant',
  dateText: 'the week of St. Nicholas',
  pages:
    'Marks at the gate, kept for the Marshal.\n\n' +
    '  Eve of St. Nicholas\n' +
    '    Turned at the wall ...... six\n' +
    '    Passed ................. none\n\n' +
    '  St. Nicholas\n' +
    '    Turned at the wall ...... eleven\n' +
    '    Passed ................. none\n\n' +
    '  The morrow\n' +
    '    Came in a body, would not turn ......\n\n' +
    'I have left the last mark off. The Marshal has that number, not me.',
};

function buildDocuments(root, M, world) {
  // Stolz's order — flat on the gate-ward's TABLE top (surface y = TABLE.topY).
  const sm = makeMarker(root, M.parchment, TABLE.cx - 0.18, TABLE.topY, TABLE.cz + 0.06,
    'apprstory_doc_' + DOC_STOLZ.id, 0.24);
  registerInteractable({
    object: sm, radius: 1.8,
    label: 'An order under a heavy seal, weighted flat on the gate-ward’s table.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_STOLZ); },
  });

  // Vogel's tally — flat on the BARREL top (surface y = BARREL.topY).
  const vm = makeMarker(root, M.parchment, BARREL.cx, BARREL.topY, BARREL.cz,
    'apprstory_doc_' + DOC_VOGEL.id, -0.35);
  registerInteractable({
    object: vm, radius: 1.8,
    label: 'A tally-board left on a barrel-head by the gate, ruled in a sergeant’s hand.',
    onExamine: () => { if (world.reader) world.reader.open(DOC_VOGEL); },
  });
}

// ===========================================================================
// EXAMINABLES — scout's plain register (§10): he describes what he sees and
// latches a second line on E. He does not know the whole story.
// ===========================================================================
function registerProp(world, name, x, y, z, radius, label, more) {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.set(x, y, z);
  if (world.scene) world.scene.add(anchor);
  registerInteractable({
    object: anchor, radius, label,
    onExamine: () => {
      const latch = world.flags.__examineLatch;
      if (typeof latch === 'function') latch(more);
    },
  });
}

function buildExaminables(world) {
  // 1) the bodies at the gate (anchor over the cluster)
  registerProp(world, 'ix_appr_bodies', 0.6, 0.6, 51.5, 3.0,
    'Bodies where they fell in the gate, not one of them laid out. The nearest is in a gate-ward’s harness.',
    'A bill lies where a hand let go of it, and a burst satchel by another. The fingers have gone black at the ends on all of them, and dark blood is dried under one face. The gate behind them is barred fast.');

  // 2) the tipped cart
  registerProp(world, 'ix_appr_cart', 2.6, 0.7, 30, 2.6,
    'A handcart gone over on its side, its load burst across the cobbles — bundles, a bedroll, a bowl.',
    'A whole house packed onto one cart, and it got no further than the yard. Nothing has been taken up since. The flies have found the bundles.');

  // 3) a boarded door with its chalk cross (west curtain wall)
  registerProp(world, 'ix_appr_door', -17.4, 1.4, 26, 2.4,
    'A door in the wall, boarded over with planks nailed crosswise. A cross is chalked on it, a date under.',
    'The nails are driven from the yard, not from within. Whoever was behind it was shut in, and not shut out.');
}
