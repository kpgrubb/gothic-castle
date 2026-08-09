import * as THREE from 'three';
import { addLight, onUpdate } from '../core/scene.js';
import { ps1ify } from '../core/ps1.js';

// ===========================================================================
// OUTDOOR WEATHER — rain, circling vultures, and an overcast open-air sky for
// the world's three far-off open-air "islands" (world-bible open-air regions):
//
//   • INNER WARD / arrival (the approach)  centre (0,0,36)     r≈28
//         — already skied + daylit by areas/approach.js; here it gets ONLY
//           rain + vultures (no sky, no daylight — approach.js owns those).
//   • THE CLOISTER                         centre (100,0,-100) r≈15
//         — currently dark & sky-less: gets sky + daylight + rain + vultures.
//   • THE HORTUS CLAUSUS (walled garden)   centre (150,0,100)  r≈15
//         — open-air: gets sky + a light daylight lift + rain + vultures.
//
// Matches the approach's exterior vocabulary (see areas/approach.js buildSky /
// buildDaylight): a BackSide vertex-gradient overcast sky box (MeshBasicMaterial,
// fog:false, renderOrder -1) and a cool HemisphereLight + soft directional fill
// added via addLight. Everything animates off engine time (onUpdate's dt / t) —
// never Date.now()/Math.random() (those THROW here); scatter is seeded with an
// LCG and index math so the whole system is deterministic and frozen-shot-safe.
//
// Cost: one merged LineSegments for ALL rain (positions updated in a typed loop
// only while the camera is outdoors), 15 three-triangle vulture silhouettes, two
// backdrop sky boxes, four lights. 60fps-cheap.
// ===========================================================================

// --- the open-air regions --------------------------------------------------
// c: centre (y ignored for the XZ gate), r: island radius. `sky` regions also
// receive a backdrop sky + a ramped daylight rig (hemi/dir target intensities).
const REGIONS = [
  { c: new THREE.Vector3(0, 0, 36), r: 28, sky: false },                     // Inner Ward (approach owns sky+light)
  { c: new THREE.Vector3(100, 0, -100), r: 15, sky: true, hemiT: 0.80, dirT: 0.24 }, // Cloister (was dark)
  { c: new THREE.Vector3(150, 0, 100), r: 15, sky: true, hemiT: 0.52, dirT: 0.16 },  // Hortus (light lift)
];

// --- rain tuning -----------------------------------------------------------
const RAIN_DROPS = 400;      // merged line-segment streaks in the pool
const RAIN_BOX = { w: 30, h: 20, d: 30 }; // camera-recentred field extent (metres)
const RAIN_BASE = 0.5;       // material opacity at full strength
const RAIN_FADE = 5.0;       // boundary fade band (m) — full inside r, →0 by r+FADE
const RAIN_WIND = 2.6;       // constant +X wind slant (m/s)
const RAIN_COLOR = 0x8894a0; // cool translucent grey

// --- overcast sky palette (matches approach.js) ----------------------------
const SKY_HORIZON = 0x9aa4b2;
const SKY_TOP = 0xc8d0da;
const HEMI_SKY = 0xc9d2dc, HEMI_GROUND = 0x3a3f47;
const DIR_COLOR = 0xb8c4d4;
const VULTURE_COLOR = 0x15130f; // near-black silhouette

// small deterministic LCG (no Math.random — it throws here)
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ===========================================================================
export function createWeather(world) {
  const root = new THREE.Group();
  root.name = 'weather_root';
  world.scene.add(root);

  // sky + daylight for the sky-flagged regions (Cloister + Hortus only)
  const dayRigs = [];
  for (const rg of REGIONS) {
    if (!rg.sky) continue;
    buildRegionSky(root, rg.c);
    dayRigs.push(buildRegionDaylight(world, rg));
  }

  const rain = buildRain(root);
  const vultures = buildVultures(root);

  // ---- single per-frame driver: daylight ramp, rain gate + fall, vultures ----
  let seeded = false;
  onUpdate((dt, t) => {
    const cam = world.camera;
    if (!cam) return;
    const a = seeded ? 1 - Math.pow(0.02, dt) : 1; // exp smoothing; snap first frame
    seeded = true;

    // DAYLIGHT — ramp each region's rig up only while the camera is within it,
    // so the sky-lift never blows out the dark candlelit interiors elsewhere.
    for (const rig of dayRigs) {
      const d = Math.hypot(cam.position.x - rig.c.x, cam.position.z - rig.c.z);
      const on = d < rig.r + 3;
      rig.hemi.intensity += ((on ? rig.hemiT : 0) - rig.hemi.intensity) * a;
      rig.dir.intensity += ((on ? rig.dirT : 0) - rig.dir.intensity) * a;
    }

    // RAIN GATE — spatial only (independent of world.currentZone, so fixed-camera
    // shots work): fade in when the camera XZ is inside ANY region, out past r+FADE.
    let target = 0;
    for (const rg of REGIONS) {
      const d = Math.hypot(cam.position.x - rg.c.x, cam.position.z - rg.c.z);
      const f = THREE.MathUtils.clamp((rg.r + RAIN_FADE - d) / RAIN_FADE, 0, 1);
      if (f > target) target = f;
    }
    rain.fade += (target - rain.fade) * a;
    rain.mat.opacity = RAIN_BASE * rain.fade;
    rain.mesh.visible = rain.fade > 0.01;
    if (rain.mesh.visible) updateRain(rain, cam, dt);

    // VULTURES — always circling (you only ever see the set overhead wherever
    // you stand). Cheap: 15 birds, three triangles each.
    updateVultures(vultures, t);
  });

  return root;
}

