import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ps1ify, crunch } from '../core/ps1.js';

// ===========================================================================
// SHARED CORPSE + STAIN. PS1-era bodies (~Silent Hill / Resident Evil) were
// low-poly but NOT cubes: tapered limb "bones" run joint-to-joint, a rounded
// (squashed) head, and a single pixel texture doing the work. This replaces the
// crude axis-boxes across the areas with one convincing, posable corpse.
//
//   makeCorpse({ pose, cloth, seed, plague }) -> Group  (origin on the floor,
//     lying with the head toward +X; caller sets .position and .rotation.y)
//   makeStain({ r, seed }) -> Group  (a big soft dark-brown plague pool)
// ===========================================================================

// ---- deterministic tiny RNG (per corpse), so a seed gives a repeatable pose --
function rng(seed) { let s = (seed | 0) || 1; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

// ---- textures (tiny, crunch'd) --------------------------------------------
function px(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); crunch(t); return t;
}
function skinTex(plague) {
  return px(64, (g, s) => {
    g.fillStyle = plague ? '#8f8f82' : '#a9a08c'; g.fillRect(0, 0, s, s);       // greyed, waxy pallor
    for (let i = 0; i < 240; i++) {                                            // mottling + livor
      const v = Math.random();
      g.fillStyle = v < 0.28 ? '#6d6f63' : v < 0.52 ? '#7c6a5b' : v < 0.7 ? '#4d4a40' : '#9ba08f';
      g.globalAlpha = 0.5 + Math.random() * 0.5;
      g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 1 + ((Math.random() * 2) | 0), 1 + ((Math.random() * 2) | 0));
    }
    g.globalAlpha = 1;
  });
}
function clothTex(hex) {
  const base = new THREE.Color(hex);
  const dk = base.clone().multiplyScalar(0.62), lt = base.clone().multiplyScalar(1.18);
  const h = (c) => '#' + c.getHexString();
  return px(64, (g, s) => {
    g.fillStyle = h(base); g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { g.fillStyle = (y % 4 === 0) ? h(dk) : h(lt); g.globalAlpha = 0.18; g.fillRect(0, y, s, 1); }
    g.globalAlpha = 1;
    for (let i = 0; i < 180; i++) { g.fillStyle = Math.random() < 0.5 ? h(dk) : h(lt); g.globalAlpha = 0.4 + Math.random() * 0.5; g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 1, 1 + ((Math.random() * 2) | 0)); }
    // grime/stain wash toward the lower half (where a body rots into its clothes)
    g.globalAlpha = 0.5; g.fillStyle = '#2c2013'; g.fillRect(0, s * 0.55, s, s * 0.45);
    g.globalAlpha = 1;
  });
}

let MAT = null; const CLOTH = {};
function mats() {
  if (MAT) return MAT;
  MAT = {
    skin: ps1ify(new THREE.MeshLambertMaterial({ map: skinTex(true) })),
    black: ps1ify(new THREE.MeshLambertMaterial({ color: 0x100b08 })),   // blackened extremities / hair
    nail: ps1ify(new THREE.MeshLambertMaterial({ color: 0x241a12 })),
  };
  return MAT;
}
function clothMat(hex) {
  const key = hex >>> 0;
  if (!CLOTH[key]) CLOTH[key] = ps1ify(new THREE.MeshLambertMaterial({ map: clothTex(hex) }));
  return CLOTH[key];
}

// ---- a tapered "bone" cylinder spanning joint a -> b -----------------------
// Parts are collected per-material into geometry buckets, transformed, then
// merged into ONE mesh per material (3 draw calls per corpse, not ~20).
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1);
function push(bucket, geo, p, quat, scale) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), quat || new THREE.Quaternion(), scale || _s1));
  bucket.push(geo);
}
function bone(bucket, a, b, r0, r1) {
  _d.subVectors(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(a[0], a[1], a[2]));
  const len = (_d.length() || 0.01) + 0.03;                       // slight overlap into the joints
  _q.setFromUnitVectors(_up, _d.clone().normalize());
  push(bucket, new THREE.CylinderGeometry(r1, r0, len, 6), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], _q.clone());
}
function joint(bucket, p, r) { push(bucket, new THREE.SphereGeometry(r, 6, 4), p); }
function mass(bucket, p, sx, sy, sz, yaw) {
  push(bucket, new THREE.SphereGeometry(0.5, 8, 6), p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw || 0, 0)), new THREE.Vector3(sx, sy, sz));
}

