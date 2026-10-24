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
export const BUCKETS = ['brick', 'concrete', 'concreteDark', 'concreteWarm', 'glassTower', 'trim', 'roof', 'window', 'awning', 'metal', 'sill', 'shopGlass', 'shopSign',
  // showcase block (appended so the merge order of everything above is unchanged)
  'brickTex', 'siding', 'showPaving', 'interior', 'awningStripe', 'showSign', 'props', 'clearGlass']

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
    bakeShading(k, merged)
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

// ---------------------------------------------------------------- baked shading (S1.1)
//
// Depth cues written into the existing per-vertex colours at merge time. No new materials, buckets,
// draw calls or random draws. The window bucket is never touched: its vertex colour is the night glow.

export const WALL_BUCKETS = new Set(['brick', 'concrete', 'concreteDark', 'concreteWarm', 'glassTower', 'brickTex', 'siding'])
// trim is excluded on purpose: its material ignores vertex colours (frames and cornices carry dark tints)
const UNDERSIDE_BUCKETS = new Set(['sill', 'roof', 'awning', 'metal', 'brick', 'concrete', 'concreteDark', 'concreteWarm', 'brickTex', 'siding', 'props'])
export const SHADE = { base: 0.7, band: 2.4, bandTop: 0.96, top: 1.04, topAt: 60, underside: 0.45 }

// Wall box with an extra horizontal cut SHADE.band above its bottom, so the grounding band stays at the
// base instead of stretching up the whole facade. (+8 triangles per box.)
export function wallBox(w, h, d) {
  if (h <= 2.2) return new THREE.BoxGeometry(w, h, d)
  const g = new THREE.BoxGeometry(w, h, d, 1, 2, 1)
  const p = g.attributes.position, cut = -h / 2 + Math.min(SHADE.band, h * 0.3)
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 1e-6) p.setY(i, cut)
  return g
}

// world-height factor for walls: darker at street level, very slightly lighter toward the top
export function wallShade(y) {
  if (y <= 0) return SHADE.base
  if (y < SHADE.band) return SHADE.base + (SHADE.bandTop - SHADE.base) * (y / SHADE.band)
  return SHADE.bandTop + (SHADE.top - SHADE.bandTop) * Math.min(1, (y - SHADE.band) / SHADE.topAt)
}

export function bakeShading(key, geo) {
  if (key === 'window') return
  const col = geo.attributes.color, pos = geo.attributes.position, nrm = geo.attributes.normal
  if (!col || !nrm) return
  const wall = WALL_BUCKETS.has(key), under = UNDERSIDE_BUCKETS.has(key)
  for (let i = 0; i < col.count; i++) {
    let f = 1
    if (wall && Math.abs(nrm.getY(i)) < 0.5) f *= wallShade(pos.getY(i))
    if (under && nrm.getY(i) < -0.5) f *= SHADE.underside
    if (f !== 1) col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f)
  }
  col.needsUpdate = true
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

// Which generator builds a lot.
// M2b adds the downtown typologies below; M2c–M2d add lab, career and house variants.
export function typologyFor(districtId, lot, rng, info = {}) {
  if (districtId === 'downtown') return downtownTypology(rng, { h: lot.h, landmark: info.landmark })
  if (districtId === 'home') return 'legacyHouse'
  if (districtId === 'skills') return 'legacyGarage'
  return 'legacyBuilding'
}

// ================================================================ downtown (M2b)
//
// Each generator receives the City instance `c` (for c.box / c.tint / c.geo / c.brand /
// c.rooftop / c.signAtlas) and the lot: centre, size, height and which faces touch a street.
// The ground floor always fills the lot exactly (that rectangle is the collider); everything
// above it stays inside the lot. Only existing material buckets are used.

const STONE = ['#d8cbb5', '#c9b79c', '#e3dccf', '#b9aa92', '#cfc6b8']
const COOL = ['#9fb2bf', '#b7c3cc', '#c9cfd4', '#8aa0b0', '#a9b8c2']
const WARM_LIT = ['#ffd9a0', '#ffe6b8', '#ffcf8a', '#fff0d0']
const pick = (r, a) => a[Math.floor(r() * a.length)]

