# Stage 0 audit + Stage 1 visual benchmark (block 4,1) — for review, not approved

Branch `m2-building-kit`, everything uncommitted. `main` untouched. No downloads, no new dependencies.
Art direction (updated by your note during this stage): **futuristic Milan meets the Italian coast** —
sculpted glass/metal core with restrained cyan light, next to Italian stucco, travertine and terracotta.
Toggle: the benchmark is on by default; `?benchmark=0` loads the original block for comparison.

## Stage 0 — audit and baselines

- Working tree: 11 modified + new files from M2b, S1/S1.1, render fix, showcase, gait/civilian, sidewalk
  collision, controls and driver work; all preserved. Zips are ignored via `/*.zip`.
- Assets on disk: the 11 user zips (extracted to `~/Desktop/akshat-city-asset-intake/`). KayKit, Kenney,
  extra Poly Haven/ambientCG material packs and audio files are **not** on this machine. Details and licences:
  `docs/assets/MANIFEST.md`.
- Block (4,1) checked before building: 4 lots of 13.2 × 13.2 m (collider tops 57.3 / 64 / 92.9 / 87.4 m),
  3.2 m alleys and sidewalk ring, no mission checkpoint, billboard, token or tree inside it (the "Shipped It"
  start marker is on the road 7 m north).
- Baselines on the default load (2004×1092 buffer, dpr 1.5, pedestrians and traffic visible):

| View | Draw calls | Triangles | GPU ms |
| --- | --- | --- | --- |
| skyline | 353 | 2.32 M | 1.42 |
| downtown | 227 | 2.32 M | 1.31 |
| residential | 463 | 4.05 M | 1.73 |
| pier | 243 | 2.31 M | 1.34 |

Build, "Shipped It", fullscreen sizes and a clean console were verified at the end of the previous stage in this session (sidewalk collision + run fixes), immediately before this work.

## Stage 1 — what was built (`src/game/Benchmark.js`)

Visual only. Lot footprints, the four collider boxes, the 64 slab colliders and all mission points are
unchanged (fingerprint below). The original typologies still run into a throwaway buffer, so the block's
random draws are unchanged.

| Lot | Building | Made from |
| --- | --- | --- |
| NE (tallest) | **Akshat Tower**: twisting (70°), tapering glass tower, champagne-gold fins, cyan light line every 3rd slab, planted terraces (Bosco Verticale nod), three-tier glass crown, violet + cyan halo, mast | Podium: kit metal modules (champagne). Tower: custom procedural geometry (the kits have no futuristic tower) with a canvas curtain-wall texture (lit panes at night only) |
| SE | Glass-and-metal tower, silver-blue metal, gold crown band with a cyan reveal | Kit `Metal_FullWindow` / `Metal_FirstFloor_Window` / `Metal_Plain_3` / columns / cornice |
| SW | **Torre**: Milanese rationalist tower — travertine arcade base, bronze glass bays framed by travertine piers, arched loggia crown, terracotta roof | Kit arched windows (re-materialled to stucco), trim columns, cornices, slate roof tinted terracotta |
| NW | **Palazzo**: ochre stucco, sienna piano nobile, rusticated arched base, corner quoins, deep cornice, terracotta mansard; the warm transition to the brick showcase block to the west | Kit arched + square windows (stucco), trim, cornice, roof modules. Drawn 22 m tall; its collider is 57 m (see decisions) |
| Streets | Travertine paseo through the block centre and round the perimeter, flush cyan light lines, gold medallion at the crossing, curb-side shade trees in planters, flower planters, bollards, lamps with cyan rings, travertine benches | Kit planters/bollards, nature-kit trees/bushes, procedural paving texture, lamps, benches |

Night: kit windows show room images (lit / dim / dark per window), the landmark's curtain wall lights up,
cyan and violet accents brighten, and additive warm **facade washes** and **lamp pools** floodlight the
Italian buildings (no real lights added).

Performance approach: every kit module part is one `InstancedMesh` shared by all four buildings (5,666
instances); procedural parts are merged per material. Kit textures are 512 px JPEG.

## Screenshots (1336×677 viewport, dpr 1.5, HUD hidden)

`day-1-establishing`, `day-2-street`, `day-3-driving`, `day-4-plaza`, `day-5-skyline`, `day-6-downtown` and
the same six as `night-*`. Camera positions are the `bench-*`, `skyline` and `downtown` views in
`akshatDev.views` (`src/game/DevCapture.js`), so they are repeatable.

## Measurements

| View | Draw calls off → on | Triangles off → on | Textures off → on |
| --- | --- | --- | --- |
| skyline | 361 → 419 | 2.33 → 2.76 M | 99 → 127 |
| downtown | 228 → 260 | 2.32 → 2.71 M | 99 → 127 |
| residential | 469 → 582 | 4.05 → 4.92 M | 100 → 128 |
| bench-establishing | 385 → 440 | 2.33 → 2.75 M | 108 → 136 |
| bench-street | 234 → 289 | 2.32 → 2.75 M | 108 → 136 |
| bench-driving | 461 → 515 | 2.33 → 2.76 M | 110 → 138 |
| bench-plaza | 218 → 272 | 2.32 → 2.75 M | 110 → 138 |

Frame time with the benchmark on (this Mac, one game tab, 60 Hz vsync): street 16.66 ms avg / 17.7 ms p95,
establishing 16.67 / 18.0, normal play 16.67 / 17.8 — the p95 ≤ 20 ms target holds. GPU ms per view stayed
within noise (0.9–1.9 ms either way). Shipped payload added on this branch: **2.95 MB** of the 10 MB budget
(1.18 MB downtown kit, 1.25 MB nature kit, 0.16 MB room images, 0.36 MB civilian). Load time was not measured
reliably (the dev server served from cache); network transfer grows by the 2.42 MB of benchmark files.

## Regression (benchmark on)

- Static colliders 276 (identical hash) + 64 slabs; trees, palms, parked cars, props, pedestrian spawns identical.
- "Shipped It" offered, three cards shown, passed; save data backed up and restored exactly.
- Fullscreen: canvas 2004×1015, composer and SMAA 2004×1015.5. Night 0 → 1 → 0 fade completes.
- `vite build` passes; console clean.

## Known issues and decisions for you

1. **No real plaza.** With lot footprints and colliders frozen, the only open ground is the 3.2 m paseo
   cross and the sidewalk ring. A proper piazza needs one lot (e.g. NW) freed of its collider — a collision
   change that needs your approval.
2. **Palazzo height.** It is drawn 22 m tall but its collider is 57 m. The extra collision volume is above the
   roof and unreachable on foot or by car, but it exists. Alternative: draw it 57 m (a tall palazzo) or lower
   the collider (collision change).
3. **Street props are visual only.** Planters, trees, benches, bollards and lamps have no colliders, so the
   player can walk through them. Adding small colliders changes collision geometry (approval needed).
4. **Repetition.** Only three room images exist, so the Torre's and the glass tower's windows repeat visibly
   up close; the SE tower still reads somewhat dark by day.
5. **Style gap.** The rest of the city is still flat procedural boxes, so the block stands out until the
   art direction is applied city-wide (Stage 1 expansion, after your review).
6. Sun glints on the landmark's gold fins read as bright strips at some angles by day.

Stopping here for your review before scaling the art direction to the rest of the city.
