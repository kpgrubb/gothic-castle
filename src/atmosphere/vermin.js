import * as THREE from 'three';
import { ps1ify } from '../core/ps1.js';

// ===========================================================================
// VERMIN — the writhing filth of the plague. Seething PATCHES of maggots and a
// few slow-scuttling cockroaches on the interior floors, always beside the
// dead / the decay. The horror here is comprehension, not a jump-scare: grubs
// heaving on the flagstones by a composed body, roaches creeping across a
// stain, amplify the plague grammar the architecture and area modules already
// speak (bodies, dark set stains, drifts of dead flies, futile lime).
//
// Cheapness: everything is TWO instanced meshes (maggots + roaches), two draw
// calls, tiny boxes, no colliders, no lights. Animated purely off ENGINE time
// (the elapsed value the main loop feeds each updater / world.elapsed) — never
// Date.now()/Math.random() (both THROW in this codebase). All per-creature
// scatter is seeded by a small LCG so it is stable across loads.
//
// Grounded at each area's ACTUAL floor Y + ~0.02 so the creatures sit ON the
// stone, never sunk into it. Crypt floor y=-6; every island floor y=0.
// ===========================================================================

// --- palette ---------------------------------------------------------------
const MAGGOT_COLOR = 0xcfc6a8;   // pale off-white / yellowish grub
const ROACH_COLOR = 0x201814;    // near-black carapace

// --- curated patch list ----------------------------------------------------
// Each patch sits on the floor BESIDE a corpse / stain / decay anchor read out
// of the architecture + area modules. (area, x, y, z). y is the real floor Y.
const PATCHES = [
  // CRYPT / UNDERCROFT (src/architecture/undercroft.js — floor y=-6). Plague
  // pit centred (0,-8); ossuary niches at z=-6 and z=-11 on the ±5 walls.
  { area: 'crypt',     x: 1.6,   y: -6, z: -8.0 },   // by the sealed plague pit (east lip, guttered candle)
  { area: 'crypt',     x: -1.3,  y: -6, z: -8.0 },   // by the plague pit (west lip)
  { area: 'crypt',     x: 3.7,   y: -6, z: -6.0 },   // under the east "hero" ossuary niche
  { area: 'crypt',     x: -3.6,  y: -6, z: -11.0 },  // under the west far ossuary niche

  // NAVE / SIDE-CHAMBER DECAY (src/architecture/decay.js — floor y=0). Fallen
  // chandelier (-0.5,-4) + wax pool; collapsed west-bay rubble (-4,-8.2).
  { area: 'decay',     x: 0.3,   y: 0,  z: -4.0 },   // in the hardened wax pool under the crashed chandelier
  { area: 'decay',     x: -3.6,  y: 0,  z: -7.6 },   // at the collapsed-vault rubble pile

  // INFIRMARY (src/areas/infirmary.js — floor y=0, island centre (-100,0)).
  // Two bodies on the FLOOR between the beds; a scrubbed stain by a bed-foot.
  { area: 'infirmary', x: -102.8, y: 0, z: -1.5 },   // beside the floor body between the west beds
  { area: 'infirmary', x: -100.8, y: 0, z: 4.9 },    // beside the second floor body
  { area: 'infirmary', x: -104.4, y: 0, z: 0.6 },    // on the set stain by the bed-foot

  // CHAPEL (src/areas/chapel.js — floor y=0, island (-100,100)). Father Anselm
  // composed at the altar step (x=-100, z≈95), a set stain beneath him.
  { area: 'chapel',    x: -99.0, y: 0, z: 95.3 },    // beside Anselm at the altar step
  { area: 'chapel',    x: -100.9, y: 0, z: 95.8 },   // on the stain / flies banked to the body

  // KEEP (src/areas/keep.js — floor y=0, island (-100,-100)). One man down in
  // the hall by the west wall (-105.2,-97), stain + scrub-marks beneath.
  { area: 'keep',      x: -104.2, y: 0, z: -97.0 },  // beside the hall body / on the worked-in stain
  { area: 'keep',      x: -105.3, y: 0, z: -95.6 },  // trailing off the stain toward the hearth

  // LONG GALLERY (src/areas/long-gallery.js — floor y=0). A man sat down before
  // the clock and did not get up (≈0.5,0,-176.4). Plague grammar lies light.
  { area: 'gallery',   x: 1.3,   y: 0,  z: -176.2 }, // beside the slumped man before the clock

  // CLOISTER (src/areas/cloister.js — floor y=0, island (100,-100)). Two bodies
  // fallen in the walk (99.0,-90.4) & (101.6,-89.8), blood pools set into stone.
  { area: 'cloister',  x: 98.2,  y: 0, z: -90.6 },   // beside the first cloister body
  { area: 'cloister',  x: 100.3, y: 0, z: -89.6 },   // between the two bodies
];

// --- deterministic LCG (seeded per patch; never Math.random) ---------------
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

/**
 * Populate the castle floors with writhing vermin. Self-registers its meshes on
 * world.scene and pushes ONE per-frame animator onto world.updaters.
 * @param {object} world  shared world (scene, updaters, elapsed, dt, ...)
 */