// faces: 0 +z, 1 -z, 2 +x, 3 -x
const FACE_ROT = [0, Math.PI, Math.PI / 2, -Math.PI / 2]
function face(m, f) {
  const rot = FACE_ROT[f]
  const n = [Math.sin(rot), Math.cos(rot)], t = [Math.cos(rot), -Math.sin(rot)]
  const cx = f === 2 ? m.cx + m.w / 2 : f === 3 ? m.cx - m.w / 2 : m.cx
  const cz = f === 0 ? m.cz + m.d / 2 : f === 1 ? m.cz - m.d / 2 : m.cz
  return { rot, n, t, cx, cz, len: f < 2 ? m.w : m.d }
}
// put a geometry (built facing +z, centred on the origin) onto face f at tangent offset u, height y, pushed out by `out`
function onFace(g, F, u, y, out) {
  g.rotateY(F.rot)
  g.translate(F.cx + F.t[0] * u + F.n[0] * out, y, F.cz + F.t[1] * u + F.n[1] * out)
  return g
}
function faceBox(c, key, F, u, y, w, h, depth, out, color) { c.geo[key].push(c.tint(onFace(new THREE.BoxGeometry(w, h, depth), F, u, y, out), color)) }
function facePlane(c, key, F, u, y, w, h, out, color) { c.geo[key].push(c.tint(onFace(new THREE.PlaneGeometry(w, h), F, u, y, out), color)) }

function winColor(r, litChance) { return r() < litChance ? new THREE.Color(pick(r, WARM_LIT)) : new THREE.Color(0.02, 0.02, 0.03) }

// ---- facade patterns ------------------------------------------------------------

// punched windows with frames, sills and (on unlit windows) pale blinds so glass is never a uniform black
function punched(c, m, y0, y1, { floorH = 3.3, spacing = 2.8, ww = 1.4, wh = 1.9, lit = 0.4, blinds = 0.45, frame = 0x2d2f38 } = {}) {
  const r = c.brand
  for (let f = 0; f < 4; f++) {
    const F = face(m, f)
    const cols = Math.max(1, Math.floor((F.len - 1.4) / spacing))
    const u0 = -(cols - 1) * spacing / 2
    for (let y = y0 + 1.0 + wh / 2; y + wh / 2 <= y1 - 0.5; y += floorH) for (let k = 0; k < cols; k++) {
      const u = u0 + k * spacing
      const col = winColor(r, lit)
      // frame sits behind the glass (front face at +0.03) so only its 0.1 m border shows
      faceBox(c, 'trim', F, u, y, ww + 0.2, wh + 0.2, 0.12, -0.03, frame)
      facePlane(c, 'window', F, u, y, ww, wh, 0.05, col)
      faceBox(c, 'sill', F, u, y - wh / 2 - 0.06, ww + 0.3, 0.1, 0.26, 0.12)
      if (col.r < 0.1 && r() < blinds) { const bh = wh * (0.25 + r() * 0.45); facePlane(c, 'sill', F, u, y + wh / 2 - bh / 2, ww - 0.1, bh, 0.06, pick(r, ['#efe7d8', '#e4dccb', '#f4efe6'])) }
    }
  }
}

// continuous horizontal glass bands with projecting ledges and a few full-height fins
function ribbon(c, m, y0, y1, { floorH = 3.4, band = 0.56, seg = 2.6, lit = 0.45, fins = 3 } = {}) {
  const r = c.brand
  for (let f = 0; f < 4; f++) {
    const F = face(m, f)
    const n = Math.max(1, Math.round((F.len - 0.6) / seg)), sw = (F.len - 0.6) / n
    for (let y = y0 + 0.9; y + floorH * band <= y1 - 0.4; y += floorH) {
      const bh = floorH * band
      for (let k = 0; k < n; k++) facePlane(c, 'window', F, -(F.len - 0.6) / 2 + sw * (k + 0.5), y + bh / 2, sw - 0.06, bh, 0.03, winColor(r, lit))
      faceBox(c, 'sill', F, 0, y - 0.08, F.len + 0.3, 0.16, 0.42, 0.18)
    }
    for (let k = 1; k <= fins; k++) faceBox(c, 'trim', F, -F.len / 2 + (F.len * k) / (fins + 1), (y0 + y1) / 2, 0.14, y1 - y0, 0.34, 0.12)
  }
}

