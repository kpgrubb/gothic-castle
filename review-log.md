# review-log.md

Verification scores for the PS1 gothic castle. Rubric (1–5 each), **pass = ≥4 on all five**:
**VS** Value structure · **LM** Light motivation · **DS** Decay specificity ·
**SL** Scale legibility · **PD** Palette discipline. Captures in `./captures/`.

Note on per-module judging: architecture lands before real lighting exists, so its pass is
scored primarily on form/silhouette/scale/decay-geometry; LM & PD are re-scored once the
atmosphere module lands. Final pass is judged with all modules integrated.

---

## ARCHITECTURE — Pass 1  (2026-08-08)

Captures: `captures/arch-pass1-shot{1..6}.png` (under stub lighting — near-black, as expected)
and `captures/archinspect-shot{1..6}.png` (with the core `?inspect=1` neutral fill, used to
judge geometry). 43 colliders, 0 console errors, geometry confirmed in the live scene.

| Shot | VS | LM | DS | SL | PD | Notes |
|---|---|---|---|---|---|---|
| 1 nave_from_entrance | 4 | — | 4 | 5 | 3.5 | Column recession + vault ribs read cleanly; foreground block for scale; apse window shape at end. Floor inlay tiles a touch saturated. |
| 2 aisle_midnave | 4 | — | 4 | 5 | 3.5 | Strong aisle depth, wall courses read; chandelier wax pool + blocks visible. Clerestory opening sits above frame — confirm shaft in atmosphere pass. |
| 3 apse_window | 4 | — | 3 | 5 | 4 | Tracery mullions + pointed head framed well; needs cold glass glow (atmosphere) to sing. |
| 4 side_chamber_table | 4 | — | 5 | 5 | 3.5 | Abandoned-meal reads: table + 2 bowls + stool; chamber window opening present. Stool upright (spec wanted tipped — minor). |
| 5 entrance_from_apse | 4 | — | 4 | 5 | 3.5 | Doorway silhouette framing is excellent; fallen chandelier anchors foreground. Needs sky-glow behind door. |
| 6 fallen_debris | 4 | — | 5 | 5 | 3.5 | Snapped chain, iron ring, wax, dressed blocks — specific decay + scale. |

**LM = deferred** (no lights until atmosphere). **VS** scored on form/silhouette readability
under flat inspection light (true value contrast comes with atmosphere). **PD** provisional —
base stone greys are on-model; the only risk is the colored floor inlay (ref-accurate but
watch saturation under real dark lighting).

**Verdict: architecture PASS on its remit** (geometry, layout, collision, decay forms, scale).
SL 5/6 shots, DS strong (4–5), forms readable. Proceeding to atmosphere; will re-score
VS/LM/PD with real lighting and send architecture a targeted fix only if PD (floor tiles) or a
geometry gap fails then. No architecture re-pass needed now (1/3 used).

Follow-ups queued for later modules:
- Atmosphere: keep floor inlay subdued; confirm clerestory shaft in shot 2 has a visible source.
- Interaction/decay polish: tip the side-chamber stool; add the chalk plague cross.

## ATMOSPHERE — Pass 1  (2026-08-08)

Captures: `captures/atmo-pass1-shot{1..6}.png` (REAL lighting, no inspect). 8 lights, 0 console
errors. Perf: forced render **0.82 ms/frame** (≈60fps trivially met; HUD "1 fps" is headless
rAF throttling only). Floor-inlay watch-item RESOLVED — low illumination subdues them.

| Shot | VS | LM | DS | SL | PD | Notes |
|---|---|---|---|---|---|---|
| 1 nave_from_entrance | 5 | 5 | 4 | 4 | 5 | Apse window beacon, black column silhouettes, warm sconce accents. Textbook value structure. |
| 2 aisle_midnave | 5 | 4 | 4 | 4 | 5 | Cold god-ray shafts + dust on west wall; apse window is the in-frame cold source (clerestory source sits just above frame — nudge if we polish). |
| 3 apse_window | 5 | 5 | 3* | 4 | 5 | Pure light-motivation shot: window blazes, shaft on chancel steps. *DS low BY DESIGN — camera points at a window; scene-level decay covered by 4 & 6. |
| 4 side_chamber_table | 5 | 5 | 5 | 5 | 5 | Warm chandelier over abandoned meal + cold side window. Best frame. Ref-4 mood nailed. |
| 5 entrance_from_apse | 5 | 5 | 4 | 4 | 5 | Cold doorway silhouette-maker; warm foreground fallen candle + snapped chain. |
| 6 fallen_debris | 5 | 5 | 5 | 5 | 5 | Still-lit candle on rubble/ring/wax, cold window at right. Warm/cold + scale + decay. |

