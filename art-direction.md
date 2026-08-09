# art-direction.md

Derived from the five reference images in `./refs/` (Malbork ribbed-vault hall; a dark
brick candlelit hall; a grey turreted exterior; a small candlelit stone chamber; a
god-ray CG gothic hall). The refs are **realistic**; the target render is **PS1-era
low-fidelity**. This doc translates the realistic references into a disciplined PS1
palette, value, light, decay, and scale spec. Modules must match it — "Palette
discipline" and the other rubric criteria are scored against this file.

---

## 0. One-line brief

A plague-abandoned gothic great hall, seen through a 1998 game console: **cold stone
emptiness cut by a few motivated pools of warm candlelight and cold window daylight**,
rendered chunky — low-res, vertex-wobbly, nearest-filtered.

---

## 1. Palette (two families — cool base, warm accent)

Sample from the refs. Base is **cool desaturated stone**; the only saturated colour in
the scene is **motivated light** (flame-warm) and a few decay accents. Keep total palette
small — PS1 hardware pushed few colours and dithered between them.

**Cool base (dominant — walls, floor, vaults in shadow):**
- Stone shadow `#1b1e26`  · stone mid `#3a3f47` · stone light `#5c606a`
- Limestone warm-grey (lit walls, ref 4) `#6b6656` · `#8a836d`
- Slate blue-grey (ref 3 roofs / cold cast) `#2b3340` · `#3d4a5c`
- Cold daylight (window shafts, refs 2/5) `#9fb0c4` → highlight `#cdd8e4` (near-white, blown)

**Warm accent (rare — only where a flame or warm surface justifies it):**
- Candle flame core `#ffd9a0` · glow `#e8a24c` · falloff `#7a4a22`
- Brick / terracotta vault (refs 1/2) `#5a3326` · `#844d33` · tile `#6e3b2a`
- Aged plaster / faded fresco (ref 1) `#b9a887` · `#8f7f60`
- Painted vault-rib stripe accents (ref 1), used *sparingly*: dull ochre `#9c7b3a`, oxblood `#6e2f2a`, muted verdigris `#4c5f4a`

**Decay accents (tiny doses):** moss/verdigris `#3f4a3a`, water-stain `#2c2a24`,
rust `#5a3620`, bone/wax pale `#cbb89a`.

**Rule:** if a pixel is warm, the player must be able to see *why* (a flame, or sunlit
brick). Everywhere else trends cool and desaturated. No free-floating orange.

---

## 2. Value structure (this carries the whole look)

The refs are high-contrast: near-black vault pockets, mid stone, and **blown-out
windows**. Reproduce that three-zone structure so silhouettes stay readable (rubric:
Value structure).

- **Darks (0–20%)** — vault crowns, aisle depths, under-bench, behind columns. Let these
  go nearly black; fog helps. Columns read as near-black silhouettes against window light.
- **Mids (30–55%)** — the bulk of lit stone walls and floor. Keep them *separated* from
  darks; avoid a muddy 25–40% soup (the failure mode the rubric calls out).
- **Highlights (85–100%)** — only window daylight and flame cores. Small in area, high in
  value. These are the eye's anchors (see refs 2 and 5: the window is the brightest thing).

Target: any shot should be legible as a black-and-white thumbnail — columns and arches as
clean dark shapes, windows as bright shapes, floor as a mid plane.

---

## 3. Light sources (every pool is motivated — rubric: Light motivation)

Only three kinds of light exist. Each has a **visible source mesh**:

1. **Tracery windows (cold key).** Apse window (z=−20) and clerestory windows (y 6–8 on
   side walls) and the side-chamber window (x=+13). Behind each: a bright emissive plane /
   cool sky so the glass glows and throws a cold shaft to the floor (god-ray feel of refs
   2 & 5). Colour `#9fb0c4`→`#cdd8e4`.
2. **Candle chandeliers & wall sconces (warm fill).** Wrought-iron rings with candle
   points (refs 2 & 4). Each candle = a small emissive flame mesh + a low-range warm
   point light. Guttered/half-burnt (decay). Warm `#e8a24c`.
3. **The doorway (cold, from behind camera at spawn).** Daylight spills through the
   entrance arch (z=+15) — a bright plane beyond it; makes the silhouette shot (5) work.

