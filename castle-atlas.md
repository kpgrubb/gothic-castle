# castle-atlas.md

**The master spatial plan for Hochmauer.** Read this before you place any new
area. It governs **where** things are: coordinate envelopes, elevations, and
connections, so ~100 areas can be built across many sessions without overlaps,
elevation conflicts, or broken traversal.

Peer documents, and how this one relates to them:

- **`world-bible.md`** — governs *meaning* (who built what, §3; the works, §7;
  what a place is for). The atlas never invents canon; it only positions canon in
  space. Every row here cites its bible generation (§3) and work (§7).
- **`scene-contract.md`** — governs the *module contract* and the **current built
  coordinates** (§4). The atlas is the **spatial master**; scene-contract remains
  the authority for the built Great Hall's exact geometry and the six shot
  cameras. Where they touch, they must agree. **If you move a built envelope, you
  edit scene-contract §4 first, then mirror it here.**
- **`art-direction.md`** — governs *form* (palette, value, light, decay). The
  atlas says where a garden goes; art-direction says it must read in the cold
  family. No conflict; consult both.

Nothing here overrides the PS1 spec, the palette rules, or world-bible §13.3
(what is fixed).

---

## 1. Purpose

One problem, solved once: **a shared, non-overlapping map of the whole castle** so
that any agent, in any session, can claim a place to build and know it will not
collide with — or fail to connect to — anything already standing or planned.

The atlas answers four questions for every area, before a single vertex is cut:

1. **What cluster is it in?** (shared coordinate space, or its own)
2. **How do you get there?** (seam or portal, and from where)
3. **What envelope does it own?** (x/z extent, y level/band)
4. **Where is it in the world?** (generation §3, band, logical position, works §7)

If an area cannot answer all four here, it is not ready to build. See §7.

---

## 2. Organizing model — HUB + DISCRETE

### Cluster and Area

- **CLUSTER** — a contiguous coordinate space the player walks **seamlessly**,
  including its vertical levels. There is exactly one core cluster today: the
  **Great Hall cluster** (nave, chancel/apse, side chamber, undercroft, and now
  the Nordturm). It is the emotional core and the hub; the player always returns
  through it.
- **AREA** — a room or space (a row in §4). Areas connect two ways:

### Seam vs Portal

- **SEAM** — a walkable boundary **within the same cluster**. Shared coordinates,
  no load. The nave ↔ chancel ↔ undercroft joins are seams today. A seam demands
  **strict non-overlap** in the shared space: two seamed areas must never occupy
  the same (x,z) at the same y.
- **PORTAL** — a transition (threshold → fade → load) between the core and a
  **DISCRETE** area that carries **its own local coordinate origin**. Because each
  discrete area sits at its own local `(0,0,0)`, discrete areas **never globally
  overlap** — you may build a hundred of them and never check one against another.

### Coordinate policy

- **Core cluster:** one shared coordinate space (scene-contract §4 metres, +Y up,
  1 unit = 1 m). Careful non-overlap required **within** it. Every new core-cluster
  area must claim an envelope here that touches no other core envelope's volume.
- **Discrete areas:** **local coordinates.** Each may start at its own origin.
  No global-overlap concern — only internal self-consistency and a clean portal
  seam at the door.

### The logical map (independent of render coordinates)

Separately from render coordinates, every area carries a **castle-wide logical
position**: roughly where it sits on the **headland → harbour gradient**
(world-bible §2) and which **generational zone** raised it (§3). This exists for
narrative coherence and a future in-game map, and is **decoupled from render
coordinates** — a discrete area at local `(0,0,0)` still has a real place on the
headland. The gradient runs `0.0` (headland summit) → `1.0` (below the tide).

> Render-axis convention for the core: **−Z is the up-headland / landward end**
> (apse, Nordturm, keep); **+Z is the down-slope / harbour-and-town end**
> (entrance, ward, quays). So walking −Z in the hall walks *up* the gradient.
> (Flagged for author confirmation — see Open Questions.)

---

## 3. Elevation bands (headland → below-tide)

Six bands, high to low, following the builder stratigraphy (§3) and the descent to
water (§2). Each band has a name, a **core-cluster y-convention** (used only where
the core cluster reaches that band), and the standing rule for discrete areas.

