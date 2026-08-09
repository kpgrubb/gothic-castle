# scene-contract.md

**Read this before writing any code.** It is the single source of truth for module
boundaries, the shared scene-graph API, naming, unit scale, the castle layout, and the
six verification cameras. If you need something that isn't here, or a change that
touches another module's files or the shared layout — **stop and route it through the
integrator (core owner)**. Do not edit files outside your module.

---

## 1. Project shape

```
gothic-castle/
  index.html            core   — DOM shell, HUD, prompt overlay
  vite.config.js        core
  src/
    main.js             core   — bootstrap + frame loop + module init order
    core/
      scene.js          core   — world object + registration API   (§3)
      ps1.js            core   — PS1 render primitives              (§5)
      shots.js          core   — 6 fixed cameras                    (§6)
    architecture/       ARCHITECTURE AGENT owns everything here     (§7a)
    atmosphere/         ATMOSPHERE AGENT owns everything here       (§7b)
    interaction/        INTERACTION AGENT owns everything here      (§7c)
  refs/                 reference images (read-only)
  captures/             verification PNGs (written by the loop)
  art-direction.md      palette / value / light / decay / scale spec
  review-log.md         verification scores per pass
```

Each module has an `index.js` exporting exactly one init function (§7). `main.js`
imports only those. Modules may add as many other files inside their own folder as they
like. **No module imports another module's files** — all cross-module data flows through
`world` (§3).

---

## 2. Unit scale & coordinate system

- **1 world unit = 1 metre.** Right-handed. **+Y up.**
- Player eye height **1.7 m** (`EYE_HEIGHT` in `scene.js`).
- Spawn: `(0, 1.7, 15.5)` **facing −Z** (into the castle). The castle extends toward −Z.
- Human reference sizes (use these so scale reads correctly — rubric criterion):
  doorway opening 3.0 w × 4.5 h · human 1.7 · step rise 0.17, tread 0.30 · table top 0.75 ·
  bench seat 0.45 · column clear height to springing ≈ 5.0 · vault crown ≈ 9.0 ·
  wall thickness 0.6.

---

## 3. Shared scene-graph API  (`src/core/scene.js`)

```js
import { world, UNIT, EYE_HEIGHT,
         registerCollider, registerInteractable, addLight, onUpdate } from '../core/scene.js';
```

`world` fields:

| field | type | who writes | who reads |
|---|---|---|---|
| `scene/camera/renderer/clock` | THREE objects | core | all |
| `dt`, `elapsed` | number | core (loop) | all |
| `colliders` | `THREE.Box3[]` | architecture (via `registerCollider`) | interaction |
| `interactables` | `Interactable[]` | interaction | interaction |
| `lights` | `THREE.Light[]` | atmosphere (via `addLight`) | atmosphere |
| `updaters` | `((dt,t)=>void)[]` | any (via `onUpdate`) | core loop |
| `spawn` | `{position:Vec3, yaw:number}` | architecture *may* override before interaction init | interaction |
| `flags` | plain object | any | any (triggers) |
| `ps1` | `{ setInternalHeight(h) }` | core | atmosphere (may retune) |

Registration functions:

- `registerCollider(box3)` — push a world-space AABB. Interaction slides the player against these.
- `registerInteractable({ object, radius, label, onExamine? })` — proximity examine target.
- `addLight(light)` — adds to scene **and** tracks in `world.lights`. Atmosphere only.
- `onUpdate(fn)` — per-frame callback `fn(dt, elapsed)`.

**Init order (fixed):** `architecture → atmosphere → interaction`. So:
architecture may set `world.spawn`; interaction reads final `world.colliders`. Everything
is guarded — a throw in one module won't blank the app, but it will show in console.

---

## 4. Castle layout  (BUILD TO THESE COORDINATES — the shots depend on them)

Cruciform great hall. Top-down (metres); north/apse is −Z, entrance is +Z.

```
                 x=-6            x=0            x=+6      x=+13
   z=-20  ┌───────┼══ APSE WINDOW ══┼───────┐              N (−Z)
          │        (raised chancel, 2 steps)  │             ▲
   z=-15  ├─ chancel step ──────────────────  ┤             │
          │  ·col   ·col        ·col   ·col   │
          │   (column rows at x=±3.5)         │
   z=-5   │  ·col   ·col        ·col   ·col   │
          │        NAVE  (clear 12 w)          │
   z=0    │                                   ├──────────┐
          │  ·col   ·col        ·col   ·col   │  SIDE     │  ← opening in east
   z=+3   │                                   │  CHAMBER  │    wall @ z≈3
          │                                   │  (table)  │
   z=+8   │                                   ├──────────┘  window on x=+13
   z=+13  │                                   │
   z=+15  └────────── DOORWAY (glows) ─────────┘   S (+Z, spawn just inside)
```

Fixed elements (architecture builds; other modules reference):

| element | placement (m) | notes |
|---|---|---|
| Nave floor | x ∈ [−6,6], z ∈ [−15, 15] | flagstone; slight tile variation |
| South/entrance wall | z = +15 | arched **doorway** 3.0 w × 4.5 h at x=0; bright exterior beyond (glows) |
| North/apse wall | z = −20 | big **tracery window** 5 w, sill 2.0 → head 7.0; cool daylight behind |
| Chancel | z ∈ [−20,−15] | raised 0.34 m (2 steps) at z=−15 |
| West wall | x = −6 | solid + blind arcade; **clerestory windows** y ∈ [6,8] cast shafts |
| East wall | x = +6 | as west, but **opening** z ∈ [0,7] into side chamber |
| Column rows | x = ±3.5, z = 11,7,3,−1,−5,−9,−13 | piers r≈0.45, clear to 5.0, then vault springing |
| Vault | crown y ≈ 9 | low-poly pointed/groin approximation over nave |
| Side chamber | x ∈ [6,13], z ∈ [0,8] | window on x=+13; **abandoned table** ~ (10.5, 0, 3.5) |
| Fallen chandelier + rubble | centred ≈ (−0.5, 0, −4) | decay prop; interaction may make examinable |