No light without a source in frame or clearly just out of frame. Ambient stays very low
and cool (a fill so darks aren't pure void), value ~ `#242a34`, low intensity.

---

## 4. Decay & abandonment (specific, story-bearing — rubric: Decay specificity)

Not uniform grunge. Each piece implies people **left in a hurry, then never came back**.
Distribute, don't smear. Concrete props (interaction registers the examinable ones):

- **The abandoned meal** — side-chamber table (ref 4): tipped stool, a wooden bowl, a
  guttered candle stub, a dark stain. Examinable: "Two places set. One chair knocked back."
- **Plague cross** — a chalk/red cross daubed on the side-chamber door or a nave pillar.
  Examinable: the classic sealed-house mark.
- **Fallen chandelier** — crashed on the nave floor (≈ (−0.5,0,−4)), chain snapped, wax
  pooled and hardened, some candles snuffed, one *impossibly* still lit (a warm point).
- **Scattered pews/benches** — a few knocked over along the aisles (refs 2 & 4 have neat
  rows; break the order).
- **Water damage & rubble** — a collapsed vault section letting a cold shaft in; rubble
  pile with dressed-stone blocks (scale cue); dark water stains bleeding down one wall.
- **Faded frescoes** (ref 1) — large wall areas of peeling painted plaster, colours nearly
  gone. A saint's face half-scrubbed by damp.
- **Nature intrusion** — ivy/creeper through the collapsed section or a broken window
  (ref 3 exterior ivy), a bird's nest on a capital.
- **Dust & wax** — dust motes in the window shafts; hardened wax runs down sconces.

Avoid: evenly-tiled "dirt" textures, blanket cobwebs everywhere, symmetric damage.
Decay should be **local and legible**, each cluster a small scene.

---

## 5. Scale legibility (rubric: Scale legibility)

Give the eye human references in every shot:
- **Doorway** 3.0 × 4.5 m arch (≈ 2.6× a person). **Steps** at the chancel, 0.17 rise —
  reads as climbable. **Benches/table** at sitting/standing height (0.45 / 0.75).
- **Columns** ~0.9 m diameter, ~5 m to springing — massive but with a human-height base
  moulding. **A dropped stool / bowl** on the floor = instant human scale.
- Keep at least one 0.3–0.8 m familiar object (bowl, candle, stool, fallen block) in the
  foreground of shots 1, 4, and 6.

---

## 6. PS1 rendering spec (how the above gets crunched)

Provided by `core/ps1.js`; every module conforms:

- **Internal resolution** ~512×288, nearest-upscaled to the window (chunky pixels). Core-owned.
- **Vertex jitter** via `ps1ify()` on all materials — geometry wobbles as the camera moves.
- **Textures** ≤ 128 px, `crunch()`'d (nearest, no aniso). Hand-authored/canvas-generated,
  low colour count, visible dither where it helps (stone speckle, wax, moss).
- **Shading** per-vertex feel: `MeshLambertMaterial` lit by atmosphere. `MeshBasicMaterial`
  for emissive (flames, glowing glass, sky).
- **Fog** hides the draw distance (and is the performance budget). Cool fog colour matching
  the cold base (`#0a0b10`–`#141824`), tuned so the apse window still reads from the entrance.
- **No smooth shadows.** Fake contact with baked-dark vertex colours / darkened floor decals
  under big objects. No shadow maps (perf + era-correct).
- **Affine warp / dithering** are polish-tier; low-res + jitter already sell it. Don't block
  a passing build on them.

Performance target: **60 fps on integrated graphics.** Keep draw calls modest (merge static
geometry per material), textures tiny, lights few (≤ ~8 cheap point lights + ambient), and
lean on fog culling. If a shot dips below 60, cut light count or vault polys before anything else.

---

## 7. Per-shot intent (what "good" looks like)

- **1 nave_from_entrance** — long cold nave, columns as dark verticals, the apse window a
  bright beacon at the end, one warm sconce midway. Foreground: a fallen block.
- **2 aisle_midnave** — a single cold clerestory shaft cutting across the west aisle,
  columns rhythmic, deep shadow between them. Value study.
- **3 apse_window** — the tracery window dominant and bright, cold shaft on the chancel
  steps, everything else falling to dark. Pure light-motivation shot.
- **4 side_chamber_table** — warm: candle chandelier over the abandoned table, cold side
  window behind, the tipped stool and bowl telling the story.
- **5 entrance_from_apse** — the doorway a bright silhouette-maker; columns and a fallen
  chandelier as black shapes against it.
- **6 fallen_debris** — low, intimate: snapped chandelier and rubble, one candle still lit,
  wax pooled, dressed-stone blocks for scale.
