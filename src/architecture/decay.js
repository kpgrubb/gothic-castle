import * as THREE from 'three';
import { ps1ify } from '../core/ps1.js';
import { addBox, addMesh, registerAABB, addContactShadow } from './geom-utils.js';

// ---------------------------------------------------------------------------
// Story-bearing decay (art-direction.md §4). Specific, local clusters — people
// left in a hurry and never came back:
//   - abandoned meal: chamber table + tipped stool + wooden bowls
//   - fallen chandelier at (-0.5,0,-4): snapped iron ring, hardened wax, stubs
//   - dressed-stone blocks + rubble under the collapsed west vault bay (~-4,-8)
//   - scattered pews, some knocked over, along the nave aisles
//   - a daubed plague cross (sealed-house mark) near the chamber opening
//   - a fallen block in the shot-1 sightline for human scale
// Atmosphere owns the still-lit flame + glow; here it is iron / wax / broken forms.
// Colliders on every large floor prop.
// ---------------------------------------------------------------------------

export function buildDecay(root, M) {
  const paint = ps1ify(new THREE.MeshLambertMaterial({ color: 0x6e2f2a })); // oxblood daub

  makeTable(root, M, 10.5, 3.5);
  makeStool(root, M, 9.5, 4.4, true, 1.1);   // tipped stool, knocked back
  makeStool(root, M, 11.4, 2.5, false, 0);   // the other place, still upright

  // wooden bowls on the table (foreground human-scale cue for shot 4)
  addMesh(root, new THREE.CylinderGeometry(0.17, 0.13, 0.11, 8), M.wood, 'arch_bowl',
    [10.1, 0.81, 3.2]);
  addMesh(root, new THREE.CylinderGeometry(0.18, 0.16, 0.04, 8), M.wood, 'arch_plate',
    [10.9, 0.775, 3.7]);

  makeChandelier(root, M, -0.5, -4);

  // dressed-stone blocks around the debris (scale cues, shots 5 & 6)
  makeBlock(root, M, -1.6, -4.6, 0.62, 0.46, 0.7, 0.5);
  makeBlock(root, M, 0.35, -3.0, 0.55, 0.5, 0.62, -0.3);
  makeBlock(root, M, -0.1, -5.3, 0.7, 0.42, 0.55, 0.2);

  // rubble pile beneath the collapsed west vault bay
  makeRubble(root, M, -4.0, -8.2);

  // fallen block in the nave, foreground of shot 1
  makeBlock(root, M, 0.9, 11.0, 0.55, 0.5, 0.66, 0.4);

  // scattered pews along the aisles (some knocked over)
  makeBench(root, M, -5.0, 8, 0, false);
  makeBench(root, M, -5.0, 1, 0, true);      // knocked over
  makeBench(root, M, -5.0, -6, 0.08, false);
  makeBench(root, M, 5.0, 9, Math.PI, false);
  makeBench(root, M, 5.0, 2, Math.PI, true); // knocked over
  makeBench(root, M, 5.0, -6, Math.PI, false);
  makeBench(root, M, -2.6, 12.5, Math.PI / 2, true); // knocked into the nave

  // plague cross daubed near the chamber opening (nave side of east wall)
  addBox(root, 0.12, 0.9, 0.05, paint, 5.98, 2.3, 10, 'arch_plague_cross_v', false);
  addBox(root, 0.55, 0.12, 0.05, paint, 5.98, 2.45, 10, 'arch_plague_cross_h', false);
}

function makeTable(root, M, x, z) {
  addContactShadow(root, x, z, 2.6, 1.3, M.shadow);
  addBox(root, 2.2, 0.12, 0.9, M.wood, x, 0.69, z, 'arch_table_top', false);
  for (const dx of [-1.0, 1.0]) {
    for (const dz of [-0.35, 0.35]) {
      addBox(root, 0.14, 0.69, 0.14, M.wood, x + dx, 0.345, z + dz, 'arch_table_leg', false);
    }
  }
  registerAABB(x, 0.375, z, 2.2, 0.75, 0.9);
}

