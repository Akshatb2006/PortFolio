# M2b — downtown architecture

## Typologies (src/game/BuildingKit.js)
midrise (stone, punched windows, string courses, deep cornice) · slab (wide ribbon-glazed bar) ·
stepped (three setbacks with cornices) · point (slim tower, cap, entrance canopy) ·
curtain (glass tower with spandrels and mullions). Every downtown lot gets a podium with retail bays
(glass, pilasters, awnings, signs) on its two street faces.

Landmarks (tallest lot of the block): spire at 4,1 (stepped art-deco tower, lit crown, 22 m needle),
sloped glass crown at 3,0, octagonal glass tower with lit halo at 5,2.

## World fingerprint (docs/m2a/world-fingerprint.js)
| | M2a | M2b |
| --- | --- | --- |
| staticColliders | 276:b79eb74f | 276:b79eb74f |
| trees / palms | 94:eb727d63 / 10:7961e622 | same |
| parked | 30:64a74d6c:ce04b5f | same |
| props | 92:45f82461 | same |
| cityMeshes | 261:44b23171 | 261:e826f42c (expected) |

Per-mesh comparison against M2a served from a detached worktree: all 248 non-building city meshes
identical; the `brick` bucket (career + houses only) identical; the other 12 building buckets changed.

## Metrics (idle browser, 2004×1015, pixel ratio 1.5)
| View | Calls M2a → M2b | Triangles M2a → M2b |
| --- | --- | --- |
| skyline | 351 → 353 | 2.44 M → 2.30 M |
| downtown | 219 → 221 | 2.44 M → 2.29 M |
| residential | 467 → 471 | 4.23 M → 4.01 M |
| pier | 246 → 240 | 2.44 M → 2.29 M |
Frame interval 16.7 ms avg, 17.3 ms p95 (idle and driving). GPU readings 0.9–6 ms, too noisy to rank.
