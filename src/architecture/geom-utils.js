import * as THREE from 'three';
import { registerCollider } from '../core/scene.js';

// ---------------------------------------------------------------------------
// Small geometry helpers shared by the architecture builders.
// Everything here is axis-aligned-box friendly; colliders are world-space AABBs.
// ---------------------------------------------------------------------------

/** Register a world-space axis-aligned box collider from centre + size. */
export function registerAABB(cx, cy, cz, w, h, d) {
  const min = new THREE.Vector3(cx - w / 2, cy - h / 2, cz - d / 2);
  const max = new THREE.Vector3(cx + w / 2, cy + h / 2, cz + d / 2);
  return registerCollider(new THREE.Box3(min, max));
}

/**
 * Add an axis-aligned box mesh at a centre point.
 * @returns the THREE.Mesh (already parented).
 */
export function addBox(parent, w, h, d, mat, cx, cy, cz, name, collide = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  if (name) m.name = name;
  parent.add(m);
  if (collide) registerAABB(cx, cy, cz, w, h, d);
  return m;
}

/** Add an arbitrary geometry as a mesh. */
export function addMesh(parent, geo, mat, name, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

/**
 * Fake contact shadow: a flat dark quad just above the floor under a big prop.
 * No transparency (keeps it cheap + era-correct); reads as a darkened flagstone.
 */
export function addContactShadow(parent, cx, cz, w, d, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0.02, cz);
  m.name = 'arch_contact_shadow';
  parent.add(m);
  return m;
}