function makeStool(root, M, x, z, tipped, rotY) {
  const g = new THREE.Group();
  g.name = 'arch_stool';
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), M.wood);
  seat.position.y = 0.44;
  g.add(seat);
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.06), M.wood);
      leg.position.set(dx, 0.22, dz);
      g.add(leg);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  if (tipped) {
    g.rotation.z = Math.PI / 2;   // lying on its side
    g.position.y = 0.2;
  }
  root.add(g);
  registerAABB(x, 0.22, z, 0.5, tipped ? 0.45 : 0.5, 0.5);
}

function makeBench(root, M, x, z, rotY, knocked) {
  const g = new THREE.Group();
  g.name = 'arch_bench';
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.42), M.wood);
  seat.position.y = 0.45;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.08), M.wood);
  back.position.set(0, 0.75, -0.18);
  g.add(back);
  for (const dx of [-0.8, 0.8]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.42), M.wood);
    end.position.set(dx, 0.225, 0);
    g.add(end);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  if (knocked) {
    g.rotation.x = Math.PI / 2;   // toppled forward
    g.position.y = 0.42;
  }
  root.add(g);
  const w = Math.abs(Math.cos(rotY)) > 0.5 ? 1.8 : 0.6;
  const d = Math.abs(Math.cos(rotY)) > 0.5 ? 0.6 : 1.8;
  registerAABB(x, 0.3, z, w, 0.6, d);
}

function makeBlock(root, M, x, z, w, h, d, rotY) {
  const m = addBox(root, w, h, d, M.rubble, x, h / 2, z, 'arch_block', false);
  m.rotation.y = rotY || 0;
  registerAABB(x, h / 2, z, Math.max(w, d), h, Math.max(w, d));
}

function makeRubble(root, M, x, z) {
  addContactShadow(root, x, z, 3.0, 3.0, M.shadow);
  const r = seed(101);
  for (let i = 0; i < 12; i++) {
    const s = 0.18 + r() * 0.4;
    const px = x + (r() - 0.5) * 2.2;
    const pz = z + (r() - 0.5) * 2.2;
    const py = s / 2 + r() * 0.15;
    const m = addBox(root, s, s * (0.7 + r() * 0.6), s, M.rubble, px, py, pz, 'arch_rubble', false);
    m.rotation.set(r() * 0.6, r() * Math.PI, r() * 0.6);
  }
  // one bigger toppled block for scale
  makeBlock(root, M, x + 0.6, z + 0.4, 0.8, 0.55, 0.7, 0.6);
  registerAABB(x, 0.4, z, 2.6, 0.8, 2.6);
}

function makeChandelier(root, M, x, z) {
  addContactShadow(root, x, z, 2.6, 2.6, M.shadow);
  const g = new THREE.Group();
  g.name = 'arch_chandelier';
  g.position.set(x, 0, z);
  g.rotation.set(Math.PI / 2, 0, 0);   // ring laid flat...
  g.rotation.z = 0.22;                  // ...then tilted (crashed askew)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 18), M.iron);
  g.add(ring);
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.06), M.iron);
  g.add(cross1);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.0), M.iron);
  g.add(cross2);
  // candle cups around the ring (some snapped off / leaning)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.2, 6), M.wax);
    cup.position.set(Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0);
    if (i === 3) cup.rotation.z = 1.2; // one knocked over
    g.add(cup);
  }
  root.add(g);

  // snapped chain draping up toward the vault (broken)
  const chain = addMesh(root, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), M.iron,
    'arch_chandelier_chain', [x + 0.3, 0.9, z - 0.2]);
  chain.rotation.z = 0.5;

  // hardened wax pool spreading on the flagstones
  addMesh(root, new THREE.CylinderGeometry(0.55, 0.62, 0.04, 10), M.wax,
    'arch_wax_pool', [x + 0.1, 0.03, z + 0.15]);

  registerAABB(x, 0.3, z, 2.3, 0.6, 2.3);
}

// tiny deterministic PRNG for stable rubble placement
function seed(s) {
  let v = s >>> 0;
  return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
}
