# Open-world gameplay and nightlife expansion

Branch `m2-building-kit`, uncommitted. Measured and browser-tested on 2026-10-24 in Chrome against the Vite
dev server, with one game tab open. Nothing is described as working unless it was exercised in the browser.

## Systems

| System | File | What it does |
| --- | --- | --- |
| Vehicles | `src/game/VehicleSystem.js` | Your Ferrari plus stolen cars. Tap E to get in or out of a free car; hold E for 0.9 s next to a parked car to steal it (Interact animation, alarm, theft crime). Getting out checks for free space with a capsule query (driver side, passenger side, behind, front). At most 4 stolen cars exist; old ones are removed only when far away and out of view. |
| Wanted level | `src/game/Wanted.js` | 0–3 stars. Theft, hit-and-run and assault are +1; attacking police is at least 2 stars. Civilians within 30 m with line of sight react ("!", flee) and report after about 2 s only if they can still see you. Escape: stay unseen for `6 + 4·stars` s and get `35 + 15·stars` m from where you were last seen. Hiding indoors counts double. |
| Police | `src/game/Police.js` | Units spawn 75–170 m away and out of view, drive along roads, switch to direct pursuit when close with line of sight, brake on a stopping curve and keep 5 m apart. Officers get out and chase on foot (5.2 m/s; sprinting escapes). Busted: held 1 s on foot, or boxed in for 3 s in a car. Fine up to $100, released at Career Heights. Synthesised siren. Traffic yields to police. |
| Combat | `src/game/Combat.js` | Arcade only, no blood or gore. F jab, G kick, Space roll (dodge). A sparring crew of 3 holds a painted ring in the Research Park yard. Their attacks are telegraphed by a red ring; at most 2 attack at once. Player health 100 regenerates; a defeat costs $50 and sends you home. Hitting civilians or officers is a crime. |
| Club LUMEN | `src/game/Club.js` | Building with collider on block (4,6), Sunset Pier. Step-inside interior with dance floor, bar, DJ platform, two booths, stage and social wall. 21 NPCs: bartender, DJ, 8 dancers, 5 talkers, 4 seated, 2 watchers. Bar menu with non-alcoholic option. The social wall shows only links marked verified in `content.js`. Synthesised 122 BPM music plays only indoors after a user gesture. |
| Activities | `src/game/Activities.js` | Coastal Time Trial (6 checkpoints, 45 s, best time saved), Clear the Yard, Night Out at LUMEN (one-time), Shake the Heat (escape at 2 stars or more, 120 s cooldown). Cash and progress are saved; older saves get defaults. |
| UI | `src/game/UI.js`, `index.html` | Cash, health, wanted stars with SEARCHING / SPOTTED, radar blips (police, search area, activities, cars), venue panel, fades, Side activities section in the pause menu, Controls screen, first-run onboarding card. Any open menu really pauses the simulation. |

## Controls

| Context | Keys |
| --- | --- |
| On foot | WASD / arrows move · Shift sprint · F jab · G kick · Space roll · E interact / enter car · hold E steal a parked car |
| Driving | W/S accelerate and brake/reverse · A/D steer · Space handbrake · E get out (below 5 m/s) |
| General | M or Esc pause, map and missions · V camera · N day/night · R respawn if stuck · drag the mouse to look |

## Test journeys (browser, 2026-10-24)

| Journey | Result |
| --- | --- |
| Steal parked car → drive 50 m → brake → exit | Pass: car body stable; exit lands at a free spot; 5 enter/exit cycles clean |
| Stolen-car cap | Pass: never more than 4; recycled only out of view |
| Witnessed theft → police | Pass: report at 2.0 s, unit spawned 82 m away out of view, search → chase → direct |
| Escape at 2 stars | Pass: cleared after about 14 s; "YOU LOST THEM"; Shake the Heat paid |
| Busted | Pass: fine charged, released at Career Heights, stars cleared |
| Officer foot chase | Pass: officer runs at 5.2 m/s; a sprinting player escapes |
| Combat yard | Pass: 11/11 hits landed, crew knocked out, dodge prevents damage (16 damage taken without dodging), defeat flow works |
| Assault on a civilian | Pass: witness → 1 star |
| Club, 3 enter/exit cycles | Pass: drink purchase, menu close restores input, 5 social links, music stops on exit; no duplicate NPCs, lights or colliders |
| All 4 activities | Pass: completed and paid; pause freezes traffic |
| Save/load + old save | Pass: defaults applied; the user's own save was restored after testing |

## Regression (Stage H)

| Check | Result |
| --- | --- |
| World generation | Identical: trees 94 (hash eb727d63), palms 10 (7961e622), parked cars and props 92 (45f82461) |
| Colliders | 277 = the 276 existing + 1 club building; existing footprints unchanged, no door gaps cut |
| Missions | "Shipped It" and "Home Sweet Home" completed |
| Fullscreen | Drawing buffer matches the composer and SMAA targets |
| Day/night | Round trip works; physics bodies 108 → 111 during a chase → 108 afterwards |
| Console | No errors |
| Spawning | Player and police cars snap to the ground before the first physics step (fixes "feet and car under the ground") |

## Performance

Rerun on 2026-10-24 (later), plugged in. An empty page now runs at 16.7 ms, so the earlier 30 fps cap was Chrome's
Energy Saver on low battery. One game tab open, 60 Hz display, so frame time is vsync-bound at 16.7 ms.
CPU = `frame()` update + render submit; GPU = timer query.

