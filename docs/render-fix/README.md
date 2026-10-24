# Fullscreen rendering audit, fix, and art-direction plan

## 1. Root cause (proven)

Machine: macOS, Chrome 155, display 1470×956 CSS at devicePixelRatio 2.2. Renderer pixel ratio is capped at
1.5 by design (`main.js`, quality "high").

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | **Composer born at CSS size.** `createPostfx()` built its render target from `renderer.getSize()` (CSS pixels) and passed it to `EffectComposer`, which then never resized until a `resize` event. Every frame rendered at 1× and was stretched onto the 1.5× canvas. | Fresh load, no resize event: canvas 2004×1092, composer 1336×728. Fresh load in a 1280×720 viewport: canvas 1920×1080, composer 1280×720. |
| 2 | **SMAA resized in CSS pixels.** `resize()` called `smaa.setSize(w, h)` after `composer.setSize()` had already sized it in device pixels. | After any resize (including entering fullscreen): composer 2205×1434 but SMAA 1470×956. |
| 3 | **Stale composer pixel ratio.** The composer stores the pixel ratio at construction; the adaptive scaler changed the renderer's ratio without telling it. | Forced ratio 0.85: canvas 816×459, composer still 1440×810. |

So: windowed play was blurry from load (1), and fullscreen fixed the scene resolution but left antialiasing at
0.67× (2). On slower hardware the adaptive scaler would add a third mismatch (3). The adaptive scaler did not
lower the ratio on this machine at any tested size (stayed 1.5), so it is not the cause here.

Ruled out: camera aspect (correct at every size), CSS sizing (`#game` fills the viewport 1:1), bloom (its targets
follow the composer, half resolution by design), textures (procedural canvases at anisotropy 8, mipmapped),
browser or screenshot scaling (the defect is visible in raw `readPixels`-sized buffers and reproduces in a
same-origin iframe at exact sizes).

## 2. Fix (2 files)

- `src/game/Postfx.js`: `new EffectComposer(renderer)` (it creates HalfFloat targets at CSS × pixel ratio);
  `resize(w, h, pixelRatio)` calls `composer.setPixelRatio(pixelRatio)` then `composer.setSize(w, h)`; the
  separate SMAA resize is removed.
- `src/main.js`: `resize()` passes `this.dpr` to the post stack.

Tone mapping, colour space, pass order (render → bloom → grade → output → SMAA), night mode and materials are
unchanged. No new render targets.

## 3. Measurements (viewport harness, downtown view, game running)

| CSS viewport | Canvas buffer | Composer | SMAA before → after | Frame avg / p95 |
| --- | --- | --- | --- | --- |
| 960×540 | 1440×810 | 1440×810 | 960×540 → 1440×810 | 16.68 / 17.8 ms |
| 1280×720 | 1920×1080 | 1920×1080 | 1280×720 → 1920×1080 | 16.68 / 17.7 ms |
| 1470×956 (full display) | 2205×1434 | 2205×1434 | 1470×956 → 2205×1434 | 16.67 / 17.1 ms |
| 1920×1080 | 2880×1620 | 2880×1620 | 1920×1080 → 2880×1620 | 16.65 / 17.7 ms |

Fresh-load composer before → after: 1280×720 → 1920×1080. Forced ratio 0.85 after the fix: canvas, composer and
SMAA all 816×459. 80+ consecutive resizes: geometries 269, textures 95, unchanged (no accumulation); frame time
16.65 ms afterwards. GPU-ms readings from inside the iframe were too noisy to rank sizes (0.7–1.8 ms).

Static metrics (pedestrians, markers, traffic hidden; 2004×1092): skyline 255 calls / 1.98 M tris, downtown
150 / 1.98 M, residential 338 / 3.53 M, pier 177 / 1.98 M — identical to S1.1 (the fix changes sizes, not
geometry). World fingerprint: colliders, trees, palms, parked cars, props, non-building meshes and all
building buckets identical. Regression pass clean.

