import * as THREE from 'three';
import { addLight, onUpdate } from '../core/scene.js';
import { addGlassPlane, addGlow, addFlame } from './sources.js';

// ===========================================================================
// NORDTURM ATMOSPHERE — the climb and Siegmund's study (the climax).
// The stair is dim and cold (a few arrow-slit glows + two low points so it is
// navigable but oppressive). The study is the one place with a WARM key: the
// lamp Siegmund writes of leaving lit ("I have left a light burning") burns on
// the desk beside the letter, against a cold NW window. Warm letter, cold sky.
//
// Tower centre (-8.5,-18.25); study floor y=13. Window opening centre
// (-9.84,14.5,-19.59), NW-facing. Reuses the atmosphere helpers + texture set T.
// ===========================================================================

const COLD_SKY = 0x9fb0c4;
const COLD_HALO = 0xcdd8e4;
const WARM_LAMP = 0xe8a24c;

export function initNordturmAtmo(world, root, T) {
  const g = new THREE.Group();
  g.name = 'atmo_nord';
  root.add(g);

  const warmLights = [];
  const flames = [];

  // --- Study cold window (the daylight key; a visible glowing source) --------
  const glass = addGlassPlane(g, 'atmo_nord_glass', 0.9, 1.8, [-9.95, 14.5, -19.7], Math.PI / 4, T.glass, COLD_HALO);
  glass.rotation.x = 0; // vertical wall window
  addGlow(g, 'atmo_nord_glow_win', [-9.7, 14.4, -19.45], 2.4, T.glowCold, COLD_SKY, 0);
  // (light 1) cold point just inside the window — pools on the desk/floor, dies at the walls.
  const cold = new THREE.PointLight(COLD_SKY, 6, 8, 1.9);
  cold.position.set(-9.5, 14.4, -19.2);
  addLight(cold);

  // --- The lamp "left burning" on the desk (warm key on the letter + hand) ----
  flames.push(addFlame(g, 'atmo_nord_lamp_flame', [-9.72, 13.9, -19.42], 0.11, T.flame));
  addGlow(g, 'atmo_nord_lamp_glow', [-9.72, 14.02, -19.42], 1.3, T.glowWarm, WARM_LAMP, 0);
  // (light 2) low warm point — the desk lamp. Gutters faintly.
  const lamp = new THREE.PointLight(WARM_LAMP, 5, 4.6, 1.9);
  lamp.position.set(-9.7, 13.95, -19.4);
  addLight(lamp);
  warmLights.push({ light: lamp, base: 5, amp: 0.16, speed: 6.4, phase: 1.1 });

  // --- Dim cold arrow-slit glows down the stair (orientation; no light cost) --
  const cx = -8.5, cz = -18.25, rr = 2.32;
  const slits = [
    { th: 270, y: 2.2 }, { th: 200, y: 4.6 }, { th: 250, y: 7.2 }, { th: 195, y: 9.8 },
  ];
  for (const s of slits) {
    const a = (s.th * Math.PI) / 180;
    const x = cx + rr * Math.cos(a), z = cz + rr * Math.sin(a);
    addGlow(g, `atmo_nord_slit_${s.th}`, [x, s.y, z], 1.1, T.glowCold, COLD_SKY, 0);
  }
  // (lights 3 & 4) two very low cold points so the spiral treads read while climbing.
  const s1 = new THREE.PointLight(COLD_SKY, 2.2, 7, 1.7); s1.position.set(-8.5, 4.6, -18.25); addLight(s1);
  const s2 = new THREE.PointLight(COLD_SKY, 2.2, 7, 1.7); s2.position.set(-8.5, 9.4, -18.25); addLight(s2);

  // --- Flicker (lamp + flame quad) -------------------------------------------
  onUpdate((dt, t) => {
    for (const w of warmLights) {
      const n = Math.sin(t * w.speed + w.phase) * 0.6 + Math.sin(t * w.speed * 2.6 + w.phase) * 0.4;
      w.light.intensity = w.base * (1 + w.amp * n);
    }
    for (const f of flames) {
      const p = f.mat.uuid.charCodeAt(0) || 1;
      f.mat.opacity = 0.76 + 0.24 * (0.5 + 0.5 * Math.sin(t * 8 + p));
    }
  });

  return g;
}