// glass curtain wall: per-floor vision glass, opaque spandrel bands and vertical mullions
function curtain(c, m, y0, y1, { floorH = 3.4, col = 1.7, lit = 0.3, spandrel = 0x2d2f38 } = {}) {
  const r = c.brand
  for (let f = 0; f < 4; f++) {
    const F = face(m, f)
    const n = Math.max(1, Math.round(F.len / col)), cw = F.len / n
    for (let y = y0; y + floorH <= y1 + 0.01; y += floorH) {
      // unlit vision glass is the tower's own blue glass; only lit panels get a window quad (dark by day, glowing at night)
      for (let k = 0; k < n; k++) if (r() < lit) facePlane(c, 'window', F, -F.len / 2 + cw * (k + 0.5), y + 0.35 + (floorH - 0.7) / 2, cw - 0.05, floorH - 0.7, 0.03, new THREE.Color(pick(r, WARM_LIT)))
      facePlane(c, 'trim', F, 0, y + floorH - 0.2, F.len, 0.55, 0.035, spandrel)
    }
    for (let k = 0; k <= n; k++) faceBox(c, 'trim', F, -F.len / 2 + cw * k, (y0 + y1) / 2, 0.09, y1 - y0, 0.14, 0.06, 0x3a3d46)
  }
}

// ---- street level ---------------------------------------------------------------

function signPlane(c, F, u, y, w, h, out) {
  const r = c.brand, A = c.signAtlas
  const idx = Math.floor(r() * A.count)
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv, u0 = (idx % A.cols) / A.cols, v0 = 1 - (Math.floor(idx / A.cols) + 1) / A.rows
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / A.cols, v0 + uv.getY(i) / A.rows)
  c.geo.shopSign.push(c.tint(onFace(g, F, u, y, out), 0xffffff))
}

// retail bays on the street faces of a podium: glass, pilasters, lintel, awnings and signs
function retail(c, m, faces, h = 4.4) {
  const r = c.brand
  for (const f of faces) {
    const F = face(m, f)
    const bays = Math.max(1, Math.round(F.len / 4.2)), bw = F.len / bays
    facePlane(c, 'shopGlass', F, 0, 0.6 + 1.45, F.len - 0.4, 2.9, 0.03)
    for (let k = 0; k <= bays; k++) faceBox(c, 'trim', F, -F.len / 2 + bw * k, 0.6 + 1.6, 0.32, 3.2, 0.3, 0.08)
    faceBox(c, 'trim', F, 0, 3.75, F.len + 0.2, 0.32, 0.36, 0.1)
    for (let k = 0; k < bays; k++) {
      const u = -F.len / 2 + bw * (k + 0.5)
      if (r() < 0.7) { const a = new THREE.BoxGeometry(bw - 0.5, 0.1, 1.3); a.rotateX(0.24); c.geo.awning.push(c.tint(onFace(a, F, u, 3.45, 0.7), pick(r, ['#c9473a', '#2b7a78', '#e2a33c', '#3c5a99', '#7b4b94', '#2d2f38']))) }
      if (r() < 0.55 && h > 4.3) signPlane(c, F, u, 4.4, Math.min(bw - 0.6, 3.2), Math.min(bw - 0.6, 3.2) / 2.2, 0.06)
    }
  }
}

// deep entrance canopy on the main street face of a tower
function entrance(c, m, f, w = 5) {
  const F = face(m, f)
  faceBox(c, 'metal', F, 0, 4.0, w, 0.28, 2.2, 1.1)
  faceBox(c, 'trim', F, 0, 4.2, w + 0.1, 0.12, 2.25, 1.12)
}

