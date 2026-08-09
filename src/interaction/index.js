import * as THREE from 'three';
import { EYE_HEIGHT, registerInteractable } from '../core/scene.js';
import { ps1ify } from '../core/ps1.js';
import { DOCUMENTS } from '../content/documents.js';

// ===========================================================================
// INTERACTION MODULE — first-person controls, collision, examine system.
// OWNS: everything under src/interaction/. Everything flows through `world`.
//
//  - Pointer-lock mouselook (yaw + pitch) + WASD relative to yaw.
//  - Circle-vs-AABB slide collision against world.colliders (axis-separated).
//  - Proximity examine of world.interactables via the #examine DOM element.
//  - ?free=1 test mode: active without pointer lock; window.__controls exposed.
//
// Returns { enabled:boolean, update(dt) } as required by main.js (§7c).
// ===========================================================================

// --- Tunables -------------------------------------------------------------
const WALK_SPEED = 2.6;          // m/s (contract target)
const RUN_SPEED  = 4.6;          // m/s while Shift held
const ACCEL_LAMBDA = 14;         // exponential accel/damping rate (per second)
const LOOK_SENS = 0.0022;        // radians per pixel of mouse movement
const PITCH_LIMIT = THREE.MathUtils.degToRad(85);

const PLAYER_RADIUS = 0.3;       // XZ collision circle radius (metres)
// Vertical band the player's body occupies for collision. Starts above knee
// height so low step edges / chancel steps (rise 0.17–0.34) and floor slabs do
// NOT block, while walls, columns and standing props (table top 0.75) do.
const BAND_MIN = 0.5;
const BAND_MAX = 1.75;

const EXAMINE_HOLD = 7;          // seconds the extended examine text lingers

// --- Floor-follow (vertical) ----------------------------------------------
// Each frame a ray is cast straight DOWN against world.floors to find the
// surface under the player; eye Y is damped toward surfaceY + EYE_HEIGHT so
// stairs/ramps glide instead of snapping.
const RAY_START_ABOVE = 1.0;     // ray origin is feetY + this (metres)
const RAY_FAR = 20;              // max downward reach for the floor ray
const STEP_UP_MAX = 0.6;         // surfaces more than this ABOVE feet aren't floor
const MAX_DROP = 8;              // ignore surfaces absurdly far below (gap guard)
const FLOOR_LAMBDA = 14;         // exp-damp rate for eye Y (12–16: smooth glide)

// --- Footsteps ------------------------------------------------------------
const STRIDE_WALK = 2.0;         // metres of travel per footstep, walking
const STRIDE_RUN = 1.5;          // shorter cadence while running
const CRYPT_EYE_Y = -3;          // below this eye Y we're in the wet crypt
const STEP_VOLUME = 0.45;

// --- Examine vertical band ------------------------------------------------
// Only consider an interactable whose anchor Y is within this of the camera Y.
// Keeps crypt prompts out of the nave (they share XZ footprints) and vice-versa.
const EXAMINE_Y_BAND = 2.5;

// Soft containment rects (metres). Last-resort clamp if the player escapes the
// building; colliders normally stop them well before these edges. Nave+chancel
// span z∈[-20,15]; the side chamber x∈[6,13], z∈[0,8].
const BOUNDS = [
  { x0: -6, x1: 6, z0: -20, z1: 15 },   // nave + chancel + undercroft (crypt sits within)
  { x0: 6, x1: 13, z0: 0, z1: 8 },      // side chamber
  { x0: -11.5, x1: -6, z0: -21, z1: -15 }, // Nordturm (west of the hall, seam off the chancel)
  // Discrete portal-area islands (far off; player teleports in):
  { x0: 94, x1: 106, z0: -12, z1: 12 }, // The Tithe House
  { x0: -8, x1: 8, z0: 94, z1: 106 },   // The Library
  { x0: -106, x1: -94, z0: -9, z1: 9 }, // The Infirmary
  { x0: 88, x1: 112, z0: -112, z1: -88 }, // The Cloister
  { x0: -110, x1: -90, z0: -110, z1: -90 }, // The Keep
  { x0: -106, x1: -94, z0: 90, z1: 110 }, // St. Ursel's Chapel
  { x0: -5, x1: 5, z0: -181, z1: -139 }, // The Long Gallery
  { x0: 139, x1: 161, z0: 91, z1: 109 }, // The Hortus Clausus
  { x0: 205, x1: 333, z0: -32, z1: 32 }, // The Harbour (+ lighthouse)
  { x0: 190, x1: 210, z0: -114, z1: -86 }, // The Guild Hall
  { x0: -208, x1: -192, z0: -109, z1: -86 }, // The Bridal Hall
  { x0: -14, x1: 14, z0: 187, z1: 213 }, // The Sounding Court
  { x0: -176, x1: -144, z0: -16, z1: 16 }, // The Ordinal
  // The arrival procession south of the hall (Inner Ward + Gatehouse), seamless:
  { x0: -18, x1: 18, z0: 15, z1: 58 },
];

