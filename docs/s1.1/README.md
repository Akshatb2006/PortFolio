# S1.1 — baked architectural shading (+ day/night fade fix)
Compare with docs/s1/after/. Shading baked into existing vertex colours at merge time (BuildingKit.bakeShading):
2.4 m base band on wall boxes (0.70 → 0.96), faint full-height gradient (→ 1.04 at 60 m), undersides of
sills/roofs/awnings/metal/walls ×0.45. Window bucket untouched. vertexColors enabled on sill, roof, metal,
glassTower (all carry white/light tints); trim excluded (dark tints).
Fix: day/night fade stalled at ~0.04/~0.96 (applyNight's 0.002 threshold); now reaches exactly 0 and 1.
Fingerprint: colliders, trees, palms, parked, props, 248 non-building meshes identical.
Static metrics (pedestrians, markers, traffic hidden), S1 → S1.1: skyline 264/1.978M → 264/1.981M,
downtown 151/1.974M → 151/1.977M, residential 348/3.525M → 348/3.529M, pier 177/1.975M → 177/1.978M.
Draw-call noise in earlier reports came from moving objects: same view, same code, 344–353 calls over 6 s.

Regression (scripted, S1.1 + fade fix): walk blend, first/third camera, enter car, drive (16.67 ms avg /
17.2 ms p95), stop at podium (car y 0.01), exit, barrel chain explosion, token, Home Sweet Home to
"MISSION PASSED", menu + map, night reaches 1.0 and day returns to exactly 0, persistence after reload,
console clean. Idle sample taken in the first 3 s after start read 19.0 / 20.6 ms (startup warm-up).