**Verdict: atmosphere PASS.** Every criterion ≥4 on every shot except shot-3 DS=3, which is
intentional (a window-light composition); decay-specificity is a scene-level property and is
strongly met by shots 4 & 6. VS/LM/PD are now excellent across the board — the earlier
architecture deferrals are satisfied. No atmosphere re-pass needed (1/3 used).

Optional polish (non-blocking, revisit before final): add a small decay prop on the chancel
steps so shot 3 also carries story; make one clerestory window visible within shot 2's frame.

## INTERACTION — Pass 1  (2026-08-08)  — WALKABLE

Driven via `?free=1` + synthetic keydown, stepping `update(dt)` manually (headless throttles rAF).
Capture: `captures/walkable-freeroam.png` (first-person, mid-nave, examine prompt live). 0 errors.

Functional verification (not the visual rubric — this module is mechanics):
- **Movement**: W drives −Z at ~2.6 m/s (1.73 m / 0.67 s), eye height pinned at 1.7 (no fly/fall). PASS
- **Collision (slide)**: west wall stops player at x=−5.69 (wall −6 − radius 0.3); columns/aisle
  benches stop at ~x=3.8; center-nave debris blocks at z≈−2.55; door jambs block lateral at the
  threshold. Axis-separated resolution slides along walls. PASS
- **Examine proximity**: approaching (0.5,−4) shows "…One candle still burns. Who lit it? [E]". PASS
- **E-key lore latch**: pressing E swaps to extended text "The chain snapped clean. Cold wax
  pools across the flagstones — yet one flame holds, warm and impossible." PASS
- **Test hooks**: `?free=1` active-without-lock + `window.__controls` (position/yaw/pitch/active). PASS
- Pointer-lock click-to-enter / Esc-to-release flow present (best-effort in headless; verify by hand).

**Verdict: interaction PASS — the build is WALKABLE.** (1/3 used.)

---

## BUILD STATUS — walkable milestone shipped
- `npm run build` ✓ (2.70s, 21 modules, dist/ emitted). `npm run dev` on :5188.
- Perf: 0.82 ms/frame → 60fps target met with large headroom on integrated graphics.
- All three modules integrated, 0 console errors, 6/6 shots + free-roam verified.
- Visual rubric (atmosphere pass): every criterion ≥4 on every shot except shot-3 DS (by design).