// ---- masses, cornices, crowns ---------------------------------------------------

function mass(c, key, m, y0, y1, color) { c.box(key, m.cx, y0, m.cz, m.w, y1 - y0, m.d, color) }
function cornice(c, m, y, depth = 0.35, h = 0.5, color = 0x2d2f38) { c.box('trim', m.cx, y, m.cz, m.w + depth * 2, h, m.d + depth * 2, color) }
function band(c, m, y, color = '#efe7d8') { c.box('sill', m.cx, y, m.cz, m.w + 0.24, 0.22, m.d + 0.24, color) }
function inset(m, sx, sz = sx, ox = 0, oz = 0) { return { cx: m.cx + ox, cz: m.cz + oz, w: m.w * sx, d: m.d * sz } }

// a ring of lit panels near the top: dark by day, glows at night through the window shader
function litCrown(c, m, y, h, color = '#e8f2ff') {
  for (let f = 0; f < 4; f++) { const F = face(m, f); facePlane(c, 'window', F, 0, y + h / 2, F.len - 0.3, h, 0.05, color) }
}
function mast(c, x, z, y, h, r0 = 0.3) { const g = new THREE.CylinderGeometry(r0 * 0.4, r0, h, 8); g.translate(x, y + h / 2, z); c.geo.metal.push(c.tint(g, 0xffffff)) }

// box whose top slopes down toward -x (or -z): a sloped glass crown
function wedge(c, key, m, y0, h, drop, alongX, color) {
  const g = new THREE.BoxGeometry(m.w, h, m.d)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && (alongX ? p.getX(i) < 0 : p.getZ(i) < 0)) p.setY(i, p.getY(i) - drop)
  g.computeVertexNormals()
  g.translate(m.cx, y0 + h / 2, m.cz)
  c.geo[key].push(c.tint(g, color))
}

// ---- typologies -----------------------------------------------------------------

const PODIUM = 4.6

function podium(c, m, streets, color, key = 'concreteDark') {
  mass(c, key, m, 0, PODIUM, color)
  retail(c, m, streets)
  cornice(c, m, PODIUM, 0.3, 0.45)
}

// quiet mid-rise: masonry block, punched windows, string courses, deep cornice
function midrise(c, L) {
  const r = c.brand, m = L.m, col = pick(r, STONE)
  podium(c, m, L.streets, col, 'concrete')
  mass(c, 'concrete', m, PODIUM, L.h, col)
  punched(c, m, PODIUM, L.h - 0.6, { lit: 0.35 })
  for (let y = PODIUM + 3.3 * 3; y < L.h - 3; y += 3.3 * 3) band(c, m, y)
  cornice(c, m, L.h, 0.5, 0.7)
  c.rooftop(m.cx, m.cz, m.w, m.d, L.h + 0.7)
}

// wide slab: long horizontal proportions, ribbon glazing, oriented across the lot
function slab(c, L) {
  const r = c.brand, m = L.m, alongX = r() < 0.5, col = pick(r, COOL)
  const s = alongX ? inset(m, 1, 0.52) : inset(m, 0.52, 1)
  const H = Math.min(L.h, 30 + r() * 8)
  podium(c, m, L.streets, col)
  mass(c, 'concrete', s, PODIUM, H, col)
  ribbon(c, s, PODIUM + 0.4, H - 0.4, { lit: 0.45, fins: alongX ? 4 : 1 })
  cornice(c, s, H, 0.25, 0.5)
  c.rooftop(s.cx, s.cz, s.w, s.d, H + 0.5)
}

