# Asset manifest

Measured on 2026-10-24. "Ships" means the file is in `public/` and therefore in the production build.
Sizes of shipped files are the files in `public/` (identical in `dist/`). Source archives stay outside the
repository (`~/Desktop/akshat-city-asset-intake/`, extracted copies) and in the repo root as ignored zips.

## Shipped files added on this branch (beyond `main`)

| File in `public/` | Bytes | Built from (source pack → files) | Licence record | In-game use |
| --- | --- | --- | --- | --- |
| `assets/models/city/downtown-kit.glb` | 1,176,352 | Quaternius Downtown City MegaKit [Standard], `Exports/glTF (Godot)/`: Metal_FullWindow, Metal_Window_Half, Metal_FirstFloor_Window, Metal_FirstFloor_Wall, Metal_Plain_3, Metal_Column_Center, Cornice_Metal_Center, Brick_Inset_Window_Curved, Brick_Window_Square_Single, Brick_Plain_3_noWear, Brick_TopTrim, Brick_BottomTrim, Cornice_Brick_Center, Cornice_Trim_Center, Trim_Column_Center, Roof_SlateCornice_Center, Roof_Slate_Center, DoorFrame_Metal_Single, Prop_Bollard, Prop_Planter_Single, Sidewalk_Planter, Prop_ACUnit (22 modules; 18 textures resized 2048→512, JPEG) | CC0 1.0, `licenses/downtown-city-megakit-License_Standard.txt` | Benchmark block (4,1) facades, cornices, roofs, street props |
| `assets/models/city/nature-kit.glb` | 1,249,112 | Quaternius Stylized Nature MegaKit [Standard], `glTF/`: Pine_3, CommonTree_3, Bush_Common, Bush_Common_Flowers, Plant_1, Flower_3_Group (7 textures resized to ≤512) | CC0 1.0, `licenses/stylized-nature-megakit-License_Standard.txt` | Street trees, terrace planting, flower planters (Pine_3, Plant_1, Flower_3_Group packed but not yet placed) |
| `assets/tex/T_lit_interior_1.jpg` | 70,744 | Downtown City MegaKit `T_lit_interior_1.png` (2048→512 JPEG) | CC0 1.0 (same pack) | Room image behind kit windows |
| `assets/tex/T_lit_interior_2.jpg` | 47,294 | Downtown City MegaKit `T_lit_interior_2.png` | CC0 1.0 (same pack) | Room image behind kit windows |
| `assets/tex/T_dark_interior.jpg` | 45,228 | Downtown City MegaKit `T_dark_interior.png` | CC0 1.0 (same pack) | Room image behind kit windows |
| `assets/models/characters/*.glb` (12 mesh-only GLBs, 178–239 KB each, + `anims-men.glb` 391 KB, `anims-women.glb` 398 KB) | 3,177,296 | Men: `M_Casual_Hoodie` (player), `M_Casual_2`, `M_Suit`, `M_Worker`, `M_Beach`, `M_Swat` (police officers) from Ultimate Modular Men `Individual Characters/glTF/`; Women: `W_Casual`, `W_Formal`, `W_Suit`, `W_Worker`, `W_Punk`, `W_Adventurer` from Ultimate Modular Women. Characters ship as meshes + skeleton only; the two shared animation sets bind by bone name. Clips kept from the packs: Idle, Idle_Neutral, Walk, Wave, Interact, Punch_Left, Punch_Right, Kick_Right, HitRecieve, Death, Roll. Baked offline from the Universal Animation Library: Run ← Jog_Fwd_Loop, Dance ← Dance_Loop, Sit ← Sitting_Idle_Loop, Talk ← Idle_Talking_Loop. Meshopt-compressed (`tools/retarget/build-roster.mjs`) | Men / Women packs: CC0 per the official pack pages (the zips have no licence file). UAL: CC0 1.0, `licenses/universal-animation-library-License.txt` | Player, pedestrians, police officers, combat crew, club staff and patrons |
| `assets/models/animals/*.glb` (HolsteinCow, Calf, Sheep, Lamb, Pig) | 513,052 | Gobkit Free Animal Pack Vol.3, copied unchanged | CC0 1.0, `licenses/gobkit-farm-pack-LICENSE.txt` | Urban farm meadow in Central Park (block 2,4) |
| `assets/models/vehicles/kenney-cars.glb` | 109,984 | Kenney Car Kit 3.1, `Models/GLB format/`: sedan, suv, van, police (one shared 12 KB palette texture, meshopt; `tools/assets/build-cars.mjs`) | CC0 1.0, `licenses/kenney-car-kit-License.txt` | Parked cars (sedan / SUV / van, repainted per car) and the cars you steal from them; police pursuit cars |
| `assets/models/city/village-kit.glb` | 1,335,456 | Quaternius Medieval Village MegaKit [Standard], `glTF/`: 20 modules (plaster / uneven-stone walls with arched window and door, timber corners, arched windows, shutters, door, balcony, round-tile roofs 8x8 and 8x10, gable, chimney, three vines, uneven-stone floor); textures resized to 512, JPEG (`tools/assets/build-kit.mjs`) | CC0 1.0, `licenses/medieval-village-megakit-License_Standard.txt` | Grove Street village houses (Village.js); cobbled sidewalks |
| `assets/tex/aerial_rocks_02_diff.jpg`, `assets/tex/rock_face_03_diff.jpg` | 239,754 | Poly Haven `aerial_rocks_02`, `rock_face_03`, 1k colour maps resized to 512 (downloaded 2026-10-24 at the user's request) | CC0 1.0, `licenses/polyhaven-*-SOURCE.txt` | Scenic terrain: mountain rock and cliff faces (Scenery.js) |
| **Total added** | **7,964,272 (7.96 MB)**, 2026-10-24 | | | Budget: 10 MB |

`assets/models/Soldier.glb` (2.16 MB, already on `main`) still ships but is only downloaded if the civilians fail to load.

Build tools (not shipped): `tools/assets/build-kit.mjs`, `tools/retarget/*.mjs`. They read the extracted
packs and write the files above; re-running them reproduces the shipped bytes (verified for the character).

## Inspected, not shipped

| Pack | Local path | Format, size | Licence | Status |
| --- | --- | --- | --- | --- |
| Ultimate Modular Men (other 10) | `.../individual-characters/` | glTF ~3 MB each before trimming | CC0 per pack page | Stage 2 candidates (Beach, Casual_Hoodie, Suit, Worker) |
| Universal Animation Library | `.../universal-animation-library/` | 2 GLB 7.6 MB each, 43 clips, Unreal-style skeleton | CC0 1.0 (file) | Jog, Dance_Loop, Sitting_Idle_Loop and Idle_Talking_Loop are baked and shipped (above). It has no pole-performance clip, so the club's stage performer is pending |
| Modular SciFi MegaKit | `.../modular-scifi-megakit/` | 190 glTF, spaceship-interior walls/platforms/columns, 2048 PBR | CC0 1.0 (file) | Not used: interior kit; candidate for the career-office interior (Stage 5) |
| Sci-Fi Essentials Kit | `.../scifi-essentials-kit/` | 37 glTF: desks, lockers, shelves, chairs, mugs; also weapons and enemies | CC0 1.0 (file) | Not used; office props possible in Stage 5; weapons/enemies excluded |
| Gobkit Free Animal Pack Vol.3 (other 5) | `.../gobkit-farm-pack/` | Bull, HighlandCow, SpottedPig, BlackSheep, Piglet GLBs | CC0 1.0 (file) | Not used yet |
| Kenney Car Kit 3.1 (other 41 models: taxi, ambulance, delivery, trucks, karts, race cars, debris…) | `~/Desktop/akshat-city-asset-intake/kenney-car-kit/` (from `kenney_car-kit.zip`) | GLB ~2k triangles each, shared palette | CC0 1.0 (file) | Not used yet; traffic still uses the Ferrari LOD |
| `ferrari_mid.glb` (56k-triangle police / stolen Ferrari, built this branch) | moved to `~/Desktop/akshat-city-asset-intake/retired/`; rebuild with `scripts/make-car-mid.mjs` | 198 KB | CC-BY (Ferrari) | Retired: replaced by the Kenney police car and parked models |
| Universal Base Characters [Standard] | `.../universal-base-characters/` | base bodies in underwear + hairstyles, glTF/FBX | CC0 1.0 (file) | Not used: no clothing in the free version, so unsuitable as street NPCs |
| Medieval Village MegaKit (other ~156 modules) | `.../medieval-village-megakit/` | glTF, 2048 PBR | CC0 1.0 (file) | Available for later (stairs, overhangs, fences, wagon, towers) |
| Poly Haven normal / ARM maps for the two rock sets | `.../polyhaven-aerial_rocks_02/`, `.../polyhaven-rock_face_03/` | 1k JPG | CC0 | Downloaded, not shipped (the terrain uses colour maps only) |
| KayKit City Builder Bits, Kenney City / Racing kits, hover-car / flying-vehicle packs | not found on this machine | – | – | Not available locally |
| Extra Poly Haven / ambientCG materials or HDRIs | not found on this machine (only the ones already in `public/`) | – | – | Not available locally |
| Audio files | none in the repo or the downloads; `Audio.js` synthesises sound with Web Audio | – | – | Stage 6 can only use synthesised audio unless files are supplied |

## Previously shipped (unchanged)
`assets/hdr/sky_2k.hdr` (Poly Haven, CC0), `assets/models/ferrari.glb` + `ferrari_lod.glb` (“Ferrari 458 Italia”
by vicent091036, CC-BY, via three.js examples), `assets/models/Soldier.glb` (Mixamo via three.js examples),
`assets/tex/aerial_grass_rock_*` (Poly Haven, CC0), `assets/tex/waternormals.jpg` (three.js examples).
In-game credits (`index.html`, Credits) now also name the Quaternius packs.
