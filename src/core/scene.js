import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SHARED SCENE-GRAPH API  (owned by CORE — see scene-contract.md §3)
// Every module reads `world` and registers through these functions.
// No module mutates another module's objects; cross-cutting edits go through core.
// ---------------------------------------------------------------------------

export const UNIT = 1;            // 1 world unit === 1 metre
export const EYE_HEIGHT = 1.7;    // player camera height, metres

export const world = {
  // Set by main.js before any module init:
  scene: null,
  camera: null,
  renderer: null,
  clock: null,

  // Per-frame, written by the main loop:
  dt: 0,
  elapsed: 0,

  // Registration surfaces (modules push; consumers read):
  colliders: [],       // THREE.Box3[]           — architecture pushes, interaction reads
  floors: [],          // THREE.Mesh[]           — architecture pushes walkable surfaces; interaction raycasts for eye height
  interactables: [],   // Interactable[]         — interaction pushes & reads
  lights: [],          // THREE.Light[]          — atmosphere pushes
  updaters: [],         // ((dt, t) => void)[]    — any module pushes; called each frame

  // Player start. Architecture may override via world.spawn before interaction inits.
  spawn: { position: new THREE.Vector3(0, EYE_HEIGHT, 15.5), yaw: Math.PI }, // faces -Z

  // Free-form shared flags for triggers (e.g. world.flags.chapelEntered = true)
  flags: {},

  // Handle to the PS1 render helpers (set by main.js)
  ps1: null,

  // Handle to the procedural audio engine (set by main.js — see core/audio.js)
  audio: null,
};

/** Register an axis-aligned collider (metres, world space). */
export function registerCollider(box3) {
  world.colliders.push(box3);
  return box3;
}

/**
 * Register a walkable surface mesh. Interaction raycasts downward against these
 * to set the player's eye height, enabling stairs and multiple floor levels.
 * Pass the actual (or an invisible smooth proxy) mesh — ramps under stairs make
 * the descent glide instead of step-snapping.
 */
export function registerFloor(mesh) {
  world.floors.push(mesh);
  return mesh;
}

/**
 * Register an examinable object.
 * @typedef {Object} Interactable
 * @property {THREE.Object3D} object   world-space anchor (proximity measured to its position)
 * @property {number} radius           metres within which the prompt appears
 * @property {string} label            short line shown on the prompt / on examine
 * @property {() => void} [onExamine]  optional callback when the player presses E
 */
export function registerInteractable(item) {
  world.interactables.push(item);
  return item;
}

/** Add a light to the scene and track it (atmosphere owns lighting). */
export function addLight(light) {
  world.lights.push(light);
  if (world.scene) world.scene.add(light);
  return light;
}

/** Register a per-frame updater: fn(dt, elapsed). */
export function onUpdate(fn) {
  world.updaters.push(fn);
  return fn;
}

/**
 * Register a PORTAL: a walk-up threshold that, on [E], fades to black, teleports
 * the player to `target`, and whooshes. Implemented as an interactable so it
 * reuses the examine/prompt flow. Bidirectional portals are just two of these.
 * @param {{ pos:[x,y,z], radius?:number, target:{x,y,z,yaw?}, label?:string }} p
 */
export function registerPortal(p) {
  const anchor = new THREE.Object3D();
  anchor.name = 'portal';
  anchor.position.set(p.pos[0], p.pos[1], p.pos[2]);
  if (world.scene) world.scene.add(anchor);
  registerInteractable({
    object: anchor,
    radius: p.radius ?? 1.7,
    label: p.label || 'A way through.  [E] to pass',
    onExamine: () => {
      if (world.flags.sfxWhoosh) world.flags.sfxWhoosh();
      const t = p.target;
      if (world.fade) world.fade(() => world.teleport && world.teleport(t.x, t.y, t.z, t.yaw));
      else if (world.teleport) world.teleport(t.x, t.y, t.z, t.yaw);
    },
  });
  return anchor;
}