// stepped tower: three setbacks, each with its own cornice
function stepped(c, L, crown = false) {
  const r = c.brand, m = L.m, col = pick(r, STONE)
  podium(c, m, L.streets, col, 'concrete')
  const tiers = [[0.92, 0.5], [0.74, 0.78], [0.56, 1]]
  let y = PODIUM
  for (const [k, frac] of tiers) {
    const t = inset(m, k), top = PODIUM + (L.h - PODIUM) * frac
    mass(c, 'concrete', t, y, top, col)
    punched(c, t, y, top - 0.4, { lit: 0.4, spacing: 2.6 })
    cornice(c, t, top, 0.3, 0.5)
    y = top + 0.5
  }
  const t = inset(m, 0.56)
  if (crown) { litCrown(c, inset(t, 0.98), L.h - 1.8, 1.2, '#ffe6b8'); mast(c, t.cx, t.cz, L.h + 0.5, 6) }
  else c.rooftop(t.cx, t.cz, t.w, t.d, L.h + 0.5)
}

// slim point tower on a podium, punched or ribbon facade
function point(c, L) {
  const r = c.brand, m = L.m, k = 0.56 + r() * 0.08, col = pick(r, COOL)
  const t = inset(m, k, k, (r() - 0.5) * m.w * (1 - k) * 0.6, (r() - 0.5) * m.d * (1 - k) * 0.6)
  podium(c, m, L.streets, col)
  entrance(c, m, L.streets[0])
  mass(c, 'concrete', t, PODIUM, L.h, col)
  if (r() < 0.5) punched(c, t, PODIUM, L.h - 0.4, { lit: 0.45, spacing: 2.5 })
  else ribbon(c, t, PODIUM + 0.4, L.h - 0.4, { lit: 0.45, fins: 2 })
  cornice(c, t, L.h, 0.25, 0.6)
  const cap = inset(t, 0.6)
  mass(c, 'concreteDark', cap, L.h + 0.6, L.h + 3.4, col)
  c.rooftop(cap.cx, cap.cz, cap.w + 2, cap.d + 2, L.h + 3.4)
}

// glass curtain-wall tower on a glazed lobby
function curtainTower(c, L, crown = null) {
  const r = c.brand, m = L.m, k = 0.66 + r() * 0.1
  const t = inset(m, k)
  mass(c, 'glassTower', m, 0, PODIUM, 0xffffff)
  retail(c, m, L.streets)
  cornice(c, m, PODIUM, 0.3, 0.45)
  entrance(c, m, L.streets[0], 6)
  mass(c, 'glassTower', t, PODIUM, L.h, 0xffffff)
  curtain(c, t, PODIUM + 0.5, L.h, { lit: 0.3 })
  if (crown === 'slope') {
    litCrown(c, inset(t, 1.002), L.h, 1.0, '#e8f2ff')
    wedge(c, 'glassTower', t, L.h + 1.0, 14, 11, r() < 0.5, 0xffffff)
    mast(c, t.cx + t.w * 0.3, t.cz, L.h + 15, 8)
  } else {
    cornice(c, t, L.h, 0.15, 0.6)
    c.rooftop(t.cx, t.cz, t.w, t.d, L.h + 0.6)
  }
}

// ---- landmarks ------------------------------------------------------------------

// L1 "Akshat Tower": art-deco stepped spire, stone with lit fins and a needle
function landmarkSpire(c, L) {
  const m = L.m, H = L.h + 18, col = '#e3dccf'
  podium(c, m, L.streets, col, 'concrete')
  entrance(c, m, L.streets[0], 7)
  const tiers = [[0.9, 0.42], [0.76, 0.66], [0.62, 0.84], [0.46, 0.95]]
  let y = PODIUM
  for (const [k, frac] of tiers) {
    const t = inset(m, k), top = PODIUM + (H - PODIUM) * frac
    mass(c, 'concrete', t, y, top, col)
    punched(c, t, y, top - 0.4, { lit: 0.5, spacing: 2.2, ww: 1.1, wh: 2.3, frame: 0x8a6d3b })
    // corner piers
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) c.box('concreteWarm', t.cx + sx * t.w / 2, y, t.cz + sz * t.d / 2, 0.9, top - y + 1.2, 0.9, '#f1e7d6')
    cornice(c, t, top, 0.35, 0.6, 0x8a6d3b)
    y = top + 0.6
  }
  const t = inset(m, 0.32)
  mass(c, 'concrete', t, y, H, col)
  litCrown(c, inset(t, 1.01), y + 1, H - y - 2, '#ffd27a')
  cornice(c, t, H, 0.2, 0.5, 0x8a6d3b)
  mast(c, t.cx, t.cz, H + 0.5, 22, 0.45)
}

