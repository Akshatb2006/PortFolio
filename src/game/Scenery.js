import * as THREE from 'three'
import { SIZE, roadCoord } from './CityMap.js'

// Scenic ring around the city (visual only, outside the play boundary): one heightfield replaces the old cone
// mountains and the flat outer plane.
//   Crown Mountains   a high ridge north (behind downtown), lower ranges east and west, coastal cliffs either
//                     side of the southern bay
//   Sapphire River    a turquoise river carved along the north edge of the city that bends south down the east side
//                     into the bay; water is one ring of planes at sea level, the terrain decides where it shows
//   Celestial Bridge  a suspension bridge carrying the central avenue (road column 4) north over the river, with
//                     cyan edge lines and warm deck lamps that light up at night
// The city square itself stays flat at the old outer-plane height, and nothing here has a collider.
const HALF = SIZE / 2                 // 207: city edge
const SEA = 0.06                      // sea level = the pier water (Y_SLAB - 0.12)
const FLAT = -0.05                    // old outer plane height
const EXTENT = 3200, SEG = 320        // terrain size (m) and resolution (10 m cells)

// ---------------------------------------------------------------------------------------------- noise
function hash2(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, z, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5 } return s }
const ridged = (x, z, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { const n = 1 - Math.abs(vnoise(x * f, z * f) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5 } return s }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// river centre line: from the north-west range, along the north edge, then south along the east edge to the bay
export const RIVER = [[-1500, -520], [-900, -330], [-450, -282], [0, -282], [282, -282], [300, -150], [292, 120], [330, 360], [420, 900]]
const RIVER_W = 56
function riverDist(x, z) {
  let best = Infinity
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1], dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

// landmark sites (Landmarks.js builds on these; heightAt shapes the ground for them)
export const SITES = {
  falls: { x: -250, lip: -438, top: 72, pool: -402 },       // Hidden Falls: a mesa north-west of downtown
  temple: { x: -700, z: 330, y: 24, r: 62 },                // ancient temple on a cliff terrace above the bay
  cove: { x0: -590, x1: -762, z: 455 },                     // sea inlet at the foot of the western cliff (bay falls)
  view: { x: 745, z: 365, r: 28 },                          // Aurora Point: overlook on the eastern cliffs
}
const TRIB = [[-250, -404], [-250, -330], [-236, -282]]     // stream from the falls' pool (not the lip) to the river
function segDist(x, z, pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

export function heightAt(x, z) {
  const out = Math.max(Math.abs(x), Math.abs(z)) - HALF
  if (out < 8) return FLAT
  let h = landAt(x, z, out)
  const F = SITES.falls, T = SITES.temple, V = SITES.view, C = SITES.cove
  // Hidden Falls mesa: a 72 m shelf with a sheer south face, a stream channel leading to the lip
  const mx = smooth(-470, -430, x) * (1 - smooth(-70, -30, x)), mz = smooth(F.lip + 7, F.lip - 7, z)
  if (mx * mz > 0) {
    const top = F.top + smooth(F.lip, F.lip - 160, z) * 30 + fbm(x / 60, z / 60) * 6
    h = Math.max(h, top * mx * mz) - 3 * (1 - smooth(5, 12, Math.abs(x - F.x))) * mx * mz
  }
  // temple terrace, with a high cliff wall behind it (west) running along the coast
  const dt = Math.hypot(x - T.x, z - T.z)
  const wall = smooth(-770, -835, x) * (1 - smooth(200, 280, Math.abs(z - (T.z + 60))))
  if (wall > 0) h = Math.max(h, T.y + wall * (110 + ridged(x / 90, z / 90) * 50))
  const flat = 1 - smooth(T.r, T.r + 24, dt)
  h = h * (1 - flat) + T.y * flat
  // sea inlets: one in front of the temple (its stairs go down to the water), one at the foot of the cliff (bay falls)
  const lag = 1 - smooth(30, 52, segDist(x, z, [[-560, T.z], [T.x + T.r + 6, T.z]]))
  const cove = 1 - smooth(34, 58, segDist(x, z, [[C.x0, C.z], [C.x1, C.z]]))
  const sea = Math.max(lag, cove)
  h = h * (1 - sea) + Math.min(h, -3) * sea
  // Aurora Point: a flat summit on the eastern cliffs
  const vt = landAt(V.x, V.z, Math.max(Math.abs(V.x), Math.abs(V.z)) - HALF), dv = Math.hypot(x - V.x, z - V.z), vf = 1 - smooth(V.r, V.r + 18, dv)
  h = h * (1 - vf) + vt * vf
  // rivers: the main river and the stream from the falls (with a plunge pool)
  const rd = riverDist(x, z)
  const carve = 1 - smooth(RIVER_W / 2, RIVER_W / 2 + 70, rd)
  h = h * (1 - carve) + Math.min(h, -2.5 - (1 - rd / RIVER_W) * 2) * carve
  // (tight falloff: a wider carve reached back into the cliff and lowered the falls' lip)
  const td = Math.min(segDist(x, z, TRIB), Math.hypot(x - F.x, z - F.pool) - 8)
  const tc = 1 - smooth(10, 22, td)
  h = h * (1 - tc) + Math.min(h, -2.2) * tc
  return h
}

// the landscape before landmark sites and rivers
function landAt(x, z, out) {
  const n = fbm(x / 420, z / 420)
  // ranges: north is the big one, east / west lower; all start rising ~60 m outside the walls
  // the north range starts ~500 m out (a river valley in front of it) and peaks ~1–1.4 km from downtown
  const north = smooth(-520, -1250, z), side = smooth(HALF + 160, HALF + 900, Math.abs(x)) * (1 - smooth(-200, 300, -z) * 0.2)
  const ridge = ridged(x / 520 + 7.3, z / 520 - 2.1)
  let h = (north * 700 + side * 230) * (0.35 + ridge * 0.95) + n * 45 * smooth(20, 200, out)
  // foothills right outside the walls stay low; a 1.2 m lowland base keeps land above the sea everywhere except
  // the river and the bay (so the city edge reads as countryside, not an island). 2.5 m, not less: at long
  // range the depth buffer cannot separate thinner gaps and the sea plane shows through the land
  h = h * smooth(30, 260, out) + 2.5 * smooth(8, 30, out)
  // southern bay: below sea level south of the city, between coastal cliffs at |x| > 700
  // (starts right at the city's south edge, so Sunset Pier opens onto the sea instead of a cut-off pond)
  const bay = smooth(HALF - 10, HALF + 24, z) * (1 - smooth(560, 900, Math.abs(x) + fbm(x / 200, z / 200) * 160))
  h = h * (1 - bay) + (-3 - 30 * smooth(HALF + 40, 900, z)) * bay
  // cliffs: steepen the coast on either side of the bay
  if (z > HALF) h += smooth(600, 760, Math.abs(x)) * smooth(HALF, HALF + 120, z) * (140 + ridge * 120)
  return h
}

// ---------------------------------------------------------------------------------------------- terrain material
// Textures are sRGB, which the GPU already decodes on sampling (decoding again in the shader darkened everything).
// grass (low), aerial rock (mid / steep, world XZ), cliff rock (steep faces, biplanar), sand at the waterline,
// snow on high flat-ish ground. Textures are sampled in world space, so the mesh needs no UVs.
function terrainMaterial(sets) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
  const U = { tGrass: { value: sets.grass.map }, tAerial: { value: sets.rockAerial.map }, tFace: { value: sets.rockFace.map }, uNight: { value: 0 } }
  m.userData.U = U
  for (const t of [sets.grass.map, sets.rockAerial.map, sets.rockFace.map]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;\nuniform sampler2D tGrass, tAerial, tFace;\nuniform float uNight;\nconst float HALF = ' + HALF.toFixed(1) + ';\nvec3 lin(vec4 c){ return c.rgb; }')
      // aerial perspective: the terrain gets its own, thinner and cooler haze than the city (whose warm sunset
      // fog would paint distant mountains orange); at night it falls back to the scene's dark fog colour
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
        float ff = 1.0 - exp(-fogDensity * fogDensity * 0.45 * vFogDepth * vFogDepth);
        vec3 haze = mix(fogColor, vec3(0.66, 0.74, 0.86), 0.6 * (1.0 - uNight));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, ff);
      #endif`)
      .replace('#include <map_fragment>', `
        vec3 nrm = normalize(vWNor); float slope = 1.0 - nrm.y; float h = vWPos.y;
        vec3 grass = lin(texture2D(tGrass, vWPos.xz / 14.0)) * vec3(0.62, 0.86, 0.5);
        // the aerial rock is warm tan; cool it toward grey-blue granite so the haze reads as distance, not dust
        vec3 aerialRaw = lin(texture2D(tAerial, vWPos.xz / 90.0));
        vec3 aerial = mix(vec3(dot(aerialRaw, vec3(0.3, 0.5, 0.2))), aerialRaw, 0.45) * vec3(0.86, 0.92, 1.0);
        vec2 fuv = abs(nrm.x) > abs(nrm.z) ? vWPos.zy : vWPos.xy;
        vec3 face = lin(texture2D(tFace, fuv / 28.0)) * vec3(0.9, 0.92, 0.95);
        vec3 col = mix(grass, aerial, clamp(smoothstep(60.0, 180.0, h) * 0.9 + smoothstep(0.3, 0.5, slope) * 0.7, 0.0, 1.0));
        col = mix(col, face, smoothstep(0.42, 0.62, slope));
        vec3 sand = vec3(0.86, 0.78, 0.6) * (0.85 + 0.15 * lin(texture2D(tAerial, vWPos.xz / 9.0)).r);
        // sand only on real shores: not on the gentle ramp right outside the city walls
        float shore = (1.0 - smoothstep(0.35, 1.0, h)) * smoothstep(HALF + 18.0, HALF + 30.0, max(abs(vWPos.x), abs(vWPos.z)));
        col = mix(col, sand, shore);
        float snowLine = 300.0 + 40.0 * lin(texture2D(tAerial, vWPos.xz / 400.0)).r;
        col = mix(col, vec3(0.93, 0.95, 0.98), smoothstep(snowLine, snowLine + 60.0, h) * (1.0 - smoothstep(0.55, 0.75, slope)));
        diffuseColor.rgb *= col;`)
  }
  m.customProgramCacheKey = () => 'akshat-terrain'
  return m
}

