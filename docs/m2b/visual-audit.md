# Akshat City — M2b visual review and whole-world art-direction audit

Branch `m2-building-kit`, M2a committed (`623fed2`), M2b uncommitted. Audit only: no source files changed.
Evidence: current code, `docs/baseline`, `docs/m1`, `docs/m2a`, `docs/m2b` screenshots and metrics, and the
eight reference images the user supplied (a stylised shopping street, LEGO/Fortnite beach city, two Zenless
Zone Zero plazas, a stylised NYC asset pack, Hyper Scape, a Japanese street from Shashingo, Neverness to
Everness at dusk).

## 0. What the references have in common

The references are all **asset-driven**: hand-modelled modular kits with bevelled edges, painted or
trim-sheet textures, baked ambient occlusion and hundreds of distinct props. Their shared traits:

1. Dense street level: shopfronts with readable interiors, awnings, signage, planters, bins, benches,
   bollards, hydrants, vending machines, bikes. The camera always has something within 10 m.
2. Material identity: brick, tile, siding, paving patterns, cobbles. Surfaces carry pattern, not flat colour.
3. Soft forms: bevels, rounded corners, thick trims. Nothing is a raw box edge.
4. Contact darkening: every object is grounded by ambient occlusion and shadow.
5. Light with direction: warm key sun, cool fill, sky-tinted shadows, restrained emissive.
6. Vegetation that is clustered, layered (tree + shrub + flower), and placed in tree pits and planters.
7. Characters that match the world's style.

Akshat City today is **procedural geometry with flat materials**. Code alone will close part of the gap
(fixes 1–5 below), but reaching the reference level needs a stylised CC0 asset kit. That is a separate
decision (section 4, stage S6).

## 1. Ranked findings

Ranking = visual impact × reach across the city, then risk and cost.

### F1. Windows render as flat dark squares (legacy buildings) — *geometry bug*
- **Symptom:** every lab, career and house window reads as a near-black square (residential, lab and pier screenshots).
- **Cause:** `City.windows()`: the glass plane sits at `off + 0.03`, but the frame is a 0.1 m-deep box centred at `off + 0.02`, so its front face is at `off + 0.07`, **in front of the glass**. The frame (`trim`, `#2d2f38`) is all you see; the glass and its night colour are occluded. The night glow only shows because the frame box is not in the window material. Downtown was fixed in M2b (`BuildingKit.punched()` puts the frame behind the glass); legacy buildings still use the broken path.
- **Fix:** route lab, career and houses through `punched()` (or apply the same offset fix in `windows()`); remove the 0.28 m black "shadow strip" plane, which also adds to the black look.
- **Area:** geometry. **Risk:** none to gameplay or colliders; changes only building buckets. **Cost:** neutral.
- **Acceptance:** at the residential view, no unlit window is darker than the trim colour; blinds and sky reflections visible on ≥ 40 % of unlit windows.

### F2. Flat lighting with no grounding — *lighting/material*
- **Symptom:** buildings, trees and props look pasted onto the ground; walls in shade and in sun differ little; everything is equally bright.
- **Cause:** `main.js boot()`: hemisphere fill 1.25 against a 2.6 sun plus env 0.6 gives a key-to-fill ratio near 1.5:1 (references are ~4:1). No ambient occlusion (GTAO removed for cost), wall materials are 3.5 % noise (`Palette.noiseTexture`, roughness 0.95) so faces carry no gradient. Shadow frustum is ±60 m, so mid-distance buildings cast none.
- **Fix:** (a) lower hemisphere to ~0.55, tint ground bounce warm, sky fill cool; raise sun to ~3.2. (b) bake vertex AO into merged building geometry at generation time: darken the bottom 1.5 m of every wall, under cornices and inside window reveals, and add a soft dark contact quad under trees, poles, benches and cars. This is free at runtime. (c) a cheap vertical gradient on wall vertex colours (base 8 % darker than top).
- **Area:** lighting + geometry (vertex colours). **Risk:** none to gameplay; deterministic (no random draws). **Cost:** ~0 GPU; shadow change none.
- **Acceptance:** in the downtown view, sunlit vs shaded wall luminance ratio ≥ 2.5:1; tree and pole bases visibly darkened.

### F3. Large, uninterrupted ground surfaces and no curbs — *geometry/material*
- **Symptom:** home and park blocks are 31 × 31 m single-texture lawns; downtown blocks are one pavement slab; roads meet sidewalks with a 0.18 m step textured as pavement.
- **Cause:** `City.buildGround()`: each block is one pavement ring (2.6 m) plus one interior box; no curb element, no verges, no tree pits, no paths through lawns, no driveways. Grass and sand are noise canvases (`Palette.noiseTexture`).
- **Fix:** curb strip (light concrete, 0.3 m wide, bevelled top) around every block; paving texture with real tile pattern (already have `pavingTexture`, scale it to 0.6 m tiles and add colour variation); residential blocks get front paths, driveways, hedges along lot lines and a narrow verge strip with street trees; downtown sidewalks get tree pits, planters and a tactile strip at crossings.
- **Area:** geometry + procedural textures. **Risk:** must not add colliders over mission points or change existing colliders; new hedges are visual only. Uses the shared random stream → must use its own seeded generator (same pattern as `BuildingKit`) to keep trees/props fixed. **Cost:** +2–4 draw calls (curb, hedge instanced), < +60 k triangles.
- **Acceptance:** no lawn area larger than 12 × 12 m without a path, hedge or bed; every road edge has a visible curb; world fingerprint unchanged except city meshes.