| # | Band | Core-cluster y | Generational owners (§3) | Notes |
|---|---|---|---|---|
| 1 | **Headland / Keep** | y ≥ +12 | Gen 1 Otwin (keep, curtain), Gen 7 tower-top | Highest, oldest, most defensive. Nordturm study lives here at core y ≈ +18. |
| 2 | **Great Hall** | y ∈ [−7, +9] | Gen 2 Reinhold (hall), Gen 5 Konrad (undervault) | The ceremonial core. Floor y=0, vault crown ≈ +9, undercroft floor y=−6 as its lower sublevel. |
| 3 | **Courtyards / Gardens** | *local* | Gen 6 Dietrich & Gisela | Cloisters, long gallery, library, pleasure garden, Hortus Clausus. Refinement band. |
| 4 | **Workshops / Guild yard** | *local* | Gen 4 Albrecht II | Guild hall, smithy, joiners', mason's yard; the Cold Forge and Tithe House sit at this band's service edge. |
| 5 | **Harbour works** | *local* | Gen 3 Mechthild | Mole, quays, harbour stair, the Brandturm on the far mole. |
| 6 | **Below-tide** | *local* | Gen 3 Mechthild / Gen 7 Focalor | Floods with the tide. Wet Chapel, Drowning Stair. The lowest, wettest, worst. |

**Rule.** The core-cluster y-convention applies **only** to areas inside the Great
Hall cluster (bands 1–2 today). **Every discrete area uses local y**, starting at
its own floor (usually local y=0), and is merely *tagged* with the band it belongs
to for the logical map. A discrete Wet Chapel is "Below-tide" on the map but is
built at local y=0 in its own space.

---

## 4. Region table

Every area is a row. `Conn` = connection type → target. `Envelope` is metres,
local unless the cluster is the core (then it is shared scene-contract space).
`Gen` cites §3; `Role` cites §7. `Pos` is the logical headland→harbour gradient
(0.0 summit → 1.0 below-tide).

**Status:** `BUILT` (standing, in scene-contract §4) · `NEXT` (Tier 1, envelope
claimed) · `STUBBED` (canonical, rough envelope reserved, not built) ·
`REFERENCED` (named in canon, off-map or distant, no envelope yet).

### 4.1 Great Hall cluster (core — shared coordinates)

