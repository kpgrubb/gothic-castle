# Plague's End — Build Export / Handoff

> Portable context pack for workshopping the next steps. This is a self-contained
> summary of an existing, working project: a first-person, PS1-style, plague-abandoned
> gothic castle you can walk through. Paste this whole file into an AI to plan what's next.
> (You do not have the source files in this AI; everything needed to reason is below.)

---

## 1. What it is

An explorable 3D **gothic castle, abandoned during plague**, rendered in a deliberate
**PlayStation-1 aesthetic** (chunky low-res, vertex wobble, crunchy nearest-filtered
textures, fog-culled draw distance). **First-person walking sim** — no combat, no threat;
mood, exploration, and environmental story. Runs at **60fps on integrated graphics**
(measured ~0.86 ms/frame render cost, huge headroom).

Two areas exist today:
- **Main floor** — a cruciform great hall: nave with two column rows + low-poly vault, a
  chancel/apse with a big cold tracery window, a side chamber with an abandoned meal, and
  a fallen chandelier whose one candle impossibly still burns.
- **The Undercroft** — a stair descends into a plague-crypt below: a sealed lime-pit, ossuary
  niches stacked with bone, a child's shoe on the steps, under a cold moonlight shaft.

Fully procedural **spatial audio** (no asset files): wind at the windows, crypt drone + water
drips, a distant tolling bell, candle crackle, footsteps (wet underground).

---

## 2. Tech stack & how to run

- **Vite 5** + **Three.js r0.169** (ES modules, no framework). Vanilla JS (no TypeScript).
- No external runtime deps beyond three. Audio is Web Audio via `THREE.AudioListener` /
  `THREE.PositionalAudio` with **synthesized buffers** (no files).
- Run: `npm install` → `npm run dev` (fixed port **5188**). Build: `npm run build` → `dist/`.