### F4. Street furniture scale and repetition — *geometry/placement*
- **Symptom:** tall dark poles dominate every street shot; identical trees in rows.
- **Cause:** `City.buildStreetFurniture()`: 144 street lamps (7 m pole + 2.2 m arm) and **162 traffic-light poles** (5.5 m + 3.5 m arm, two at every one of 81 intersections, including dead-end edges). Poles are `trim`/`metal` near-black. `buildTrees()` uses one crown shape (six blobs), scale 0.8–1.4, one trunk.
- **Fix:** traffic lights only at the ~25 intersections inside districts with traffic, one per approach corner and a lighter grey; lamps every other block edge, 5.5 m, slimmer with a warm head; three tree species (round, columnar, spreading) + shrubs, scale tied to setting (street trees smaller, park trees larger); bins, bollards, hydrants, bike racks and planters placed by rules (near crossings and shop entrances).
- **Area:** geometry/placement. **Risk:** lamp and traffic-light colliders are not registered today (visual only) so removing some is safe; trees *are* colliders (`addCircle`) → keep existing tree spots, add new vegetation without colliders or with its own seeded generator. **Cost:** fewer poles −~130 instances; vegetation +2 instanced meshes.
- **Acceptance:** at the residential and downtown views, no more than 2 poles taller than 5 m in frame; ≥ 3 tree silhouettes distinguishable.

### F5. Residential and secondary architecture is boxy — *geometry*
- **Symptom:** houses are a box + four-sided cone roof, one door; lab and career buildings are legacy boxes.
- **Cause:** `City.house()`, `City.building()` (lab/career), `City.garage()`; untouched in M2b by design.
- **Fix (M2c/M2d scope):** houses: gabled roofs with overhang and fascia, porches with posts, bay windows, garages, fences, mailbox; lab: low-rise campus blocks with glass atriums and roof gardens; career: brick lofts with sawtooth roofs, fire escapes, loading bays. All through `BuildingKit` with per-block seeds.
- **Area:** geometry. **Risk:** low (building buckets only; colliders = lot rectangles). **Cost:** < +0.5 M triangles city-wide.
- **Acceptance:** ≥ 3 house variants distinguishable in the residential view; lab and career silhouettes distinct from downtown.

### Further findings (lower rank)

| # | Finding | Cause | Fix | Risk / cost |
| --- | --- | --- | --- | --- |
| F6 | Military Soldier clashes with the stylised world | `Assets.js` loads `Soldier.glb` for player and pedestrians | CC0 stylised character (Quaternius "Ultimate Animated Character" or KayKit Adventurers) with idle/walk/run clips; same `makeSoldier`/`blendLocomotion` path | Needs asset approval; retargeting risk medium |
| F7 | Facade colours too pale in sun (M2b stone towers read white) | `BuildingKit` STONE/COOL palettes are high-value; sun + hemi over-light them | Deeper, more saturated district palette (terracotta, teal, mustard, brick red accents) | Low |
| F8 | Retail glass is flat light blue, no interiors | `shopGlass` material is a plain tinted plane | Interior "card" planes behind the glass (shelves/lights from a small canvas atlas), warm emissive at night | Low; +1 canvas texture (procedural) |
| F9 | Mountains are plain cones | `buildGround()` instanced cones | Layered silhouette cards at 2–3 haze depths with gradient colour | Low |
| F10 | HUD stats panel competes with the sky in every shot; radar large | `style.css .hud-top-right`, `#radar` 180 px | Smaller radar (150 px), stats panel collapses to a single line after 5 s of play | None |
| F11 | Ferrari is the only high-detail object | Asset mismatch, not a car problem | Solved indirectly by F1–F5; keep the car | — |

### Composition vs genuine problems
- The **downtown** fixed view is 6 m from two facades with the sky top-left; it under-represents retail (only the lower 30 % of frame). Genuine issue there: F7 and F8.
- The **residential** view shows mostly road and lawn because of F3; that is a real ground-treatment problem, not framing.
- The **pier** view's emptiness is real: the beach has no props, umbrellas or boardwalk details.
- The **skyline** view hides the sloped landmark; add a fifth fixed view from the north (used in `docs/m2b/landmarks-from-north.jpg`).

## 2. M2b verdict

**Retain M2b, with revisions.** It fixed the window bug for downtown, created real typologies and three
landmarks, reduced triangles, and kept every non-building placement identical. Weaknesses to revise in the
next stage: palettes too pale (F7), retail glass flat (F8). Nothing in M2b needs reverting.

