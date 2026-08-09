import * as THREE from 'three';
import { ps1ify, crunch } from '../core/ps1.js';

// ---------------------------------------------------------------------------
// Canvas-generated PS1 textures (<=128px, low colour count) + shared materials.
// Cool desaturated stone base, warm terracotta vault, dull iron, dark wood —
// per art-direction.md §1. Atmosphere lights all of this (MeshLambertMaterial);
// nothing here is self-lit.
// ---------------------------------------------------------------------------

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  crunch(t);
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// deterministic pseudo-random so the texture is stable (no per-frame flicker)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- flagstone floor: 4x4 dressed slabs, dark mortar, a few colour-tile accents
function drawFlagstone(ctx, size) {
  const r = rng(7);
  ctx.fillStyle = '#20222a'; // mortar / shadow base
  ctx.fillRect(0, 0, size, size);
  const n = 4, cell = size / n, gap = 2;
  const bases = ['#403b32', '#4a453a', '#37342e', '#443f36']; // warm-grey stone mids
  const accents = ['#6e3b2a', '#9c7b3a', '#4c5f4a']; // tile / ochre / verdigris (rare)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let col = bases[(x + y * 3 + Math.floor(r() * 4)) % bases.length];
      if (r() < 0.12) col = accents[Math.floor(r() * accents.length)];
      ctx.fillStyle = col;
      ctx.fillRect(x * cell + gap, y * cell + gap, cell - gap * 2, cell - gap * 2);
      // speckle for dither feel
      const spk = Math.floor(r() * 10);
      for (let s = 0; s < spk; s++) {
        ctx.fillStyle = r() < 0.5 ? '#2c2a24' : '#5c5648';
        ctx.fillRect(
          x * cell + gap + Math.floor(r() * (cell - gap * 2)),
          y * cell + gap + Math.floor(r() * (cell - gap * 2)),
          2, 2
        );
      }
    }
  }
}

// --- coursed stone wall: mid cool stone, faint horizontal courses + speckle
function drawStone(ctx, size) {
  const r = rng(19);
  ctx.fillStyle = '#4a4852';
  ctx.fillRect(0, 0, size, size);
  const courses = 8, ch = size / courses;
  for (let i = 0; i < courses; i++) {
    ctx.fillStyle = i % 2 ? '#454350' : '#514f59';
    ctx.fillRect(0, i * ch, size, ch - 1);
    ctx.fillStyle = '#33323b'; // course line
    ctx.fillRect(0, i * ch + ch - 1, size, 1);
  }
  for (let s = 0; s < 220; s++) {
    ctx.fillStyle = r() < 0.5 ? '#3a3942' : '#5f5d68';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 2, 2);
  }
}

// --- pale limestone for columns / tracery (warmer, lighter than walls)
function drawLimestone(ctx, size) {
  const r = rng(31);
  ctx.fillStyle = '#6b6656';
  ctx.fillRect(0, 0, size, size);
  for (let s = 0; s < 260; s++) {
    ctx.fillStyle = r() < 0.5 ? '#585240' : '#8a836d';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 2, 2);
  }
}

// --- damp crypt stone: cooler + darker than the nave walls, vertical water
//     stains bleeding down, moss dabs near the base (art-direction §4 decay)
function drawDampStone(ctx, size) {
  const r = rng(23);
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, size, size);
  const courses = 6, ch = size / courses;
  for (let i = 0; i < courses; i++) {
    ctx.fillStyle = i % 2 ? '#353b44' : '#414852';
    ctx.fillRect(0, i * ch, size, ch - 1);
    ctx.fillStyle = '#262b32';
    ctx.fillRect(0, i * ch + ch - 1, size, 1);
  }
  // vertical water-stain runs
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = '#2c2a24';
    ctx.fillRect(Math.floor(r() * size), 0, 2 + Math.floor(r() * 4), size);
  }
  for (let s = 0; s < 170; s++) {
    ctx.fillStyle = r() < 0.5 ? '#2b3038' : '#4a515c';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 2, 2);
  }
  // moss / verdigris near the bottom courses
  for (let s = 0; s < 34; s++) {
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(Math.floor(r() * size), size - Math.floor(r() * 22), 2, 2);
  }
}

// --- pale bone / skull texture for the ossuary niches
function drawBone(ctx, size) {
  const r = rng(41);
  ctx.fillStyle = '#bfae90';
  ctx.fillRect(0, 0, size, size);
  for (let s = 0; s < 200; s++) {
    ctx.fillStyle = r() < 0.5 ? '#a2916f' : '#cbb89a';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 2, 2);
  }
  for (let s = 0; s < 12; s++) {
    ctx.fillStyle = '#6b5f48';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 3 + Math.floor(r() * 4));
  }
}