**Dev / verification URL flags** (important — this is how it's tested):
- `?shot=N` — freeze the camera at fixed preset **N (1–9)** and disable controls (deterministic screenshots).
- `?free=1` — activate WASD **without** pointer lock; exposes `window.__controls` (position/yaw/pitch/active/free) for synthetic-input testing.
- `?inspect=1` — add a neutral fill light to inspect raw geometry (diagnostic only, not the art direction).

**Controls:** click to enter (pointer lock + fullscreen + audio unlock). WASD/arrows move,
Shift runs, mouse looks, **E** examines near glowing prompts, Esc releases.

---

## 3. Aesthetic direction (the rules content must obey)

Derived from realistic reference photos of gothic halls, then translated to PS1.

- **Palette — two families.** Dominant **cool desaturated stone** base (greys `#1b1e26`→`#5c606a`,
  limestone `#6b6656`/`#8a836d`, cold daylight `#9fb0c4`→`#cdd8e4`). Rare **warm motivated
  accents** only where a flame/warm surface justifies it (candle `#ffd9a0`/`#e8a24c`, brick/terracotta
  `#5a3326`/`#844d33`). **Rule: if a pixel is warm, the player must see why (a flame, sunlit stone).**
- **Value structure** — high contrast, 3 zones: near-black darks (vault pockets, aisles), mid
  stone (the bulk), blown-out highlights (windows, flame cores — small in area). Every shot
  should read as a legible black-and-white thumbnail.
- **Light motivation** — only 3 kinds of light, each with a VISIBLE source mesh: cold tracery
  windows (daylight shafts), warm candle chandeliers/sconces (flame points), the entrance
  doorway. No unmotivated pools.
- **Decay = specific, not uniform grunge.** Each prop implies people left in a hurry and never
  returned (abandoned meal, plague cross, fallen chandelier, collapsed vault, ossuary, lime-pit).
- **Scale legibility** — human references in every shot (doors 3.0×4.5 m, steps, benches, bowls, blocks).
- **PS1 spec** — internal res ~512×288 nearest-upscaled; vertex-snap jitter on all materials;
  textures ≤128 px nearest-filtered; `MeshLambertMaterial` for lit surfaces, `MeshBasicMaterial`
  for emissive; fog hides draw distance (and is the perf budget); no shadow maps.

Full detail lives in the repo's `art-direction.md`.

---

## 4. Architecture — the module system

**Hard rule: one owner per folder, no cross-writes.** Modules never import each other; all
data flows through a shared `world` object. "Core" is shared infrastructure owned by the
integrator. This separation is enforced by process (each module was built by a dedicated agent).

```
src/
  main.js            CORE — bootstrap, frame loop, module init order, HUD, ?inspect light
  core/
    scene.js         CORE — the `world` object + registration API (below)
    ps1.js           CORE — PS1 render primitives (ps1ify, crunch, makePS1Renderer)
    audio.js         CORE — procedural spatial-audio engine (buffers, emitters, one-shots)
    shots.js         CORE — 9 fixed verification cameras
  architecture/      geometry, layout, collision, walkable-floor tagging
  atmosphere/        lighting, fog, materials, light-SOURCE meshes, + audio PLACEMENT
  interaction/       controls, collision response, floor-follow, examine system
```

### The shared `world` object (core/scene.js)
```
world = {
  scene, camera, renderer, clock,      // THREE objects (set by main.js)
  dt, elapsed,                         // per-frame, written by the loop
  colliders: THREE.Box3[],             // architecture pushes; interaction reads (XZ slide)
  floors:    THREE.Mesh[],             // architecture pushes walkable surfaces; interaction raycasts for eye height
  interactables: Interactable[],       // interaction pushes & reads
  lights:    THREE.Light[],            // atmosphere pushes
  updaters:  ((dt,t)=>void)[],         // any module; called each frame
  spawn: { position: Vec3, yaw },      // architecture may override
  flags: {},                           // free-form shared triggers
  ps1:   { setInternalHeight(h) },     // core
  audio: <audio engine>,               // core (see §6)
}
```
Registration helpers: `registerCollider(box3)`, `registerFloor(mesh)`,
`registerInteractable({object, radius, label, onExamine?})`, `addLight(light)`, `onUpdate(fn)`.

**Init order (fixed):** architecture → atmosphere → interaction. Guarded so a throw in one
module can't blank the app.

### Conventions
- **1 unit = 1 metre**, right-handed, +Y up. Eye height 1.7 m. Spawn (0,1.7,15.5) facing −Z.
- Object names are module-prefixed: `arch_*`, `atmo_*`, `ix_*`, `audio_*`. Files kebab-case.
- Every material wrapped with `ps1ify()`; every texture with `crunch()`. Textures ≤128 px, canvas-generated.

---

## 5. World layout (coordinates — the map)

Cruciform hall; north/apse is −Z, entrance is +Z. Metres.

**Main floor (y = 0):**
- Nave floor x∈[−6,6], z∈[−15,15]. South/entrance wall z=+15 with a 3.0×4.5 m doorway (glowing sky beyond).
- North apse wall z=−20 with a 5 m tracery window (cold key light). Raised chancel z∈[−20,−15] (2 steps, +0.34 m).
- Two column rows at x=±3.5, z = 11,7,3,−1,−5,−9,−13. Low-poly pointed vault, crown ≈ 9 m, one collapsed bay.
- West/East walls x=±6 (clerestory windows y 6–8). Side chamber x∈[6,13], z∈[0,8] (window on x=+13; abandoned table ≈ (10.5,0,3.5)).
- Fallen chandelier + rubble ≈ (−0.5,0,−4), one candle still lit.

**The Undercroft (crypt, y ≈ −6):**
- Footprint x∈[−5,5], z∈[−14,−3]; low vault ceiling ≈ −3.2; 4 squat piers.
- Stair/ramp from chancel (top z≈−16, y=0.34) down to crypt (z≈−9, y=−6); invisible smooth ramp registered as floor so the eye glides.
- Iron grate + moonlight shaft ≈ (0,−3.25,−5). Sealed lime-pit centre (0,−6,−8) with timber lid + candle. Ossuary niches at x=±5, z=−6 and −11 (bone piles).

**9 fixed cameras** (shots.js): 1 nave-from-entrance, 2 aisle god-ray, 3 apse window, 4 side-chamber table,
5 entrance silhouette, 6 fallen debris, 7 stair descent, 8 crypt ossuary, 9 plague pit.

---

## 6. Systems

- **PS1 pipeline (core/ps1.js).** Renderer draws into a tiny ~512×288 buffer; CSS stretches it
  nearest-neighbour (the chunky look, and cheap). `ps1ify(material)` injects vertex-snap jitter
  via `onBeforeCompile`. `crunch(texture)` = nearest + sRGB. No post-processing render target (kept simple).
- **Audio engine (core/audio.js).** `THREE.AudioListener` on the camera. 7 synthesized mono
  buffers: `wind` (brown-noise loop), `drone` (integer-Hz sine bed, seamless loop), `footstepStone`,
  `footstepWet`, `drip`, `bell` (inharmonic partials), `crackle`. API: `unlock()` (resume on gesture,
  optimistic — starts sources immediately so a no-audio-device env can't stall), `onUnlock(fn)`,
  `emitter(buf,{pos,refDistance,maxDistance,rolloff,loop,volume})` → positional loop, `oneShot(buf,{pos,volume,rate})`,
  `footstep({wet,rate,volume})`, `setMaster(v)`. Atmosphere PLACES emitters; interaction fires footsteps.
- **Controls + floor-follow (interaction/index.js).** Pointer-lock mouselook + WASD. XZ collision =
  circle (r≈0.3) vs each Box3, resolved per-axis so you slide along walls. **Eye height is a downward
  raycast onto `world.floors`, damped** (enables stairs / multiple levels). Examine = nearest
  interactable within radius (XZ distance **and** a Y-band check so crypt props don't trigger from the
  nave above), shows `#examine` text + "[E]"; E latches an extended lore line.
- **Verification loop (the dev methodology).** After each module lands: launch dev server → Playwright
  navigates to `?shot=1..9` → screenshot to `captures/` → score each 1–5 on a rubric (value structure,
  light motivation, decay specificity, scale legibility, palette discipline; pass = ≥4 on all five) →
  log to `review-log.md`. Traversal/audio verified via `?free=1` + synthetic input + `window.__controls`.
  Perf via a forced-render micro-benchmark. Max 3 passes/module.

---

## 7. Key technical decisions (and why)

- **CSS-upscale instead of a render-target for the low-res look** — avoids colour-space bugs; simplest strong PS1 tell.
- **Procedural audio, no files** — license-free, era-appropriate lo-fi, tiny footprint; `unlock()` is
  optimistic so headless/no-device environments (and the autoplay gate) don't stall it.
- **Floor-follow via raycast + invisible smooth ramp under visible treads** — seamless descent, reusable
  for all future verticality; backward-compatible (flat floors read exactly as before).
- **Per-area fog swap** — an updater lerps `scene.fog` denser/colder when camera.y < −3 (crypt) vs nave.
- **Module-per-agent + Playwright rubric loop** — every visual change is scored against screenshots, not assumed.

---

## 8. Current file inventory (line counts)

```
core:        main.js 89 · scene.js 70 · ps1.js 64 · audio.js 173 · shots.js 45
architecture: index 36 · floor 61 · walls 120 · columns 41 · vault 95 · side-chamber 31 ·
              decay 159 · undercroft 364 · materials 180 · geom-utils 45
atmosphere:   index 172 · sources 198 · textures 89 · undercroft-atmo 118 · audio 86
interaction:  index 420
docs:         scene-contract.md · art-direction.md · review-log.md · README.md
```
~28 verification screenshots in `captures/`, 5 source reference images in `refs/`.

---

## 9. Known issues / polish backlog (non-blocking)

1. **Crypt descent "steps down" ~6 m at the stairwell edge** (z=−9) rather than a gradual walk-down
   from the chancel head — the ramp's low end faces the nave approach. Damped (not a teleport) and
   visible treads sell it, but reorienting the flight or slowing the descent would be cleaner.
2. Spawn clamps to z=15 (½ m inside the door) instead of 15.5 (containment rect edge).
3. Shot-3 (apse window) has little decay in frame **by design** (it's a light study); a small chancel prop would lift it.
4. Shot-2 god-ray: the clerestory light source sits just above frame (apse window covers motivation in-frame).
5. Crypt near-floor can read very dark at some angles (mood-appropriate; a bit more cold fill would raise legibility).
6. Era polish not yet done: affine texture-warp + ordered dithering pass.
7. Audio verified as a graph only (headless has no audio device) — needs a human ear-check for actual sound quality/mix.

---

## 10. Roadmap & open questions to workshop next

The user wants to keep growing this as an **atmospheric walking sim** (no threat). Directions
previously chosen: **more world/space** and **atmosphere/audio**, delivered as small verified
vertical slices. Candidate next slices (not yet built):

- **More space (vertical):** an upper gallery + **bell tower** (the bell you can already hear);
  a **courtyard / exterior** approach; more wings (kitchens, dormitory, chapter house).
- **Narrative shape:** right now story is ambient (examinables). Could add a **through-line** — a
  sequence to uncover, a destination, an ending — while staying threat-free.
- **Systems:** a **journal** that collects examined lore; readable **notes/letters**; keys/sealed doors
  (metroidvania-lite gating without combat); a **day/night or candle-lighting** mechanic.
- **Presentation polish:** affine warp + dithering; a title/intro; subtle head-bob; save/checkpoint;
  an options screen (volume, sensitivity, internal-resolution slider).

**Open design questions to resolve with the next AI:**
1. What's the *goal loop* for a walking sim here — pure wander, or a soft objective/ending?
2. Should the world stay one contiguous building (seamless), or use area transitions for bigger scope?
3. How much narrative authoring do we want (env-only vs notes/journal vs a scripted arc)?
4. Priority: breadth (more rooms) vs depth (systems/polish) for the next slice?
5. Any target platform constraints beyond "60fps on integrated graphics" (mobile? published web build?)?

**How to add a new slice (the established pattern):**
1. Core: extend the `world` API / add a shared primitive / add `?shot` cameras if needed.
2. Architecture agent → geometry + colliders + `registerFloor`, to fixed coordinates.
3. Atmosphere agent → lighting (visible sources) + fog + audio placement.
4. Interaction agent → any new traversal/examine/systems.
5. Integrator runs the Playwright rubric loop (regression + new shots), logs scores, iterates ≤3×.

---

*End of export. The authoritative specs in-repo are `scene-contract.md` (module contract) and
`art-direction.md` (visual rules); `review-log.md` has the full scored verification history.*
