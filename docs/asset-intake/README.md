# Asset intake report (no project files changed, nothing copied into `public/`)

All zips were extracted (after a path-safety check) into `~/Desktop/akshat-city-asset-intake/<pack>/`, outside
the repo. No scripts from the archives were run. The zips themselves still sit untracked in the repo root.

## 1. What each zip is

| Zip | Contents (verified by parsing files) | Licence |
| --- | --- | --- |
| Individual Characters-…204909Z | **Ultimate Modular Men**, 11 characters as glTF + FBX + Blend: Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker | No file in zip; CC0 per official pack page |
| All together-…204847Z | Men pack, all 11 in one FBX/Blend (`Humans_Master`) | as above |
| All together-…205123Z | **Ultimate Modular Women**, all 10 in one FBX/Blend: Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker | No file in zip; CC0 per official pack page |
| Separate Skeletal Meshes and Animations-… | Women pack as per-part FBX (Head/Body/Legs/Feet) + `Animations.fbx` | as above |
| Universal Animation Library[Standard] | 2 GLB + 2 FBX (standard and root-motion), mannequin mesh | CC0 (License.txt) |
| Downtown City MegaKit[Standard] | 153 glTF modular pieces, 29 PBR textures (2048²), FBX exports | CC0 (License.txt) |
| Stylized Nature MegaKit[Standard] | 68 glTF, 20 textures (mostly 2048²) | CC0 (License.txt) |
| Modular SciFi MegaKit / Sci-Fi Essentials Kit | 190 / 37 glTF | CC0, **not on the approved list** |
| gobkit-farm-pack | 10 animal GLBs | CC0, **not on the approved list** |

**Resolved:** the Women glTF set arrived later in `Individual Characters-20261023T210501Z-1-001.zip` (see section 7).

## 2. Character rig facts (Men glTF, measured)

- One skin, 62 joints, armature `CharacterArmature`; key bones `Hips`, `Head`, `Foot.L`, `Foot.R`.
  The Women FBX uses the same armature and bone names, so clips are shareable across both packs.
- Height 1.86–1.88 m in mesh units, root scale 1, no root rotation: no rescale needed (facing still to be
  checked in the viewer).
- 4–5 mesh parts, 5.8k–7.7k triangles, 7–10 flat-colour materials, **no textures**.
- Buffers are embedded base64 (≈3 MB per .gltf; ≈1 MB real binary).
- 24 clips, identical in both packs: Death, Gun_Shoot, HitRecieve, HitRecieve_2, Idle, Idle_Gun,
  Idle_Gun_Pointing, Idle_Gun_Shoot, Idle_Neutral, Idle_Sword, Interact, Kick_Left, Kick_Right, Punch_Left,
  Punch_Right, Roll, Run, Run_Back, Run_Left, Run_Right, Run_Shoot, Sword_Slash, Walk, Wave.
- Integration notes: `measureGait()` matches `/LeftFoot$/` and must also accept `Foot.L`; there are no sitting,
  talking or swimming clips in this rig.

## 3. Universal Animation Library (measured)

7.6 MB GLB each, 65 bones with Unreal-style names (`pelvis`, `thigh_l`, `foot_l` …), 43 clips including
Idle_Loop, Walk_Loop, Walk_Formal_Loop, Jog_Fwd_Loop, Sprint_Loop, Sitting_Enter/Idle_Loop/Talking_Loop/Exit,
Idle_Talking_Loop, Dance_Loop, Swim_Fwd_Loop, Swim_Idle_Loop, Driving_Loop, Interact, Push_Loop.
**Not directly compatible** with the Modular Men/Women rig (different bone names and hierarchy). Using its
sitting/talking/swimming clips on our civilians needs retargeting (`SkeletonUtils.retargetClip` plus a bone map
and a visual check), or its own mannequin mesh.

## 4. Trial optimisation (scratchpad only, measured)

Beach, Casual_2, Casual_Hoodie and Suit; kept 6 clips (Idle, Idle_Neutral, Walk, Run, Wave, Interact);
prune + dedup, then optionally meshopt + quantisation.