// --- dark wood planks (benches / table)
function drawWood(ctx, size) {
  const r = rng(53);
  ctx.fillStyle = '#33261a';
  ctx.fillRect(0, 0, size, size);
  const planks = 4, pw = size / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = i % 2 ? '#2c2016' : '#3a2c1e';
    ctx.fillRect(i * pw, 0, pw - 1, size);
  }
  for (let s = 0; s < 120; s++) {
    ctx.fillStyle = r() < 0.5 ? '#241a12' : '#4a3826';
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 2 + Math.floor(r() * 3));
  }
}

/** Build every shared material (call inside init so `document` exists). */
export function createMaterials() {
  const floorTex = canvasTex(128, drawFlagstone, [3.5, 8]);
  const chancelTex = canvasTex(128, drawFlagstone, [2, 1.6]);
  const stoneTex = canvasTex(128, drawStone, [4, 3]);
  const limeTex = canvasTex(128, drawLimestone, [1, 3]);
  const woodTex = canvasTex(64, drawWood, [1, 1]);
  const rubbleTex = canvasTex(128, drawStone, [1, 1]);
  const dampTex = canvasTex(128, drawDampStone, [2, 1.5]);
  const cryptFloorTex = canvasTex(128, drawFlagstone, [3, 3]);
  const boneTex = canvasTex(64, drawBone, [1, 1]);
  const timberTex = canvasTex(64, drawWood, [2, 1]);

  const M = {
    floor: ps1ify(new THREE.MeshLambertMaterial({ map: floorTex, color: 0xcfcabf })),
    chancel: ps1ify(new THREE.MeshLambertMaterial({ map: chancelTex, color: 0xcfc6b8 })),
    wall: ps1ify(new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xbfc0c8 })),
    stone: ps1ify(new THREE.MeshLambertMaterial({ map: limeTex, color: 0xc9c4b4 })),
    column: ps1ify(new THREE.MeshLambertMaterial({ map: limeTex, color: 0xb9b2a0 })),
    wood: ps1ify(new THREE.MeshLambertMaterial({ map: woodTex, color: 0xb99f83 })),
    rubble: ps1ify(new THREE.MeshLambertMaterial({ map: rubbleTex, color: 0xa9a6a0 })),
    iron: ps1ify(new THREE.MeshLambertMaterial({ color: 0x1b1c22 })),
    wax: ps1ify(new THREE.MeshLambertMaterial({ color: 0xcbb89a })),
    // vault uses per-vertex colour (dark crown), so map is omitted
    vault: ps1ify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })),
    vaultRib: ps1ify(new THREE.MeshLambertMaterial({ color: 0x4a3226, side: THREE.DoubleSide })),
    shadow: ps1ify(new THREE.MeshBasicMaterial({ color: 0x0c0d12 })),

    // --- THE UNDERCROFT (plague crypt below the chancel) — cool, damp, dark ---
    // DoubleSide on the merged-buffer surfaces (stairs, vault) so winding is moot.
    cryptWall: ps1ify(new THREE.MeshLambertMaterial({ map: dampTex, color: 0x8a929e, side: THREE.DoubleSide })),
    cryptFloor: ps1ify(new THREE.MeshLambertMaterial({ map: cryptFloorTex, color: 0x969ca6 })),
    cryptPier: ps1ify(new THREE.MeshLambertMaterial({ map: dampTex, color: 0x7f8792 })),
    cryptNiche: ps1ify(new THREE.MeshLambertMaterial({ color: 0x14161c, side: THREE.DoubleSide })), // shadowed void
    bone: ps1ify(new THREE.MeshLambertMaterial({ map: boneTex, color: 0xcbb89a })),
    timber: ps1ify(new THREE.MeshLambertMaterial({ map: timberTex, color: 0x6a5a44 })),
    quicklime: ps1ify(new THREE.MeshLambertMaterial({ color: 0xd6d0c0 })),
    // Mechthild's red shoe (world-bible §4/§7.4). Aged oxblood leather — the one
    // deliberate warm splash in the crypt; motivated by candlelight, never named.
    shoeLeather: ps1ify(new THREE.MeshLambertMaterial({ color: 0x8a2f26 })),
    // invisible smooth ramp proxy under the stair treads — raycast target only.
    rampHidden: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  };
  return M;
}
