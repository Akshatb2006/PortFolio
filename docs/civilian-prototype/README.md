# Civilian prototype, controls fix and visible driver (uncommitted)

Branch `m2-building-kit`. The Soldier stays the default player and pedestrian model. The civilian only loads
with `?civilian=1`; a normal load fetches no character file and the world fingerprint is unchanged.

## Files
| File | Change |
| --- | --- |
| `public/assets/models/characters/Casual_2.glb` | new, 726,104 bytes. Quaternius Ultimate Modular Men "Casual_2" (CC0 per pack page), 6 clips, prune + dedup + meshopt |
| `src/game/Characters.js` | new. `makeCharacter` (clip-role map, facing, shared materials), `CivilianTest`, dev measurements on `akshatDev.civilian` |
| `src/game/Assets.js` | `loadCivilian()` with a lazily imported `MeshoptDecoder` (three 0.180 built-in) |
| `src/game/Player.js` | `isLeftFootBone` (Mixamo, `Foot.L`, `foot_l`), clip map in `measureGait`; tank-style on-foot control; `applySeatPose`, `seatIn`, `unseat` |
| `src/game/Vehicle.js` | steering input inverted (right arrow turns right), slower wheel swing, less lock at speed |
| `src/main.js` | flag-gated `initCivilian`; on-foot control call; seat the player on entering the car; hide the body in first-person driving |

## Character checks (Casual_2, in game)
| Check | Result |
| --- | --- |
| Skeleton | 1 skin, 62 joints; GLTFLoader names `FootL` / `FootR` (dots stripped) |
| Clips mapped | Idle → `Idle`, Walk → `Walk`, Run → `Run` |
| Height | 1.81–1.85 m (varies with pose) |
| Feet vs ground | −0.001 to −0.008 m |
| T-pose | no; upper arm 59–68° below horizontal at idle |
| Facing | correct with no extra rotation (planted foot moves backwards: cosine −1) |
| Materials | 9, shared with the source glTF (no per-character clones) |
| Gait (foot-bone measured) | Walk 1.38 m/s, Run 3.00 m/s; Soldier unchanged at 1.557 / 4.001 |

## Foot slip (mean of both feet, planted = within 3 cm of lowest point)
| Speed | Clip | Slip m/s | ≤ 0.15 |
| --- | --- | --- | --- |
| 1.0 | Walk | 0.111 | pass |
| 1.4 | Walk | 0.144 | pass |
| 1.8 | Walk | 0.182 | fail |
| 3.0 | Run | 0.561 | fail |
| 3.8 | Run | 0.700 | fail |
| 4.6 | Run | 0.796 | fail |
| 5.5 | Run | 0.839 | fail |

Cause (measured in the clips themselves, not the playback code): the Walk clip's planted-foot speed varies
about 11 %, so the best possible slip is 0.149 m/s at its natural 1.33 m/s and grows with speed. The Run
clip's right-foot contact speed ranges 1–4 m/s, so its best possible slip is 0.69 m/s at any rate. The Run
loop is also not closed: the pose jumps 7.8 cm (left hand/arm) at the loop seam every 0.8 s. Idle and Walk
loops close (0 and 0.17 cm).

## Controls (measured with synthetic key presses)
- On foot: right arrow turns right, left turns left, at 2.2 rad/s (was ~10 rad/s and mirrored). Up walks
  forward, down walks backwards at 1.8 m/s with the walk clip reversed.
- Car at ~20 m/s: right arrow moves the car 6.8 m to screen-right, left 6.6 m to screen-left (both were
  mirrored). Heading change in the first 0.5 s is about 30 % lower than before.

## Regression
- Default load: static colliders 276, trees, palms, parked cars, props, 269 city meshes, 447 scene meshes:
  identical to the pre-change baseline. Pedestrian spawn values unchanged in code (the first hash also
  included each walker's moving loop position, so it could not match between samples).
- "Shipped It" mission: offered, started, three cards, passed. Save data backed up and restored exactly.
- Fullscreen fix: canvas 2004×1015, composer and SMAA 2004×1015.5 at 1.5×, fresh and after resize.
- Build passes; `Characters` (5 kB) and the meshopt decoder (22 kB) are separate lazy chunks.
- Console clean; 17.7 ms average frame with the civilian.

## Known issues
- Run clip fails slip and snaps at its loop seam; walk passes only up to ~1.35 m/s.
- The physics ground is flat at 0 and block slabs are 0.18 m visual-only, so the player Soldier stands
  18 cm into sidewalks (pre-existing). The civilian adds the slab height visually.
- The Soldier's backpack makes the seated driver look hunched; a civilian driver would read better.

## Update: better run, foot locking, sidewalk collision, archives ignored

### Run animation
- The Quaternius `Run` clip was replaced in `Casual_2.glb` by the Universal Animation Library `Jog_Fwd_Loop`
  (CC0, `License.txt` in the pack), retargeted offline onto the Quaternius rig (`tools/retarget/`). Only the
  baked clip ships (23 tracks); the 7.6 MB library does not. The file is now 359,196 bytes (was 726,104).
- Clip quality on the character, before any foot locking:

| Clip | Natural speed | Slip / speed | Loop seam |
| --- | --- | --- | --- |
| Quaternius Run (old) | 3.1 m/s | 17–22 % | 8.7 cm |
| Retargeted jog (new) | 6.2–6.6 m/s | 5.2 % | 0.2 cm |

- `FootLock` (two-bone IK, `Characters.js`) pins a foot while it is planted and fades the correction out after
  lift-off; `blendCivilian` keeps walk and run on one phase and cycle rate in the blend band.
- Test civilian now walks at 1.3 m/s and runs at 5.5 m/s (the pedestrians' flee speed).

| Speed | Without lock (m/s) | With lock (m/s) | Largest correction |
| --- | --- | --- | --- |
| 1.3 walk | 0.138 | 0.008 | 4 cm |
| 1.8 walk | 0.177 | 0.009 | – |
| 3.0 blend | 0.774 | 0.005 | 19 cm |
| 3.8 blend | 1.020 | 0.019 | 19 cm |
| 4.6 run | 0.186 | 0.026 | – |
| 5.5 run | 0.255 | 0.054 | 2 cm |
| 6.5 run | 0.313 | 0.049 | – |

### Sunken feet
- Cause 1: block slabs (0.18 m) had no collider. Now one 36 × 36 × 0.18 m fixed box per block (64), from
  `CityMap.addSlab` in the slab loop of `City.js`, built in `Physics.buildStatic`.
- Cause 2 (also on roads): the character controller's snap-to-ground of 0.4 m overshot and left the capsule
  16.5 cm inside the ground after landing. Snap is now 0.1 m (0.2 m and above still overshoot).
- Result: player feet at 0.00–0.01 m on roads (a few cm dip while walking) and 0.22 m on sidewalks (slab +
  4 cm controller gap); curb up and down are smooth. The car mounts a curb at 61 km/h and stays upright.
  Props rest exactly on their ground. The civilian's visual slab offset was removed (the ray now hits the slab).

### Archives
`/*.zip` added to `.gitignore`; the 11 archives stay on disk (not deleted).

### Regression
Static colliders unchanged except the 64 new slabs; trees, palms, parked cars, props, 269 city meshes, 447
scene meshes and pedestrian spawns identical. "Shipped It" passes (save backed up and restored). Fullscreen
sizes match. Build passes. Console clean. 16.7 ms average frame with the civilian.