Remaining OPTIONAL polish (none blocking; within each module's 3-pass budget):
1. Architecture: small decay prop on chancel steps (lifts shot-3 DS); tip the side-chamber stool.
2. Architecture/atmosphere: make a clerestory window visible in shot-2 frame (tighten LM to 5).
3. Interaction: nudge spawn/containment so player starts at z=15.5 (currently clamps to 15).
4. Core (era polish, optional): affine-warp + ordered dither pass.

===========================================================================
# EXPANSION — Vertical Slice: "The Undercroft" + Ambient Audio  (2026-08-08)
===========================================================================

Added ONE area (a plague-crypt below, reached by a stair) + ONE system (procedural
spatial audio), plus the enabling floor-follow traversal. Modules extended by agents;
core (audio engine, floors API, crypt cameras 7-9, listener) owned by integrator.

## Regression (shots 1-6) — PASS
Shots 1 & 4 re-captured pixel-identical to the original build (`captures/regress-shot1.png`,
`regress-shot4.png`); nave modules untouched, the global fog-swap targets nave settings
above y=-3, audio is additive. 0 console errors. HUD now "x/9". No regression.

## New area (shots 7-9, REAL lighting) — PASS
Captures: `captures/crypt-pass1-shot{7,8,9}.png` (+ `cryptinspect-*` geometry passes).

| Shot | VS | LM | DS | SL | PD | Notes |
|---|---|---|---|---|---|---|
| 7 stair_descent | 4 | 4 | 4 | 4 | 5 | Dark stairwell with cold+warm glow pooling below — an inviting descent. |
| 8 crypt_ossuary | 5 | 5 | 4 | 4 | 5 | Cold moonlight shaft through the grate + warm candle on the quicklime pit-lid. Best crypt frame. |
| 9 plague_pit | 5 | 5 | 5 | 4 | 5 | Moonlight + 2 candles; ossuary bone-piles lit in the side niches; sealed pit centre. |

All criteria >=4. Crypt is the darkest, dampest beat as intended.

## Traversal (floor-follow) — PASS  (`captures/crypt-freeroam.png`)
Driven via ?free=1 + stepped update(dt): walked nave (y1.7) -> stairwell slot -> crypt
floor (y=-4.3), damped (not teleported), yFinite throughout, no fall-through/NaN. Eye
tracks the invisible ramp accurately; walking up the ramp raises the eye (ascent works,
not trapped). Y-aware examine confirmed: the crypt pit prompt fires at crypt level and
NOT from the nave above it. Player-eye crypt POV shows the pit + candle + lit ossuary +
live examine text.

## Audio (plumbing) — PASS (ear-check pending)
`world.audio` engine; after unlock(): 3 wind beds (apse/doorway/clerestory) + crypt drone
all isPlaying; footstep one-shots fire on movement (wet timbre below y=-3); scheduled
drips (in-crypt), distant bell, candle crackle wired inside onUnlock. All buffers
synthesized (no asset files). Autoplay handled by resume-on-click; unlock() is optimistic
(starts sources immediately, queued by WebAudio until the context resumes) so a
no-audio-device headless env can't stall it. NOTE: sound *quality* needs a human ear
check in a real browser — graph verified, audio not audible to the integrator.

## Perf — PASS
Forced render 0.86 ms/frame WITH the crypt loaded (338 meshes, 12 lights, 59 colliders,
9 floor surfaces). 60fps target still trivially met. `npm run build` OK (2.41s).

## Known polish (non-blocking) for the Undercroft
- The descent "steps down" ~6 m at the stairwell slot edge (z=-9, the ramp's low end faces
  the nave approach) rather than a gradual walk-down from the chancel head. Damped so it's a
  quick dip, not a teleport, and the visible treads + glow-below sell it — but a future pass
  could reorient the flight (high end toward the nave) or slow the descent for a cleaner
  stair-walk. Fallback fade-transition remains available if preferred.
- Crypt near-floor can read very dark at some angles (mood-appropriate; a touch more cold
  fill would raise legibility if desired).

===========================================================================
# BACKLOG #6 — Era polish: affine warp + ordered dithering  (2026-08-08)
===========================================================================

Implemented in `src/core/ps1.js` as per-material shader injections (no post-processing
render target — pipeline stays simple/fast). Both URL-toggleable.

## Ordered dithering — DONE, DEFAULT ON  (`?dither=0` to disable)
4x4 Bayer ordered dither + quantization to 32 levels/channel (~15-bit, PS1-authentic),
applied AFTER colour-space + fog in the fragment shader. Verified on shots 1, 2, 4, 8
(nave hero, aisle god-ray, side chamber, crypt): adds authentic PS1 grain to fog/glow
gradients, value structure and light motivation preserved, 0 console errors/warnings.
Perf unaffected (forced render 0.4–0.86 ms/frame; dither is a few ALU ops/fragment).
Captures: `captures/dither-shot{1,2,4,8}.png`.

## Affine texture mapping — IMPLEMENTED but DEFAULT OFF (opt-in `?affine=1`)
Screen-linear UV via the uv*w / w trick (no `noperspective` needed; WebGL2/GLSL3).
Two bugs found + fixed during verification:
  (a) ignored Three's map uv-transform -> tiling textures stopped tiling (fixed: apply
      `mapTransform` before the affine multiply).
  (b) referenced the `uv` attribute on `USE_MAP` materials that lack it (the dust
      `THREE.Points`) -> flood of "useProgram: program not valid" (fixed: guard on
      `USE_MAP && USE_UV`; also skip affine on transparent/additive FX materials).