// ---------------------------------------------------------------------------------------------- build
export function buildScenery(city, assets) {
  const g = new THREE.Group(); g.name = 'scenery'
  // terrain
  const geo = new THREE.PlaneGeometry(EXTENT, EXTENT, SEG, SEG).rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
  geo.computeVertexNormals(); geo.deleteAttribute('uv')
  const terrain = new THREE.Mesh(geo, terrainMaterial(assets.sets)); terrain.receiveShadow = true; terrain.name = 'terrain'
  g.add(terrain)

  // water: a ring of planes around the city square plus the pier bay; the terrain hides it wherever it is above
  // sea level, so the river and coastline come out of the heightfield. The pier's own sea (City) is replaced.
  const E = EXTENT / 2, parts = [[-E, -E, E, -HALF], [-E, HALF, E, E], [-E, -HALF, -HALF, HALF], [HALF, -HALF, E, HALF], [-115, 169, 81, HALF]]
  const wg = parts.map(([x0, z0, x1, z1]) => { const p = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2); p.translate((x0 + x1) / 2, SEA, (z0 + z1) / 2); const uv = p.attributes.uv; const ps = p.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, ps.getX(k) / 14, ps.getZ(k) / 14); return p })
  const n1 = assets.waterNormals.clone(); n1.needsUpdate = true; n1.wrapS = n1.wrapT = THREE.RepeatWrapping
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x1aa7b8, roughness: 0.1, metalness: 0, normalMap: n1, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.9, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.08, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 })   // loses depth ties against nearby land
  const water = new THREE.Mesh(mergeAll(wg), waterMat); water.name = 'sea-river'; water.receiveShadow = true
  water.userData.n = n1; water.userData.speed = 0.012
  g.add(water)
  city.waters = city.waters || []; city.waters.push(water)
  if (city.sea) city.sea.visible = false

  const bridge = buildBridge(g)
  city.scene.add(g)
  return {
    group: g, terrain, water, bridge, heightAt,
    stats: { terrainTris: SEG * SEG * 2, bridgeTris: bridge.tris },
    setNight(n) { bridge.setNight(n); terrain.material.userData.U.uNight.value = n },
  }
}

