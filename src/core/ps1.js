import * as THREE from 'three';

// ---------------------------------------------------------------------------
// PS1 RENDER PRIMITIVES  (owned by CORE — see scene-contract.md §5)
// Four era techniques, all cheap enough for integrated graphics:
//   1. Tiny drawing buffer stretched to the window with nearest-neighbour CSS.
//   2. Per-vertex snapping ("jitter").
//   3. AFFINE texture mapping — no perspective correction, so textures "swim"
//      across triangles (the signature PS1 warp).
//   4. Ordered (4x4 Bayer) dithering + ~15-bit colour quantization.
// (2)-(4) are per-material fragment/vertex injections via onBeforeCompile — no
// post-processing render target, so the pipeline stays simple and fast.
// Atmosphere sets the ARTISTIC params (colours, fog, light values); core only
// provides the technique. Do not bake palette decisions in here.
// ---------------------------------------------------------------------------

// Global toggles. Dithering is ON by default (the iconic, robust PS1 tell).
// Affine warp is OPT-IN (?affine=1): it's surface-dependent — great on small
// tessellated surfaces, but washes out some large untextured wall quads — so it
// ships off until per-surface tuning lands (see review-log / backlog).
//   ?dither=0  -> disable dithering    ?affine=1 -> enable affine warp
const PS1_FX = (() => {
  try {
    const p = new URLSearchParams(location.search);
    return { affine: p.get('affine') === '1', dither: p.get('dither') !== '0' };
  } catch (_) { return { affine: false, dither: true }; }
})();

/**
 * Patch a material for the PS1 look: vertex snapping, affine (non-perspective)
 * texture mapping, and ordered dithering + colour quantization.
 * Works on any standard material (Basic/Lambert/Standard) that includes the
 * usual chunks. Three r169 is WebGL2 (GLSL ES 3.0), so array constructors and
 * dynamic indexing in the dither block are valid.
 * @param {THREE.Material} material
 * @param {{ jitter?: number, affine?: boolean, dither?: boolean }} opts
 */
export function ps1ify(material, { jitter = 160, affine = PS1_FX.affine, dither = PS1_FX.dither } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uJitter = { value: jitter };

    // Affine warp is for opaque WORLD textures (floors/walls/props). Skip it on
    // transparent/additive FX (light shafts, glows, dust) — their falloff UVs
    // must stay perspective-correct or the additive blend blows out.
    const doAffine = affine && !material.transparent && material.blending === THREE.NormalBlending;

    // ---- VERTEX: snap projected vertex + capture affine (screen-linear) UV ----
    // Affine trick that needs no `noperspective`: pass uv*w and w as varyings;
    // the GPU's perspective-correct interpolation of (uv*w)/(w) cancels back to a
    // screen-space-LINEAR uv in the fragment -> the PS1 texture warp.
    let vs = 'uniform float uJitter;\nvarying vec2 vPsxUv;\nvarying float vPsxW;\n' + shader.vertexShader;
    vs = vs.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec3 _ndc = gl_Position.xyz / gl_Position.w;   // -> NDC
        _ndc.xy = floor(_ndc.xy * uJitter) / uJitter;  // snap to a coarse grid
        gl_Position.xyz = _ndc * gl_Position.w;        // back to clip space (w preserved)
      }
      #if defined( USE_MAP ) && defined( USE_UV )
        // Apply Three's map uv-transform (repeat/offset) BEFORE the affine
        // multiply, so tiling textures still tile. Then *w for affine sampling.
        // Guarded on USE_UV so non-uv materials (e.g. Points/dust) stay valid.
        vPsxW = gl_Position.w;
        vPsxUv = ( mapTransform * vec3( uv, 1.0 ) ).xy * vPsxW;
      #else
        vPsxW = 1.0;
        vPsxUv = vec2(0.0);
      #endif`
    );
    shader.vertexShader = vs;

    // ---- FRAGMENT ----
    let fs = 'varying vec2 vPsxUv;\nvarying float vPsxW;\n' + shader.fragmentShader;

    if (doAffine) {
      // Sample the diffuse map with the screen-linear (affine) uv instead of vMapUv.
      fs = fs.replace(
        '#include <map_fragment>',
        `#if defined( USE_MAP ) && defined( USE_UV )
          diffuseColor *= texture2D( map, vPsxUv / vPsxW );
        #endif`
      );
    }

    if (dither) {
      // After colour-space conversion + fog: ordered 4x4 Bayer dither, then
      // quantize each channel to 32 levels (~15-bit colour, PS1-authentic).
      fs = fs.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          const float _bayer[16] = float[16](
            0.0, 8.0, 2.0, 10.0,
            12.0, 4.0, 14.0, 6.0,
            3.0, 11.0, 1.0, 9.0,
            15.0, 7.0, 13.0, 5.0
          );
          int _bx = int(mod(gl_FragCoord.x, 4.0));
          int _by = int(mod(gl_FragCoord.y, 4.0));
          float _threshold = (_bayer[_by * 4 + _bx] + 0.5) / 16.0 - 0.5;
          float _levels = 32.0;
          vec3 _c = gl_FragColor.rgb + _threshold / _levels;
          gl_FragColor.rgb = floor(_c * _levels + 0.5) / _levels;
        }`
      );
    }
    shader.fragmentShader = fs;
  };
  material.userData.ps1 = true;
  return material;
}

/** Make a texture read as low-res PS1: nearest filtering, no anisotropy. */
export function crunch(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Create the renderer and wire up low-internal-resolution rendering.
 * The drawing buffer is ~internalHeight tall; CSS stretches the canvas to the
 * window. Camera aspect always matches the window so nothing is distorted.
 */
export function makePS1Renderer(parentEl, { internalHeight = 288 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x05060a, 1);
  parentEl.appendChild(renderer.domElement);

  const state = { internalHeight };

  function resize(camera) {
    const w = window.innerWidth, h = window.innerHeight;
    const ih = state.internalHeight;
    const iw = Math.max(1, Math.round(ih * (w / h)));
    renderer.setSize(iw, ih, false); // false => do NOT write inline CSS size; #app canvas CSS handles stretch
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }

  return { renderer, resize, state };
}
