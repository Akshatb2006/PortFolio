# Akshat City — gameplay regression checklist

Run after every milestone on the production build (`npm run build && npm run preview`) and once on `npm run dev`.
Tick each line; note the milestone and date at the top of your run.

## Boot
- [ ] Title screen appears over the live city orbit; loading reaches 100 % with no console errors.
- [ ] "Start game" plays the fly-in cinematic on a fresh save; "Skip intro" works; second launch skips it.
- [ ] "Résumé mode" opens the plain page and "Back to the city" returns.

## On foot
- [ ] WASD / arrows move relative to the camera; Shift sprints; Idle → Walk → Run blends without T-pose.
- [ ] Character is blocked by buildings, trees, lamp posts, parked cars and the pier bollards; can walk onto the pier.
- [ ] V toggles first / third person; mouse drag orbits; camera recentres when moving.
- [ ] R respawns on a road in the current district.

## Vehicle
- [ ] E within ~4.5 m of the car enters it; character hidden; E again exits beside the car (refused above ~16 km/h).
- [ ] Accelerate, brake, reverse, steer; Space handbrake produces a drift with tyre smoke.
- [ ] Collisions with buildings/props produce sparks, crash sound and camera shake; car never falls through the ground.
- [ ] Flipping the car auto-rights it within ~2 s.
- [ ] Headlights and tail lights appear at night (N).

## World systems
- [ ] Traffic cars drive the road grid, stop behind the player and each other, and are solid to the player.
- [ ] Pedestrians walk sidewalks, step aside, and run from a fast car.
- [ ] Crates and cones can be knocked over; barrels explode when hit fast, chain-react, and push the car.
- [ ] N toggles day / night: sky, windows, shop signs, lamp pools, bloom and fog all change.

## Missions and progression
- [ ] Yellow marker + "Press E" hint; briefing dialogue advances with E/Enter/click; Skip cancels.
- [ ] Home Sweet Home: 4 checkpoints in order, final card, "MISSION PASSED", marker turns green.
- [ ] Shipped It / Career Heights: cards show project / experience content with working links.
- [ ] Mad Scientist / Mod Garage: pickups in any order, counter in the objective text.
- [ ] Stay Connected: pickups require being on foot; car gets the "get out" hint.
- [ ] Trophy Run: timer visible, red under 10 s, "MISSION FAILED" on timeout, retry possible.
- [ ] Tokens increment the HUD and respect bar; all 7 missions → "CITY COMPLETE".

## UI and persistence
- [ ] M / Esc opens the menu: Map (blips, player arrow), Missions (Go there teleports, Abandon), Dossier (locked/unlocked), Controls (credits, Reset progress).
- [ ] Radar rotates with heading, shows missions, tokens, objective and the parked car.
- [ ] District name shows on entering a district; objective and hints never stick after a mission starts.
- [ ] Sound toggle persists; mission and token progress persist across reload; Reset progress clears them.

## Performance (record, don't just tick)
- [ ] `akshatDev.all()` metrics for skyline / downtown / residential / pier.
- [ ] `akshatDev.frameTimes()` while driving through downtown with traffic in view: avg and p95.
- [ ] Note render buffer size, pixel ratio and whether adaptive resolution kicked in.