function mergeAll(list) {
  const out = new THREE.BufferGeometry(), keys = ['position', 'normal', 'uv']
  for (const k of keys) { const arrs = list.map(l => l.attributes[k].array), size = list[0].attributes[k].itemSize, tot = arrs.reduce((s, a) => s + a.length, 0), dst = new Float32Array(tot); let o = 0; for (const a of arrs) { dst.set(a, o); o += a.length } out.setAttribute(k, new THREE.BufferAttribute(dst, size)) }
  const idx = []; let base = 0; for (const l of list) { for (const i of l.index.array) idx.push(i + base); base += l.attributes.position.count }
  out.setIndex(idx); return out
}

// ---------------------------------------------------------------------------------------------- bridge
// Suspension bridge on road column 4 (x = 0), from the city edge north across the river: two towers on the banks,
// main cables as sagging curves with vertical hangers, a deck with cyan edge lines and warm lamps.
function buildBridge(parent) {
  const x = roadCoord(4), z0 = -HALF - 4, z1 = -HALF - 168, deckY = 9, W = 16
  const lists = { concrete: [], steel: [], cable: [], cyan: [], lamp: [], asphalt: [] }
  const box = (k, cx, cy, cz, w, h, d) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(cx, cy, cz); lists[k].push(b) }
  const len = z0 - z1, mid = (z0 + z1) / 2
  // deck: ramps up from the avenue to deck height over the first / last 30 m, then level
  const ramp = 34
  for (const [a, b, ya, yb] of [[z0, z0 - ramp, 0.1, deckY], [z0 - ramp, z1 + ramp, deckY, deckY], [z1 + ramp, z1, deckY, deckY * 0.6]]) {
    const L = Math.abs(b - a), ang = Math.atan2(yb - ya, L)
    const d = new THREE.BoxGeometry(W, 0.9, Math.hypot(L, yb - ya)); d.rotateX(ang); d.translate(x, (ya + yb) / 2 - 0.45, (a + b) / 2); lists.concrete.push(d)
    const r = new THREE.BoxGeometry(W - 2, 0.05, Math.hypot(L, yb - ya)); r.rotateX(ang); r.translate(x, (ya + yb) / 2 + 0.03, (a + b) / 2); lists.asphalt.push(r)
    for (const s of [-1, 1]) { const e = new THREE.BoxGeometry(0.18, 0.12, Math.hypot(L, yb - ya)); e.rotateX(ang); e.translate(x + s * (W / 2 - 0.1), (ya + yb) / 2 + 0.55, (a + b) / 2); lists.cyan.push(e)
      const rail = new THREE.BoxGeometry(0.12, 1.1, Math.hypot(L, yb - ya)); rail.rotateX(ang); rail.translate(x + s * (W / 2 - 0.1), (ya + yb) / 2 + 0.5, (a + b) / 2); lists.steel.push(rail) }
  }
  // piers under the level span
  for (let zz = z0 - ramp; zz >= z1 + ramp; zz -= 24) box('concrete', x, deckY / 2 - 1, zz, 6, deckY - 1, 3)
  // towers: two legs + cross beams, on each bank
  const towerH = 62, tz = [z0 - ramp - 6, z1 + ramp + 6]
  for (const t of tz) for (const s of [-1, 1]) {
    box('concrete', x + s * (W / 2 + 1.2), towerH / 2, t, 2.4, towerH, 3.2)
    box('cyan', x + s * (W / 2 + 1.2), towerH / 2, t + 1.62, 0.25, towerH - 4, 0.06)
  }
  for (const t of tz) for (const y of [deckY + 14, towerH - 8, towerH - 1]) box('concrete', x, y, t, W + 4.8, 2, 2.6)
  // main cables: parabola between tower tops, extended down to anchors beyond each tower; hangers every 6 m
  for (const s of [-1, 1]) {
    const cx = x + s * (W / 2 + 0.6), pts = []
    const zA = z0 + 10, zB = z1 - 10
    for (let i = 0; i <= 80; i++) {
      const zz = zA + (zB - zA) * i / 80
      let y
      if (zz > tz[0]) y = deckY + (towerH - deckY) * (zA - zz) / (zA - tz[0])                  // back-stay up to the tower
      else if (zz < tz[1]) y = deckY + (towerH - deckY) * (zz - zB) / (tz[1] - zB)
      else { const u = (zz - (tz[0] + tz[1]) / 2) / ((tz[0] - tz[1]) / 2); y = deckY + 5 + (towerH - 1 - deckY - 5) * u * u }
      pts.push(new THREE.Vector3(cx, y, zz))
    }
    lists.cable.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.35, 6, false))
    for (let zz = tz[0] - 6; zz > tz[1] + 2; zz -= 6) {
      const u = (zz - (tz[0] + tz[1]) / 2) / ((tz[0] - tz[1]) / 2), y = deckY + 5 + (towerH - 1 - deckY - 5) * u * u
      box('cable', cx, (deckY + y) / 2, zz, 0.08, y - deckY, 0.08)
    }
  }
  // lamps along both kerbs
  for (let zz = z0 - 8; zz > z1 + 8; zz -= 14) for (const s of [-1, 1]) {
    const y = zz > z0 - ramp ? 0.1 + (deckY - 0.1) * (z0 - zz) / ramp : zz < z1 + ramp ? deckY * 0.6 + (deckY - deckY * 0.6) * (zz - z1) / ramp : deckY
    box('steel', x + s * (W / 2 - 0.6), y + 3, zz, 0.12, 6, 0.12)
    box('lamp', x + s * (W / 2 - 1.1), y + 6, zz, 1.0, 0.18, 0.4)
  }
  const mats = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.85 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e99a8, metalness: 0.7, roughness: 0.4 }),
    cable: new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 0.8, roughness: 0.35 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x3dd6f5, emissiveIntensity: 0.5, roughness: 0.4 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc77a, emissiveIntensity: 0.2 }),
  }
  const grp = new THREE.Group(); grp.name = 'celestial-bridge'; let tris = 0
  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue
    const geo = mergeAll(list.map(l => { const n = l.index ? l : l; if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n.index ? n : (() => { n.setIndex([...Array(n.attributes.position.count).keys()]); return n })() }))
    const mesh = new THREE.Mesh(geo, mats[k]); mesh.castShadow = k !== 'cyan' && k !== 'lamp'; mesh.receiveShadow = true; grp.add(mesh)
    tris += geo.index.count / 3
  }
  parent.add(grp)
  return { group: grp, tris, setNight(n) { mats.cyan.emissiveIntensity = 0.5 + n * 3.5; mats.lamp.emissiveIntensity = 0.2 + n * 3 } }
}
