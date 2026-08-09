import * as THREE from 'three';
import { world, EYE_HEIGHT } from './core/scene.js';
import { makePS1Renderer } from './core/ps1.js';
import { createAudio } from './core/audio.js';
import { createReader } from './core/reader.js';
import { createZones } from './core/zones.js';
import { createMap } from './core/map.js';
import { initAreas } from './areas/index.js';
import { buildApproach } from './areas/approach.js';
import { buildApproachStory } from './areas/approach-story.js';
import { SHOTS, applyShot, shotFromURL } from './core/shots.js';
import { initArchitecture } from './architecture/index.js';
import { initAtmosphere } from './atmosphere/index.js';
import { createWeather } from './atmosphere/weather.js';
import { createVermin } from './atmosphere/vermin.js';
import { initInteraction } from './interaction/index.js';

// ---------------------------------------------------------------------------
// BOOTSTRAP  (owned by CORE). Assembles the world, runs module inits in a fixed
// order, then drives the frame loop. Modules must not depend on load order
// beyond: architecture -> atmosphere -> interaction.
// ---------------------------------------------------------------------------

const appEl = document.getElementById('app');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
const clock = new THREE.Clock();
const { renderer, resize } = makePS1Renderer(appEl, { internalHeight: 288 });

world.scene = scene;
world.camera = camera;
world.renderer = renderer;
world.clock = clock;
world.ps1 = { setInternalHeight: (h) => { world.ps1._h = h; resize(camera); }, _h: 288 };

// Procedural spatial audio engine (listener attaches to the camera). Created
// before module init so atmosphere can place emitters; stays suspended until a
// user gesture calls world.audio.unlock() (from interaction's click handler).
world.audio = createAudio(world);

// Reading system (framed-panel document overlay + findings tally). Interaction
// opens it via world.reader.open(doc); while open, world.flags.reading freezes controls.
world.reader = createReader(world);

// Zone titles — announce the room on entry (top-centre, fade in/hold/out).
createZones(world);

// Automap overlay — toggle with M; reveals the castle's node graph as you visit.
createMap(world);

resize(camera);
window.addEventListener('resize', () => resize(camera));

// The game opens at the gatehouse — the scout arrives overland and walks up
// through the dead ward and in through the great door (see areas/approach.js).
world.spawn.position.set(0, 1.7, 55);   // gate passage, facing -Z (yaw stays Math.PI)
camera.position.copy(world.spawn.position);

// Expose for Playwright/dev diagnostics only (never used by module code).
window.__world = world;
window.__THREE = THREE;

// Core-owned INSPECTION light: ?inspect=1 adds a neutral fill so the architecture
// module can be judged for form/scale/decay before the atmosphere module exists.
// It is NOT part of the art direction and is off unless explicitly requested.
if (new URLSearchParams(location.search).has('inspect')) {
  const hemi = new THREE.HemisphereLight(0xcfd6e0, 0x40382c, 1.15);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 10, 8);
  scene.add(hemi, key);
}

// ---- Module init (guarded: a failing/empty module must never blank the app) ----
safeInit('architecture', () => initArchitecture(world));
safeInit('atmosphere', () => initAtmosphere(world));
let controls = null;
safeInit('interaction', () => { controls = initInteraction(world); });

function safeInit(name, fn) {
  try { fn(); } catch (e) { console.error(`[${name}] init failed:`, e); }
}

// ---- Portal transition helpers (used by core/scene registerPortal) ----
const fadeEl = document.getElementById('fade');
world.fade = (atBlack) => {
  if (!fadeEl) { if (atBlack) atBlack(); return; }
  fadeEl.classList.add('on');
  setTimeout(() => { try { if (atBlack) atBlack(); } catch (_) {} }, 360); // teleport at full black
  setTimeout(() => fadeEl.classList.remove('on'), 540);                    // then fade back in
};
world.teleport = (x, y, z, yaw) => { if (controls && controls.teleport) controls.teleport(x, y, z, yaw); };

// ---- Discrete areas (Tithe House / Library / Infirmary) + their portals ----
safeInit('areas', () => initAreas(world));

// ---- The arrival procession (seamless): Gatehouse -> Inner Ward -> great door ----
safeInit('approach', () => {
  buildApproach(world);        // exterior shell + sky + overcast daylight
  buildApproachStory(world);   // gate-killings, cart, sealed doors, grounded docs
  // The old fake sky-plane behind the door is now replaced by the real ward.
  const sky = world.scene.getObjectByName('atmo_sky_door'); if (sky) sky.visible = false;
  const glow = world.scene.getObjectByName('atmo_glow_door'); if (glow) glow.visible = false;
  // Zone titles for the exterior.
  world.registerZone({ name: 'The Inner Ward', min: [-18, -1, 16], max: [18, 8, 47.9] });
  world.registerZone({ name: 'The Gatehouse', min: [-9, -1, 47.9], max: [9, 14, 58] });
});

// ---- Outdoor weather (rain + circling vultures + sky/daylight for open-air
// areas) and interior VERMIN (maggots + roaches near the dead). Both self-add
// their meshes + one updater; safe-guarded so a failure never blanks the app.
safeInit('weather', () => createWeather(world));
safeInit('vermin', () => createVermin(world));

// ---- Sky-box region gate. Large static area sky boxes (fog:false) live in one
// shared scene with no inter-area occlusion, so from a far-off island they bleed
// into view as pale panels. Show each only when the player is near its own
// region. (appr_sky self-gates in approach.js; har_sky is camera-following.)
safeInit('skygate', () => {
  const skies = [];
  scene.traverse((o) => {
    if (o.isMesh && (o.name === 'snd_sky' || o.name === 'weather_sky')) {
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      skies.push({ mesh: o, cx: c.x, cz: c.z });
    }
  });
  if (skies.length) world.updaters.push(() => {
    const p = camera.position;
    for (const s of skies) s.mesh.visible = Math.hypot(p.x - s.cx, p.z - s.cz) < 48;
  });
});

// ---- Shot mode: deterministic static cameras for the verification loop ----
const shotIdx = shotFromURL();
const shotMode = shotIdx >= 0;
world.flags.shotMode = shotMode;   // zone titles skip announcing during captures
if (shotMode) {
  applyShot(camera, shotIdx);
  document.getElementById('prompt')?.classList.add('hidden');
  if (controls && 'enabled' in controls) controls.enabled = false;
}

// ---- Frame loop ----
window.__ready = false;                 // Playwright waits on this before capturing
let frames = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  world.dt = dt;
  world.elapsed = clock.elapsedTime;
  if (!shotMode && controls && controls.update) controls.update(dt);
  const updaters = world.updaters;
  for (let i = 0; i < updaters.length; i++) updaters[i](dt, world.elapsed);
  renderer.render(scene, camera);
  if (++frames === 4) window.__ready = true;
}
loop();

// ---- FPS / debug HUD ----
const hud = document.getElementById('hud');
let last = performance.now(), acc = 0, fcount = 0;
world.updaters.push(() => {
  const now = performance.now(); acc += now - last; last = now; fcount++;
  if (acc >= 500) {
    const fps = Math.round((fcount / acc) * 1000);
    if (hud) {
      hud.textContent =
        `${fps} fps  |  x ${camera.position.x.toFixed(1)} z ${camera.position.z.toFixed(1)}  |  ` +
        `colliders ${world.colliders.length}  lights ${world.lights.length}` +
        (shotMode ? `  |  SHOT ${shotIdx + 1}/${SHOTS.length} ${SHOTS[shotIdx].name}` : '');
    }
    acc = 0; fcount = 0;
  }
});
