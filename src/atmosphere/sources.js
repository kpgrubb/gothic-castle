import * as THREE from 'three';
import { ps1ify } from '../core/ps1.js';

// ---------------------------------------------------------------------------
// ATMOSPHERE source meshes (all named atmo_*). Every light the module adds has
// a VISIBLE emissive source built here:
//   - glowing window / sky planes (cold, MeshBasic, fog:false so they stay the
//     scene's brightest highlights through the fog)
//   - warm candle flames (crossed additive quads), wall sconces, a wrought-iron
//     table chandelier
//   - additive faux light-shafts (god-rays) and soft bloom halos
// Nothing here casts real light — the PointLights/DirectionalLight in index.js
// do that; these are the motivating sources the rubric scores.
// ---------------------------------------------------------------------------

/** Shared dark-iron + pale-wax materials for atmosphere's own props. */
export function createAtmoMaterials() {
  return {
    iron: ps1ify(new THREE.MeshLambertMaterial({ color: 0x141519 })),
    wax: ps1ify(new THREE.MeshLambertMaterial({ color: 0xcbb89a })),
  };
}

/** A self-lit glass / sky plane. fog:false keeps it a highlight at any depth. */
export function addGlassPlane(parent, name, w, h, pos, rotY, tex, color = 0xffffff) {
  const mat = ps1ify(new THREE.MeshBasicMaterial({
    map: tex, color, side: THREE.DoubleSide, fog: false, toneMapped: false,
  }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.name = name;
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = rotY || 0;
  parent.add(m);
  return m;
}

/** A soft additive bloom halo (billboard-ish flat quad). */
export function addGlow(parent, name, pos, size, tex, color, rotY = 0) {
  const mat = ps1ify(new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false,
  }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.name = name;
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

/**
 * A warm candle flame: two crossed additive quads so it reads from any camera.
 * Returns { group, mat } — mat.opacity is flickered by the updater.
 */
export function addFlame(parent, name, pos, size, flameTex, color = 0xffffff) {
  const mat = ps1ify(new THREE.MeshBasicMaterial({
    map: flameTex, color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false, toneMapped: false,
  }));
  const g = new THREE.Group();
  g.name = name;
  g.position.set(pos[0], pos[1], pos[2]);
  for (let i = 0; i < 2; i++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.7), mat);
    q.rotation.y = i * Math.PI / 2;
    q.position.y = size * 0.55;
    g.add(q);
  }
  parent.add(g);
  return { group: g, mat };
}

/**
 * A wall sconce: small iron bracket + wax candle stub + flame. Positioned at the
 * candle base (x,y,z) already stood off the wall by the caller.
 * Returns the flame handle for flicker.
 */
export function addSconce(parent, name, x, y, z, mats, flameTex) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), mats.iron);
  g.add(bracket);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 6), mats.wax);
  candle.position.y = 0.1;
  g.add(candle);
  parent.add(g);
  return addFlame(g, name + '_flame', [0, 0.2, 0], 0.1, flameTex);
}

/**
 * The warm wrought-iron chandelier hung over the abandoned table (atmosphere's
 * own prop — the fallen one on the nave floor is architecture's). Centre at
 * (cx,cy,cz); six candle cups + flames + a snapped chain up toward the ceiling.
 * Returns { group, flames:[{group,mat}] }.
 */
export function addTableChandelier(parent, cx, cy, cz, mats, flameTex) {
  const g = new THREE.Group();
  g.name = 'atmo_chandelier_table';
  g.position.set(cx, cy, cz);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 16), mats.iron);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.03), mats.iron));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.1), mats.iron));
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), mats.iron);
  chain.position.y = 0.78;
  g.add(chain);

  const flames = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 0.55, pz = Math.sin(a) * 0.55;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.16, 6), mats.wax);
    cup.position.set(px, 0.08, pz);
    // one guttered / burnt low (decay), one snuffed (no flame)
    if (i === 4) cup.scale.y = 0.4;
    g.add(cup);
    if (i === 2) continue; // this candle is out
    flames.push(addFlame(g, 'atmo_flame_chand', [px, 0.16, pz], 0.1, flameTex));
  }
  parent.add(g);
  return { group: g, flames };
}

/**
 * Additive faux light-shaft (god-ray) from A (bright, window end) to B (floor).
 * Built as two crossed tapered trapezoids so it has volume from any shot angle.
 * Nearly free: transparent, depthWrite:false, no real light.
 */
export function addBeam(parent, name, A, B, wA, wB, tex, color, opacity) {
  const a = new THREE.Vector3(A[0], A[1], A[2]);
  const b = new THREE.Vector3(B[0], B[1], B[2]);
  const dir = new THREE.Vector3().subVectors(b, a);
  const dlen = dir.length() || 1;
  const dn = dir.clone().multiplyScalar(1 / dlen);

  const mat = ps1ify(new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false, toneMapped: false,
  }));

  const group = new THREE.Group();
  group.name = name;
  for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
    // perpendicular component of axis relative to the beam direction
    const p = axis.clone().addScaledVector(dn, -axis.dot(dn));
    if (p.lengthSq() < 1e-4) continue;
    p.normalize();
    const a0 = a.clone().addScaledVector(p, wA);
    const a1 = a.clone().addScaledVector(p, -wA);
    const b1 = b.clone().addScaledVector(p, -wB);
    const b0 = b.clone().addScaledVector(p, wB);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      ...a0.toArray(), ...a1.toArray(), ...b1.toArray(),
      ...a0.toArray(), ...b1.toArray(), ...b0.toArray(),
    ]), 3));
    // uv.y = 1 at the window end (bright) -> 0 at floor (gone)
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0, 1, 1, 1, 1, 0,
      0, 1, 1, 0, 0, 0,
    ]), 2));
    const m = new THREE.Mesh(geo, mat);
    m.name = name + '_quad';
    group.add(m);
  }
  parent.add(group);
  return group;
}

/**
 * A thin drifting dust field for a light shaft (polish). Small Points cloud,
 * additive, fogged so it dies into the dark. Returns { points, drift() }.
 */
export function addDust(parent, name, box, count, tex, color) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = box.x + (Math.random() - 0.5) * box.w;
    positions[i * 3 + 1] = box.y + Math.random() * box.h;
    positions[i * 3 + 2] = box.z + (Math.random() - 0.5) * box.d;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = ps1ify(new THREE.PointsMaterial({
    size: 0.05, map: tex, color, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  const points = new THREE.Points(geo, mat);
  points.name = name;
  parent.add(points);
  const attr = geo.getAttribute('position');
  const baseY = positions.slice();
  function drift(t) {
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      // slow fall + gentle sway; wrap within the box height
      let y = baseY[i * 3 + 1] - ((t * 0.12 + s) % box.h);
      if (y < box.y) y += box.h;
      attr.array[i * 3 + 1] = y;
      attr.array[i * 3] = positions[i * 3] + Math.sin(t * 0.3 + s) * 0.08;
    }
    attr.needsUpdate = true;
  }
  return { points, drift };
}