// --------------------------------------------------------------- SKY
// A far backdrop box (BackSide) enclosing one island: overcast grey with a
// vertical vertex gradient (horizon→top). Emissive MeshBasicMaterial, fog:false,
// renderOrder -1 — exactly the approach.js buildSky recipe, recentred per island.
function buildRegionSky(root, c) {
  const HX = 46, Y0 = -12, Y1 = 58, DH = 46;
  const geo = new THREE.BoxGeometry(2 * HX, Y1 - Y0, 2 * DH);
  geo.translate(c.x, (Y0 + Y1) / 2, c.z);
  const top = new THREE.Color(SKY_TOP), bot = new THREE.Color(SKY_HORIZON);
  const pos = geo.attributes.position, col = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - Y0) / (Y1 - Y0), 0, 1);
    tmp.copy(bot).lerp(top, Math.pow(t, 0.7)); // gradient reads mostly at the horizon
    col.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  });
  ps1ify(mat);
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'weather_sky';
  sky.renderOrder = -1;
  root.add(sky);
  return sky;
}

// --------------------------------------------------------------- DAYLIGHT
// A cool overcast HemisphereLight + a soft low cool directional fill, both
// starting at 0 and ramped up by the driver only when the camera is inside the
// region (so interiors stay candlelit). Added + tracked via addLight.
function buildRegionDaylight(world, rg) {
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, 0.0);
  hemi.position.set(rg.c.x, 40, rg.c.z);
  hemi.name = 'weather_daylight_hemi';
  addLight(hemi);

  const dir = new THREE.DirectionalLight(DIR_COLOR, 0.0);
  dir.position.set(rg.c.x - 22, 34, rg.c.z + 20);
  dir.target.position.set(rg.c.x, 0, rg.c.z);
  dir.name = 'weather_daylight_dir';
  addLight(dir);
  world.scene.add(dir.target);

  return { c: rg.c, r: rg.r, hemi, dir, hemiT: rg.hemiT, dirT: rg.dirT };
}