| # | Area | Conn → target | Envelope (x / z / y·band) | Gen | Role (§7) | Pos | Status |
|---|---|---|---|---|---|---|---|
| 1 | **Nave** | HUB (spawn) | x[−6,6] z[−15,15] · y=0 · B2 | 2 Reinhold | Ancestral: ceremonial spine | 0.55 | **BUILT** |
| 2 | **Chancel / Apse** | seam → Nave | x[−6,6] z[−20,−15] · y=+0.34 · B2 | 2 Reinhold | Ancestral: raised chancel, tracery window | 0.45 | **BUILT** |
| 3 | **Side chamber** | seam → Nave (E wall z[0,7]) | x[6,13] z[0,8] · y=0 · B2 | 2 Reinhold / service | Ancestral: abandoned meal (mo.13) | 0.58 | **BUILT** |
| 4 | **Undercroft (crypt)** | seam → Chancel (stair) | x[−5,5] z[−14,−3] · y=−6 · B2 | 5 Konrad | Ancestral granary → plague crypt (mo.12); lime-pit | 0.50 | **BUILT** |
| 5 | **Nordturm** (N tower + Siegmund's study) | seam → Chancel (W door) | base x[−11.5,−6] z[−21,−15.5]; study y≈+18 · B1 | 1 Otwin (fabric) / 7 (occupant) | Ancestral keep tower; the keystone letter (§5.5) | 0.30 | **NEXT** |

### 4.2 Discrete areas — Tier 1 (NEXT)

| # | Area | Conn → target | Local envelope (x / z / y·band) | Gen | Role (§7) | Pos | Status |
|---|---|---|---|---|---|---|---|
| 6 | **The Tithe House** | portal → East service passage | x[−5,5] z[0,24] · y[0,6] · B4 | 7 / Mammon | Diabolical §7.2: racks, cradles, fitted cases, cases labelled in Marck's hand | 0.62 | **NEXT** |
| 7 | **Hortus Clausus** (poison garden) | portal → Pleasure Garden (iron gate) | x[−10,10] z[0,15] · open-air y0 · B3 | 6 Gisela | §7.3: sealed poison garden, still living | 0.40 | **NEXT** |

### 4.3 Discrete areas & future clusters — Tier 2/3 (STUBBED)

| # | Area | Cluster | Conn → target | Rough envelope · band | Gen | Role (§7) | Pos | Status |
|---|---|---|---|---|---|---|---|---|
| 8 | **Inner Ward** (great courtyard) | Ward | portal → Nave (entrance z=+15) | ~30×30 open · B3 | 1 Otwin / connective | Ancestral: the hub of the outdoor half | 0.60 | STUBBED |
| 9 | **Cloister walk** | Ward | seam → Inner Ward | ~24×24 arcade ring · B3 | 6 Dietrich | Ancestral: connective refinement | 0.55 | STUBBED |
| 10 | **The Long Gallery** | Gallery | portal → Cloister | x[−4,4] z[0,40] · B3 | 6 Dietrich | Ancestral: the astronomical clock's bay (Payment I) | 0.48 | STUBBED |
| 11 | **The Library** | Gallery | seam → Long Gallery | ~16×12 · B3 | 6 Gisela | Ancestral: Gisela's books (§3.1) | 0.46 | STUBBED |
| 12 | **St. Ursel's Chapel** | Chapel | portal → Cloister | ~10×18 · B2/3 | 1 Otwin (first chapel) | Ancestral: Anselm dies here (mo.13); Walburga | 0.52 | STUBBED |
| 13 | **The Infirmary** | Chapel | seam → St. Ursel's | ~12×16 · B3 | 5 Konrad | Ancestral: beds, composed dead (mo.13); Sister Klara | 0.56 | STUBBED |
| 14 | **The Pleasure Garden** | Garden | portal → Cloister | ~24×18 open · B3 | 6 Dietrich & Gisela | Ancestral: the formal garden (holds #7 & #15) | 0.42 | STUBBED |
| 15 | **The Iron Orchard** | Garden | seam → Pleasure Garden | ~14×14 · B3 | 7 / Mammon | Diabolical §7.2: twelve iron trees (Ochs) | 0.42 | STUBBED |
| 16 | **The Ordinal** | discrete | portal → Undercroft or a vault passage | ~14×14 vaulted · B2/3 | 7 / Astaroth | Diabolical §7.2: seven concentric brick rings, no opening to the centre | 0.44 | STUBBED |
| 17 | **The Sounding Court** | discrete | portal → Inner Ward | ~18×18 open · B3 | 7 / Astaroth | Diabolical §7.2: a voice returns wrong | 0.50 | STUBBED |
| 18 | **The Unfinished Stair** | discrete | portal → Undercroft | ~6×6 footprint, rising · B2 | 7 / Belial | Diabolical §7.2: 41 perfect steps into a sealed vault | 0.47 | STUBBED |
| 19 | **The Bridal Hall** | discrete | portal → Cloister (locked) | ~10×16 · B3 | 7 / Asmodeus | Diabolical §7.2: a wedding feast never held; key never found | 0.52 | STUBBED |
| 20 | **The Guild Hall** | Guild | portal → Inner Ward | ~18×24 · B4 | 4 Albrecht II | Ancestral: the guild quarter's seat; Krieg | 0.68 | STUBBED |
| 21 | **The Smithy** | Guild | seam → Guild yard | ~12×14 · B4 | 4 Albrecht II | Ancestral: Werner Ochs's forge; work orders | 0.70 | STUBBED |
| 22 | **The Joiners' Shop** | Guild | seam → Guild yard | ~10×14 · B4 | 4 Albrecht II | Ancestral: Baltic oak, the boy Otwin's drawings | 0.70 | STUBBED |
| 23 | **The Mason's Yard** | Guild | seam → Guild yard | ~20×20 open · B4 | 4 Albrecht II | Ancestral: dressed stone, Krieg's guild roll (Payment III) | 0.72 | STUBBED |
| 24 | **The Cold Forge** | discrete | portal → Guild yard | ~12×14 · B4 | 7 / Asmodeus | Diabolical §7.2: a second smithy whose fires will not take; Ochs stops writing | 0.71 | STUBBED |
| 25 | **The Water Works** | discrete | portal → Undercroft | ~16×10 · B2/6 | 5 Konrad | Ancestral: cisterns, conduits — invisible works | 0.66 | STUBBED |
| 26 | **The Keep (interior)** | Keep | portal → Inner Ward / seam → Nordturm | ~16×16, multi-storey · B1 | 1 Otwin I | Ancestral: the founder's keep, thick and dark | 0.25 | STUBBED |
| 27 | **The Curtain Wall walk** | Keep | seam → Keep / Gatehouse | perimeter walk · B1 | 1 Otwin I | Ancestral: the "high wall"; the gate killings (mo.12) | 0.30 | STUBBED |
| 28 | **The Gatehouse** | Ward | seam → Inner Ward / Curtain | ~12×16 · B1/2 | 1 Otwin I | Ancestral: the way in; Stolz, Vogel's tallies | 0.65 | STUBBED |

### 4.4 Referenced only (named in canon, no envelope yet)

| # | Area | Band | Gen | Role (§7 / bible) | Pos | Status |
|---|---|---|---|---|---|---|
| 29 | **The Harbour Mole & Quays** | Harbour | 3 Mechthild | Ancestral: the deep-bay works | 0.85 | REFERENCED |
| 30 | **The Harbour Stair** | Harbour | 3 Mechthild | Ancestral: descent to the water | 0.88 | REFERENCED |
| 31 | **The Brandturm** (lighthouse) | Harbour | 4 Albrecht II | Ancestral: far-mole light, brazier still lit (§7.4); Krug | 0.90 | REFERENCED |
| 32 | **The Wet Chapel** | Below-tide | 7 / Focalor | Diabolical §7.2: floods twice daily, wrong orientation | 0.95 | REFERENCED |
| 33 | **The Drowning Stair** | Below-tide | 7 / Focalor | Diabolical §7.2: quay stair past the low-water mark | 0.97 | REFERENCED |
| 34 | **The Ossuary** | Great Hall | 5 Konrad | Ancestral vault: ordered bone (mo.11–12) | 0.50 | REFERENCED |
| 35 | **Neder Hochmauer** (town) | — | mixed | §2: the dead town below; Salt Row, Tanners' Steps | 0.80 | REFERENCED |
| 36 | **The Bone Field** | — | — | §2/§6: outside the wall; Brack fled here (mo.14) | 0.99 | REFERENCED |

**Counts:** 36 rows — **4 BUILT · 3 NEXT** (Nordturm, Tithe House, Hortus Clausus)
**· 21 STUBBED · 8 REFERENCED.** The named-work skeleton (all of §7's works, all
of §3's wings) is placed; the density scales cleanly toward ~100 by subdividing
existing wings (rooms within the keep, bays of the gallery, cells off the cloister)
without touching the core coordinate space.

---

### 4.5 Core cluster — top-down (metres, shared space)

```
            x=-11.5   x=-6        x=0        x=+6      x=+13
   z=-21  ┌─────────┐                                          N / −Z
          │ NORDTURM│  study y≈+18  (spiral rises from base)   up-headland
   z=-20  │  base   ├───┼══ APSE WINDOW ══┼───────┐            ▲
          │ (W door │    (raised chancel +0.34)    │           │
   z=-15  │  @z-17) ├──── chancel step ────────────┤           │
          └────┬────┤ ·col      ·col   ·col   ·col │
               │(seam)│                             │
   z=0    ▼UNDERCROFT│  NAVE (clear 12 w)           ├──────────┐
        (y=-6, below │  ·col      ·col   ·col   ·col│  SIDE     │→ E service
         chancel)    │                             │  CHAMBER  │  passage
   z=+8              │                             ├────┬─────┘  ──PORTAL──▶
                     │                             │    │(passage) TITHE HOUSE
   z=+15            └──────── DOORWAY ─────────────┘    (discrete, local origin)
                          │ (glows)                     S / +Z
                       ──PORTAL──▶ INNER WARD            down-slope
                       (discrete)                       (harbour / town)
```

Nordturm base abuts the hall at the shared wall `x=−6` (no volume overlap: tower
is `x[−11.5,−6]`, hall is `x[−6,6]`). Its door is cut in that shared wall at
`z≈−17`, `y=+0.34` (chancel level). The spiral climbs within the tower footprint
to the study at `y≈+18`; the desk faces the north light. The apse tracery window's
north backdrop stays clear because the tower is offset to the **northwest** corner,
not centred behind the window. (Build note flagged below.)

---

## 5. Connection graph

Adjacency list. `—seam—` shares coordinates (no load); `—portal—` loads a discrete
area. Traversal is proven from the entrance to the Nordturm, the Tithe House, and
the Hortus Clausus.

```
Entrance doorway (z=+15)
  —seam— Nave
      —seam— Chancel/Apse
          —seam(W door, z≈-17)— Nordturm base
              —seam(spiral)— Siegmund's Study (y≈+18)      [PROVEN: entrance → Nordturm]
          —seam(stair)— Undercroft
              —portal— The Ordinal
              —portal— The Unfinished Stair
              —portal— The Water Works
      —seam(E wall, z[0,7])— Side chamber
          —seam(passage)— East service passage
              —portal— The Tithe House                     [PROVEN: entrance → Tithe House]
  —portal— Inner Ward (great courtyard)
      —seam— Cloister walk
          —portal— Long Gallery —seam— Library
          —portal— St. Ursel's Chapel —seam— Infirmary
          —portal— The Bridal Hall (locked)
          —portal— Pleasure Garden
              —seam— Iron Orchard
              —portal(iron gate)— Hortus Clausus            [PROVEN: entrance → Hortus Clausus]
      —portal— Sounding Court
      —portal— Guild Hall —seam— Guild yard —seam— Smithy / Joiners' / Mason's Yard
                                            —portal— Cold Forge
      —seam— Gatehouse —seam— Curtain Wall walk —seam— Keep —seam— Nordturm (upper, optional)
      (Harbour Mole, Quays, Harbour Stair, Brandturm, Wet Chapel, Drowning Stair,
       Neder Hochmauer, Bone Field — REFERENCED, edges not yet cut)
```

Every Tier-1 target is reachable from the spawn through built or claimed seams and
one or two portals. The core cluster is the hub every route passes through.

---

## 6. Priority tiers

- **Tier 0 — Built.** Nave, Chancel/Apse, Side chamber, Undercroft. (scene-contract §4.)
- **Tier 1 — Next.** **Nordturm** (seam, keystone letter — the ending), **Tithe
  House** (first portal + first diabolical work), **Hortus Clausus** (the second
  strangeness; proves the garden art-direction and the portal spine to the ward).
- **Tier 2 — Later, high value.** Inner Ward + Cloister (unlocks the whole outdoor
  half), Long Gallery, Library, St. Ursel's + Infirmary, Pleasure Garden + Iron
  Orchard, The Ordinal.
- **Tier 3 — Later.** Sounding Court, Unfinished Stair, Bridal Hall, Guild quarter
  (Hall/Smithy/Joiners'/Mason's Yard), Cold Forge, Water Works, Keep, Curtain,
  Gatehouse.
- **Referenced-only.** Harbour works, Brandturm, Wet Chapel, Drowning Stair,
  Ossuary, Neder Hochmauer, Bone Field — placed on the logical map, no envelope
  until promoted.

---

## 7. Rules & amendment protocol

### The standing rules

1. **No area is built until it claims a non-overlapping envelope in this file.**
   Core-cluster areas must clear every other core envelope's volume; discrete areas
   declare a local origin. A build with no atlas row is out of process.
2. **Seam vs portal.** Use a **seam** only when the areas genuinely share one
   contiguous coordinate space and the join is walked without a load — and only
   after confirming non-overlap in that space. Otherwise use a **portal** and give
   the new area its own local origin. When in doubt, portal: it is cheaper, safer,
   and never risks a global overlap.
3. **Core stays hub.** Do not seam two large discrete areas into a second sprawling
   shared space without integrator sign-off; discrete-plus-portal is the default so
   the map scales to ~100 without a coordinate crisis.
4. **Bands are law for the core.** A core-cluster area obeys its band's
   y-convention (§3). Discrete areas use local y and are only *tagged* with a band.
5. **scene-contract is authority for built geometry.** Changing a built envelope
   means editing scene-contract §4 first, then mirroring here. The six shot cameras
   depend on §4 coordinates — never drift them.
6. **Canon before coordinates.** Every row names a generation (§3) and a work/role
   (§7). No non-canonical *places*. Generic connective spaces (a passage, a
   courtyard, a cloister) are allowed but must pass world-bible §13.1's four tests
   and stay generic.
7. **Performance.** Only the **current area plus the hub** are loaded at once
   (portals load/unload; seams are already one cluster). Keep discrete areas
   self-contained so a portal can free the previous one. (art-direction §6: 60 fps,
   fog culling, few lights.)
8. **The integrator updates this file when an area ships** — flip its status to
   BUILT, freeze its envelope, and mirror any geometry into scene-contract §4.
   Mirror the world-bible §13.4 amendment protocol: canon that lives only in an
   agent's context is lost.

### How to add an area — checklist

1. **Name it from canon.** A §7 work or a §3 wing. Cite the generation and the
   patron/voice. Run the §13.1 four tests.
2. **Choose cluster & connection.** Core-cluster seam, or discrete + portal? Name
   the target you connect to (must already exist in §4).
3. **Claim an envelope.** Core: pick x/z/y that overlap nothing in §4.1 — check the
   top-down (§4.5). Discrete: declare a local origin and extent, tag a band (§3).
4. **Place it on the logical map.** Assign a headland→harbour position (0.0–1.0)
   and a band, consistent with its generation.
5. **Add the row** to §4 (STUBBED), add the **edge** to §5, set a **tier** in §6.
6. **Build to scene-contract** (unit scale, PS1, module contracts) and
   **art-direction** (palette/value/light/decay).
7. **On ship:** integrator flips status → BUILT, freezes the envelope, mirrors
   geometry into scene-contract §4, and (if new canon) into world-bible per §13.4.

---

## 8. Open questions for the author (do not invent answers)

1. **Render-axis ↔ gradient mapping.** The atlas assumes **−Z = up-headland**
   (apse/Nordturm/keep) and **+Z = down-slope toward ward, town, and harbour**
   (entrance). World-bible §2 says the castle descends headland→water and the scout
   arrives overland; it does not fix the great hall's orientation on the slope.
   Confirm the entrance faces down-slope.
2. **Nordturm gating (§12.7).** Task instruction: reachable **anytime**, via a
   chancel seam (ungated by geometry). This resolves §12.7 toward *ungated*.
   Confirm — or specify a soft geographic gate if the ending should be earned.
3. **Apse window vs Nordturm.** The tower is offset to the NW corner so it does not
   block the apse tracery window's north sky (art-direction §3 needs that backdrop
   bright). Confirm the tower may attach at the northwest rather than due north.
4. **Tithe House location.** World-bible §7.2 does not fix *where* the Tithe House
   physically sits. Placed here off the east service range at the workshops-band
   edge (pos 0.62), portal via a generic service passage. Confirm the placement and
   the invented connective passage.
5. **Hortus Clausus location.** §7.3 fixes its size (~30×20 paces), its single iron
   gate in a blind wall, and that it is inside the walls — not *which* enclosure it
   opens off. Placed off Gisela's Pleasure Garden (her generation). Confirm.
6. **Entrance → outside (§12.3).** The atlas treats the entrance doorway as a
   **portal to an Inner Ward**, and Neder Hochmauer as beyond that. §12.3 (town
   walled off vs continuous) is open; the Inner Ward is a canonical-adjacent
   connective assumption pending your ruling.
7. **Undercroft band.** Folded into the Great Hall band as its lower sublevel
   (core y=−6) rather than given its own "vaults" band, since the prompt's six
   bands have none. Konrad's infrastructure (water works, ossuary) is tagged to the
   nearest band. Confirm this is acceptable, or add a dedicated undervault band.

---

*Atlas v1 — 8 August 2026. Baselines the 4 built areas (scene-contract §4),
places Nordturm + Tithe House + Hortus Clausus (Tier 1), and stubs the §7 works
and §3 wings toward ~100. Amend per §7 as areas ship.*

---

## 9. Author confirmations (2026-08-08)

All 7 open questions in �8 CONFIRMED to canon: (1) -Z = up-headland; (2) Nordturm ungated; (3) Nordturm attaches NW to preserve the apse window; (4) Tithe House off the east service passage; (5) Hortus Clausus off the Pleasure Garden; (6) entrance doorway = future portal to the Inner Ward; (7) Undercroft = Great Hall sublevel.

### Reconciliation — Nordturm BUILT (2026-08-09)
Built to a full-circle tower, centre (-8.5,-18.25) R_out 2.5 (within the claimed
envelope, offset NW; apse window backdrop clear). Study floor **y = +13.0** (a 3-turn
spiral, ~12.7 m climb) — the atlas §4 row 5 / §3 band-1 "≈+18" is superseded by the
built value +13. Seam door in the chancel west wall at x=-6, z=-17, y=+0.34. Floor-follow
up the helical ramp verified. Status flips NEXT → BUILT.
