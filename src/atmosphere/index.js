import * as THREE from 'three';
import { addLight, onUpdate } from '../core/scene.js';
import { createAtmoTextures } from './textures.js';
import {
  createAtmoMaterials, addGlassPlane, addGlow, addFlame, addSconce,
  addTableChandelier, addBeam, addDust,
} from './sources.js';
import { initUndercroftAtmo } from './undercroft-atmo.js';
import { initNordturmAtmo } from './nordturm-atmo.js';
import { initAudio } from './audio.js';

// ===========================================================================
// ATMOSPHERE MODULE — lighting, fog, and the motivating light-source meshes
// (scene-contract.md §7b, art-direction.md §1-3). Turns the flat geometry into
// the "cold stone emptiness cut by a few motivated pools of warm candlelight and
// cold window daylight" brief.
//
// Value structure: very low cool ambient (darks -> near black) + fog. The only
// bright things are self-lit window/sky planes (cold highlights) and flame cores
// (warm accents). Every real light sits at/behind a visible atmo_* source mesh.
//
// Real lights (8 total, physical falloff — three r169): 1 ambient, 1 cold
// directional key from the apse, 6 point lights. Everything else that "glows" is
// an emissive mesh with no light cost. No shadow maps. fog is the perf budget.
// ===========================================================================

// --- palette (art-direction.md §1) --------------------------------------------
const FOG_COLOR = 0x0c0f16;   // cool near-black base
const BG_COLOR = 0x090a10;
const AMBIENT = 0x242c38;     // cool fill so darks aren't pure void
const COLD_KEY = 0xaebfd4;    // directional daylight
const COLD_APSE = 0xbcd2e8;   // apse beacon point
const COLD_SHAFT = 0x9fb4cc;  // clerestory shaft point + beams
const WARM_SCONCE = 0xe89a4a; // sconce / chandelier point
const WARM_CHAND = 0xe8a24c;  // chandelier point
const WARM_FALLEN = 0xe8955a; // the impossibly still-lit fallen candle