// ---- pose skeletons (local space; lying flat, head toward +X, y = off ground)
// Each returns joints keyed by name. Values are [x,y,z].
function skeleton(pose, rand) {
  const j = (rand() - 0.5); // small jitter helper
  const y = 0.13;
  if (pose === 'facedown') {
    return {
      pelvis: [-0.30, 0.11, 0], chest: [0.22, 0.12, 0.02 * j], neck: [0.37, 0.12, 0], head: [0.5, 0.11, 0.04],
      shL: [0.24, 0.12, 0.18], shR: [0.24, 0.12, -0.18],
      elbL: [0.34, 0.11, 0.34], elbR: [0.30, 0.11, -0.33], wrL: [0.5, 0.09, 0.4], wrR: [0.46, 0.09, -0.42],
      hipL: [-0.38, 0.11, 0.11], hipR: [-0.38, 0.11, -0.11],
      knL: [-0.66, 0.11, 0.13], knR: [-0.7, 0.1, -0.1], anL: [-0.92, 0.09, 0.12], anR: [-0.98, 0.08, -0.12],
    };
  }
  if (pose === 'side') { // curled on one side, knees drawn up
    return {
      pelvis: [-0.28, 0.14, 0.02], chest: [0.2, 0.16, -0.04], neck: [0.35, 0.16, -0.05], head: [0.48, 0.15, -0.08],
      shL: [0.22, 0.18, 0.08], shR: [0.22, 0.13, -0.14],
      elbL: [0.06, 0.14, 0.16], elbR: [0.08, 0.1, -0.2], wrL: [-0.1, 0.11, 0.12], wrR: [-0.08, 0.1, -0.14],
      hipL: [-0.36, 0.14, 0.08], hipR: [-0.36, 0.13, -0.08],
      knL: [-0.5, 0.16, 0.24], knR: [-0.52, 0.13, 0.18], anL: [-0.34, 0.11, 0.36], anR: [-0.36, 0.1, 0.3],
    };
  }
  if (pose === 'slumped') { // seated, back low, head fallen forward (against a wall/desk)
    return {
      pelvis: [-0.1, 0.08, 0], chest: [0.02, 0.55, 0.05], neck: [0.05, 0.78, 0.12], head: [0.1, 0.86, 0.2],
      shL: [-0.02, 0.72, 0.19], shR: [-0.02, 0.72, -0.19],
      elbL: [0.06, 0.42, 0.24], elbR: [0.06, 0.42, -0.24], wrL: [0.2, 0.18, 0.2], wrR: [0.2, 0.18, -0.2],
      hipL: [-0.16, 0.1, 0.12], hipR: [-0.16, 0.1, -0.12],
      knL: [0.28, 0.12, 0.15], knR: [0.3, 0.12, -0.14], anL: [0.6, 0.08, 0.14], anR: [0.62, 0.08, -0.13],
    };
  }
  // default: supine (on back), CONTORTED for 3-D relief — one arm flung out on
  // the ground, the other folded up across the chest; one leg extended, the
  // other knee drawn up high. Reads unmistakably as a fallen body.
  return {
    pelvis: [-0.34, y, 0], chest: [0.24, y + 0.03, 0], neck: [0.42, y + 0.04, 0.02], head: [0.57, y + 0.04, 0.05 + 0.03 * j],
    shL: [0.28, y + 0.02, 0.2], shR: [0.28, y + 0.02, -0.2],
    elbL: [0.14, y - 0.02, 0.44], wrL: [-0.06, y - 0.04, 0.57],           // L arm flung out
    elbR: [0.36, y + 0.15, -0.24], wrR: [0.18, y + 0.13, -0.03],          // R forearm folded onto the chest
    hipL: [-0.42, y, 0.13], hipR: [-0.42, y, -0.13],
    knL: [-0.8, y - 0.01, 0.17], anL: [-1.14, y - 0.05, 0.2],             // L leg extended
    knR: [-0.5, y + 0.28, -0.17], anR: [-0.7, y - 0.02, -0.22],           // R knee drawn up high
  };
}

/**
 * A low-poly corpse. opts:
 *   pose   'supine' | 'facedown' | 'side' | 'slumped'   (default 'supine')
 *   cloth  hex garment colour (default a muted brown-grey)
 *   seed   integer — repeatable pose jitter
 *   plague true → waxy/greyed pallor (default true)
 *   scale  overall size multiplier (default 1)
 */