| Character | Plain GLB | Meshopt GLB | Meshopt gzip |
| --- | --- | --- | --- |
| Beach | 1.25 MB | 0.74 MB | 0.32 MB |
| Casual_2 | 1.19 MB | 0.73 MB | 0.31 MB |
| Casual_Hoodie | 1.22 MB | 0.74 MB | 0.32 MB |
| Suit | 1.36 MB | 0.77 MB | 0.34 MB |
| **Total** | **5.02 MB** | **2.98 MB** | **1.29 MB** |

All outputs keep their 62 joints and 6 clips. The meshopt files need `MeshoptDecoder`, which ships with
three 0.180 (`examples/jsm/libs/meshopt_decoder.module.js`, no new dependency). Quantisation split the single
skin into one skin per mesh part; that is valid glTF but must be checked in the browser (bind pose, no
T-pose) before use. Not yet viewed in the game.

## 5. Environment kits (measured per piece; subset sizes not yet measured)

| Piece | Triangles | Geometry | Textures |
| --- | --- | --- | --- |
| CommonTree_1 / CommonTree_3 / Pine_1 | 6.3k / 3.5k / 3.9k | 480 / 290 / 269 KB | bark + bark normal + leaves, 2048² PNG |
| Bush_Common, Rock_Medium_1 | 900, 342 | 90, 13 KB | one 2048² PNG each |
| Downtown `Building_Medium_2_001` | 25.6k | 2.4 MB | 15 PBR maps |
| Downtown modular wall / window / AC unit | 136–210 | 6–17 KB | 3–6 PBR maps (2048²) |

Textures dominate: the nature kit's PNGs total 37 MB and the downtown kit's 79 MB. Fitting the 10 MB budget
needs textures downsized (512–1024) and re-encoded (JPEG/WebP), normal maps dropped where they don't read at
game distance, and whole prebuilt buildings avoided in favour of modular pieces. These are planning
estimates until a subset is built and measured.

## 6. Proposed budget (to confirm before integration)

| Item | Size | Status |
| --- | --- | --- |
| 4 men civilians (meshopt) | 2.98 MB | measured |
| 4 women civilians (meshopt) | 2.96 MB | measured |
| Nature subset (3 trees, bush, rock, grass; 1024 textures) | 1–2 MB | estimate |
| Downtown modular subset for the benchmark block (512–1024 textures) | 1.5–3 MB | estimate |
| **Total** | **≈8.4–10.9 MB** | over budget at the top end, so trim one side |

## 7. Women glTF set (added later, measured)

`Individual Characters-20261023T210501Z-1-001.zip`: 30 files, safe paths, no symlinks; extracted to
`~/Desktop/akshat-city-asset-intake/women-individual-characters/`. 10 glTF characters plus FBX and Blend.
No licence file in the zip; CC0 per the official pack page.

| Character | Height (incl. hair/hat) | Triangles | Parts |
| --- | --- | --- | --- |
| Adventurer | 1.83 m | 6.8k | 4 |
| Casual | 1.85 m | 6.4k | 4 |
| Formal | 1.84 m | 6.1k | 4 |
| Medieval | 1.90 m | 7.3k | 5 |
| Punk | 1.96 m | 6.0k | 4 |
| SciFi | 1.88 m | 8.0k | 5 |
| Soldier | 1.83 m | 7.9k | 4 |
| Suit | 1.85 m | 6.5k | 4 |
| Witch | 2.05 m | 6.9k | 4 |
| Worker | 1.86 m | 6.1k | 4 |

Every file has one skin with the **same 62 bones in the same order as the Men pack**, the same 24 clips,
root scale 1, no root rotation, no textures, embedded buffers. One clip set can therefore drive all 21
characters; storing clips once instead of per file would save about 0.09 MB per character.

Trial (Casual, Formal, Suit, Worker; same 6 clips and settings as section 4):

| Character | Plain GLB | Meshopt GLB | Meshopt gzip |
| --- | --- | --- | --- |
| Casual | 1.24 MB | 0.74 MB | 0.32 MB |
| Formal | 1.21 MB | 0.73 MB | 0.31 MB |
| Suit | 1.24 MB | 0.74 MB | 0.32 MB |
| Worker | 1.21 MB | 0.74 MB | 0.31 MB |
| **Total** | **4.90 MB** | **2.96 MB** | **1.26 MB** |

All outputs keep 62 joints and the 6 clips. Same caveat as the men: the meshopt files split the skin per
mesh part and still need a browser check. The Women pack has no swimwear outfit; beach women would need
the Casual outfit or a recolour.
