# Visual upgrade: Grove Street village + scenic ring (2026-10-24)

Uncommitted, on `m2-building-kit`. Browser-tested in Chrome, one tab, on AC power.

## 1. Grove Street village (`src/game/Village.js`)

All 33 house lots of the home district are rebuilt from the Quaternius Medieval Village MegaKit (CC0):
- rough-stone ground floors and coloured plaster upper floors (7 Italian tints);
- arched windows with shutters and lit rooms behind them at night;
- balconies, terracotta roofs with closed gables, chimneys, vines;
- flowers by each door and a cypress or bush at a front corner;
- cobbled sidewalks.

Akshat's House uses its village house's real arched door.

Visual only: footprints, colliders and every random draw are unchanged (the old house generator still runs into
a throwaway bucket). Each house's variation is seeded from its lot position.

Before / after: `grove-street-before.jpg` (the same view with `?benchmark=0`), `grove-street-after.jpg`.

## 2. Scenic ring (`src/game/Scenery.js`), outside the play boundary

| Element | What it is |
| --- | --- |
| Crown Mountains | One 3.2 km heightfield (205k triangles, no shadows) replacing the cones. A snow-capped ridge 0.5–1.4 km north, lower ranges east and west, coastal cliffs either side of the southern bay. |
| Terrain material | Blends grass, aerial rock, cliff rock on steep faces, shore sand and snow, sampled in world space. Its own thinner, cooler haze gives aerial perspective; it falls back to the night fog after dark. |
| Sapphire River | Carved along the north edge of the city and down the east side into the bay. Turquoise animated water. |
| Southern bay | Opens right at Sunset Pier. The sea is one ring of planes at the pier's water level; the terrain decides where water shows. |
| Celestial Bridge | Suspension bridge carrying the central avenue (road column 4) over the river. 62 m towers, cables and hangers, cyan edge lines and warm deck lamps that light up at night. 4k triangles. |

**Not reachable yet:** the bridge starts at the existing boundary wall, which is unchanged.

Rock textures: Poly Haven `aerial_rocks_02` and `rock_face_03` (CC0), downloaded at the user's request, colour
maps shipped at 512 px.

## Fixes made along the way

| Fix | Detail |
| --- | --- |
| Minimap orientation | The minimap rotated the world by `heading` instead of `heading + π`, so whatever was ahead was drawn below the arrow and the map slid against your movement. Now a point 30 m ahead shows straight above the arrow and a point to the right shows on the right, at any heading. |
| Marker labels | Labels draw over buildings; far away they were unreadable white chips showing through houses. They now show within 45 m. |
| Village house costs | Timber corner posts replace a 3.1k-triangle stone corner piece. Small window details no longer cast shadows. |
| Terrain shader | Textures were sRGB-decoded twice (too dark). Fixed. |

## Measurements

| Check | Result |
| --- | --- |
| Grove Street walk | p95 17.6 ms, max 19.2 ms, 0 hitches |
| Downtown with bridge and mountains in view | Day p95 17.4 ms; night p95 17.3 ms; ~2 ms GPU, ~490 draw calls, ~2.2 M triangles, 0 hitches, resolution scale 1.5 |
| World identity | Trees, palms, props, parked cars and all 311 non-parked static colliders identical to the recorded hashes |
| Console | No errors |
| Asset budget | 7.96 MB of 10 MB used (see `docs/assets/MANIFEST.md`) |

## 3. Waterfalls, cliffs, temple, viewpoint (`src/game/Landmarks.js`, sites shaped in `Scenery.js`)

All procedural; no new downloads, no shipped bytes added. Stone uses the village kit's rock-trim texture.

| Landmark | What it is |
| --- | --- |
| Hidden Falls | A 61 m mesa cliff north-west of downtown. An animated waterfall shader (streaks, foam, fog-aware) drops into a misty plunge pool; a stream winds from the pool to the river. |
| Bay Falls | A waterfall about 90 m down the western sea cliff into a cove. |
| Temple of the Bay | On a cliff terrace above the bay, in a canyon of cliffs: three-tier podium, colonnade (some columns broken, two fallen), sanctuary with pediment and sun disc, grand stairs into the lagoon, flooded courtyard (fountain, four statues, one toppled), a shrine façade carved into the cliff wall, six braziers. Floodlit warm at night. |
| Aurora Point | A round overlook on a 315 m summit of the eastern cliffs: railings with a cyan glow line, pavilion, two telescopes, lamps, sign. |
| Scenic Viewer | Coin viewer at the end of Sunset Pier (E). Tours Aurora Point, Hidden Falls, Temple of the Bay, Bay Falls and Celestial Bridge. A / D (or ← →) to switch, E or Esc to leave; Escape no longer also opens the pause menu during a cinematic. |

During the tour the shadow map is frozen and people, cars, markers and animals are hidden. They are sub-pixel
from these vistas, and each character costs ~20 draw calls. Everything is restored on exit (verified).

The camera far plane went from 1,200 to 3,200 m so the ranges are not clipped in normal play. No z-fighting was
seen on road markings.

Screenshots: `hidden-falls.jpg`, `temple-of-the-bay.jpg`.

### Measurements (Chrome, AC power, one tab, 60 Hz)

| View | p95 | Draw calls | Hitches > 33 ms |
| --- | --- | --- | --- |
| Downtown walk | 17.8 ms | 482 | 0 |
| Pier facing the bay | 17.8 ms | 424 | 0 |
| Viewer: Hidden Falls / Temple / Bay Falls / Bridge | 17.6–17.8 ms | 269–296 | 0 |
| Viewer: Aurora Point (whole city in view) | 17.4 ms | 522 (was 1,528–1,662 before the tour hides) | 0 in two 10 s runs |

**One exception:** a single 139 ms frame on the very first Aurora visit. It's within the one-time allowance and
did not recur.

- **Viewer controls:** opens at 1.0 / 1.5 / 2.2 m (reach 2.4 m); closes with E and with Escape; input restored.
- **World identity:** trees, palms, props, parked cars and all 311 non-parked static colliders unchanged.
- **Console:** clean.
- **Asset budget:** unchanged at 7.96 / 10 MB.

## Still to do

- **Skyway and observation wheel** (the next item in the build order).
- **Reachable landmarks:** making the bridge, Aurora Point or the temple reachable needs the north / outer
  boundary opened and a driveable road. That's a gameplay change needing its own acceptance pass; for now the
  Scenic Viewer is the way to see them.
- **Underground hangout at Hidden Falls:** not built. The falls exist, but no cave or collectible yet.