// L2: glass curtain-wall tower with a sloped, lit crown
function landmarkSlope(c, L) { curtainTower(c, { ...L, h: Math.max(L.h, 56) + 6 }, 'slope') }

// L3: octagonal glass tower with ring ledges and a lit halo
function landmarkOctagon(c, L) {
  const r = c.brand, m = L.m, H = Math.max(L.h, 52) + 4
  podium(c, m, L.streets, '#c9cfd4')
  entrance(c, m, L.streets[0], 6)
  const R = Math.min(m.w, m.d) * 0.4
  const oct = (rad, y0, h, key, color, open = false) => {
    const g = new THREE.CylinderGeometry(rad, rad, h, 8, 1, open); g.rotateY(Math.PI / 8); g.translate(m.cx, y0 + h / 2, m.cz)
    c.geo[key].push(c.tint(g, color)); return g
  }
  oct(R, PODIUM, H - PODIUM, 'glassTower', 0xffffff)
  // the octagon (rotated by π/8) has flat facets facing k·π/4 and corners at π/8 + k·π/4
  const apothem = R * Math.cos(Math.PI / 8), side = 2 * R * Math.sin(Math.PI / 8)
  // per-floor window panels, one indexed quad per facet so lights vary facet by facet
  for (let y = PODIUM + 0.6; y + 2.6 <= H - 1; y += 3.4) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4
    const g = new THREE.PlaneGeometry(side - 0.12, 2.6); g.rotateY(a); g.translate(m.cx + Math.sin(a) * (apothem + 0.04), y + 1.3, m.cz + Math.cos(a) * (apothem + 0.04))
    c.geo.window.push(c.tint(g, winColor(r, 0.5)))
  }
  for (let y = PODIUM + 3.4 * 3; y < H - 2; y += 3.4 * 3) oct(R + 0.45, y, 0.22, 'sill', '#efe7d8')
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; const g = new THREE.BoxGeometry(0.18, H - PODIUM, 0.18); g.rotateY(a); g.translate(m.cx + Math.sin(a) * (R + 0.02), (PODIUM + H) / 2, m.cz + Math.cos(a) * (R + 0.02)); c.geo.trim.push(c.tint(g, 0x3a3d46)) }
  oct(R + 0.3, H, 0.6, 'trim', 0x2d2f38)
  oct(R * 0.7, H + 0.6, 4, 'glassTower', 0xffffff)
  let halo = new THREE.CylinderGeometry(R * 0.72, R * 0.72, 1.2, 16, 1, true); halo.translate(m.cx, H + 3, m.cz); c.geo.window.push(c.tint(halo, '#e8f2ff'))
  mast(c, m.cx, m.cz, H + 4.6, 16)
}

// lots that host landmarks: the tallest lot of these blocks
export const DOWNTOWN_LANDMARKS = { '4,1': 'spire', '3,0': 'slope', '5,2': 'octagon' }

export function downtownTypology(r, L) {
  if (L.landmark) return L.landmark
  if (L.h < 32) return r() < 0.6 ? 'midrise' : 'slab'
  if (L.h < 46) return r() < 0.5 ? 'slab' : 'stepped'
  const x = r()
  return x < 0.4 ? 'point' : x < 0.75 ? 'curtain' : 'stepped'
}

export function buildDowntown(c, type, L) {
  switch (type) {
    case 'spire': return landmarkSpire(c, L)
    case 'slope': return landmarkSlope(c, L)
    case 'octagon': return landmarkOctagon(c, L)
    case 'midrise': return midrise(c, L)
    case 'slab': return slab(c, L)
    case 'stepped': return stepped(c, L)
    case 'point': return point(c, L)
    case 'curtain': return curtainTower(c, L)
  }
  throw new Error('BuildingKit: unknown downtown typology ' + type)
}
