import * as THREE from 'three';
import { crunch } from '../core/ps1.js';

// ---------------------------------------------------------------------------
// ATMOSPHERE textures — tiny (<=64px) canvas gradients for the self-lit source
// meshes: cold window glass, cold daylight sky, warm flame cores, soft glow
// halos, and the additive light-shaft falloff. Every texture is crunch()'d
// (nearest, sRGB) per the PS1 spec. Low colour count, no per-frame redraw.
// ---------------------------------------------------------------------------

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Vertical (or horizontal) linear gradient. stops = [[offset, cssColor], ...]. */
export function linearGradTex(size, stops, horizontal = false) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = horizontal
    ? ctx.createLinearGradient(0, 0, size, 0)
    : ctx.createLinearGradient(0, 0, 0, size);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  crunch(t);
  return t;
}

/** Radial gradient from centre out — used for flame cores, glow halos, motes. */
export function radialGlowTex(size, stops) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  crunch(t);
  return t;
}

/** Build the whole atmosphere texture set once (call inside init; needs `document`). */
export function createAtmoTextures() {
  return {
    // Cold tracery glass: near-white blown top -> cool blue-grey sill.
    glass: linearGradTex(64, [
      [0.0, '#eef3f8'],
      [0.32, '#cdd8e4'],
      [0.70, '#a8b8cc'],
      [1.0, '#8090a6'],
    ]),
    // Cold exterior daylight behind the doorway (shot 5 silhouette-maker).
    sky: linearGradTex(64, [
      [0.0, '#f2f6fa'],
      [0.55, '#dfe7f0'],
      [1.0, '#b6c4d6'],
    ]),
    // Warm candle flame: hot pale core -> amber -> transparent falloff.
    flame: radialGlowTex(64, [
      [0.0, 'rgba(255,244,214,1.0)'],
      [0.22, 'rgba(255,217,160,0.95)'],
      [0.5, 'rgba(232,162,76,0.55)'],
      [0.8, 'rgba(122,74,34,0.14)'],
      [1.0, 'rgba(122,74,34,0.0)'],
    ]),
    // Soft cold bloom halo around windows.
    glowCold: radialGlowTex(64, [
      [0.0, 'rgba(214,224,236,0.85)'],
      [0.4, 'rgba(160,180,206,0.38)'],
      [1.0, 'rgba(120,140,172,0.0)'],
    ]),
    // Soft warm bloom halo around flames.
    glowWarm: radialGlowTex(64, [
      [0.0, 'rgba(255,214,150,0.7)'],
      [0.45, 'rgba(232,162,76,0.3)'],
      [1.0, 'rgba(122,74,34,0.0)'],
    ]),
    // Additive light-shaft falloff: bright at the window end (v=1) -> gone at floor.
    shaft: linearGradTex(64, [
      [0.0, 'rgba(206,220,236,0.6)'],
      [0.45, 'rgba(170,190,214,0.24)'],
      [1.0, 'rgba(150,170,200,0.0)'],
    ]),
    // Single dust mote sprite.
    mote: radialGlowTex(32, [
      [0.0, 'rgba(220,230,242,0.9)'],
      [0.5, 'rgba(180,196,216,0.4)'],
      [1.0, 'rgba(180,196,216,0.0)'],
    ]),
  };
}
