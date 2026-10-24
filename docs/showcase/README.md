# Showcase block, gait fix, asset shortlist and NPC / gameplay roadmap

Branch `m2-building-kit`, all uncommitted (on top of M2a `623fed2`, plus M2b, S1, S1.1 and the render fix).

## 1. Fullscreen render fix — re-verified, unchanged
Viewport harness (`docs/render-fix/viewport-harness.js`): fresh load 1280×720 → canvas, composer and SMAA all
1920×1080; 1920×1080 → 2880×1620; full display 1470×956 → 2205×1434; camera aspect correct at every size;
16.65–16.67 ms average frame time (measured before the machine became GPU-contended, see §5).

## 2. Showcase block (downtown block 3,1 — the two south lots)
Chosen because it is what the fixed `downtown` view looks at, it lies on the "Shipped It" route, it has two
street faces (road row 2, road column 3), and its margins hold no mission points, billboards or cones.

`src/game/Showcase.js` (new, procedural, no downloaded assets):
- **Building A — brick walk-up:** running-bond brick texture; facade built from piers, spandrels and lintel
  bands that project 0.22 m so every window has a real reveal; double-hung sash frames, blinds, stone sills
  and lintels; belt course, dentilled cornice, corner quoins; five-storey fire escape with stairs and drop
  ladder; AC units; rooftop water tower.
- **Building B — painted clapboard over a shop:** violet siding texture, white casings, green shutters, bay
  window, bracketed eave, corner boards, plaster ground floor.
- **Café "Code & Coffee":** 0.6 m projecting shopfront with pilasters, fascia sign, display windows, recessed
  door, clear glass and a painted interior card (menu board, shelves, counter, pendant lamps) with real
  parallax; striped awning with scalloped valance and cheeks; round blade sign. **"Pixel Books"** second
  shop with its own interior.
- **Street:** curbs and gutter, patterned pavers, three tree pits with street trees, hydrant, bins, bench,
  bike rack, news boxes, bollards, mailbox, café tables and chairs, planters, A-board, alley gate.
- Night: interiors and signs glow through the existing night hook.

Integration (`City.js`, `BuildingKit.js`): 8 new buckets appended after the existing ones (merge order of
everything else unchanged). The two south lots still run their original downtown typology into a throwaway
bucket set, so they consume the same random draws and the block's two north towers stay identical. Lot
rectangles and colliders unchanged; showcase props are visual-only (no colliders).

## 3. Pedestrians: sliding and resting (`Player.js`, `Pedestrians.js`)
Cause of sliding, measured: the Soldier walk clip covers 1.557 m/s and run 4.001 m/s (foot-bone stance
speed). The old blend played walking pedestrians at ~44 % walk + 56 % idle, so legs made half strides while
the body moved at full speed. Now: `measureGait()` measures each rig once; idle only below 0.5 m/s; playback
rate = speed ÷ natural speed. Mean foot slip 0.91 → 0.11 m/s (peaks ≤ 1.1 m/s only during 0.5 s start/stop
blends). Pedestrians now rest 3–10 s every 8–26 s (own seeded generator, spawn positions unchanged).
Also fixed: walkers were drawn 0.18 m above the road (they inherited the sidewalk height).

## 4. Verification
- `npm run build` passes; console clean; no missing assets.
- Fingerprint: static colliders, trees, palms, parked cars, props and all 248 non-building meshes identical.
- Regression: player blocked by the showcase building face; car stops at it and stays grounded; walk/run
  blend; camera modes; enter/exit; barrel chain; token; "Shipped It" through all three cards to
  "MISSION PASSED"; map; night 1.0 / day 0; save persists (test save cleared).
- Static metrics (pedestrians, markers, traffic hidden; 2004×1015 at 1.5×), S1.1 → showcase:
  skyline 264 → 273 calls, 1.98 → 2.01 M tris; downtown 151 → 160, 1.97 → 2.00 M; residential 348 → 364,
  3.52 → 3.57 M; pier 177 → 178. Showcase = 8 meshes, 13.9 k triangles, 6 canvas textures (≈ 7 MB GPU), 0 KB download.

## 5. Performance caveat
Late in the session the whole machine became GPU-bound: a fresh idle load ran 26 ms/frame and GPU time was
~25 ms on every view (earlier sessions: 1–8 ms). Two Chrome renderer processes were busy, consistent with a
second copy of the game open. With the showcase hidden vs shown the GPU time was within noise. **Re-measure
frame times with all other game tabs closed before signing off.**

## 6. Asset shortlist (licences verified on the official pages)