Spawn `(0,1.7,15.5)` sits just inside the doorway. Keep a clear walkable path down the
nave and into the side chamber (no collider blocking the spawn or the chamber opening).

---

## 5. PS1 render primitives  (`src/core/ps1.js`)

Use these; don't roll your own render tricks.

- `ps1ify(material, {jitter=160})` — patches a material to snap vertices to a coarse grid
  (the PS1 "wobble"). Apply to **every** material you create. Lower `jitter` = wobblier.
- `crunch(texture)` — nearest filtering + sRGB; call on every texture.
- Internal resolution is a tiny drawing buffer stretched by CSS (owned by core). Don't add
  a post-processing render target without routing through core — it changes the pipeline
  for everyone. Atmosphere colour/fog work is done via `scene.fog`, light values, and
  material params, **not** a custom composite pass (v1).

**Materials:** default to `MeshLambertMaterial` (cheap per-vertex-ish shading = correct PS1
Gouraud feel) once atmosphere's lights exist. Use `MeshBasicMaterial` only for
self-lit/emissive things (flames, glowing windows, sky). Keep textures ≤ 128 px.

---

## 6. The six verification cameras  (`src/core/shots.js`)

Navigating to `?shot=N` freezes the camera at preset N and disables controls.
**These coordinates are frozen — build the layout so each frames real content.**

| N | name | pos (m) | looks at | must show |
|---|---|---|---|---|
| 1 | nave_from_entrance | (0, 1.7, 14.5) | (0, 3.2, −18) | full nave depth, columns, apse window glow at end |
| 2 | aisle_midnave | (−3.4, 1.6, 3) | (−5.6, 2.4, −8) | west aisle, clerestory light shaft, column rhythm |
| 3 | apse_window | (0, 1.7, −8) | (0, 5.5, −19.5) | the big tracery window as a visible light source |
| 4 | side_chamber_table | (8.5, 1.6, 3.5) | (11.5, 1.1, 1.5) | abandoned table + objects, candle warmth, side window |
| 5 | entrance_from_apse | (0, 1.7, −7) | (0, 2.6, 18) | daylit doorway silhouette down the nave |
| 6 | fallen_debris | (2.2, 1.15, −1) | (−1.5, 0.4, −4) | fallen chandelier / rubble, low angle, human-scale cues |

---

## 7. Module contracts

### 7a. `architecture/` — geometry, layout, collision
- Export `initArchitecture(world)`. Build the §4 layout to scale.
- Push a `THREE.Box3` to `world.colliders` for every wall, column, step edge, and large prop.
- Name the root group `arch_root`; name meshes `arch_*`.
- Materials via `ps1ify`; textures via `crunch`. Use `MeshLambertMaterial` (atmosphere lights it).
- May set `world.spawn` if the doorway moves. Leave the nave + chamber walkable.
- **Does NOT** add lights, fog, or controls.

### 7b. `atmosphere/` — lighting, fog, materials, post/colour
- Export `initAtmosphere(world)`. Set `scene.fog`, `scene.background`, add lights via `addLight`.
- **Every pool of light must have a visible source mesh** (candle flame, window plane, sky).
  Coordinate placement with the §4 window/chandelier positions. Provide the emissive
  source meshes for lights you own (flames, glowing glass) — these are atmosphere's, named `atmo_*`.
- Tune to `art-direction.md`: cool desaturated base, warm motivated accents, high value contrast.
- **Does NOT** move/rebuild geometry or add controls. If you need a light anchor that isn't
  there, request the coordinate — don't edit architecture.

### 7c. `interaction/` — controls, triggers, examinables
- Export `initInteraction(world)` returning `{ enabled:boolean, update(dt) }`.
- Pointer-lock mouselook + WASD. Collide against `world.colliders` (capsule/AABB slide,
  radius ≈ 0.3, eye height 1.7, no fly). Reset on falling out of bounds.
- Examine system: read `world.interactables`, show `#examine` DOM text within `radius`,
  fire `onExamine` on **E**. Register the plague-story props (see art-direction decay list).
- Click `#app` → lock; **Esc** → release + show `#prompt`. Name objects `ix_*`.
- **Does NOT** build geometry or lights.

---

## 8. Naming conventions

- Module prefix on every named Object3D: `arch_`, `atmo_`, `ix_`.
- Files: kebab-case (`side-chamber.js`). Exports: camelCase. Constants: UPPER_SNAKE.
- World-space metres everywhere. No magic pixel numbers in scene code.

---

## 9. Verification protocol (run by the integrator after each module lands)

1. `npm run dev` (port 5188, already fixed).
2. For N in 1..6: navigate `http://127.0.0.1:5188/?shot=N`, wait for `window.__ready`,
   screenshot → `captures/pass<K>-shot<N>.png`.
3. Read each PNG, score 1–5 on the five rubric criteria, append to `review-log.md`.
4. **Pass = ≥4 on all five.** Max 3 passes per module; if still failing, stop and show captures + diagnosis.

Rubric: **Value structure** (readable silhouettes, no muddy mid-tones) · **Light
motivation** (every light pool has a visible source) · **Decay specificity** (rubble,
water damage, abandoned objects that imply a story — not uniform grunge) · **Scale
legibility** (doors/stairs/railings read human-sized) · **Palette discipline** (matches
art-direction.md).
