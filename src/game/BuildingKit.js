import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Building kit: shared plumbing for procedural buildings.
//
// - Geometry is collected into one bucket per material and merged once, so the
//   whole city's buildings stay at roughly one draw call per material.
// - Every block gets its own deterministic random generator, so changing how a
//   building is generated never shifts the trees, palms, parked cars or props
//   that are placed later from City's shared random stream.
// - typologyFor() is the single switch point for the M2b–M2d building styles.

// Bucket keys in merge order. Order matters: it fixes the order of meshes in the scene.
export const BUCKETS = ['brick', 'concrete', 'concreteDark', 'concreteWarm', 'glassTower', 'trim', 'roof', 'window', 'awning', 'metal', 'sill', 'shopGlass', 'shopSign']

export function createBuckets() {
  const geo = {}
  for (const k of BUCKETS) geo[k] = []
  return geo
}

// Merge each non-empty bucket into one mesh with its material and add it to `group`.
// `uvFn(geometry, tile)` rewrites UVs for materials that declare userData.tile.
export function mergeBuckets(geo, materials, group, uvFn, tint) {
  const meshes = {}
  for (const [k, arr] of Object.entries(geo)) {
    if (!arr.length) continue
    for (const g of arr) if (!g.attributes.color) tint(g, 0xffffff)
    let merged = mergeGeometries(arr)
    const mat = materials[k]
    if (mat.userData.tile) merged = uvFn(merged, mat.userData.tile, 'auto')
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = k !== 'window'
    mesh.receiveShadow = true
    group.add(mesh)
    meshes[k] = mesh
  }
  return meshes
}

// ---------------------------------------------------------------- randomness

// Same linear congruential generator as CityMap.rng, plus a draw counter and skip().
export function createRng(state) {
  let s = state >>> 0
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; r.count++; return s / 4294967296 }
  r.count = 0
  r.state = () => s
  r.skip = (n) => { for (let i = 0; i < n; i++) r() }
  return r
}

// Per-block seed and legacy draw count, keyed "bx,bz".
// seed  = state of City's shared stream when the original code reached that block,
//         so the legacy generator reproduces the M1 buildings exactly.
// draws = how many values the original building code consumed for that block; City
//         skips exactly this many on the shared stream, which keeps every later
//         placement (trees, palms, parked cars, props) identical whatever the kit does.
export const LEGACY_BLOCKS = {
  '0,0': [2473948417, 232], '0,1': [1980109993, 165], '0,2': [2264908168, 326], '0,3': [4196697614, 123],
  '0,4': [3922440853, 106], '0,5': [3724469637, 108], '0,6': [934043247, 101], '0,7': [3264158604, 108],
  '1,0': [3840554830, 279], '1,1': [1825905155, 362], '1,2': [2341676245, 263], '1,3': [3862951478, 89],
  '1,4': [4011065811, 56], '1,5': [3847344505, 128], '1,6': [2523410807, 124], '1,7': [3212953921, 50],
  '2,0': [1650216121, 286], '2,1': [2035845583, 329], '2,2': [4135889162, 257], '3,0': [1766157793, 1508],
  '3,1': [4208358789, 1282], '3,2': [3645763327, 1182], '4,0': [3001723429, 1237], '4,1': [363493764, 1998],
  '4,2': [2813913234, 1259], '5,0': [3790016203, 1218], '5,1': [1757482997, 923], '5,2': [3283461818, 1423],
  '5,5': [2546189463, 24], '5,6': [1336127279, 1], '5,7': [2602734274, 19], '6,0': [2863360739, 171],
  '6,1': [1880904400, 198], '6,2': [2885893270, 212], '6,3': [4192079546, 1], '6,4': [3602763473, 1],
  '6,5': [4142053884, 22], '6,7': [2895506034, 1], '7,0': [2694268713, 245], '7,1': [3571274136, 220],
  '7,2': [4009583748, 234], '7,3': [4291846174, 1], '7,4': [2738735333, 1], '7,5': [3271189760, 1],
  '7,6': [3294893151, 17], '7,7': [3460423426, 1],
}

export function blockRng(bx, bz) {
  const entry = LEGACY_BLOCKS[bx + ',' + bz]
  if (!entry) throw new Error(`BuildingKit: no seed for block ${bx},${bz}`)
  return createRng(entry[0])
}

export function legacyDraws(bx, bz) {
  return LEGACY_BLOCKS[bx + ',' + bz][1]
}

// ---------------------------------------------------------------- typologies

// Which generator builds a lot. M2a only knows the legacy generators; M2b–M2d add
// 'podiumTower', 'setbackTower', 'curtainWall', 'slab', 'residential', 'loft' and house variants.
export function typologyFor(districtId /* , lot, rng */) {
  if (districtId === 'home') return 'legacyHouse'
  if (districtId === 'skills') return 'legacyGarage'
  return 'legacyBuilding'
}
