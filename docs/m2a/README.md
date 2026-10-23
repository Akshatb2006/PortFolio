# M2a verification

Reference fingerprint (M1 `0dd4bc4` and M2a, identical on three separate loads):

```
staticColliders 276:b79eb74f   trees 94:eb727d63   palms 10:7961e622
parked 30:64a74d6c:ce04b5f     props 92:45f82461   cityMeshes 261:44b23171
```

Produced by `world-fingerprint.js` (paste into the console after the game loads). It hashes every
fixed Rapier collider, tree and palm spots, parked-car instance transforms and colours, settled
physics-prop positions (0.1 m), and every city mesh's positions, colours and instance matrices.
