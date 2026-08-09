import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { buildFloors } from './floor.js';
import { buildWalls } from './walls.js';
import { buildColumns } from './columns.js';
import { buildVault } from './vault.js';
import { buildSideChamber } from './side-chamber.js';
import { buildDecay } from './decay.js';
import { buildUndercroft } from './undercroft.js';
import { buildNordturm } from './nordturm.js';

// ===========================================================================
// ARCHITECTURE MODULE — geometry, layout, collision (scene-contract.md §7a).
// Builds the plague-abandoned cruciform gothic hall to the §4 coordinates:
// flagstone nave + raised chancel, perimeter walls with the doorway / tracery /
// clerestory / chamber openings, two octagonal column rows, a low-poly pointed
// vault (with a collapsed west bay), the side chamber, and the decay props.
//
// OWNS: everything under src/architecture/. Adds NO lights, fog, or controls.
// All materials are ps1ify'd; all textures crunch'd. Colliders pushed via
// registerCollider (through the geom-utils helpers).
// ===========================================================================

export function initArchitecture(world) {
  const root = new THREE.Group();
  root.name = 'arch_root';

  const M = createMaterials();

  buildFloors(root, M);
  buildWalls(root, M);
  buildColumns(root, M);
  buildVault(root, M);
  buildSideChamber(root, M);
  buildDecay(root, M);
  buildUndercroft(root, M);   // THE UNDERCROFT — plague crypt below the chancel
  buildNordturm(root, M);     // THE NORDTURM — north tower + Siegmund's study

  world.scene.add(root);

  // Spawn stays at the contract default (0,1.7,15.5) facing -Z, just inside the
  // doorway opening — the doorway did not move, so we don't override world.spawn.

  return root;
}