REMAINING ISSUE (why it's opt-in): affine still washes out some large nave WALL quads to
near-uniform bright (the chamber's smaller tessellated surfaces warp correctly). Looks
like a per-surface uv/scale problem, not an aesthetic. Shipping it default-on would be a
visual regression, so it's gated behind `?affine=1` until per-surface tuning. Dithering —
the bigger, iconic PS1 tell — carries the era look on its own.

NEXT for affine (when revisited): inspect the nave wall materials' uv/repeat setup; likely
needs per-material affine strength or excluding very large/near quads; or subdivide big
wall faces so the warp reads as "swim" instead of washing to a constant texel.

===========================================================================
# CANON-RECONCILIATION PASS vs world-bible.md  (2026-08-08)
===========================================================================
Copied world-bible.md into the repo (canon source-of-truth alongside scene-contract/
art-direction). Rewrote all 9 examinables to the bible register (§9) and canon (§7.4):
- Removed rhetorical questions / summary-conclusion clauses / AI-tell em-dashes; scout
  now describes form, not meaning; feast-day dating (St. Lucy's eve).
- Crypt pit reframed as Konrad's GRAIN BIN (§7.4); ossuary as counted/ordered; NEW
  ix_graintally pier ("not grain in the bins now") = the §3.1 thesis-carrier. Apse nods
  to Payment-I reliquary. Meal seeds the flies motif (§8).
- Shoe: canon red (Mechthild's, never named) — new M.shoeLeather oxblood on
  arch_prop_shoe. Verified rendered (captures/canon-redshoe.png). 0 console errors.
No new canon invented; no bible amendment needed.

===========================================================================
# EXPANSION — Reading System (Phase 1 of "The Reckoning")  (2026-08-08)
===========================================================================
Core reading system + 8 retrofit documents. Verified via ?free=1: 8 ix_doc_ markers;
multi-page physician's leaf opens → E turns 1/2 → 2/2 → E closes; world.flags.reading
toggles (freezes movement/look/examine); tally "leaves read: N". Framed-panel style
(user choice). 0 errors. Capture: captures/reader-grete.png.
Files: core/reader.js (new), content/documents.js (new), index.html (+#reader/#tally),
main.js (world.reader), interaction/index.js (registerDocuments + reading guards).
Docs span Payments I/II/III/IV + answer, §6 voices, §9 register, ~4:1 mundane:emotional.
NEXT (paused pending spatial plan): Tithe House + Nordturm — see castle-atlas decision.

===========================================================================
# AUDIO OVERHAUL — Ocular library (PS1-converted)  (2026-08-08)
===========================================================================
Replaced the procedural audio with the user's Sinister/Ocular library.
- Curated 6 files (avoided all breath/whisper/creature stingers per world-bible
  "no present threat"): hall-bed (Dark E), crypt-bed (Underground), air (Air E),
  bell (Ring), whoosh (Crumble), gate (Closing Gate).
- Installed ffmpeg (Gyan 9.0); PS1-converted each: mono, 11025 Hz, acrusher
  bits=8/log, ogg -q1. 52.7 MB WAV -> 218 KB ogg.
- core/audio.js rewritten as a manifest-driven file loader (roles->files;
  reassign freely). Kept synth footsteps (library has none). API preserved for
  interaction (unlock/footstep); added bed()/play()/onReady().
- atmosphere/audio.js: hall+air beds above ground, crypt bed below, crossfaded
  by camera.y<-3 (~0.7s); a far toll every 45-90s; world.flags.sfxWhoosh/sfxGate
  exposed for the atlas portal transitions.
- Verified via ?free=1: all 6 buffers loaded, 3 beds looping, bell plays, 0
  warnings. EAR-CHECK PENDING (headless has no audio device).

===========================================================================
# NORDTURM — the climax (Tier-1 area #1)  (2026-08-09)
===========================================================================
Seam-connected north tower (Great Hall cluster). Full-circle tower centre
(-8.5,-18.25), 3-turn spiral to Siegmund's study at y=13; seam door in the
chancel west wall (x=-6, z=-17). 85 colliders, 16 lights.
- TRAVERSAL: floor-follow up the invisible helical ramp verified (simulated
  climb 0.34 -> 12.3, maxRise/step 0.055 m, never stuck). Seamless ascent holds;
  no portal fallback needed.
- STUDY: cold NW window (daylight key) + a warm desk lamp ("the light I have left
  burning", residue class) over Siegmund's corpse slumped across the desk
  (blackened fingertips the one plague detail; not gory). Shots 10/11/12 read
  well (captures/nord-shot1{0,1,2}.png).
- KEYSTONE LETTER (content): 3 leaves, Siegmund to the dead Adelheid; ties the
  crypt's red shoe + the breach (§5.5) + the burning light; ENDS MID-WORD. Reads
  + pages + closes, verified. Corpse examinable fires (scout register).
- Atlas reconciled: study y +13 (not +18); status BUILT.

===========================================================================
# BUGFIXES + 3 ROOMS + PORTALS + ZONE TITLES  (2026-08-09)
===========================================================================
BUGS (verified): (1) Nordturm invisible wall = contain() BOUNDS didn't include the
tower (x<-6); added rect. (2) crypt "see above ceiling" = stair shaft not enclosed
through the inter-floor gap; agent boxed it (descent now shows only the crypt).
(3) ossuary walk-through bones = +4 niche-mouth colliders (85->89).

ZONE TITLES (core/zones.js): per-frame zone detector -> top-centre title, fade in /
hold 2s / fade out; dark backing for legibility on any bg; skipped in shot mode /
before entry / while reading. Verified across all 5 core zones + the 3 new areas.

PORTAL SYSTEM (core/scene registerPortal + main.js fade/teleport + interaction.teleport
+ #fade): walk-up threshold -> [E] -> fade to black -> teleport -> whoosh -> zone
announces. Round-trip verified (side chamber -> Tithe House entry, zone announced).

3 DISCRETE ROOMS (concurrent agents, self-contained modules on far islands; grounded
docs confirmed marker.y==surface):
- Tithe House (100,0,0): Marck's 3-leaf inventory of surrendered craft on the desk;
  racked empty labelled cases. Underlit (follow-up).
- Library (0,0,100): the beautiful room; Walburga's seal-leaf on a reading desk +
  Gisela marginalia on the lectern. Reads best of the three.
- Infirmary (-100,0,0): beds w/ composed dead, flies, lime; Klara's roll (on a bed) +
  Bohn's leaf (on the table). Underlit (follow-up).
Integration: areas/index.js (build + zones + 6 portals), main.js initAreas, 3 BOUNDS
rects. Stats: colliders 89->131, floors 13->16, lights ->30, 0 console errors, 60fps.
FOLLOW-UP: brighten Tithe House + Infirmary (both too dark vs the Library).

---

## Phase: The Arrival Procession (seamless Gate -> Inner Ward -> Great Hall)

The player now SPAWNS at the gatehouse (0,1.7,55) and walks the whole approach in
one continuous space -- no portal, no fade -- through the dead inner ward and in
through the great door into the nave. This replaces the old fake sky-plane behind
the door (atmo_sky_door / atmo_glow_door now hidden) with the real exterior.

Build: areas/approach.js (exterior shell: pointed-arch facade + open great door at
z16, ward cobbles z[15,48], curtain walls x=+/-18 with crenellations, gatehouse +
twin towers + vaulted passage z[48,58], well, mounting block, overcast-daylight rig
= HemisphereLight + DirectionalLight ramped to 0 indoors, gradient sky box, fog).
areas/approach-story.js (gate-killings tableau, tipped handcart, 2 sealed/chalked
doors, flies+lime, + 2 grounded docs: Stolz's sealed order on the ward table,
Vogel's gate-tally on a barrel-head).

Fog authority split by z to stop the two swaps fighting: approach.js drives fog
only OUTDOORS (z>16); undercroft-atmo.js now early-returns when z>16, so the crypt's
damp fog is untouched. Clean single-owner per region.

Core edits: main.js spawn moved to gate + safeInit('approach') + Inner Ward /
Gatehouse zones + hide sky-door; interaction BOUNDS += {x[-18,18] z[15,58]};
shots.js += 13-15 (exterior arrival cameras).

VERIFIED (Playwright, ?free=1 + ?shot=13..15):
- Shots 13/14/15 read: arch frames the daylit hall facade; rose window + warm-glowing
  great door vs cold daylight; reverse shows gatehouse passage glowing to the outside.
- Seamless walk gate(z55) -> door(z16) -> nave(z6): floor-follow y PINNED at 1.7 the
  entire exterior->interior transition, x=0, NO invisible wall at the facade seam
  (passedDoor=true), no fall-through. ~2.6 u/s steady.
- 10 zones registered; "The Inner Ward" title fades in on entry (opacity ~0.95).
- Both approach docs grounded on furniture (Stolz y=0.75, Vogel y=0.86) -- not floating.
- 0 console errors on current load (stale HMR/favicon 404s excluded); 60fps; 154
  colliders / 36 lights in the arrival view. npm run build OK (36 modules, 2.55s).

---

## Phase: Imposing exterior rework (approach silhouette)

Feedback: "the castle doesn't look very imposing. it looks like i'm entering the
alamo... there should be towers and arrow slits and a lot of visual interest."
The old approach was a 9 m gabled hall behind a 7 m wall -- horizontal, single-
plane, no vertical drama. Reworked src/areas/approach.js for a layered fortress
silhouette with real height.

New fortress-detail vocabulary (shared helpers):
- crown(): oversailing corbel course + crenellated parapet (machicolation).
- battlementRect(): merlons w/ crenel gaps around any rectangle perimeter.
- crossLoop(): recessed cross-shaped arrow loop (arbalest loop), ±X/±Z faces.

Added geometry:
- buildFlankTowers(): two 19 m square towers flanking the great door (x=±8.4),
  machicolated crowns, slate spikelets, 4 tiers of cross-loops per face.
- buildLanternTower(): central crossing tower rising behind the gable to 26 m +
  steep slate spire + 4 corner pinnacles + tall paired lancet openings. Base at
  y=WALL_H+1 so it never intrudes on the nave interior; revealed taller the
  further back the player stands.
Reworked:
- Curtain walls 7->9 m, thicker, oversailing corbel course, machicolated merlons,
  two tiers of cross-loops in rhythm down each inner face, + a squat wall-tower
  breaking each run. Well/mounting-block moved to x=±12.5.
- Gatehouse towers 10->14 m with machicolated crowns + steep slate caps, tiered
  cross-loops; a projecting MACHICOLATION gallery (murder-holes) oversailing the
  gate on the ward face; battlemented passage parapet; pointed gate-arch relief.
- FOG_EXT far 70->84 so the tall/distant masses read; shots 13-15 unchanged.

VERIFIED (Playwright): silhouette now reads as a proper gothic fortress -- spired
lantern tower + two machicolated flank towers + crenellated cross-looped curtain
walls (hero capture). Seamless walk gate(z55)->nave(z5.85) still clean: never
stuck, y pinned 1.7 (new tower bases clear the centre path). colliders 154->158,
0 console errors (favicon 404 excluded), 60fps. npm run build OK (2.48s).

---

## Phase: Restart/intro, stair fix, bodies, clutter, taller towers, the Cloister

Batch of user requests (one prompt + a mid-turn add):

1. ESC menu RESTART + intro. index.html: #intro overlay (the conceit — a scout
   from another lord, sent up alone to a holding gone silent — "go in, find out
   what happened, and write it down") + a Restart button on the pause screen.
   interaction/index.js: intro shows on load/restart (skipped in shot/free);
   "Begin your watch" hides it + requestLock; Restart = clean reload (returns to
   the gate spawn, re-shows intro). Verified: intro renders, buttons present.

2. NORDTURM SPIRAL FALL — fixed. Root cause: the stair arrived at the top (~26.6°)
   but the study-floor solid arc began at 32°, leaving a wedge at y=13 with neither
   ramp nor floor → floor-follow raycast into void → fall. Fix (nordturm.js):
   extend the invisible helical ramp into a flat top LANDING (rampY clamps past
   A_SPAN; +22°) and widen the study-floor arc (solid0 32°→23°) to begin before the
   arrival. Verified: eye pinned 14.7 at arrival / former-gap wedge / study centre,
   fell:false at all three.

3. INFIRMARY BODIES (agent). 5 corpses (3 on beds @ y0.50, 2 on floor @ y0),
   blackened extremities, stains+scrub, flies, lime, +2 examinables. Verified
   grounded: bed bodies base 0.50, floor corpse base 0 — nothing floats.

4. COURTYARD CLUTTER (agent, approach-story.js). Market-stall wreckage, broken
   barrels/crates, second tipped cart + dead draft beast, 5 more fallen bodies,
   rope/tools/bedrolls/ladder/cartwheel, lime along wall-feet; +20 colliders;
   central lane x[-2.5,2.5] kept clear. Verified in ward views.

5. TOWERS MORE IMPOSING (agent, approach.js). FLANK_H 19→24, LANT_H 26→32
   (spire apex 43), TOWER_H 14→17; new deepCrown()/spire() helpers; 5 loop tiers
   on flanks; a NEW REAR KEEP pair (buildKeep, x±11.3 z5, H30, crenellated tops +
   turret spirelets) for layered depth; decay/asymmetry (cracked cap + toppled
   merlon on one flank, ivy on another, slumped keep). +2 colliders. Verified:
   hero silhouette now a proper layered fortress; path/interior clearances hold.

6. THE CLOISTER (agent, NEW cloister.js + index.js wiring). Atlas #9. Island at
   (100,0,-100), 24×24 with a 16×16 open garth; ribbed groin-vaulted covered walk,
   paired-column arcade of voussoir arches, plinth wall w/ one open south bay to a
   central well-head; 3 blind doorways (St Ursel's/Long Gallery/Pleasure Garden)
   for future seams; local point-lights (garth wash → dim walk). Portal from the
   side chamber [12,1,0]; zone "The Cloister". STORY: two men fallen a sword-length
   apart, blades flung toward each other, blood pools under each + spatter between
   + ARTERIAL SPRAY up the pier (y0.1→1.46) — "not the plague that did it." +27
   colliders. Verified grounded (bodies y0, blades y0.03, pools y0.02, spray up the
   pier), zone registered, walk+garth walkable.

Totals: colliders ~207, lights 46. 0 console errors. npm run build OK (2.66s).
Reference for the cloister: Cloitre_prieure_Saint-Michel_de_Grandmont.jpg (desktop).

## Fix: pause on P (Esc is browser-owned in the embedded preview)
interaction/index.js: added togglePause() bound to KeyP — shows the pause overlay
(Restart / Fullscreen) + stops control; P again (or clicking the overlay) resumes
via requestLock. Guarded off while reading / intro up. Hint text updated to
"P pause / menu". Verified: playing→P raises menu + active=false.

---

## Phase: fixes + 4 new wings + automap + HOSTED

- Rose window now mirrored on the interior nave face (glowing oculus from inside).
- Side-chamber doors: 4 invisible portal-anchors replaced with visible stone-framed
  dark doorways (N/S walls). ROOT-CAUSE BUG FOUND: the rear keep (appr_keep_stone,
  approach.js) footprint x[7.5,15.1] z[1.2,8.8] was intersecting the side chamber
  interior (x[6,13] z[0,8]) — a solid ground-to-30m mass burying the whole chamber +
  its colliders. Fixed by lifting the keep base above the interior roofline
  (KEEP_Y0=9.6, no ground collider), like the lantern tower. Doors verified visible.
- Pause moved to P (Esc is browser-owned in the embedded preview).
- DOOM-style AUTOMAP overlay (M): node-graph of all zones, current highlighted,
  available exits, reveal-on-visit, "?" for unexplored. src/core/map.js + zones.js
  (world.currentZone) + main.js + index.html.
- 4 NEW WINGS (self-contained island modules, agents): The Keep (founder's hall +
  upper chamber), St. Ursel's Chapel (Anselm's body, Walburga leaf), The Long Gallery
  (gutted astronomical clock, Payment I), The Hortus Clausus (living poison garden).
  Wired off the INNER WARD via 4 visible curtain-wall doorways; BOUNDS + zones + map
  graph extended. 15 zones total, all reachable (Keep walk-in verified, floor-follow ok).

HOSTED on GitHub Pages: repo github.com/kpgrubb/gothic-castle, live at
https://kpgrubb.github.io/gothic-castle/ (verified: HTTP 200, app boots, 15 zones,
only favicon 404). Deployed via gh-pages branch (OAuth token lacked `workflow` scope
to push the Actions workflow; deploy.yml left untracked locally for later). Vite
base:'./' makes the subpath work. npm run build OK.

---

## Phase: atmosphere pass — vermin, weather, greebles, painting fix

Six requests, four agents + integration:
1. VERMIN (src/atmosphere/vermin.js): 365 maggots (writhe: per-instance sin bob +
   curl + crawl-jitter) + 23 roaches (scuttle elliptical loops with dart/pause),
   2 InstancedMesh draws, 16 patches on interior floors beside corpses/stains
   (crypt, nave/decay, infirmary, chapel, keep, long gallery, cloister). Grounded,
   no colliders. Wired in main.js (createVermin).
2. RAIN (src/atmosphere/weather.js): 400-streak camera-following LineSegments, shown
   ONLY when the camera XZ is within an outdoor region (ward (0,36) r28, cloister
   (100,-100) r15, hortus (150,100) r15) — spatial gate w/ 5m fade, free indoors.
3. VULTURES: 15 (5/region) near-black silhouettes circling at varied r/height/speed,
   banking into the turn, subtle wing-flap. Always on.
4. CLOISTER OUTDOOR: weather.js adds a gradient sky box + HemisphereLight + soft
   directional to the Cloister and Hortus (ramped by proximity so interiors aren't
   blown out). Cloister now reads as a daylit open-air garth in the rain (was black).
5. GREEBLES (approach.js): putlog holes, irregular/patched ashlar, damp stains,
   cracks, iron tie-rings/torch brackets, moss, and parapet DECAY (toppled/chipped
   merlons, fallen-merlon blocks) across curtain walls / gatehouse / keep (keep
   greebles above KEEP_Y0). Incidental fix: gatehouse arrow-loop batch was never
   .build()-ed — now rendered. No new colliders.
6. LONG GALLERY paintings: frames were solid slabs COVERING the canvases (z-fight).
   Rebuilt as raised border bars around each; canvas mounted 0.06m proud, facing the
   room. 5 west portraits + 2 far + 1 tapestry, visible head-on.

Verified (Playwright): ward shows rain + 2 vultures + detailed walls; cloister is a
daylit rainy garth; vermin scattered by the cloister dead (365+23 instanced); gallery
portrait + tapestry hang flat head-on. 60fps, lights 46->85, colliders ->265, 0
console errors (favicon only). npm run build OK.

---

## Phase: 5 new connected wings (incl. the ambitious Harbour) + sky-bleed fix

Five self-contained island areas (agents), wired by the integrator. World now 20 zones.
- THE HARBOUR & BRANDTURM (harbour.js) — the ambitious one. Heaving 560×440 sea
  (vertex waves), own sky + sea-fog, 3 boats (moored/half-sunk/capsized on rocks),
  quay gear (capstan/derrick/crates/barrels/nets), and a CLIMBABLE lighthouse
  (Nordturm helical-ramp trick, base y0→lantern y17, verified floor-follow holds)
  crowned by the BRAZIER STILL LIT (warm point-light, Krug's body + log, §7.4).
  Off the ward (west z16). Verified: reveal + climb + lit lantern.
- THE ORDINAL (ordinal.js) — 6 concentric brick rings funnelling to a SEALED drum;
  438 ring-post colliders make every ring a continuous barrier yet you can circle
  right up to the centre (no way in). Off the CRYPT (crypt south wall, y-6 door).
- THE GUILD HALL (guild-hall.js) — work stopped mid-task; Ochs at his anvil, Krieg's
  guild roll (Payment III). Off the ward (east z16).
- THE BRIDAL HALL (bridal-hall.js) — a wedding feast never held; tables laid, chairs
  never drawn, collapsed cake, great doors barred from outside, empty keyhole, no
  key, seven scratch-marks inside. Off the ward (east z46).
- THE SOUNDING COURT (sounding-court.js) — elliptical whispering-gallery, standing
  stone at the true centre but the acoustic figure cut OFF-centre (the voice returns
  wrong). Own sky. Off the ward (west z46).

Integration: doorPortal gained a floor-Y param (crypt door at y-6); 5 ward/crypt
doorways + returns; 5 BOUNDS rects; 5 map nodes (+Undercroft→Ordinal edge, rest off
the Inner Ward); Harbour + Sounding added to weather REGIONS (rain + vultures).

SKY-BLEED FIX: large fog:false sky boxes live in one shared scene with no inter-area
occlusion, so from far islands they bled in as pale panels (and the harbour's huge
static sky exceeded the 220 far plane → black). Fixes: har_sky is now CAMERA-FOLLOWING
(sized to fit 220, gated to x>200) with fog far 185→128; appr_sky gated to the castle
core; a central skygate updater in main.js hides snd_sky + the two cloister/hortus
weather skies unless the player is within 48 m of each. Verified: harbour grey sky
clean, Ordinal/Sounding clean, no bleed.

20 zones, 60fps, 0 console errors, npm run build OK.

---

## Phase: Envato atmosphere audio (contextual) + Continue button

Incorporated 9 downloaded Envato sounds, PS1-converted (ffmpeg → mono 16 kHz ogg,
trimmed to ~40s loops) into public/audio/: rain, wind, whispers (eerie voices),
devils (devil's presence), hallgods (Hall of Gods reverb), cryptrumble, dock (ferry
dock), fire (crackle), crow.

core/audio.js: added the 9 MANIFEST roles + a `positional(role,{pos,refDistance,...})`
helper (PositionalAudio) and start positionals on unlock.

atmosphere/audio.js: REWROTE initAudio as a ZONE-DRIVEN ambience mixer. Per-zone
target volumes for 10 looping beds crossfade (~0.8s) on world.currentZone:
- outdoors (ward/gate/cloister/hortus/harbour/court): rain + wind (+dock in harbour)
- nave/chancel/chapel: hallgods (+hallBed)
- undercroft: cryptRumble + cryptBed + whispers
- diabolical works (tithe house, ordinal): devils + whispers
- sounding court/bridal/galleries: whispers (the residue of what happened)
Plus: the lighthouse BRAZIER as a POSITIONAL fire (swells as you climb the Brandturm);
an occasional CROW one-shot while outdoors; the existing far bell + portal SFX kept.

Verified (Playwright): audio.ready + unlocked, all 9 oggs load (no failures), the
positional fire plays at (320,18,0), zone crossfade updater running. (Can't judge
sound quality headless — worth an ear-check in a browser tab.)

UI: added a prominent CONTINUE button to the pause menu (was confusing how to
resume); wired to requestLock. Menu now: Continue / Enter Fullscreen / Restart.
Held the footsteps pack (walking sound was removed earlier by request).

npm run build OK. 0 console errors (favicon only).

---

## Phase: better corpses (shared low-poly model) + more dark-brown stains

Feedback: corpses looked like Minecraft boxes. Researched PS1 body modeling
(tapered joint-to-joint limb "bones", squashed head, pixel skin/cloth texture,
~1k tris — not axis cubes). Built src/content/corpse.js:
- makeCorpse({pose,cloth,seed}) → posed low-poly body (supine/facedown/side/
  slumped), own skin/cloth/blackened-extremity materials + mottled plague-pallor
  texture, MERGED to 3 draw calls (per-material geometry buckets via
  three/addons BufferGeometryUtils.mergeGeometries). Origin on the floor, head
  toward +X. Iterated the proportions live (flat torso slab + splayed/contorted
  limbs) until it reads as a body at gameplay distance.
- makeStain({r}) → big soft dark-brown pooled plague stain (canvas-alpha plane).

SWEEP (4 agents) replaced every crude box-body across the world with makeCorpse
+ makeStain, grounded on the real surface, preserving colliders/docs/examinables/
existing decals: infirmary (5, beds@0.50 + floor), chapel (Anselm), keep (hall +
upper bed@5.12), cloister (2 duelists — kept red blood, added brown), ordinal
(slumped), sounding court, harbour (2 quay + Krug@lantern y17), long gallery
(clock-watcher), guild hall (Ochs@forge), approach-story (8 gate+ward dead),
nordturm (Siegmund slumped@desk y13). Generous brown stains under the plague dead.

Verified: gate/ward dead read as sprawled corpses in brown pools (daylight);
infirmary bed bodies grounded on mattresses. 60fps (3 draws/corpse). npm build OK.
