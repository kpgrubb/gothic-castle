import * as THREE from 'three';
import { buildTitheHouse } from './tithe-house.js';
import { buildLibrary } from './library.js';
import { buildInfirmary } from './infirmary.js';
import { buildCloister } from './cloister.js';
import { buildKeep } from './keep.js';
import { buildChapel } from './chapel.js';
import { buildLongGallery } from './long-gallery.js';
import { buildHortus } from './hortus.js';
import { buildHarbour } from './harbour.js';
import { buildGuildHall } from './guild-hall.js';
import { buildBridalHall } from './bridal-hall.js';
import { buildSoundingCourt } from './sounding-court.js';
import { buildOrdinal } from './ordinal.js';
import { registerPortal } from '../core/scene.js';

// ---------------------------------------------------------------------------
// Visible DOORWAY for a portal. The portals used to be invisible anchors, so
// the player saw no door. This builds a stone-framed dark doorway on a wall and
// registers the portal just in front of it. `faceYaw` is the direction the door
// faces (its front normal = (sin,cos)); the anchor sits `stand` metres out along
// that normal, where the player triggers it with E.
// ---------------------------------------------------------------------------
let _doorMats = null;
function doorMats() {
  if (_doorMats) return _doorMats;
  _doorMats = {
    frame: new THREE.MeshLambertMaterial({ color: 0x5c616a }),
    void: new THREE.MeshBasicMaterial({ color: 0x08090c, fog: false }),
  };
  return _doorMats;
}
function doorPortal(world, { x, z, y = 0, faceYaw = 0, w = 1.35, h = 2.45, label, target, stand = 1.15 }) {
  const M = doorMats();
  const g = new THREE.Group();
  g.position.set(x, y, z);                     // `y` = the floor the door stands on (e.g. -6 in the crypt)
  g.rotation.y = faceYaw;                     // local +Z is the door's front
  const jamb = new THREE.BoxGeometry(0.28, h, 0.4);
  const lJ = new THREE.Mesh(jamb, M.frame); lJ.position.set(-(w / 2 + 0.14), h / 2, 0); g.add(lJ);
  const rJ = new THREE.Mesh(jamb, M.frame); rJ.position.set(w / 2 + 0.14, h / 2, 0); g.add(rJ);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.56, 0.34, 0.42), M.frame);
  lintel.position.set(0, h + 0.17, 0); g.add(lintel);
  const voidPanel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.void);
  voidPanel.position.set(0, h / 2, 0.04); g.add(voidPanel);   // dark opening, faces +Z
  g.name = 'portal_door';
  world.scene.add(g);
  // portal anchor: `stand` metres out in front of the door along its normal
  const ax = x + Math.sin(faceYaw) * stand;
  const az = z + Math.cos(faceYaw) * stand;
  registerPortal({ pos: [ax, y + 1.0, az], radius: 1.5, label, target });
}

// ===========================================================================
// DISCRETE AREAS — self-contained rooms on far-off coordinate islands, reached
// by PORTALS (fade + teleport) until a streaming/contiguous layout exists.
// Each build*() adds its own geometry/lights/colliders/floors/documents.
// Here the integrator: (1) builds them, (2) registers their zone volumes (so
// entry announces the name), (3) wires core<->area portals, (4) reports islands
// so BOUNDS can contain them (see interaction/index.js).
//
// Islands (world): Tithe House (100,0,0) · Library (0,0,100) · Infirmary (-100,0,0).
// Core-side portals live in the SIDE CHAMBER (x6..13, z0..8) as temporary access
// until the connective wings (cloister/chapel/service passage) are built.
// ===========================================================================

