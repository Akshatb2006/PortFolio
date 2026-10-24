# S1 — legacy window fix and controlled lighting pass

Folders: `before/` (M2b state, lab + career; the four standard views are in `docs/m2b/`),
`after-windows/` (Part A only, old lighting = lighting "before"), `after/` (Part A + Part B).
Extra views (lab, career) are parked cameras: lab at (roadCoord(1)+4, 3, blockStart(1)+BLOCK+8) looking at
block (0,1); career at (roadCoord(7)-4, 3, same z) looking at block (7,1).

## Part A — windows (src/game/City.js windows())
- Frame box moved from +0.02 to −0.04 (front face +0.01, glass at +0.03): glass no longer occluded.
- Black 0.28 m "shadow strip" removed: it read as a dark band across every window.
- Pale blinds (65 %) or curtain pairs (35 %) on 55 % of unlit windows, chosen by a hash of window position,
  so the building's random sequence (colours, roofs, lit pattern) is unchanged.

## Part B — lighting (src/main.js, DAY / NIGHT constants)
Before: env 0.6, hemisphere 1.25 (#bcd4f5 / #a58a6e), sun 2.6. After: env 0.3, hemisphere 0.8
(#a6c1ec / #b08a64), sun 3.3. Night endpoints unchanged (env 0.05, hemisphere 0.3, sun 0.4).

Light-isolation measurement, downtown view, mean luma of sun-facing vs shade-facing wall samples:
| Removed | sunlit | shade |
| --- | --- | --- |
| nothing (before) | 163 | 163 |
| sun | 127 | 154 |
| hemisphere | 152 | 149 |
| environment | 132 | 81 |
| all but sun | 108 | 26 |

Variant sweep (downtown sunlit/shade ratio, park grass luma): before 1.00 / 83; D 1.11 / 66;
E (chosen) 1.22 / 59; F 1.41 / 51.

## Fingerprint (vs pre-S1)
staticColliders, trees, palms, parked, props, 248 non-building meshes: identical.
Building buckets changed: trim, window, sill only (brick, concrete*, glassTower, roof, awning, metal,
shopGlass, shopSign identical).

## Metrics (idle browser, 2004×1015, pixel ratio 1.5)
| View | calls before → after | triangles before → after |
| --- | --- | --- |
| skyline | 353 → 359 | 2.30 M → 2.30 M |
| downtown | 221 → 223 | 2.29 M → 2.29 M |
| residential | 471 → 471 | 4.01 M → 4.00 M |
| pier | 240 → 240 | 2.29 M → 2.29 M |
Frame interval: idle 16.67 ms avg / 18.0 ms p95; driving 16.67 / 17.9.
