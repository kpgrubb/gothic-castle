# Plague's End — an explorable PS1-style gothic castle

A first-person, walkable, plague-abandoned gothic great hall. Vite + Three.js, rendered in a
deliberate PlayStation-1 style (tiny internal resolution nearest-upscaled, vertex jitter, crunchy
textures, fog-culled draw distance) — which is also how it stays at 60fps on integrated graphics.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5188
```

Production build: `npm run build` → `dist/` (preview with `npm run preview`).

## Controls

- **Click** the window to enter (pointer lock + fullscreen + sound). **Esc** releases.
- **WASD / arrows** — move. **Shift** — run. **Mouse** — look. **E** — examine (near glowing prompts).

## What to find

The castle tells the story of a house sealed during plague. On the main floor: the abandoned
meal in the side chamber, the fallen chandelier whose one candle impossibly still burns, the red
cross on the sealed door, the collapsed vault, and the stripped altar.

**The Undercroft** — a stair descends from the chancel into a plague-crypt below: a sealed
lime-pit, ossuary niches stacked with bone, and a child's shoe on the seventh step, under a
single cold shaft of moonlight through an iron grate.

## Sound

Fully procedural (no audio files) — cold wind at the windows, water drips and a low drone in the
crypt, a distant tolling bell, candle crackle, and footsteps that turn wet underground. Audio is
spatialized to where you're looking and starts on your first click.

## Project structure (see `scene-contract.md`)

- `src/core/` — bootstrap, shared scene-graph API, PS1 render primitives, the 6 verification cameras.
- `src/architecture/` — geometry, layout, collision (43 colliders).
- `src/atmosphere/` — lighting, fog, and the motivating light-source meshes (8 lights).
- `src/interaction/` — controls, collision response, examine system.

`scene-contract.md` is the module contract (boundaries, API, unit scale, layout, cameras).
`art-direction.md` is the palette / value / light / decay / scale spec derived from `refs/`.

## Verification

The build is checked with a Playwright loop: navigate to `?shot=1..6` (six fixed cameras defined
in `src/core/shots.js`), capture to `captures/`, and score each against a 5-point rubric (value
structure, light motivation, decay specificity, scale legibility, palette discipline). Scores are
logged in `review-log.md`.

Dev/verification URL flags:
- `?shot=N` — freeze the camera at preset N (1–6) for deterministic captures.
- `?free=1` — activate WASD without pointer lock (for automated testing); exposes `window.__controls`.
- `?inspect=1` — add a neutral fill light to inspect raw geometry (diagnostic only; not the art direction).
