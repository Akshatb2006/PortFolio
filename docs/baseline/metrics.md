# Baseline metrics — M0 (2026-10-23)

Environment: Chrome 155, macOS, 1336×728 CSS viewport at 2.2 device pixel ratio, dev server (`npm run dev`).
Captured with `window.akshatDev` (`src/game/DevCapture.js`): `view(name)`, `metrics()`, `frameTimes()`, `all()`.
GPU ms = wall time of 8 composer renders bracketed by `gl.finish()`; it excludes CPU work.

| View | GPU ms | Draw calls | Triangles | Render buffer | Pixel ratio |
| --- | --- | --- | --- | --- | --- |
| skyline | 7.4 | 344 | 2.44 M | 2004×1092 | 1.5 |
| downtown | 3.8 | 218 | 2.44 M | 1803×982 | 1.35 |
| residential | 5.5 | 457 | 4.23 M | 1803×982 | 1.35 |
| pier | 3.9 | 240 | 2.44 M | 1603×873 | 1.2 |
| night (Grove Street, driving) | 5.3 | 402 | 4.19 M | 1002×546 | 0.75 |

Memory indicators: 255–303 geometries, 95–105 textures, 48–51 shader programs.

Main-thread cost per frame while driving (wrapped timers, ms): composer render submit 6.6, physics 0.76,
radar 0.21, vehicle 0.13, traffic 0.13, audio 0.13, everything else < 0.1. Total ≈ 8.3 ms.

Frame interval measured: avg 33.3 ms, p95 36.7 ms (flat 30 Hz) in both idle and driving, independent of
pixel ratio, shadows, bloom or scene content. GPU (≈4–7 ms) + CPU (≈8 ms) budgets are consistent with 60 fps;
the 30 Hz lock reproduced only while a second instance of the game was open in another tab earlier in the
session, and 60 fps was measured once that tab was closed. **Re-measure frame times in an otherwise idle
browser before and after every milestone.** The adaptive resolution scaler reacts to the slow frames and
drops pixel ratio to 0.7, which is why render buffers differ between rows above.

Known visual defects noted during capture (not fixed in M0): distant pedestrians can show a T-pose until
their mixer first updates (`Pedestrians.js` / `Player.js makeSoldier`); mountains are plain white cones.

Reference screenshots: `skyline.jpg`, `downtown.jpg`, `residential.jpg`, `pier.jpg` in this folder.