| Scenario | p50 ms | p95 ms | max ms | Resolution scale | Draw calls | Triangles | GPU ms | CPU ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Free roam (Grove St) | 16.7 | 17.3 | 17.8 | 1.5 | 811 | 2.93 M | 2.55 | 2.77 |
| Downtown | 16.7 | 17.3 | 17.8 | 1.5 | 520 | 2.16 M | 2.25 | 2.11 |
| 3-star chase (3 units, 1 officer) | 16.7 | 17.3 | 19.8 | 1.5 | 537 | 1.58 M | 2.39 | 2.53 |
| Combat yard | 16.7 | 17.3 | 17.8 | 1.5 | 389 | 1.21 M | 2.10 | 2.15 |
| Inside LUMEN | 16.7 | 17.4 | 17.9 | 1.5 | 323 | 0.14 M | 1.73 | 2.09 |
| Inside Akshat's House | 16.7 | 17.4 | 17.6 | 1.5 | 130 | 0.01 M | 0.74 | 0.73 |

**p95 ≤ 20 ms target: met in every scene.** The adaptive resolution stays at full scale. For the chase,
arrest was stubbed out during the measurement so the units stayed.

### Checkpoint freeze (fixed)

**Cause:** every marker owned a `PointLight`. Each checkpoint that appeared or was collected changed the
scene's light count, which made three.js recompile every lit material: a 2.3 s frame, measured.

**Fix:**
- Markers now share a fixed pool of 3 glow lights.
- All shaders are precompiled during loading (`renderer.compileAsync`).
- The club and house interiors are compiled in the background when you approach their doors
  (`src/game/prewarm.js`), against a stand-in scene with the exact indoor light set.

**After the fix, from a cold start:** 11 checkpoints across 3 missions had no frame over 100 ms (worst 40 ms).
Entering the house dropped from 726 ms to 47 ms, and the club entry is 200 ms.

## Payload

Production build (`vite build`), measured on 2026-10-24: **6.39 MB of assets added** beyond `main`
(budget 10 MB), itemised in `docs/assets/MANIFEST.md`. The JS bundle is 5.26 MB (1.94 MB gzip), plus a
lazily loaded 22 KB meshopt decoder.

## Added on 2026-10-24 (later)

- **Akshat's House** (`src/game/House.js`):
  - The Grove Street house nearest the "Back home" checkpoint has a front door, porch lights, a path and a
    name sign. No collider was changed.
  - Inside is a separate room with six stations, each opening a panel built from `content.js` only:
    TV for About, career wall for Experience, desk for Projects and Lab, bookshelf for Skills, trophy cabinet
    for Achievements, and corkboard for Contact.
  - Unverified links stay hidden.
  - Browser-tested: enter, all 6 stations (prompt, panel, links), exit at the door.
- **Map:**
  - A live "You" arrow (the map previously had no player marker despite its legend).
  - Tags for the house, LUMEN, Time Trial and Yard, plus a Places list.
  - Click a place or anywhere on the map to set a purple GPS waypoint (on the map, radar and in the world).
    It clears when you arrive.
  - Sized to the window height so it no longer gets clipped.
- **Pedestrians and cars:** contact is tested against the car's body rectangle.
  - Above 9 m/s (~32 km/h) the pedestrian is thrown 2–4 m and dies: death pose held, a blood spray, then a
    spreading pool.
  - Between 3 and 9 m/s they are knocked down and recover.
  - Below 3 m/s they are pushed aside.
  - Bodies are cleared after 30 s once out of view, and the pedestrian walks again elsewhere on its block.
  - Hit-and-run still raises the wanted level through witnesses.
- **Blood:** a small spray on combat hits (both directions) and pools for run-over deaths. 16 reusable pools
  fade after 45 s.

## Limitations and pending work

- **Pole performer: pending.** No compatible, non-explicit pole clip exists in the local packs. The stage,
  lighting, railing and audience area are built and the sign reads "SHOWTIME 11PM", but no performer
  animation was faked.
- **Vehicle variety (Kenney Car Kit, CC0, added 2026-10-24):**
  - Parked cars cycle sedan, SUV and van (10 each), each repainted in its original colour. Stealing one
    gives you that same model and colour.
  - Police drive the Kenney police car, with flashing lenses fitted over its light bar.
  - Bodies are scaled to street size (sedan 4.2 × 1.9 × 1.6 m) and the wheels stay round. The style is
    stylised low-poly, not realistic.
  - Traffic still uses the Ferrari LOD; your own car is the Ferrari.
  - If the pack fails to load, parked and police cars fall back to the Ferrari.
  - Browser-tested: the Ferrari plus six thefts across all three models (drive, brake, exit, level at
    y ≈ 0.005). Recycling removed 2 cars, keeping 4 stolen cars alive. Witnessed police chase and arrest
    work with the new car.
  - World generation is identical: tree, palm, prop, parked-position and colour hashes, and all 311
    non-parked static colliders. Only the 30 parked collider boxes changed size; their centres are
    unchanged.
- No flying vehicles (they depend on the packs above).
- Only one dance clip, varied in speed and phase per dancer.
- The player cannot sit in the booths; only NPCs sit.
- Slight foot slip remains at sprint speed (about 0.15).
- Performance was not verified above 30 Hz (see above).
- Unverified InsightEdge repository and Discord profile stay hidden (`verified: false` in `content.js`).