## 3. Art direction: "Golden-hour toy city"

A warm, stylised, slightly chunky city, closest to the stylised-NYC and Shashingo references, with
Zenless-style dusk lighting. Playful but tidy; readable from a driving camera.

- **Architecture:** three tiers of height (low-rise 2–4 floors, mid 6–12, towers 15+). Every building has a
  base (shopfront or plinth), a body and a top (cornice, roof kit). Bevelled or trimmed edges on every
  corner ≥ 0.15 m. Max two facade materials per building.
- **Colour:** per district, one base hue family + one accent. Downtown: warm stone + teal glass; Career:
  brick red + charcoal; Lab: white + mint; Grove Street: pastel siding + terracotta roofs; Pier: sand + sea
  blue + coral. Saturation moderate; values mid, not white.
- **Windows and storefronts:** glass in front of frames, recessed look via frame + sill; 30–50 % with
  blinds or curtains in warm off-white; storefronts with interior cards, awnings, projecting signs;
  night: warm interiors, cool sign accents, nothing pure white.
- **Ground:** asphalt dark warm grey with worn markings; light concrete curbs; patterned paving (0.6 m
  tiles, 3 tones); lawns broken by paths, hedges and beds; tree pits on sidewalks.
- **Vegetation:** 3 tree species, shrubs, hedges, flower beds; street trees 5–7 m, park trees 7–10 m;
  palms only on the beach.
- **Props:** human scale, colourful accents (red hydrants, green bins, blue mailboxes), placed by rules
  near entrances, crossings and benches; poles slimmer and lighter.
- **Lighting:** golden-hour key (warm, 3.2), cool sky fill (0.55), baked vertex AO, warm fog at the
  horizon; bloom only on signs and lamps.
- **Characters:** stylised CC0 rigged character for player and pedestrians, colour-matched to the palette.
- **Portfolio landmarks:** each district's mission building gets one hero element (the billboard trio
  downtown, a glass "lab" dome, a trophy-shaped stadium crown, a lit pier arch) so missions read as
  places, not markers.

## 4. Staged plan (each stage: own commit on `m2-building-kit`, five fixed views, fingerprint, regression)

| Stage | Scope | Files | Excludes | Acceptance | Budget |
| --- | --- | --- | --- | --- | --- |
| **S1 Window + lighting fix** | F1 for all buildings; F2 (hemi/sun rebalance, vertex AO + wall gradient + contact quads) | `City.js windows()`, `BuildingKit.js`, `main.js boot()/applyNight()` | No new geometry types | F1/F2 tests; fingerprint: only city meshes change | +0 draw calls, < +50 k tris |
| **S2 Palette + retail** | F7, F8 (deeper palettes, interior cards) | `Palette.js`, `BuildingKit.js`, `City.js makeMaterials()` | No layout change | Downtown view: no facade value > 85 %; shop interiors visible | +1 canvas texture, +1 draw call |
| **S3 Ground kit** | F3 curbs, paving, lawn breakup, tree pits | `City.js buildGround()`, new `GroundKit.js` with own seeded RNG | No new colliders | F3 tests; trees/props/parked identical | +4 draw calls, < +80 k tris |
| **S4 Street furniture + vegetation** | F4 | `City.js buildStreetFurniture()/buildTrees()` | Existing tree spots and colliders kept | F4 tests | net −100 instances, +3 draw calls |
| **S5 Lab, career, houses (M2c/M2d)** | F5 | `BuildingKit.js`, `City.js` | Downtown | F5 tests | < +0.5 M tris |
| **S6 Stylised asset kit (needs approval)** | F6 character, plus optional CC0 prop/tree kit (Kenney City Kit, KayKit City Builder, Quaternius) | `Assets.js`, `Player.js`, `Pedestrians.js` | Ferrari, physics | No T-pose, blends correct, payload < +4 MB | ≤ +4 MB, ≤ +10 draw calls |
| **S7 Polish** | F9, F10, fifth fixed view | `City.js`, `style.css`, `DevCapture.js` | — | HUD covers < 8 % of screen | — |

Every stage: `npm run build`; console clean; `docs/m2a/world-fingerprint.js` (colliders, trees, palms,
parked, props identical unless the stage explicitly owns them); regression checklist; draw calls ≤ +20
per view versus M2b; idle-browser frame time ≤ 17.5 ms p95.

## 5. Risks
- **Determinism:** S3 and S4 add placements; they must use their own seeded generators and never the
  shared stream (same tripwire pattern as M2b), or trees and props will move.
- **Colliders:** new curbs, hedges and props stay visual-only unless a stage explicitly adds colliders and
  re-verifies mission reachability.
- **Performance:** vertex AO and palettes are free; vegetation and props must be instanced; a character
  swap changes skinned-mesh cost (measure with 14 pedestrians).
- **Expectation:** code-only stages S1–S5 get to a clean, cohesive stylised city. Matching the reference
  images' prop density and softness needs S6 assets; without them the result will stay "clean
  procedural", not "hand-crafted".