export function initAtmosphere(world) {
  const scene = world.scene;

  // --- fog + background -------------------------------------------------------
  // Tuned so the apse window (~35 m from the shot-1 camera) still reads as a
  // beacon (its plane is fog:false) while distant stone falls into the dark and
  // the draw distance is hidden (perf budget).
  scene.fog = new THREE.Fog(FOG_COLOR, 7, 46);
  scene.background = new THREE.Color(BG_COLOR);

  const root = new THREE.Group();
  root.name = 'atmo_root';
  scene.add(root);

  const T = createAtmoTextures();
  const MAT = createAtmoMaterials();

  const warmLights = []; // { light, base, amp, speed, phase } — flicker targets
  const flames = [];     // { mat } — opacity flicker
  const collectFlame = (f) => { flames.push(f); return f; };

  // =========================================================================
  // 1. COLD WINDOW / SKY SOURCE MESHES  (the scene's highlights)
  // =========================================================================

  // APSE tracery window — the brightest thing in the scene (shots 1 & 3 beacon).
  addGlassPlane(root, 'atmo_glass_apse', 5.0, 5.0, [0, 4.5, -20.3], 0, T.glass);
  addGlow(root, 'atmo_glow_apse', [0, 4.6, -19.7], 7.5, T.glowCold, COLD_APSE, 0);

  // WEST clerestory windows (x=-6): faces +X into the nave.
  for (const z of [9, 3, -3, -9]) {
    addGlassPlane(root, 'atmo_glass_west', 1.4, 2.0, [-6.32, 7.0, z], Math.PI / 2, T.glass);
  }
  // EAST clerestory windows (x=+6): faces -X.
  for (const z of [-9, -3, 11]) {
    addGlassPlane(root, 'atmo_glass_east', 1.4, 2.0, [6.32, 7.0, z], -Math.PI / 2, T.glass);
  }

  // SIDE-CHAMBER window (x=+13): cold light behind the abandoned table (shot 4).
  addGlassPlane(root, 'atmo_glass_chamber', 3.6, 2.8, [13.28, 3.5, 4], -Math.PI / 2, T.glass);

  // SOUTH doorway sky (z=+15): bright cold exterior -> silhouette shot (5).
  addGlassPlane(root, 'atmo_sky_door', 3.0, 4.6, [0, 2.4, 15.55], Math.PI, T.sky);
  addGlow(root, 'atmo_glow_door', [0, 2.4, 15.2], 5.0, T.glowCold, 0xcdd8e4, Math.PI);

  // =========================================================================
  // 2. WARM CANDLE SOURCE MESHES
  // =========================================================================

  // Chandelier over the abandoned table (atmosphere's own iron ring + flames).
  const chand = addTableChandelier(root, 10.5, 2.55, 3.5, MAT, T.flame);
  chand.flames.forEach(collectFlame);
  addGlow(root, 'atmo_glow_chand', [10.5, 2.4, 3.5], 3.2, T.glowWarm, WARM_CHAND, -Math.PI / 2);

  // The impossibly still-lit candle on the fallen nave chandelier (shot 6).
  collectFlame(addFlame(root, 'atmo_flame_fallen', [0.5, 0.18, -4], 0.14, T.flame));
  addGlow(root, 'atmo_glow_fallen', [0.5, 0.42, -4], 1.6, T.glowWarm, WARM_FALLEN, 0);

  // Nave wall sconces. Two are truly lit (real point lights below); the rest are
  // glowing source meshes only (far enough that no light pool is needed).
  const sconceLit = [
    { x: -5.78, y: 2.35, z: 3 },    // west, midway (shot 1 warm accent, shot 2)
    { x: 5.78, y: 2.35, z: -5 },    // east, deeper nave
  ];
  sconceLit.forEach((s, i) => collectFlame(addSconce(root, `atmo_sconce_lit_${i}`, s.x, s.y, s.z, MAT, T.flame)));
  const sconceMeshOnly = [
    { x: -5.78, y: 2.35, z: -9 },   // west, near chancel
    { x: 5.78, y: 2.35, z: 9 },     // east, near entrance
  ];
  sconceMeshOnly.forEach((s, i) => collectFlame(addSconce(root, `atmo_sconce_${i}`, s.x, s.y, s.z, MAT, T.flame)));

  // =========================================================================
  // 3. REAL LIGHTS  (<= 8, physical falloff)
  // =========================================================================

  // (1) cool ambient fill — very low so darks read near-black.
  addLight(new THREE.AmbientLight(AMBIENT, 0.55));

  // (2) cold directional KEY, motivated by the apse/clerestory daylight.
  const key = new THREE.DirectionalLight(COLD_KEY, 0.6);
  key.position.set(0.5, 9, -18);
  key.target.position.set(0, 1.5, 4);
  root.add(key.target);
  addLight(key);

  // (3) cold APSE beacon point — blooms the window + pools on the chancel steps.
  const apse = new THREE.PointLight(COLD_APSE, 16, 26, 1.5);
  apse.position.set(0, 4.6, -18.7);
  addLight(apse);

  // (4) warm CHANDELIER point over the table.
  const chLight = new THREE.PointLight(WARM_CHAND, 10, 9, 1.7);
  chLight.position.set(10.5, 2.4, 3.5);
  addLight(chLight);
  warmLights.push({ light: chLight, base: 10, amp: 0.10, speed: 5.5, phase: 0.0 });

  // (5) warm FALLEN candle point (guttering — larger flicker).
  const fallen = new THREE.PointLight(WARM_FALLEN, 6, 7, 1.8);
  fallen.position.set(0.5, 0.5, -4);
  addLight(fallen);
  warmLights.push({ light: fallen, base: 6, amp: 0.28, speed: 7.5, phase: 1.7 });

  // (6) warm WEST sconce point (midway nave).
  const wSconce = new THREE.PointLight(WARM_SCONCE, 7, 7.5, 1.8);
  wSconce.position.set(-5.5, 2.55, 3);
  addLight(wSconce);
  warmLights.push({ light: wSconce, base: 7, amp: 0.16, speed: 6.2, phase: 3.1 });

  // (7) warm EAST sconce point (deeper nave).
  const eSconce = new THREE.PointLight(WARM_SCONCE, 7, 7.5, 1.8);
  eSconce.position.set(5.5, 2.55, -5);
  addLight(eSconce);
  warmLights.push({ light: eSconce, base: 7, amp: 0.16, speed: 6.7, phase: 0.9 });

  // (8) cold WEST clerestory shaft point — lifts the west aisle floor (shot 2).
  const shaftPt = new THREE.PointLight(COLD_SHAFT, 8, 9, 1.8);
  shaftPt.position.set(-4.6, 2.0, 1.5);
  addLight(shaftPt);

  // =========================================================================
  // 4. FAUX LIGHT-SHAFTS (additive god-rays, no light cost)
  // =========================================================================

  // West clerestory shafts across the aisle (shot 2 — the value/god-ray shot).
  addBeam(root, 'atmo_shaft_west_a', [-6.0, 7.0, 3.0], [-3.7, 0.06, 1.3], 0.7, 1.15, T.shaft, COLD_SHAFT, 0.5);
  addBeam(root, 'atmo_shaft_west_b', [-6.0, 7.0, -3.0], [-3.7, 0.06, -4.7], 0.7, 1.15, T.shaft, COLD_SHAFT, 0.42);
  // Broad apse shaft onto the chancel steps (shot 3).
  addBeam(root, 'atmo_shaft_apse', [0, 6.2, -20.0], [0, 0.3, -15.0], 1.7, 2.6, T.shaft, COLD_APSE, 0.4);
  // Doorway daylight spill (shot 5).
  addBeam(root, 'atmo_shaft_door', [0, 4.2, 15.0], [0, 0.1, 10.5], 1.0, 2.0, T.shaft, 0xcdd8e4, 0.34);

  // =========================================================================
  // 5. DUST MOTES in the west aisle shaft (polish; drifts each frame)
  // =========================================================================
  const dust = addDust(root, 'atmo_dust_west',
    { x: -4.8, y: 0.4, z: -1, w: 3.2, h: 6.4, d: 9 }, 55, T.mote, 0xcdd8e4);

  // =========================================================================
  // 6. FLICKER + DRIFT UPDATER
  // =========================================================================
  onUpdate((dt, t) => {
    for (const w of warmLights) {
      const n = Math.sin(t * w.speed + w.phase) * 0.6 + Math.sin(t * w.speed * 2.7 + w.phase * 1.7) * 0.4;
      w.light.intensity = w.base * (1 + w.amp * n);
    }
    for (const f of flames) {
      const p = f.mat.uuid.charCodeAt(0) || 1;
      f.mat.opacity = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t * 8 + p));
    }
    dust.drift(t);
  });

  // =========================================================================
  // 7. THE UNDERCROFT — crypt lighting + per-area fog (separate space below).
  //    Reuses this rig's root group + texture set; adds its own low-range
  //    lights and the descent fog-swap. (scene-contract.md shots 7/8/9)
  // =========================================================================
  initUndercroftAtmo(world, root, T);
  initNordturmAtmo(world, root, T);

  // =========================================================================
  // 8. AMBIENT SOUNDSCAPE — positional wind/drone bed + scheduled drips/bell/
  //    crackle, driving the procedural engine in core/audio.js. Placed last so
  //    all source positions above are settled.
  // =========================================================================
  initAudio(world);

  return root;
}