// --------------------------------------------------------------- RAIN
// ONE merged LineSegments: RAIN_DROPS thin vertical streaks in a box that is
// recentred on the camera every frame. Each drop stores a camera-relative
// position + a constant streak vector (along its wind-slanted velocity). Drops
// fall, drift with the wind, and recycle to the top of the box on the way out.
function buildRain(root) {
  const rnd = makeLCG(0x9e3779b1);
  const n = RAIN_DROPS;
  const rel = new Float32Array(n * 3);   // camera-relative x,y,z
  const spd = new Float32Array(n);       // fall speed (m/s)
  const sdx = new Float32Array(n);       // streak vector (leading→trailing)
  const sdy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rel[i * 3 + 0] = (rnd() - 0.5) * RAIN_BOX.w;
    rel[i * 3 + 1] = (rnd() - 0.5) * RAIN_BOX.h;
    rel[i * 3 + 2] = (rnd() - 0.5) * RAIN_BOX.d;
    const s = 9 + rnd() * 6;             // 9–15 m/s
    spd[i] = s;
    // streak points backward along the velocity (wind, -fall); length scales w/ speed
    const len = THREE.MathUtils.clamp(s * 0.06, 0.4, 0.9);
    const inv = len / Math.hypot(RAIN_WIND, s);
    sdx[i] = RAIN_WIND * inv;
    sdy[i] = -s * inv;
  }

  const positions = new Float32Array(n * 6); // 2 verts per streak
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);

  const mat = new THREE.LineBasicMaterial({
    color: RAIN_COLOR, transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.name = 'weather_rain';
  mesh.frustumCulled = false; // it follows the camera; never cull it
  mesh.visible = false;
  root.add(mesh);

  return { mesh, mat, geo, posAttr, positions, rel, spd, sdx, sdy, n, fade: 0 };
}

function updateRain(r, cam, dt) {
  const { rel, spd, sdx, sdy, positions, n } = r;
  const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
  const halfH = RAIN_BOX.h / 2, halfW = RAIN_BOX.w / 2, halfD = RAIN_BOX.d / 2;
  for (let i = 0; i < n; i++) {
    let x = rel[i * 3 + 0], y = rel[i * 3 + 1], z = rel[i * 3 + 2];
    y -= spd[i] * dt;          // fall
    x += RAIN_WIND * dt;       // wind drift
    if (y < -halfH) { y += RAIN_BOX.h; }      // recycle to the top
    if (x > halfW) x -= RAIN_BOX.w;           // wrap the box in X (wind carries it)
    else if (x < -halfW) x += RAIN_BOX.w;
    if (z > halfD) z -= RAIN_BOX.d; else if (z < -halfD) z += RAIN_BOX.d;
    rel[i * 3 + 0] = x; rel[i * 3 + 1] = y; rel[i * 3 + 2] = z;
    // world-space streak: lead vertex, then trailing vertex up the velocity
    const lx = cx + x, ly = cy + y, lz = cz + z;
    const b = i * 6;
    positions[b + 0] = lx;         positions[b + 1] = ly;         positions[b + 2] = lz;
    positions[b + 3] = lx - sdx[i]; positions[b + 4] = ly - sdy[i]; positions[b + 5] = lz;
  }
  r.posAttr.needsUpdate = true;
}

// --------------------------------------------------------------- VULTURES
// 5 dark silhouettes per outdoor centre (15 total). Each = a flat body lozenge
// (2 tris) + two swept wings (1 tri each, on pivots) sharing one near-black
// fog:false MeshBasicMaterial. They circle high overhead at varied radius /
// height / speed / phase (by index), flap slowly, and bank into the turn.
function buildVultures(root) {
  const mat = new THREE.MeshBasicMaterial({ color: VULTURE_COLOR, side: THREE.DoubleSide, fog: false });
  const group = new THREE.Group();
  group.name = 'weather_vultures';
  root.add(group);

  const birds = [];
  let gi = 0;
  for (const rg of REGIONS) {
    for (let i = 0; i < 5; i++, gi++) {
      const b = makeVulture(mat);
      group.add(b.node);
      // varied orbit params by global index (deterministic, no random)
      const radius = 6 + ((gi * 3) % 5) * 1.5;         // 6 .. 12
      const height = 14 + ((gi * 37) % 9);             // 14 .. 22
      const speed = 0.10 + ((gi * 2) % 3) * 0.05;      // 0.10 .. 0.20 rad/s
      const dir = (gi % 2) === 0 ? 1 : -1;             // alternate circling sense
      const phase = gi * 1.7;
      const flap = 1.4 + ((gi * 5) % 3) * 0.35;        // slow wing-beat rate
      birds.push({ ...b, cx: rg.c.x, cz: rg.c.z, radius, height, speed, dir, phase, flap, gi });
    }
  }
  return birds;
}

function makeVulture(mat) {
  const node = new THREE.Group();

  // BODY — a slim flat lozenge in the XZ plane, nose toward -Z (forward)
  const nose = [0, 0, -0.9], tail = [0, 0, 0.8], L = [-0.16, 0, 0], R = [0.16, 0, 0];
  const bp = [];
  pushTri(bp, nose, R, tail);
  pushTri(bp, nose, tail, L);
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  node.add(new THREE.Mesh(bodyGeo, mat));

  // WINGS — one swept triangle each, on a pivot at the spine so a z-roll flaps it
  const leftWing = wingPivot(mat, -1);
  const rightWing = wingPivot(mat, 1);
  node.add(leftWing, rightWing);

  return { node, leftWing, rightWing };
}

// a wing pivot: sign -1 = left (extends -X), +1 = right (+X)
function wingPivot(mat, sign) {
  const pivot = new THREE.Group();
  const shoulder = [0, 0, 0];
  const tip = [sign * 1.5, 0, -0.15];   // swept slightly back
  const trail = [sign * 0.28, 0, 0.55];
  const wp = [];
  pushTri(wp, shoulder, tip, trail);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  pivot.add(new THREE.Mesh(geo, mat));
  return pivot;
}

function pushTri(arr, a, b, c) { arr.push(...a, ...b, ...c); }

function updateVultures(birds, t) {
  for (const b of birds) {
    const ang = b.dir * t * b.speed + b.phase;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const x = b.cx + ca * b.radius;
    const z = b.cz + sa * b.radius;
    const y = b.height + Math.sin(t * 0.5 + b.phase) * 0.6; // gentle bob
    b.node.position.set(x, y, z);
    // face travel: velocity tangent = d/dang(pos) * dir
    const vx = -sa * b.dir, vz = ca * b.dir;
    b.node.rotation.y = Math.atan2(-vx, -vz); // forward (-Z) aligns to velocity
    b.node.rotation.z = -b.dir * 0.32;         // bank into the turn
    // slow wing-flap via a dihedral roll on each wing pivot
    const d = Math.sin(t * b.flap + b.phase) * 0.5 + 0.12;
    b.leftWing.rotation.z = d;
    b.rightWing.rotation.z = -d;
  }
}
