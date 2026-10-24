# Civilians replace the Soldiers; farm animals in Central Park (uncommitted)

## What changed
- **Player:** `M_Casual_Hoodie` (Quaternius men). Same controller, speeds and car seat; civilian gait blend +
  foot locking after the physics step (`Player.afterSync`). The seated pose now also carries this rig's separate
  foot bones to the shin ends.
- **Pedestrians (14, 6 on low quality):** 11 outfits, men and women, chosen by district —
  Sunset Pier: beachwear / casual; Downtown and Career Heights: suits and formal; Research Park and Mod Garage:
  workwear; Grove Street, Central Park, Stadium: casual. Men and women alternate where a district has both.
  Loops moved from the road edge onto the sidewalk (1.8 m from the curb, standing on the 0.18 m slab).
  Walking speed 1.0–1.35 m/s (the range where the walk clip is clean), flee speed 5.5 m/s unchanged.
  Foot locking on every animated pedestrian; shadows only within 50 m.
- **Animals:** urban farm in Central Park block (2,4): 2 cows, a calf, 2 sheep, 2 lambs and a pig inside a
  timber fence. They graze, amble (pace matched to each clip: virtual hooves on the single-bone legs), keep
  apart and move away from the player. Visual only, no colliders. The pack has only farm animals (no dogs/cats).
- **Soldier:** no longer downloaded or shown; only loaded if the civilian files fail.
- Spawn determinism: the shared random stream is consumed in the original order (same blocks, directions,
  phases); positions differ only because the loops moved onto the sidewalk.

## Measured
| Check | Result |
| --- | --- |
| Player height / feet | 1.83 m, −0.004 m |
| Player slip (lock) | jog 4.6 m/s: 0.03; sprint 8.5 m/s: 0.15–0.17 (0.40 without lock); backwards 1.8 m/s: 0.006 |
| Pedestrian slip (lock) | 0.007–0.009 m/s near the player; previously 0.10–0.30 beyond 45 m, lock now runs to 90 m |
| Pedestrians on the sidewalk | all at y = 0.18 |
| Animals face their direction of travel | yes (head ahead of body for all 8) |
| Frame time | 16.67 ms avg, p95 17.6 ms (street view and normal play) |
| Draw calls (skyline / downtown / residential / street) | 499 / 346 / 829 / 375 (were 419 / 260 / 582 / 289): each civilian is 4–5 mesh parts |
| Missions | "Shipped It" and "Home Sweet Home" pass; save restored |
| World | colliders, slabs, trees, palms, parked cars, props identical |
| Added shipped assets | 7.21 MB of 10 MB (characters 4.11, benchmark kits 2.43, animals 0.51, room images 0.16) |

## Known limits
- Sprint slip sits at the 0.15 m/s limit.
- Draw calls rose by up to ~250 in the residential view; frame time is unaffected on this Mac. Merging each
  character's parts into one skinned mesh would cut this if needed.
- No women's swimwear exists in the pack, so beach women wear casual outfits.
- Pedestrians and animals still pass through props, trees and each other in places (no avoidance yet).

Screenshots: `player.jpg`, `driver.jpg`, `downtown-woman.jpg`, `beach-man.jpg`, `farm-meadow.jpg`.
