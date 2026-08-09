import * as THREE from 'three';
import { addLight, onUpdate } from '../core/scene.js';
import { addGlassPlane, addGlow, addFlame, addBeam } from './sources.js';

// ===========================================================================
// UNDERCROFT ATMOSPHERE — the crypt is the darkest, dampest, most oppressive
// beat (scene-contract.md §6 shots 7/8/9; art-direction.md §2/§3). One cold
// motivated KEY (moonlight down the grate light-well) and two warm guttering
// candles that let the plague pit + ossuary bones read. Ambient stays near
// black and cold; per-area fog thickens on descent.
//
// Crypt volume: floor y=-6, ceiling y≈-3.2, footprint x[-5,5] z[-14,-3].
// Reuses the atmosphere source-mesh helpers (addGlassPlane/addGlow/addFlame/
// addBeam) and the already-built texture set T. Meshes are atmo_*. Adds ≤4 real
// lights, all low-range so cost stays down.
// ===========================================================================

// --- palette (art-direction.md §1) -----------------------------------------
const MOON_COLD = 0x9fb0c4;   // cold moonlight key (source + point)
const MOON_HALO = 0xcdd8e4;   // near-white bloom at the grate
const CRYPT_FILL = 0x6f8296;  // very low cold fill so darks aren't pure void
const WARM_CANDLE = 0xe8955a; // guttering crypt candles

// --- per-area fog targets (this is the ONLY dynamic global-fog touch) -------
// Nave = the setting index.js established; Crypt = damper, colder, tighter.
const FOG_NAVE = { near: 7, far: 46, color: new THREE.Color(0x0c0f16) };
const FOG_CRYPT = { near: 3, far: 18, color: new THREE.Color(0x070a0e) };
const CRYPT_ENTER_Y = -3;     // camera.y below this => in the crypt

/**
 * Light + fog the undercroft. Called from initAtmosphere AFTER the nave rig,
 * so it can reuse the same root group + texture set and only ADDS to the scene.
 * @param {object} world  shared world (scene, camera, ...)
 * @param {THREE.Group} root  atmo_root
 * @param {object} T  the created atmosphere textures (glass/glowCold/glowWarm/shaft/flame)
 */
export function initUndercroftAtmo(world, root, T) {
  const scene = world.scene;

  const crypt = new THREE.Group();
  crypt.name = 'atmo_crypt';
  root.add(crypt);

  const warmLights = []; // { light, base, amp, speed, phase }
  const flames = [];     // { mat }

  // =========================================================================
  // 1. MOONLIGHT — the crypt's cold key, down the open grate light-well.
  //    Grate centred (0,-3.25,-5); vault open above at x[-0.75,0.75]
  //    z[-5.75,-4.25]. Must read in shots 8 & 9.
  // =========================================================================

  // Cold emissive SOURCE mesh: a bright plane laid flat just under the grate,
  // the "sky" seen up through the bars. fog:false (via addGlassPlane) keeps it
  // a highlight. DoubleSide, so orientation only affects the normal.
  const grateGlow = addGlassPlane(crypt, 'atmo_glass_grate', 1.5, 1.5,
    [0, -3.22, -5], 0, T.glass, MOON_HALO);
  grateGlow.rotation.x = -Math.PI / 2; // lay flat, facing down into the crypt

  // Soft cold bloom at the grate mouth (bloom, no light cost).
  addGlow(crypt, 'atmo_glow_grate', [0, -3.5, -5], 2.2, T.glowCold, MOON_COLD, 0);

  // Faux additive shaft from the grate down to the floor pool (reuse addBeam).
  addBeam(crypt, 'atmo_shaft_grate', [0, -3.3, -5], [0, -6.0, -5],
    0.72, 1.0, T.shaft, MOON_COLD, 0.5);

  // (real light 1) cold POINT in the well — the visible-source cold key. Low
  // range so it pools on the floor (~0,-6,-5) and dies before the walls.
  const moon = new THREE.PointLight(MOON_COLD, 8, 10, 1.8);
  moon.position.set(0, -4.0, -5);
  addLight(moon);

  // =========================================================================
  // 2. WARM GUTTERING CANDLES — on the plague-pit rim and by the east niche,
  //    so the pit cover and the ossuary bones (shot 8 hero) read.
  // =========================================================================
  const candleSpots = [
    // pit-rim candle, near arch_prop_candle at (1.0,-5.2,-8)
    { name: 'pit', flame: [1.0, -5.2, -8], light: [1.0, -5.0, -8], amp: 0.30, speed: 7.2, phase: 0.4 },
    // east-niche candle so the z=-6 bones (shot 8) catch warm light
    { name: 'niche', flame: [4.3, -5.0, -6], light: [4.3, -4.9, -6], amp: 0.26, speed: 8.1, phase: 2.3 },
  ];
  for (const s of candleSpots) {
    flames.push(addFlame(crypt, `atmo_flame_crypt_${s.name}`, s.flame, 0.12, T.flame));
    addGlow(crypt, `atmo_glow_crypt_${s.name}`, [s.flame[0], s.flame[1] + 0.16, s.flame[2]],
      1.4, T.glowWarm, WARM_CANDLE, 0);
    // (real lights 2 & 3) low-range warm points, guttering flicker.
    const pl = new THREE.PointLight(WARM_CANDLE, 5, 5.2, 1.9);
    pl.position.set(s.light[0], s.light[1], s.light[2]);
    addLight(pl);
    warmLights.push({ light: pl, base: 5, amp: s.amp, speed: s.speed, phase: s.phase });
  }

  // =========================================================================
  // 3. (real light 4, optional fill) VERY low cold fill so the crypt darks
  //    aren't a pure void between the pools — kept tiny to preserve contrast.
  // =========================================================================
  const fill = new THREE.PointLight(CRYPT_FILL, 1.6, 16, 1.5);
  fill.position.set(0, -4.6, -9);
  addLight(fill);

  // =========================================================================
  // 4. FLICKER updater (crypt candles only; nave rig flickers in index.js).
  // =========================================================================
  onUpdate((dt, t) => {
    for (const w of warmLights) {
      const n = Math.sin(t * w.speed + w.phase) * 0.6 + Math.sin(t * w.speed * 2.7 + w.phase * 1.7) * 0.4;
      w.light.intensity = w.base * (1 + w.amp * n);
    }
    for (const f of flames) {
      const p = f.mat.uuid.charCodeAt(0) || 1;
      f.mat.opacity = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(t * 8.5 + p));
    }
  });

  // =========================================================================
  // 5. PER-AREA FOG — thicken + cool the fog when the camera drops into the
  //    crypt, lerp back for the nave. Smooth so the descent transitions; snap
  //    on the first tick so a frozen crypt shot (8/9) is correct immediately.
  // =========================================================================
  let seeded = false;
  onUpdate((dt) => {
    const fog = scene.fog;
    if (!fog) return;
    if (world.camera.position.z > 16) return;   // outdoors: approach.js owns the fog
    const tgt = world.camera.position.y < CRYPT_ENTER_Y ? FOG_CRYPT : FOG_NAVE;
    const a = seeded ? 1 - Math.pow(0.05, dt) : 1; // exp smoothing; snap first frame
    seeded = true;
    fog.near += (tgt.near - fog.near) * a;
    fog.far += (tgt.far - fog.far) * a;
    fog.color.lerp(tgt.color, a);
  });

  return crypt;
}