Screenshots (same camera): `before-fresh-load-1280x720.png`, `before-after-resize-1280x720.png`,
`after-fresh-load-1280x720.png`, `before-fresh-load-native-window.png`. The harness is `viewport-harness.js`.

Not tested: true OS fullscreen (needs a user gesture; covered by the 1470×956 viewport), a 1× display,
integrated or mobile GPUs, Safari and Firefox.

## 4. Art direction gaps vs the stylised-NYC reference (prioritised)

| Priority | Gap | Technique |
| --- | --- | --- |
| 1 | Flat surfaces: no brick, siding, tile or paving pattern | Texture atlas (4–6 tileable stylised materials) on existing buckets; real geometry not needed |
| 2 | Facades lack depth: windows sit proud, no reveals, no bevels, cornices are slabs | Modular facade GLB pieces (window bays with recess, bevelled corners, cornice profiles) placed by the BuildingKit |
| 3 | Empty street level: no hydrants, bins, benches, planters, signs, bollards, newspaper boxes | Instanced props from a CC0 kit, rule-placed (crossings, entrances); visual-only |
| 4 | Ground: no curbs, patterned sidewalks, tree pits, lawn breakup | Procedural curb strip + paving texture + tree-pit and planter props |
| 5 | Building life: no fire escapes, AC units, pipes, balconies with railings, awnings with depth | Instanced facade attachments from the kit, rule-placed on side/back faces |
| 6 | Vegetation: one tree, no shrubs or flowers | 3–4 instanced tree/shrub models from a CC0 nature kit |
| 7 | Character mismatch (realistic Soldier) | Stylised CC0 rigged character with idle/walk/run |
| 8 | Lighting polish | Keep golden-hour lighting; add contact shadow decals under props once props exist |

Real geometry: facade modules, cornices, curbs, awnings. Instanced props: everything at street level, trees,
AC units, fire escapes. Materials/atlases: brick, siding, tile, paving, asphalt wear. Shading: existing baked
vertex colours.

## 5. Asset shortlist (for approval; nothing downloaded)

Licences and contents are from my knowledge of these kits and must be re-checked on download. Sizes are
estimates of the subset we would use after Draco/meshopt compression, not measured.

| Kit | Licence | Use | Est. payload (subset) | Notes |
| --- | --- | --- | --- | --- |
| Kenney City Kit (Commercial) + City Kit (Suburban) | CC0 | Facade modules, shopfronts, roofs, houses | 1.5–3 MB | Low-poly, clean bevels; colour via palette texture — matches our flat-shaded style |
| Kenney City Kit (Roads) | CC0 | Curbs, crossings, street furniture | 0.5–1 MB | May overlap our road code; use props only |
| KayKit City Builder Bits (Kay Lousberg) | CC0 | Props, buildings, vegetation, street furniture | 1–2 MB | Chunky stylised look closest to the references; one shared texture |
| Quaternius Ultimate Modular City / Buildings packs | CC0 | Alternative facade modules | 2–4 MB | Check which packs are CC0 vs paid |
| Quaternius Ultimate Animated Character Pack | CC0 | Player + pedestrians | 2–4 MB | Own skeleton; clip names differ (map to Idle/Walk/Run in `blendLocomotion`) |
| KayKit Adventurers / Character Animations | CC0 | Alternative characters | 2–3 MB | Animations in a separate GLB on a shared rig; load once and bind |
| Poly Haven / ambientCG stylisable textures (brick, tiles, plaster) | CC0 | Material atlas | 1–2 MB at 1k | Only if the kit's palette texture is not enough |

Recommendation: one kit family for consistency — KayKit City Builder Bits for props and vegetation plus
Kenney City Kit for facade modules, and Quaternius characters. Estimated total ≤ 8 MB on top of today's
11.7 MB. Rig work: player and pedestrians share `makeSoldier`/`blendLocomotion`, so a swap is a loader and a
clip-name mapping, not a system rewrite.