export function initAreas(world) {
  ensureInScene(world, buildTitheHouse(world));
  ensureInScene(world, buildLibrary(world));
  ensureInScene(world, buildInfirmary(world));
  ensureInScene(world, buildCloister(world));
  // Newer wings — each self-registers its own zone volume inside its builder.
  ensureInScene(world, buildKeep(world));
  ensureInScene(world, buildChapel(world));
  ensureInScene(world, buildLongGallery(world));
  ensureInScene(world, buildHortus(world));
  ensureInScene(world, buildHarbour(world));
  ensureInScene(world, buildGuildHall(world));
  ensureInScene(world, buildBridalHall(world));
  ensureInScene(world, buildSoundingCourt(world));
  ensureInScene(world, buildOrdinal(world));

  // Zone titles for the older areas (the newer ones register their own).
  world.registerZone({ name: 'The Tithe House', min: [94, -1, -12], max: [106, 6, 12] });
  world.registerZone({ name: 'The Library', min: [-8, -1, 94], max: [8, 6, 106] });
  world.registerZone({ name: 'The Infirmary', min: [-106, -1, -9], max: [-94, 6, 9] });
  world.registerZone({ name: 'The Cloister', min: [88, -1, -112], max: [112, 6, -88] });

  // --- Portals ---------------------------------------------------------------
  const HALL = { x: 9, y: 1.7, z: 4, yaw: Math.PI };  // return point: the side chamber

  // Four VISIBLE doorways in the side chamber — two in the north wall (z≈0,
  // facing +Z) and two in the south wall (z≈8, facing -Z) — each a fade-portal
  // to a discrete area. (These were invisible anchors before.)
  doorPortal(world, { x: 8.2, z: 0.15, faceYaw: 0, label: 'A service passage — the tithe house.  [E]',
    target: { x: 100, y: 1.7, z: 11, yaw: Math.PI } });
  doorPortal(world, { x: 11.3, z: 0.15, faceYaw: 0, label: 'A covered walk — the cloister.  [E]',
    target: { x: 100, y: 1.7, z: -89.5, yaw: Math.PI } });
  doorPortal(world, { x: 8.2, z: 7.85, faceYaw: Math.PI, label: 'A stair up to the library.  [E]',
    target: { x: 0, y: 1.7, z: 104, yaw: Math.PI } });
  doorPortal(world, { x: 11.3, z: 7.85, faceYaw: Math.PI, label: 'A passage to the infirmary.  [E]',
    target: { x: -100, y: 1.7, z: 8, yaw: Math.PI } });

  // Return portals (at each area's entry) — step back through to the chamber.
  registerPortal({ pos: [100, 1.0, 11.6], radius: 1.5, label: 'Back to the hall.  [E]', target: HALL });
  registerPortal({ pos: [0, 1.0, 105], radius: 1.5, label: 'Back to the hall.  [E]', target: HALL });
  registerPortal({ pos: [-100, 1.0, 8.6], radius: 1.5, label: 'Back to the hall.  [E]', target: HALL });
  registerPortal({ pos: [100, 1.0, -88.6], radius: 1.5, label: 'Back to the hall.  [E]', target: HALL });

  // The newer wings open off the INNER WARD (the courtyard hub): two doorways in
  // the west curtain (facing +X), two in the east curtain (facing -X). Each has
  // a return portal that lands the scout back in the ward before its door.
  const WW = { x: -16.75, y: 1.7, z: 22, yaw: Math.PI / 2 };
  doorPortal(world, { x: -17.9, z: 22, faceYaw: Math.PI / 2, label: 'A stair down to the keep.  [E]',
    target: { x: -100, y: 1.7, z: -94, yaw: Math.PI } });
  registerPortal({ pos: [-100, 1.0, -93.0], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { ...WW, z: 22 } });
  doorPortal(world, { x: -17.9, z: 40, faceYaw: Math.PI / 2, label: "A door to St. Ursel's chapel.  [E]",
    target: { x: -100, y: 1.7, z: 108, yaw: Math.PI } });
  registerPortal({ pos: [-100, 1.0, 108.9], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { ...WW, z: 40 } });
  doorPortal(world, { x: 17.9, z: 22, faceYaw: -Math.PI / 2, label: 'A passage to the long gallery.  [E]',
    target: { x: 0, y: 1.7, z: -142, yaw: Math.PI } });
  registerPortal({ pos: [0, 1.0, -141.0], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { x: 16.75, y: 1.7, z: 22, yaw: -Math.PI / 2 } });
  doorPortal(world, { x: 17.9, z: 40, faceYaw: -Math.PI / 2, label: 'A gate to the walled garden.  [E]',
    target: { x: 150, y: 1.7, z: 108, yaw: Math.PI } });
  registerPortal({ pos: [150, 1.0, 108.9], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { x: 16.75, y: 1.7, z: 40, yaw: -Math.PI / 2 } });

  // A second rank of ward doorways for the newest wings — Harbour + Sounding
  // Court on the west curtain, Guild Hall + Bridal Hall on the east.
  doorPortal(world, { x: -17.9, z: 16, faceYaw: Math.PI / 2, label: 'A stair down to the harbour.  [E]',
    target: { x: 210, y: 4.3, z: 0, yaw: Math.PI / 2 } });
  registerPortal({ pos: [207, 3.6, 0], radius: 1.9, label: 'Back up to the ward.  [E]',
    target: { x: -16.75, y: 1.7, z: 16, yaw: Math.PI / 2 } });
  doorPortal(world, { x: -17.9, z: 46, faceYaw: Math.PI / 2, label: 'A door to the sounding court.  [E]',
    target: { x: 0, y: 1.7, z: 188, yaw: 0 } });
  registerPortal({ pos: [0, 1.0, 187.0], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { x: -16.75, y: 1.7, z: 46, yaw: Math.PI / 2 } });
  doorPortal(world, { x: 17.9, z: 16, faceYaw: -Math.PI / 2, label: 'A door to the guild hall.  [E]',
    target: { x: 200, y: 1.7, z: -88, yaw: Math.PI } });
  registerPortal({ pos: [200, 1.0, -86.9], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { x: 16.75, y: 1.7, z: 16, yaw: -Math.PI / 2 } });
  doorPortal(world, { x: 17.9, z: 46, faceYaw: -Math.PI / 2, label: 'A door to the bridal hall.  [E]',
    target: { x: -200, y: 1.7, z: -88, yaw: Math.PI } });
  registerPortal({ pos: [-200, 1.0, -86.9], radius: 1.5, label: 'Back to the ward.  [E]',
    target: { x: 16.75, y: 1.7, z: 46, yaw: -Math.PI / 2 } });

  // The Ordinal opens off the UNDERCROFT (crypt, floor y=-6) — a low brick
  // doorway in the crypt's south wall (canon: #16 → Undercroft).
  doorPortal(world, { x: 0, z: -2.9, y: -6, faceYaw: Math.PI, h: 2.2, label: 'A low brick doorway.  [E]',
    target: { x: -160, y: 1.7, z: -14, yaw: 0 } });
  registerPortal({ pos: [-160, 1.0, -15.0], radius: 1.5, label: 'Back to the crypt.  [E]',
    target: { x: 0, y: -4.3, z: -4.5, yaw: Math.PI } });
}

// Some area builders add their root to world.scene themselves; some return it.
// If a returned root has no parent, add it — never double-add.
function ensureInScene(world, ret) {
  const root = ret && (ret.isObject3D ? ret : ret.root);
  if (root && root.isObject3D && !root.parent && world.scene) world.scene.add(root);
}