// --- Exponential damping helper (frame-rate independent lerp) --------------
function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

function inRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}
function clampToRect(x, z, r) {
  return {
    x: Math.min(Math.max(x, r.x0), r.x1),
    z: Math.min(Math.max(z, r.z0), r.z1),
  };
}

export function initInteraction(world) {
  const cam = world.camera;
  const appEl = document.getElementById('app');
  const promptEl = document.getElementById('prompt');
  const examineEl = document.getElementById('examine');

  const free = new URLSearchParams(location.search).has('free');

  // --- Register the examinables (anchors named ix_*) ----------------------
  registerPlagueProps(world);
  registerCryptProps(world);
  registerNordturmProps(world);
  registerDocuments(world);

  // --- Player state ------------------------------------------------------
  const pos = new THREE.Vector3().copy(world.spawn.position);
  pos.y = EYE_HEIGHT;
  let yaw = (typeof world.spawn.yaw === 'number') ? world.spawn.yaw : Math.PI;
  let pitch = 0;
  const vel = new THREE.Vector3(0, 0, 0);

  // Floor-follow: one reusable raycaster shooting straight down.
  const raycaster = new THREE.Raycaster();
  raycaster.far = RAY_FAR;
  const DOWN = new THREE.Vector3(0, -1, 0);
  const rayOrigin = new THREE.Vector3();

  // Footstep cadence: accumulate horizontal distance since the last step.
  let stepAccum = 0;
  let lastFootX = pos.x;
  let lastFootZ = pos.z;

  const keys = new Set();
  let dragging = false;        // free-mode drag-look fallback
  let locked = false;          // pointer lock engaged

  // active === controls process movement + look. Normal play: only while
  // pointer-locked. Free/test mode: always active (WASD works immediately).
  let active = free;

  // Examine focus + latched extended description.
  let focused = null;
  const latch = { text: '', until: -1 };

  cam.rotation.order = 'YXZ';
  applyCamera();

  // ----------------------------------------------------------------------
  // Pointer lock flow: click #app to lock; Esc (browser) unlocks.
  // ----------------------------------------------------------------------
  function requestLock() {
    // First user gesture: start the soundscape (idempotent — unlock() self-guards).
    world.audio?.unlock?.();
    // Enter fullscreen + lock the mouse in the same user gesture (the click).
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) { try { req.call(el); } catch (_) { /* ignore if blocked */ } }
    }
    if (appEl && appEl.requestPointerLock) appEl.requestPointerLock();
  }
  function onLockChange() {
    locked = document.pointerLockElement === appEl;
    if (locked) {
      active = true;
      promptEl?.classList.add('hidden');
    } else {
      // Unlocked (Esc). In free mode we stay active for automated testing.
      if (!free) {
        active = false;
        promptEl?.classList.remove('hidden');
      }
    }
  }

  // Fullscreen toggle on the pause overlay. The Fullscreen API needs a real
  // top-level browser tab + a user gesture, so it is BLOCKED inside embedded
  // views (VS Code Simple Browser / Live Preview iframes). We detect that and
  // say so on the button, rather than silently doing nothing.
  const fsBtn = document.getElementById('fs-btn');
  const fsHint = (msg) => { if (fsBtn) { fsBtn.textContent = msg; fsBtn.style.opacity = '0.75'; } };
  function updateFsLabel() {
    if (!fsBtn) return;
    if (!document.fullscreenEnabled) { fsHint('Open in a browser tab for fullscreen'); return; }
    fsBtn.style.opacity = '';
    fsBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) { try { exit.call(document); } catch (_) {} }
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!document.fullscreenEnabled || !req) { fsHint('Open in a browser tab for fullscreen'); return; }
    try {
      const p = req.call(el);
      if (p && p.catch) p.catch((e) => { console.warn('[fullscreen] denied:', e && (e.message || e.name)); fsHint('Fullscreen denied — open in a browser tab'); });
    } catch (e) { console.warn('[fullscreen] error:', e); fsHint('Fullscreen unavailable — open in a browser tab'); }
  }
  if (fsBtn) fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', updateFsLabel);
  updateFsLabel();

  // --- Intro overlay + Restart ------------------------------------------
  // The conceit — a scout from another lord, sent up alone to a coastal
  // holding that has gone silent — is shown on first entry and again on
  // Restart. Skipped in automated shot/free modes so captures/tests run clean.
  const introEl = document.getElementById('intro');
  const beginBtn = document.getElementById('intro-begin');
  const restartBtn = document.getElementById('restart-btn');
  const shotMode = new URLSearchParams(location.search).has('shot');
  if (introEl && !free && !shotMode) introEl.classList.add('show');
  if (beginBtn) beginBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    introEl?.classList.remove('show');
    requestLock();            // the click is a valid gesture to lock + go fullscreen
  });
  // Restart = a clean reload: the scout begins again at the gate (the spawn) and
  // the intro shows once more. A full reset is the most reliable "restart" here.
  if (restartBtn) restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    location.reload();
  });

  // Continue = resume play (same path as clicking the overlay) — an explicit
  // button so it's clear how to get back in.
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) continueBtn.addEventListener('click', (e) => { e.stopPropagation(); requestLock(); });

  // Pause toggle (P). Esc is owned by the browser — in an embedded preview it
  // only releases the cursor and can't reliably raise our menu — so P is the
  // real pause key: it shows the pause overlay (Restart / Fullscreen) and stops
  // control; pressing P again (or clicking the overlay) resumes via requestLock.
  function togglePause() {
    const paused = promptEl && !promptEl.classList.contains('hidden');
    if (paused) {
      requestLock();                       // resume — same path as clicking the overlay
    } else {
      active = false;
      promptEl?.classList.remove('hidden');
      if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (_) {} }
    }
  }

  if (appEl) appEl.addEventListener('click', requestLock);
  // Clicking the pause overlay (anywhere but the fullscreen button) re-enters.
  if (promptEl) promptEl.addEventListener('click', requestLock);
  document.addEventListener('pointerlockchange', onLockChange);

  // ----------------------------------------------------------------------
  // Mouselook
  // ----------------------------------------------------------------------
  function onMouseMove(e) {
    if (!(locked || dragging) || world.flags.reading) return;
    yaw -= e.movementX * LOOK_SENS;
    pitch -= e.movementY * LOOK_SENS;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }
  document.addEventListener('mousemove', onMouseMove);

  // Free-mode drag-look (no pointer lock required for tests / inspection).
  if (free && appEl) {
    appEl.addEventListener('mousedown', () => { dragging = true; });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  // ----------------------------------------------------------------------
  // Keyboard
  // ----------------------------------------------------------------------
  function onKeyDown(e) {
    keys.add(e.code);
    // In free/test mode there's no lock click, so the first key press is the
    // user gesture that unlocks audio (idempotent — unlock() self-guards).
    if (free) world.audio?.unlock?.();
    if (e.code === 'KeyE' && !e.repeat && active) doExamine();
    // P = pause/menu (skip while reading or while the intro is up).
    if (e.code === 'KeyP' && !e.repeat && !world.flags.reading) {
      const introUp = introEl && introEl.classList.contains('show');
      if (!introUp) togglePause();
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ----------------------------------------------------------------------
  // Examine helpers
  // ----------------------------------------------------------------------
  function nearestInteractable() {
    let best = null;
    let bestD = Infinity;
    const list = world.interactables;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const p = it.object?.position;
      if (!p) continue;
      // Vertical gate: the crypt is stacked UNDER the nave and shares XZ with
      // nave props, so require the anchor's Y to be near the camera's Y. This
      // keeps crypt prompts out of the nave (and nave prompts out of the crypt).
      if (Math.abs(pos.y - p.y) > EXAMINE_Y_BAND) continue;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;         // proximity measured in XZ within the band
      const d = Math.hypot(dx, dz);
      if (d <= (it.radius ?? 2) && d < bestD) { bestD = d; best = it; }
    }
    return best;
  }
  function doExamine() {
    if (!focused) return;
    if (typeof focused.onExamine === 'function') focused.onExamine();
  }
  function showExamine(text) {
    if (!examineEl) return;
    examineEl.textContent = text;
    examineEl.style.display = 'block';
  }
  function hideExamine() {
    if (examineEl) examineEl.style.display = 'none';
  }
  // Expose a latch setter so registered props can push extended text on E.
  world.flags.__examineLatch = (text) => {
    latch.text = text;
    latch.until = world.elapsed + EXAMINE_HOLD;
  };

  // ----------------------------------------------------------------------
  // Collision: circle (radius PLAYER_RADIUS) vs every world.colliders Box3,
  // restricted to the player's vertical band. Returns true if (x,z) overlaps.
  // ----------------------------------------------------------------------
  function hitsAt(x, z) {
    const cols = world.colliders;
    const r2 = PLAYER_RADIUS * PLAYER_RADIUS;
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      if (b.max.y <= BAND_MIN || b.min.y >= BAND_MAX) continue; // out of band
      const cx = Math.min(Math.max(x, b.min.x), b.max.x);
      const cz = Math.min(Math.max(z, b.min.z), b.max.z);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }

  function contain() {
    if (inRect(pos.x, pos.z, BOUNDS[0]) || inRect(pos.x, pos.z, BOUNDS[1])) return;
    // Escaped the building — snap to the nearest allowed rect.
    let best = null, bestD = Infinity;
    for (const r of BOUNDS) {
      const c = clampToRect(pos.x, pos.z, r);
      const d = (pos.x - c.x) ** 2 + (pos.z - c.z) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { pos.x = best.x; pos.z = best.z; }
  }

  function applyCamera() {
    cam.position.set(pos.x, pos.y, pos.z);
    cam.rotation.set(pitch, yaw + Math.PI, 0, 'YXZ');
  }

  // ----------------------------------------------------------------------
  // Floor-follow: cast DOWN against world.floors and damp eye Y onto the
  // surface. Replaces the old constant EYE_HEIGHT pin so the player can walk
  // the stair ramp down into the crypt (feet 0 → -6) and back up.
  // ----------------------------------------------------------------------
  function followFloor(dt) {
    const floors = world.floors;
    if (!floors || floors.length === 0) return;
    const feetY = pos.y - EYE_HEIGHT;
    // Start the ray a little above the feet so we never begin inside the slab.
    rayOrigin.set(pos.x, feetY + RAY_START_ABOVE, pos.z);
    raycaster.set(rayOrigin, DOWN);
    const hits = raycaster.intersectObjects(floors, true);
    // hits are sorted nearest-first; from a downward ray that's the HIGHEST
    // surface below the origin. Take the first one that reads as real floor.
    let surfaceY = null;
    for (let i = 0; i < hits.length; i++) {
      const y = hits[i].point.y;
      if (y > feetY + STEP_UP_MAX) continue;   // a prop lip / step above — not floor
      if (y < feetY - MAX_DROP) continue;      // absurd gap — ignore, keep last Y
      surfaceY = y;
      break;
    }
    if (surfaceY === null) return;             // no valid hit this frame → hold Y
    const targetEyeY = surfaceY + EYE_HEIGHT;
    pos.y = damp(pos.y, targetEyeY, FLOOR_LAMBDA, dt);
  }

  // Fire footsteps by accumulated horizontal travel; wet timbre in the crypt.
  function stepAudio() {
    const moved = Math.hypot(pos.x - lastFootX, pos.z - lastFootZ);
    lastFootX = pos.x;
    lastFootZ = pos.z;
    if (!active || moved <= 1e-4) return;
    stepAccum += moved;
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const stride = running ? STRIDE_RUN : STRIDE_WALK;
    // Footstep audio removed per direction — movement is silent for now.
    if (stepAccum >= stride) { stepAccum -= stride; }
  }

  // ----------------------------------------------------------------------
  // Per-frame update (main.js calls this only when NOT in shot mode).
  // ----------------------------------------------------------------------
  const api = {
    enabled: true,
    update(dt) {
      if (!api.enabled) return;
      if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;

      // Movement basis from yaw. forward = (sin, 0, cos) → yaw=PI faces −Z
      // (matches world.spawn convention). right = (−cos, 0, sin).
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const fx = sy, fz = cy;
      const rx = -cy, rz = sy;

      let ix = 0, iz = 0;
      if (active && !world.flags.reading) {
        if (keys.has('KeyW') || keys.has('ArrowUp'))    { ix += fx; iz += fz; }
        if (keys.has('KeyS') || keys.has('ArrowDown'))  { ix -= fx; iz -= fz; }
        if (keys.has('KeyD') || keys.has('ArrowRight'))  { ix += rx; iz += rz; }
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  { ix -= rx; iz -= rz; }
      }

      const len = Math.hypot(ix, iz);
      let tvx = 0, tvz = 0;
      if (len > 0) {
        const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? RUN_SPEED : WALK_SPEED;
        tvx = (ix / len) * speed;
        tvz = (iz / len) * speed;
      }
      vel.x = damp(vel.x, tvx, ACCEL_LAMBDA, dt);
      vel.z = damp(vel.z, tvz, ACCEL_LAMBDA, dt);

      // Integrate with axis-separated slide so we glide along walls.
      let nx = pos.x + vel.x * dt;
      if (hitsAt(nx, pos.z)) { nx = pos.x; vel.x = 0; }
      let nz = pos.z + vel.z * dt;
      if (hitsAt(nx, nz)) { nz = pos.z; vel.z = 0; }
      pos.x = nx;
      pos.z = nz;

      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) {
        pos.copy(world.spawn.position);
      }
      contain();

      // Vertical: settle the eye onto the floor/ramp under us (stairs → crypt).
      followFloor(dt);
      // Footsteps: cadence by horizontal distance travelled (stone vs. wet).
      stepAudio();

      applyCamera();

      // --- Examine prompt ---
      if (active && !world.flags.reading) {
        focused = nearestInteractable();
        if (latch.until > world.elapsed) {
          showExamine(latch.text);
        } else if (focused) {
          showExamine(`${focused.label}   [E]`);
        } else {
          hideExamine();
        }
      } else {
        hideExamine();
      }
    },
    // Teleport (used by portals): set position + facing, zero velocity, let
    // floor-follow settle the eye height on the next frame.
    teleport(x, y, z, newYaw) {
      pos.set(x, y, z);
      vel.set(0, 0, 0);
      if (typeof newYaw === 'number') { yaw = newYaw; pitch = 0; }
      applyCamera();
    },
    // --- Test / diagnostic surface -------------------------------------
    get position() { return cam.position; },          // live Vector3 (x,y,z)
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get active() { return active; },
    get free() { return free; },
  };

  // In free/test mode start active, no pointer lock required, hide the prompt.
  if (free) promptEl?.classList.add('hidden');

  // Expose the returned object for the integrator's synthetic-input tests.
  window.__controls = api;

  return api;
}

// ===========================================================================
// Plague-story examinables. Small empty Object3D anchors at the prop coords;
// label shows within radius, onExamine latches an extended line for a few sec.
// ===========================================================================
// Documents: a small parchment marker at each position, registered as a readable
// that opens the framed reader (world.reader). The Y-aware examine gate keeps
// crypt leaves from firing when the player stands in the nave above them.
function registerDocuments(world) {
  const geo = new THREE.PlaneGeometry(0.34, 0.44);
  for (const doc of DOCUMENTS) {
    const mesh = new THREE.Mesh(
      geo,
      ps1ify(new THREE.MeshBasicMaterial({ color: 0xb7a06a, side: THREE.DoubleSide }))
    );
    mesh.name = 'ix_doc_' + doc.id;
    mesh.position.set(doc.pos[0], doc.pos[1], doc.pos[2]);
    const r = doc.rot || [-Math.PI / 2, 0, 0];
    mesh.rotation.set(r[0], r[1], r[2]);
    if (world.scene) world.scene.add(mesh);
    registerInteractable({
      object: mesh,
      radius: doc.radius || 2.0,
      label: doc.prompt || 'A written leaf.',
      onExamine: () => { if (world.reader) world.reader.open(doc); },
    });
  }
}

// Nordturm study — the one body we reach. Scout's plain register (§10): he sees
// a man at a desk, not a king; the letter (a document) tells the rest.
function registerNordturmProps(world) {
  registerAnchors(world, [
    {
      name: 'ix_siegmund', pos: [-9.2, 13.9, -18.95], radius: 2.0,
      label: 'A man at the desk, fallen forward across his own writing. He has sat here a long time.',
      more: 'Good cloth, a signet ring on the hand. The fingers have gone black at the tips, like all the rest. No one came up to close his eyes.',
    },
  ]);
}

function registerPlagueProps(world) {
  const defs = [
    {
      name: 'ix_table', pos: [10.5, 0.75, 3.5], radius: 2.2,
      label: 'The board is set for two. Both stools stand back from it and the food has gone to scum in the bowls.',
      more: 'A knife laid at each place, salt spilled and not swept. Flies lie thick in the near bowl and along the sill.',
    },
    {
      name: 'ix_chandelier', pos: [0.5, 0.3, -4], radius: 2.6,
      label: 'The chandelier is down, its chain snapped, the wax pooled and set hard across the flags. One candle stands lit among the cold.',
      more: 'He holds a hand to the flame. It throws light and no heat, and does not stir in the draught.',
    },
    {
      name: 'ix_threshold', pos: [6, 1.5, 3.5], radius: 2.2,
      label: 'A cross is daubed on the door in red, a date chalked under it. The boards are nailed from the near side.',
      more: 'Beneath the cross, scratched small by a failing hand: Lord, have mercy on this house.',
    },
    {
      name: 'ix_rubble', pos: [-4, 0.5, -8], radius: 2.6,
      label: 'A bay of the vaulting has come down. The dressed blocks lie where they fell, each near the size of a coffin.',
      more: 'Good stone, well cut. The sky shows grey through the gap, and ivy has come in after it.',
    },
    {
      name: 'ix_apse', pos: [0, 1.2, -18], radius: 3.2,
      label: 'The altar stands bare. The plate is gone from it, and the credence beside.',
      more: 'Pale light falls through the tracery where the glass saints stood. The fixings for the reliquary are empty.',
    },
  ];

  registerAnchors(world, defs);
}

// ===========================================================================
// Crypt / undercroft examinables. Same structure as the plague props, placed
// at crypt y-levels so the Y-aware nearestInteractable() gate keeps them from
// firing when the player stands ABOVE them in the nave.
// ===========================================================================
function registerCryptProps(world) {
  const defs = [
    {
      name: 'ix_pit', pos: [0, -6, -8], radius: 2.6,
      label: 'A grain bin, stone-sided, its timber lid battened down and run over with lime. It was cut to hold a store.',
      more: 'Chalked on the lid in a later hand: sealed on St. Lucy\'s eve, and no more to go in.',
    },
    {
      name: 'ix_ossuary', pos: [5, -5.2, -6], radius: 2.4,
      label: 'Bones set in the niches by kind, the long bones to the wall and the skulls in courses. They were laid by count.',
      more: 'A slate hangs at the end of the rack, wiped and re-marked many times. The last figure has not been wiped.',
    },
    {
      name: 'ix_graintally', pos: [2.5, -5, -6], radius: 2.0,
      label: 'Numbers cut deep in the pier, counting in fours, worn shallow with handling. A store-keeper\'s reckoning.',
      more: 'The count runs on under the bone-dust to a last mark, and stops. It is not grain in the bins now.',
    },
    {
      name: 'ix_shoe', pos: [0.5, -5.05, -10], radius: 2.2,
      label: 'A child\'s shoe, red, on the seventh step. Small, and good work. Its fellow is not here.',
      more: 'The leather is soft, the buckle silver. Someone paid well to shoe a small foot.',
    },
  ];

  registerAnchors(world, defs);
}

// Shared: turn {name,pos,radius,label,more} defs into anchored interactables.
function registerAnchors(world, defs) {
  for (const d of defs) {
    const anchor = new THREE.Object3D();
    anchor.name = d.name;
    anchor.position.set(d.pos[0], d.pos[1], d.pos[2]);
    if (world.scene) world.scene.add(anchor);
    registerInteractable({
      object: anchor,
      radius: d.radius,
      label: d.label,
      onExamine: () => {
        const latch = world.flags.__examineLatch;
        if (typeof latch === 'function') latch(d.more);
      },
    });
  }
}