export function makeCorpse(opts = {}) {
  const { pose = 'supine', cloth = 0x4b4535, seed = 1, scale = 1.12 } = opts;
  const M = mats(), C = clothMat(cloth), rand = rng(seed);
  const s = skeleton(pose, rand);
  for (const k in s) { s[k] = [s[k][0] + (rand() - 0.5) * 0.03, s[k][1] + (rand() - 0.5) * 0.02, s[k][2] + (rand() - 0.5) * 0.03]; }
  const clo = [], skin = [], black = [];   // geometry buckets per material

  // TORSO — a narrow flat slab oriented along the pelvis→chest axis + hips + neck
  const tmid = [(s.pelvis[0] + s.chest[0]) / 2, Math.max(0.13, (s.pelvis[1] + s.chest[1]) / 2), (s.pelvis[2] + s.chest[2]) / 2];
  const tyaw = -Math.atan2(s.chest[2] - s.pelvis[2], s.chest[0] - s.pelvis[0]);
  const along = Math.hypot(s.chest[0] - s.pelvis[0], s.chest[2] - s.pelvis[2]);
  mass(clo, tmid, Math.max(0.6, along * 1.5), 0.3, 0.44, tyaw);
  mass(clo, [s.pelvis[0], tmid[1] - 0.01, s.pelvis[2]], 0.34, 0.28, 0.4, tyaw);
  bone(skin, s.chest, s.neck, 0.07, 0.055);

  // HEAD — squashed skin sphere + a dark hair cap
  const hq = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.7, 0));
  const hsc = new THREE.Vector3(1.02, 0.94, 0.9);
  push(skin, new THREE.SphereGeometry(0.125, 7, 6), s.head, hq.clone(), hsc.clone());
  push(black, new THREE.SphereGeometry(0.13, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), s.head, hq.clone(), hsc.clone());

  // ARMS — upper clothed, forearm bare skin, blackened hand + elbow round
  for (const [sh, el, wr] of [[s.shL, s.elbL, s.wrL], [s.shR, s.elbR, s.wrR]]) {
    bone(clo, sh, el, 0.075, 0.06);
    joint(skin, el, 0.056);
    bone(skin, el, wr, 0.056, 0.04);
    push(black, new THREE.SphereGeometry(0.056, 5, 4), wr, null, new THREE.Vector3(1.25, 0.7, 0.95));
  }
  // LEGS — thigh clothed, shin bare skin, blackened foot + knee round
  for (const [hip, kn, an] of [[s.hipL, s.knL, s.anL], [s.hipR, s.knR, s.anR]]) {
    bone(clo, hip, kn, 0.1, 0.07);
    joint(skin, kn, 0.066);
    bone(skin, kn, an, 0.066, 0.05);
    push(black, new THREE.BoxGeometry(0.14, 0.075, 0.1),
      [an[0] - 0.05, Math.max(0.038, an[1] - 0.01), an[2]], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.5, 0)));
  }

  const g = new THREE.Group(); g.name = 'corpse';
  if (clo.length) g.add(new THREE.Mesh(mergeGeometries(clo, false), C));
  if (skin.length) g.add(new THREE.Mesh(mergeGeometries(skin, false), M.skin));
  if (black.length) g.add(new THREE.Mesh(mergeGeometries(black, false), M.black));
  g.scale.setScalar(scale);
  return g;
}

// ---- STAIN: a big soft dark-brown plague pool (canvas alpha, laid flat) -----
let STAINTEX = null;
function stainTex() {
  if (STAINTEX) return STAINTEX;
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const blob = (x, y, r, a, col) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(0.65, `rgba(${col},${a * 0.6})`); grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  };
  const C0 = '34,22,12', C1 = '46,30,18', C2 = '20,12,7';
  blob(64, 64, 52, 0.85, C0);                                  // main pool
  for (let i = 0; i < 22; i++) {                               // spreading blotches + tendrils
    const ang = Math.random() * 7, rad = 20 + Math.random() * 40;
    blob(64 + Math.cos(ang) * rad, 64 + Math.sin(ang) * rad, 8 + Math.random() * 20, 0.5 + Math.random() * 0.4, Math.random() < 0.4 ? C2 : C1);
  }
  blob(64, 64, 30, 0.9, C2);                                   // dark centre (soaked)
  const t = new THREE.CanvasTexture(c); crunch(t); t.needsUpdate = true;
  STAINTEX = t; return t;
}

/** A big soft dark-brown plague pool, laid flat on the floor. opts: { r=1.3, seed=1 } */
export function makeStain(opts = {}) {
  const { r = 1.3, seed = 1 } = opts, rand = rng(seed);
  const g = new THREE.Group(); g.name = 'plague_stain';
  const mat = new THREE.MeshBasicMaterial({ map: stainTex(), transparent: true, depthWrite: false, opacity: 0.9 });
  const main = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r), mat);
  main.rotation.x = -Math.PI / 2; main.position.y = 0.02; main.renderOrder = 1; g.add(main);
  // a couple of offset outliers so the pool reads irregular, not a disc
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(r * (0.7 + rand() * 0.5), r * (0.7 + rand() * 0.5)), mat);
    p.rotation.x = -Math.PI / 2; p.rotation.z = rand() * 6;
    p.position.set((rand() - 0.5) * r * 1.3, 0.021 + i * 0.002, (rand() - 0.5) * r * 1.3); p.renderOrder = 1; g.add(p);
  }
  return g;
}
