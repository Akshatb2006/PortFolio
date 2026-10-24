# Stability milestone: acceptance pass

Run on 2026-10-24 in Chrome against the Vite dev server. Conditions: one game tab, Mac on AC power, 60 Hz
display, fresh reload. Inputs are real key events (E, Escape, M, W, F, G, R) and real UI clicks, except where
noted. Some setup used teleports (to markers, doors and checkpoints). The user's save was backed up first and
restored afterwards (byte-identical).

## Hitch budget

A p95 under 20 ms does not mean every frame is under 20 ms, so hitches are budgeted separately:

| Rule | Limit |
| --- | --- |
| Steady play (driving, walking, missions, chases, interiors) | p95 ≤ 20 ms, p99 ≤ 25 ms, **no frame > 50 ms** |
| One-time first use (first interior entry, first checkpoint after load) | ≤ 3 frames > 50 ms per session, **none > 100 ms** |
| Anywhere | **no frame > 100 ms** |

Check it in the console with `akshatDev.hitches()`. A passive monitor logs every frame over 33 ms with its
location and mission; menus and pauses are excluded. `akshatDev.hitches(true)` resets it.

**Rules for new content, so the old freezes don't come back:**
- Never add or remove lights at runtime. A change in light count recompiles every material; that caused the
  2.3 s checkpoint freeze.
- New interiors reuse the club's light set and are prewarmed (`src/game/prewarm.js`).
- New materials must exist (visible) at boot so `compileAsync` covers them.

## Results

### 1. Performance after a fresh reload

| Scenario | Frames | p50 | p95 | p99 | Max | > 33 ms | > 50 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All 7 missions, 32 points (incl. the 11 route checkpoints) | 3,974 | 16.7 | 17.7–17.9 | 17.9–18.3 | 46.9 (first checkpoint) | 1 | 0 |
| House entry ×6 / exit ×6 | 1,040 | 16.6–16.7 | 17.6–23.0 | ≤ 43.3 | 43.3 (first entry) | 1 | 0 |
| Club entry ×6 / exit ×6 | 1,040 | 16.6–16.7 | 17.6–18.0 | ≤ 60.3 | 60.3 (first entry) | 1 | **1** (one-time) |
| Inside house / club | 305 / 305 | 16.6 | 17.8 | 18.1 | 18.2 | 0 | 0 |
| Sustained 3-star chase, 30 s, 3 units | 1,801 | 16.7 | 17.9 | 18.3 | 23.4 | 0 | 0 |
| Run-overs (3 real, at 22–24 m/s) | 637 | 16.7 | 17.6 | 17.8 | 18.1 | 0 | 0 |

**Within budget.** The only frames over 50 ms were the club's first entry (60.3 ms, a one-time compile).
No frame anywhere exceeded 100 ms.

For the sustained chase, arrest was stubbed out so the chase could continue. The units reached and pinned the
car, so the load is 3 units at close range.

**Interior entry/exit cycles 4–6 added nothing:** programs, textures, geometries, colliders, physics bodies,
scene children and club NPCs all grew by 0. Police bodies went 108 → 111 during the chase and back to 108.

### 2. Map and GPS

| Check | Result |
| --- | --- |
| Set from the map's Places list (real click) | Pass: waypoint, marker, active button; closing with M restores input |
| Walk 25 m to it | Pass: arrives in 3.8 s, "You have arrived", marker removed |
| Set by clicking the map canvas | Pass: within 0.6 m of the clicked point |
| Drive to it | Pass: arrives in 2.3 s, cleared |
| Respawn (R) with a waypoint | Pass: waypoint and marker kept |
| Enter the house with a waypoint | Pass: marker hidden indoors, no false arrival, waypoint kept; visible again outside |
| Choose the same place again / another place | Pass: clears / replaces (never two GPS markers) |
| Arrive at a destination that starts an activity (yard) | Pass: arrival hint, cleared |

### 3. Pedestrian collisions

| Case | Result |
| --- | --- |
| Repeated hits on a body | Pass: counted once, no further effect |
| Someone knocked down at 6 m/s, then hit at 15 m/s | **Failed, fixed**: was immune (the car passed over them); now killed |
| Knocked down, then a slow second hit | Pass: stays down, not killed |
| Dead-centre hit (zero sideways offset) | Pass: counts as contact |
| Body older than 30 s but in view | Pass: kept |
| Body older than 30 s, off-screen but near the player | Pass: kept |
| Body old, off-screen and far | Pass: cleared, walks again on the sidewalk |
| Duplicates | Pass: 14 pedestrians, 14 unique models, all in the scene once, scene children unchanged |
| 18 blood pools on 16 slots | Pass: oldest reused, mesh count fixed |
| 3 real run-overs by car | Pass: all killed at 22–24 m/s |

### 4. House stations

**All pass.** Six stations × three ways to close (Escape, E, the close button) = 18 checks. In every one:
- the panel opened and the game paused;
- the panel closed and input came back;
- every link was on the verified list (Projects 7, Contact 5, others 0);
- InsightEdge and Discord stayed unlinked.

**Failed, fixed: closing a panel with E re-opened it.** The same key press also counted as a new interaction
on the next frame. The same bug could start a car theft when closing a panel next to a parked car, because a
held E is what steals.

The fix: keys a menu uses (E, Enter, Escape, M) are consumed until released, and cleared on window blur. In
3 of 3 retests, holding the closing E never steals, while a fresh hold of E still steals normally.

### 5. Missions, activities, saves

| Check | Result |
| --- | --- |
| All 7 portfolio missions (incl. the two existing ones, Home Sweet Home and Shipped It), started with E at the marker, briefing advanced with E | 7/7 passed, 25 cards closed with Escape, input restored each time |
| Coastal Time Trial (E at the start sign in a car) | Pass, +$75 (the 3.92 s best is a teleport artefact, in the test save only) |
| Clear the Yard (15 real F/G presses) | Pass in 11.5 s, +$60, 52 HP left |
| Night Out at LUMEN (door, bartender → free water, social wall) | Pass, +$40 |
| Shake the Heat (2 stars, hide in the house) | Pass: cleared in 5 s, +$50, police left |
| New save survives a reload | Pass: money, missions, activities and best times identical; HUD 7/7 |
| Old save (no money / activities / best / onboarded) | Pass: $250 default, empty activities, missions kept, welcome card shown, map opens |
| User's own save | Restored; byte-identical to the backup taken before testing |

### 6. Repository

- Branch: `m2-building-kit`.
- Last commit: still `623fed2` (2026-10-23).
- No new commits, no stashes.
- 59 changed or new paths, all uncommitted (58 before; this pass added `src/game/Input.js`).
- `main` not touched.

## Known, accepted for this stage

- **One-time first-entry hitches:** club 60 ms, house 43 ms, first checkpoint 47 ms. All within the one-time
  allowance.
- **The chase test pins the player:** police box the car in within seconds, so a "sustained chase" is mostly
  3 units at close range.
- **Respawn (R) distance:** it places the player at the nearest safe road point, which can be 70+ m away.