export function createVermin(world) {
  const root = new THREE.Group();
  root.name = 'vermin_root';
  if (world.scene) world.scene.add(root);

  // Lambert so the grubs catch the guttering candle / cold window pools; PS1
  // vertex-snap + dither via ps1ify to match the house material feel.
  const maggotMat = ps1ify(new THREE.MeshLambertMaterial({ color: MAGGOT_COLOR, flatShading: true }));
  const roachMat = ps1ify(new THREE.MeshLambertMaterial({ color: ROACH_COLOR, flatShading: true }));

  // Tiny shared geometries. Maggot: a short pale capsule read as a box (~2×2×6
  // cm). Roach: a flat oval body read as a box (~1.6 cm long, ~1 cm wide, low).
  const maggotGeo = new THREE.BoxGeometry(0.02, 0.02, 0.06);
  const roachGeo = new THREE.BoxGeometry(0.012, 0.005, 0.02);

  // --- build per-creature instance data (seeded, stable) -------------------
  const maggots = [];  // { x, y, z, yaw, phase, speed, bob, jit, jitPhase, jitSpeed, curl }
  const roaches = [];   // { cx, cz, y, rx, rz, ang, angSpeed, dartPhase, dartSpeed }

  for (let pi = 0; pi < PATCHES.length; pi++) {
    const p = PATCHES[pi];
    const rng = makeRng(1000 + pi * 7919);
    // maggots sit with their box CENTRE at floorY + 0.02 + half-height, so the
    // underside rests ~0.02 above the stone. Bob only ever lifts them.
    const magY = p.y + 0.02 + 0.01;
    const roachY = p.y + 0.02 + 0.0025;

    // MAGGOTS — a seething blob, radius ~0.2 m (a ~0.4 m patch). 15–30.
    const nMag = 15 + Math.floor(rng() * 16);
    for (let i = 0; i < nMag; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 0.2;   // sqrt → even area fill within the blob
      maggots.push({
        x: p.x + Math.cos(a) * r,
        z: p.z + Math.sin(a) * r,
        y: magY,
        yaw: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
        speed: 4.5 + rng() * 5.5,          // writhe rate
        bob: 0.006 + rng() * 0.006,        // vertical wriggle amplitude
        jit: 0.004 + rng() * 0.005,        // tiny in-plane crawl jitter
        jitPhase: rng() * Math.PI * 2,
        jitSpeed: 3 + rng() * 4,
        curl: 0.25 + rng() * 0.35,         // how far the body flexes/tilts
      });
    }

    // COCKROACHES — sparse (1–3 per patch), creeping short looping paths with
    // an occasional dart. Seeded near the patch centre.
    const nRoach = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < nRoach; i++) {
      const a = rng() * Math.PI * 2;
      const o = rng() * 0.12;              // small offset of the loop centre
      roaches.push({
        cx: p.x + Math.cos(a) * o,
        cz: p.z + Math.sin(a) * o,
        y: roachY,
        rx: 0.10 + rng() * 0.16,           // loop radii (an irregular ellipse)
        rz: 0.10 + rng() * 0.16,
        ang: rng() * Math.PI * 2,
        angSpeed: (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.9),
        dartPhase: rng() * Math.PI * 2,
        dartSpeed: 0.6 + rng() * 1.4,       // slow creep / occasional dart cadence
      });
    }
  }

  const maggotMesh = new THREE.InstancedMesh(maggotGeo, maggotMat, Math.max(1, maggots.length));
  maggotMesh.name = 'vermin_maggots';
  maggotMesh.frustumCulled = false;        // scattered across the whole castle
  maggotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(maggotMesh);

  const roachMesh = new THREE.InstancedMesh(roachGeo, roachMat, Math.max(1, roaches.length));
  roachMesh.name = 'vermin_roaches';
  roachMesh.frustumCulled = false;
  roachMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(roachMesh);

  // --- per-frame animation -------------------------------------------------
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  const step = (t, dt) => {
    // MAGGOTS writhe: vertical wriggle + tiny in-plane jitter + a body-curl tilt,
    // each maggot on its own phase so the patch SEETHES rather than pulsing.
    for (let i = 0; i < maggots.length; i++) {
      const g = maggots[i];
      const w = Math.sin(t * g.speed + g.phase);
      const w2 = Math.sin(t * g.speed * 0.7 + g.phase * 1.3);
      pos.set(
        g.x + g.jit * Math.sin(t * g.jitSpeed + g.jitPhase),
        g.y + g.bob * (0.5 + 0.5 * w),                       // lift only, stays on stone
        g.z + g.jit * Math.cos(t * g.jitSpeed * 0.9 + g.jitPhase),
      );
      // curl the grub about its side (x) and wag its heading (y) as it heaves
      e.set(g.curl * w, g.yaw + 0.25 * w2, g.curl * 0.4 * w2);
      q.setFromEuler(e);
      m.compose(pos, q, scl);
      maggotMesh.setMatrixAt(i, m);
    }
    if (maggots.length) maggotMesh.instanceMatrix.needsUpdate = true;

    // COCKROACHES scuttle: creep along an elliptical loop, speed modulated so
    // they pause then dart; oriented to face their heading (long axis = velocity).
    for (let i = 0; i < roaches.length; i++) {
      const r = roaches[i];
      const dart = 0.35 + 0.65 * Math.max(0, Math.sin(t * r.dartSpeed + r.dartPhase));
      r.ang += r.angSpeed * dart * dt;
      const x = r.cx + Math.cos(r.ang) * r.rx;
      const z = r.cz + Math.sin(r.ang) * r.rz;
      // velocity along the loop → heading (yaw); box long axis is z, so face +z along v
      const vx = -Math.sin(r.ang) * r.rx * r.angSpeed;
      const vz = Math.cos(r.ang) * r.rz * r.angSpeed;
      const yaw = Math.atan2(vx, vz);
      pos.set(x, r.y, z);
      q.setFromAxisAngle(up, yaw);
      m.compose(pos, q, scl);
      roachMesh.setMatrixAt(i, m);
    }
    if (roaches.length) roachMesh.instanceMatrix.needsUpdate = true;
  };

  // Seed the matrices once so a frozen first frame is already correct (nothing
  // parked at the world origin), then register the single animator.
  step(0, 0);
  world.updaters.push((dt, elapsed) => step(elapsed !== undefined ? elapsed : world.elapsed, dt));

  return root;
}