| Pack | Source | Licence | Formats | Contents relevant to us | Size |
| --- | --- | --- | --- | --- | --- |
| Ultimate Modular Women | quaternius.com/packs/ultimatemodularwomen.html | CC0 (pack page) | glTF, FBX, Blend | 10 characters (Casual, Formal, Suit, Worker, Punk, Adventurer…), 24 animations, humanoid-rig version | not listed |
| Ultimate Modular Men | quaternius.com/packs/ultimatemodularcharacters.html | CC0 (pack page) | glTF, FBX, Blend | 11 incl. **Beach** (swimwear), Casual_2, Casual_Hoodie, Suit, Worker; 24 animations | not listed |
| KayKit City Builder Bits | kaylousberg.itch.io/city-builder-bits | CC0, no attribution | GLTF, FBX, OBJ | 32+ city models (free tier), one 1024² gradient atlas (downsizable to 128²) | 4.6 MB zip |
| Kenney City Kit (Commercial) v2.1 | kenney.nl/assets/city-kit-commercial | CC0 | (not listed on page) | 50 files: commercial buildings | not listed |
| Kenney City Kit (Suburban) v2.0 | kenney.nl/assets/city-kit-suburban | CC0 | (not listed) | 40 files: houses | not listed |
| Kenney City Kit (Roads) | kenney.nl/assets/city-kit-roads | CC0 | (not listed) | 90 files incl. traffic lights, signs, dumpster | not listed |
| Quaternius Universal Base Characters / Animation Library (fallback) | quaternius.itch.io | CC0 | glTF/GLB (+engine exports) | bases in minimal clothing, ~13 k tris; 45 free animations incl. sitting, swimming, root-motion option | 122 MB / 15 MB zips |

Note: quaternius.com's site-wide licence page now shows the "Quaternius Asset License v1.0" (28 Aug 2026:
commercial use, no attribution, no resale of the assets), while the two modular packs' own pages still show
CC0. Either permits shipping them inside the game.

**Download status:** the approved Women/Men packs are hosted on Google Drive, which currently refuses
anonymous downloads ("Quota exceeded") for every file tried. Retry later or download them yourself into
`public/assets/models/characters/` (glTF subset only). The only other copy found was a third-party itch.io
mirror, not used.

Rig compatibility: both packs use Quaternius's humanoid rig with named clips; `makeSoldier()` already clones
any skinned glTF and `measureGait()` adapts playback to each rig. Integration = clip-name mapping (Idle,
Walk, Run, plus Sit/Wave if present), scale check (1.8 m), facing check, and per-character tint variants.

## 7. NPC system plan (after assets arrive)
1. Loader: one `CharacterLibrary` loading the chosen glTFs once; shared materials; outfit and tint variants.
2. Test harness on one character: bind pose, idle/walk/run blend, no root-motion drift, foot grounding,
   facing, camera framing, no T-pose — before replacing the Soldier.
3. Pedestrian roster: 8–12 visible; city outfits on sidewalks, **Beach** outfit + women's lighter outfits on
   the beach and pier, lounging/standing idles there.
4. LOD: mixers update every frame < 30 m, every 2nd frame < 60 m, every 4th < 90 m, frozen beyond.
5. Sidewalk routing with avoidance of props (needs a nav strip per block; current loop runs on the road edge).

## 8. Future gameplay architecture (interfaces only, not implemented)
- `PedestrianBrain` state machine: idle → walking → avoiding → reacting → fleeing → recovering; input:
  route, nearby threats (player speed/vehicle), output: target speed + heading for the locomotion layer.
- `Drivable` interface: `{ seats, enter(actor), exit(actor), controller, handling }`; Ferrari becomes the
  first implementation unchanged; parked/traffic cars gain `Drivable` on demand; theft = owner NPC reaction.
- `Combat` (non-graphic, fictional): hit → stagger → knockdown → recover; separate from locomotion.
- `Wanted` meter: events (theft, collisions, combat) raise heat; police AI spawns from road graph; escape by
  breaking line of sight + timer. Missions, rendering and vehicle physics stay independent.

## 9. Screenshots
`before/` (street, drive, corner by day; street, corner by night) and `after/` (same views + downtown fixed
view). Camera positions are in `Showcase` notes: street (x0+12, 1.7, zS+6.5), corner (x0−9, 2.2, zS+9),
drive (x0+48, 3.0, road2+2.5) with x0 = blockStart(3), zS = blockStart(1)+36. The window height changed
from 728 to 677 px between the before and after sessions (same camera, slightly shorter frame).
