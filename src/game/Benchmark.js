import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Visual benchmark: downtown block (4,1) rebuilt from authored kit modules (Quaternius Downtown City
// MegaKit + Stylized Nature MegaKit, CC0) plus a custom landmark. Art direction: futuristic Milan meets the
// Italian coast. Visual only: lot footprints, colliders and mission points are untouched (City.js still
// registers the same collider boxes for these lots).
export const BENCHMARK = { bx: 4, bz: 1 }
const Y0 = 0.18          // block slab top
const FLOOR = 3          // kit module storey height
const WHITE = new THREE.Color(1, 1, 1)
const col = (h) => new THREE.Color(h)

// palette: deep navy, sunset gold, cyan, violet + Italian stucco / travertine / terracotta
const C = {
  navyMetal: col(0xb4c2d6), graphite: col(0x58606e), champagne: col(0xf2dcb4), bronze: col(0xe0c49a),
  travertine: col(0xf3e6cc), ochre: col(0xe4b06a), sienna: col(0xd27c4f), cream: col(0xf6ead2), stone: col(0xe9dcc4),
  cyan: 0x3dd6f5, violet: 0x7b5cd6, gold: 0xf2b866,
}

// ---------------------------------------------------------------------------------------------- kit library
function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]
    if (a.array instanceof Float32Array && !a.normalized) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c)
    g.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize))
  }
  return g
}

export class Kit {
  constructor(gltf) {
    this.mods = {}
    for (const sc of gltf.scenes) {
      sc.updateMatrixWorld(true)
      const parts = []
      sc.traverse(o => {
        if (!o.isMesh) return
        const g = toFloat(o.geometry.clone()); g.applyMatrix4(o.matrixWorld); g.computeBoundingSphere()
        // the kit's window "rooms" are bare quads (their UVs were dropped because the source material had no
        // texture): map the room image across each quad from its own bounds
        if (o.material.name === 'MI_FakeInterior' && !g.attributes.uv) {
          g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2)
          for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x || 1); uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y || 1) }
          g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
        }
        parts.push({ g, m: o.material })
      })
      this.mods[sc.name] = parts
    }
  }
}

// Collects module placements and turns each (module part, material) pair into ONE InstancedMesh.
export class Batch {
  constructor(kits, matFor) { this.kits = kits; this.matFor = matFor; this.items = new Map() }
  // color: the building tint (frames, walls); room: the interior lighting variation; glass is never tinted
  add(name, mtx, color = WHITE, opts = {}, room = WHITE) {
    const parts = this.kits.find(k => k.mods[name])?.mods[name]
    if (!parts) throw new Error('kit module missing: ' + name)
    parts.forEach((p, i) => {
      const mat = this.matFor(p.m, name, opts); if (!mat) return
      const key = name + '|' + i + '|' + mat.uuid
      let it = this.items.get(key); if (!it) this.items.set(key, it = { name, g: p.g, mat, mtx: [], col: [] })
      it.mtx.push(mtx.clone()); it.col.push(p.m.name === 'MI_FakeInterior' ? room : p.m.name === 'MI_Glass' ? WHITE : color)
    })
  }
  build(group, stats) {
    for (const it of this.items.values()) {
      const im = new THREE.InstancedMesh(it.g, it.mat, it.mtx.length); im.name = it.name
      it.mtx.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, it.col[i]) })
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true
      im.castShadow = !it.mat.transparent; im.receiveShadow = true
      im.computeBoundingSphere()
      group.add(im)
      stats.instances += it.mtx.length; stats.tris += it.mtx.length * (it.g.index ? it.g.index.count : it.g.attributes.position.count) / 3
    }
  }
}

// ---------------------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8; return t
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// curtain wall of the landmark: 8 bays x 16 storeys per tile; map = glass/mullions, emissive = lit panes
function curtainTextures() {
  const r = rng(41), cols = 8, rows = 16, W = 512, H = 1024
  const lit = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) lit.push(r())
  const map = canvasTex(W, H, (g) => {
    const cw = W / cols, ch = H / rows
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = 0.75 + lit[j * cols + i] * 0.25
      const grd = g.createLinearGradient(0, j * ch, 0, (j + 1) * ch); grd.addColorStop(0, `rgb(${120 * v},${170 * v},${195 * v})`); grd.addColorStop(1, `rgb(${52 * v},${86 * v},${112 * v})`)
      g.fillStyle = grd; g.fillRect(i * cw, j * ch, cw, ch)
    }
    g.fillStyle = '#c9d2dc'; for (let i = 0; i <= cols; i++) g.fillRect(i * W / cols - 2, 0, 4, H)   // mullions
    g.fillStyle = '#20262f'; for (let j = 0; j <= rows; j++) g.fillRect(0, j * H / rows - 5, W, 10)  // spandrels
  }, { repeat: true })
  const emissive = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
    const cw = W / cols, ch = H / rows
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = lit[j * cols + i]; if (x < 0.45) continue
      g.fillStyle = x > 0.9 ? '#9fe9ff' : x > 0.7 ? '#ffd9a0' : '#f5c27a'
      g.fillRect(i * cw + 4, j * ch + 8, cw - 8, ch - 16)
    }
  }, { repeat: true })
  return { map, emissive }
}

// travertine piazza paving: offset rectangular slabs with a darker border course
function pavingTex() {
  const r = rng(9)
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#d9cfbd'; g.fillRect(0, 0, W, H)
    const rows = 8, ch = H / rows
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * 48
      for (let x = -off; x < W; x += 96) {
        const t = 200 + r() * 30
        g.fillStyle = `rgb(${t + 12},${t + 2},${t - 18})`; g.fillRect(x + 2, j * ch + 2, 92, ch - 4)
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(150,130,100,${0.08 + r() * 0.1})`; g.fillRect(x + 4 + r() * 80, j * ch + 4 + r() * (ch - 10), 4 + r() * 18, 1 + r() * 2) }
      }
    }
  }, { repeat: true })
}

// ---------------------------------------------------------------------------------------------- builder
export function buildBenchmark(scene, assets, lots) {
  const group = new THREE.Group(); group.name = 'benchmark'
  const kit = new Kit(assets.kit.downtown), nature = new Kit(assets.kit.nature)
  const stats = { instances: 0, tris: 0 }

  // ---- materials (shared)
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fb0cc, metalness: 0.6, roughness: 0.12, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 1.8 })
  const interior = assets.kit.interiors.map((t, i) => {
    t.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.14, roughness: 0.9, metalness: 0 })
    m.name = 'interior' + i
    // the per-instance colour also scales the emissive, so unlit / dim rooms stay dark at night (three defines
    // USE_COLOR in the fragment stage for instance colours)
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif') }
    return m
  })
  const stucco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0 })
  const cache = new Map()
  const variant = (src, key, setup) => { const k = src.uuid + key; if (!cache.has(k)) { const m = src.clone(); m.vertexColors = false; setup(m); cache.set(k, m) } return cache.get(k) }
  const matFor = (m, mod, o) => {
    const n = m.name
    if (n === 'MI_Glass') return glass
    if (n === 'MI_FakeInterior') return interior[o.iv ?? 0]
    if (n === 'MI_InteriorWall' && o.stucco) return stucco
    if (n === 'MI_Roof_Slate') return variant(m, 'terracotta', (x) => { x.color.setRGB(2.3, 1.15, 0.72) })
    return variant(m, 'base', (x) => { x.envMapIntensity = 1.4 })
  }
  const B = new Batch([kit, nature], matFor)

  // ---- placement helpers
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4()
  const place = (name, x, y, z, yaw, sx = 1, sy = 1, sz = 1, color = WHITE, opts = {}, room = WHITE) => {
    q.setFromAxisAngle(up, yaw); M4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); B.add(name, M4, color, opts, room)
  }
  // four facades of a rectangle. Kit modules face +z with their depth behind the face, so a module turned
  // by yaw sits on the edge line and extends into the lot.
  const sidesOf = (r) => [
    { yaw: Math.PI, sx: r.x0 + r.w, sz: r.z0, tx: -1, tz: 0, len: r.w, name: 'N' },
    { yaw: 0, sx: r.x0, sz: r.z0 + r.d, tx: 1, tz: 0, len: r.w, name: 'S' },
    { yaw: Math.PI / 2, sx: r.x0 + r.w, sz: r.z0 + r.d, tx: 0, tz: -1, len: r.d, name: 'E' },
    { yaw: -Math.PI / 2, sx: r.x0, sz: r.z0, tx: 0, tz: 1, len: r.d, name: 'W' },
  ]
  let hashN = 0
  const hash = () => { hashN = (hashN * 1103515245 + 12345) >>> 0; return hashN / 4294967296 }
  // one storey of modules all round; pick(side, i, n) may return a different module name per bay
  const storey = (r, y, modW, pick, color, opts = {}) => {
    for (const s of sidesOf(r)) {
      const n = Math.max(1, Math.round(s.len / modW)), seg = s.len / n
      for (let i = 0; i < n; i++) {
        const name = typeof pick === 'function' ? pick(s, i, n) : pick; if (!name) continue
        const x = s.sx + s.tx * seg * (i + 0.5), z = s.sz + s.tz * seg * (i + 0.5)
        const h = hash(), iv = h < 0.4 ? 0 : h < 0.75 ? 1 : 2
        // interior rooms: most warm-lit, some dim (blinds), a few dark
        const k = hash(), room = k < 0.3 ? new THREE.Color(0.1, 0.1, 0.12) : k < 0.55 ? new THREE.Color(0.45, 0.42, 0.4) : WHITE
        place(name, x, y, z, s.yaw, seg / modW, 1, 1, color, { ...opts, iv }, room)
      }
    }
  }
  const corners = (r, y0, y1, name, color, w = 0.5) => {
    for (const [cx, cz] of [[r.x0, r.z0], [r.x0 + r.w, r.z0], [r.x0, r.z0 + r.d], [r.x0 + r.w, r.z0 + r.d]])
      for (let y = y0; y < y1 - 0.01; y += FLOOR) place(name, cx, y, cz, 0, w / 0.5, 1, w / 0.5, color)
  }
  const proc = { wash: [], pool: [], fin: [], metal: [], dark: [], stuccoP: [], terracotta: [], cyan: [], violet: [], gold: [], curtain: [], travertine: [], paving: [] }
  const box = (key, cx, cy, cz, w, h, d, yaw = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (yaw) g.rotateY(yaw); g.translate(cx, cy, cz); proc[key].push(g); return g }

  // night-only light: a warm wash rising up a facade (vertical gradient quad just in front of it) and warm
  // pools on the paving under lamps; additive, so they cost one draw call each and no real lights
  const wash = (r, y0, h) => {
    for (const s2 of sidesOf(r)) {
      const g = new THREE.PlaneGeometry(s2.len, h); g.rotateY(s2.yaw); const nx = Math.sin(s2.yaw), nz = Math.cos(s2.yaw)
      g.translate(s2.sx + s2.tx * s2.len / 2 + nx * 0.45, y0 + h / 2, s2.sz + s2.tz * s2.len / 2 + nz * 0.45); proc.wash.push(g)
    }
  }
  const pool = (x, z, rad) => { const g = new THREE.PlaneGeometry(rad * 2, rad * 2); g.rotateX(-Math.PI / 2); g.translate(x, Y0 + 0.03, z); proc.pool.push(g) }
  const byPos = {}
  for (const L of lots) byPos[(L.rx > 18 ? 'E' : 'W') + (L.rz > 18 ? 'S' : 'N')] = L
  const rectOf = (L) => ({ x0: L.x0, z0: L.z0, w: L.w, d: L.d })

  // ================================================= 1. AKSHAT TOWER (NE): twisting glass tower with fins,
  // cyan light lines and planted terraces (Bosco Verticale nod), on a champagne-metal podium
  {
    const L = byPos.EN, r = rectOf(L), cx = r.x0 + r.w / 2, cz = r.z0 + r.d / 2
    storey(r, Y0, 2, (s, i, n) => (s.name === 'N' || s.name === 'W') && i === Math.floor(n / 2) ? 'DoorFrame_Metal_Single' : 'Metal_FirstFloor_Window', C.champagne)
    for (let f = 1; f < 3; f++) storey(r, Y0 + f * FLOOR, 2, 'Metal_FullWindow', C.champagne)
    corners(r, Y0, Y0 + 3 * FLOOR, 'Metal_Column_Center', C.champagne, 0.7)
    storey(r, Y0 + 3 * FLOOR, 2, 'Cornice_Metal_Center', C.champagne)
    const base = Y0 + 3 * FLOOR + 1, top = L.h + 6, F = 3.4, S = 11.2, twist = THREE.MathUtils.degToRad(70)
    const floors = Math.floor((top - base) / F)
    box('dark', cx, base - 0.4, cz, r.w - 0.4, 0.8, r.d - 0.4)   // podium roof
    const curtain = [], uvTile = 16
    for (let f = 0; f < floors; f++) {
      const y = base + f * F, a = twist * f / floors, taper = 1 - 0.22 * Math.pow(f / floors, 1.5), s = S * taper
      // glass band with per-floor UV offset into the 16-storey curtain texture
      const g = new THREE.BoxGeometry(s, F - 0.35, s); const uv = g.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setY(k, ((f % uvTile) + uv.getY(k)) / uvTile)
      g.rotateY(a); g.translate(cx, y + (F - 0.35) / 2 + 0.35, cz); curtain.push(g)
      box('metal', cx, y + 0.17, cz, s + 0.5, 0.35, s + 0.5, a)                 // slab edge
      if (f % 3 === 0) box('cyan', cx, y + 0.36, cz, s + 0.52, 0.05, s + 0.52, a)   // light line on every 3rd slab
      // vertical fins: three per face + corners
      for (let k = 0; k < 4; k++) {
        const fa = a + k * Math.PI / 2
        for (const t of [-0.5, -0.17, 0.17, 0.5]) {
          const lx = t * s, lz = s / 2 + 0.22, ca = Math.cos(fa), sa = Math.sin(fa)
          box('fin', cx + lx * ca + lz * sa, y + F / 2, cz - lx * sa + lz * ca, 0.16, F, 0.45, fa)
        }
      }
      // planted terraces every other storey on two opposite corners, rotating with the twist
      if (f % 2 === 1 && f < floors - 3) for (const k of [0, 2, 1, 3].slice(0, f % 4 === 1 ? 2 : 4)) {
        const ca = a + k * Math.PI / 2 + Math.PI / 4, rr = s * 0.68
        const px = cx + Math.sin(ca) * rr, pz = cz + Math.cos(ca) * rr
        box('dark', px, y + 0.2, pz, 1.9, 0.5, 1.9, a)
        place('Bush_Common_Flowers', px, y + 0.45, pz, ca, 1.0, 0.9, 1.0)
      }
    }
    proc.curtain.push(...curtain)
    // crown: three tapering glass tiers, violet-cyan halo, mast with beacon
    const yTop = base + floors * F
    for (let k = 0; k < 3; k++) { const s = S * (0.82 - k * 0.2); box('curtain', cx, yTop + k * 3 + 1.5, cz, s, 3, s, twist + k * 0.2); box('metal', cx, yTop + k * 3 + 3.05, cz, s + 0.4, 0.2, s + 0.4, twist + k * 0.2) }
    const halo = new THREE.TorusGeometry(S * 0.42, 0.18, 8, 48); halo.rotateX(Math.PI / 2); halo.translate(cx, yTop + 10, cz); proc.violet.push(halo)
    const halo2 = new THREE.TorusGeometry(S * 0.3, 0.12, 8, 40); halo2.rotateX(Math.PI / 2); halo2.translate(cx, yTop + 11.6, cz); proc.cyan.push(halo2)
    const mast = new THREE.CylinderGeometry(0.12, 0.35, 16, 8); mast.translate(cx, yTop + 17, cz); proc.metal.push(mast)
    box('cyan', cx, yTop + 25.2, cz, 0.5, 0.5, 0.5)
    group.userData.towerTop = yTop + 25
  }

  // ================================================= 2. GLASS & METAL TOWER (SE): kit curtain modules in navy metal
  {
    const L = byPos.ES, r = rectOf(L)
    storey(r, Y0, 2, (s, i, n) => (s.name === 'S' || s.name === 'E') && i === Math.floor(n / 2) ? 'DoorFrame_Metal_Single' : 'Metal_FirstFloor_Window', C.graphite)
    const floors = Math.floor((L.h - 1) / FLOOR)
    for (let f = 1; f < floors; f++) storey(r, Y0 + f * FLOOR, 2, f % 8 === 0 ? 'Metal_Plain_3' : 'Metal_FullWindow', C.navyMetal)
    corners(r, Y0, Y0 + floors * FLOOR, 'Metal_Column_Center', C.navyMetal, 0.6)
    const yt = Y0 + floors * FLOOR
    storey(r, yt, 2, 'Cornice_Metal_Center', C.navyMetal)
    box('dark', r.x0 + r.w / 2, yt + 0.4, r.z0 + r.d / 2, r.w - 0.3, 0.8, r.d - 0.3)
    // gold crown band and a cyan reveal under it
    box('gold', r.x0 + r.w / 2, yt + 1.6, r.z0 + r.d / 2, r.w + 0.3, 0.5, r.d + 0.3)
    box('cyan', r.x0 + r.w / 2, yt + 1.25, r.z0 + r.d / 2, r.w + 0.32, 0.08, r.d + 0.32)
    place('Prop_ACUnit', r.x0 + 3, yt + 0.8, r.z0 + 3, 0, 1.5, 1.5, 1.5); place('Prop_ACUnit', r.x0 + 6, yt + 0.8, r.z0 + 3, 0, 1.5, 1.5, 1.5)
  }

  // ================================================= 3. TORRE (SW): Milanese rationalist tower: travertine
  // arcade base, bronze curtain bays framed by stucco piers, arched loggia crown and a terracotta roof
  {
    const L = byPos.WS, r = rectOf(L), opts = { stucco: true }
    storey(r, Y0, 4, 'Brick_Inset_Window_Curved', C.travertine, opts)
    storey(r, Y0 + FLOOR, 4, 'Brick_Inset_Window_Curved', C.travertine, opts)
    storey(r, Y0 + 2 * FLOOR, 2, 'Cornice_Trim_Center', C.travertine)
    const body = 14
    for (let f = 0; f < body; f++) {
      const y = Y0 + (2 + f) * FLOOR + 1
      storey(r, y, 2, 'Metal_FullWindow', C.bronze)
      // stucco piers at every second bay joint
      for (const s of sidesOf(r)) { const n = Math.round(s.len / 2), seg = s.len / n; for (let i = 0; i <= n; i += 2) place('Trim_Column_Center', s.sx + s.tx * seg * i, y, s.sz + s.tz * seg * i, s.yaw, 0.8, 1, 0.8, C.travertine) }
    }
    const yl = Y0 + (2 + body) * FLOOR + 1
    storey(r, yl - 0.5, 2, 'Cornice_Trim_Center', C.cream)
    storey(r, yl + 0.5, 4, 'Brick_Inset_Window_Curved', C.cream, opts)
    storey(r, yl + 0.5 + FLOOR, 4, 'Brick_Inset_Window_Curved', C.cream, opts)
    const yc = yl + 0.5 + 2 * FLOOR
    storey(r, yc, 2, 'Cornice_Trim_Center', C.cream)
    storey(r, yc + 1, 2, 'Roof_SlateCornice_Center', WHITE)
    box('terracotta', r.x0 + r.w / 2, yc + 3.6, r.z0 + r.d / 2, r.w - 4, 0.4, r.d - 4)
    wash(r, Y0, 2 * FLOOR + 1); wash(r, yl, yc - yl + 1)
  }

  // ================================================= 4. PALAZZO (NW): ochre palazzo with rusticated arched
  // base, piano nobile, deep cornice and terracotta roof; the warm transition to the older streets (west)
  {
    const L = byPos.WN, r = rectOf(L), opts = { stucco: true }
    storey(r, Y0, 4, 'Brick_Inset_Window_Curved', C.stone, opts)
    storey(r, Y0 + FLOOR, 2, 'Cornice_Trim_Center', C.stone)
    for (let f = 1; f <= 5; f++) storey(r, Y0 + f * FLOOR + 0.6, 2, 'Brick_Window_Square_Single', f === 1 ? C.sienna : C.ochre, opts)
    corners(r, Y0 + FLOOR + 0.6, Y0 + 6 * FLOOR + 0.6, 'Trim_Column_Center', C.stone, 0.7)
    const yc = Y0 + 6 * FLOOR + 0.6
    storey(r, yc, 2, 'Cornice_Trim_Center', C.stone)
    storey(r, yc + 1, 2, 'Roof_SlateCornice_Center', WHITE)
    box('terracotta', r.x0 + r.w / 2, yc + 3.6, r.z0 + r.d / 2, r.w - 4, 0.4, r.d - 4)
    wash(r, Y0, yc - Y0 + 1)
  }

  // ================================================= streetscape: travertine paseo through the block centre,
  // cypress planters at the curb, flower planters, bollards, lamps with cyan rings, light lines in the paving
  {
    const bx0 = Math.min(...lots.map(l => l.x0)) - 3.2, bz0 = Math.min(...lots.map(l => l.z0)) - 3.2, BS = 36
    const mid = BS / 2, alley = 3.2
    const pave = (x0, z0, w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, Y0 + 0.012, z0 + d / 2); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 6, uv.getY(k) * d / 6); proc.paving.push(g) }
    pave(bx0 + mid - alley / 2, bz0 + 3.2, alley, BS - 6.4)           // north-south paseo
    pave(bx0 + 3.2, bz0 + mid - alley / 2, BS - 6.4, alley)           // east-west paseo
    pave(bx0, bz0, BS, 3.2); pave(bx0, bz0 + BS - 3.2, BS, 3.2)       // perimeter ring
    pave(bx0, bz0 + 3.2, 3.2, BS - 6.4); pave(bx0 + BS - 3.2, bz0 + 3.2, 3.2, BS - 6.4)
    // cyan light lines along the paseo edges, flush with the paving
    for (const s of [-1, 1]) { box('cyan', bx0 + mid + s * (alley / 2 - 0.15), Y0 + 0.02, bz0 + mid, 0.06, 0.02, BS - 6.6); box('cyan', bx0 + mid, Y0 + 0.02, bz0 + mid + s * (alley / 2 - 0.15), BS - 6.6, 0.02, 0.06) }
    // centre: a low travertine medallion with a gold inlay ring (flush, walkable)
    const ring = new THREE.RingGeometry(1.05, 1.25, 40); ring.rotateX(-Math.PI / 2); ring.translate(bx0 + mid, Y0 + 0.02, bz0 + mid); proc.gold.push(ring)
    // curb-side cypress planters (north and west faces = the street sides that the views look at) and the
    // south / east faces; skip block corners (crossings) and paseo mouths
    const cypress = (x, z) => { place('Prop_Planter_Single', x, Y0, z, 0, 0.6, 0.9, 0.6); place('CommonTree_3', x, Y0 + 0.4, z, hash() * 6.28, 0.62, 0.68, 0.62) }
    for (const t of [6.5, 12, 24, 29.5]) { cypress(bx0 + t, bz0 + 0.9); cypress(bx0 + 0.9, bz0 + t); cypress(bx0 + t, bz0 + BS - 0.9); cypress(bx0 + BS - 0.9, bz0 + t) }
    // paseo: flower planters against the facades, bollards at each mouth, lamps
    for (const s of [-1, 1]) for (const t of [8, 28]) {
      place('Sidewalk_Planter', bx0 + mid + s * 1.12, Y0, bz0 + t, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0.55, 1, 0.55)
      place('Bush_Common_Flowers', bx0 + mid + s * 1.12, Y0 + 0.3, bz0 + t, hash() * 6, 0.45, 0.45, 0.45)
      place('Sidewalk_Planter', bx0 + t, Y0, bz0 + mid + s * 1.12, s > 0 ? Math.PI : 0, 0.55, 1, 0.55)
      place('Bush_Common_Flowers', bx0 + t, Y0 + 0.3, bz0 + mid + s * 1.12, hash() * 6, 0.45, 0.45, 0.45)
    }
    for (const [x, z] of [[mid, 3.4], [mid, BS - 3.4], [3.4, mid], [BS - 3.4, mid]]) for (const s of [-1, 1]) {
      const along = x === mid ? [s * 1.0, 0] : [0, s * 1.0]
      place('Prop_Bollard', bx0 + x + along[0], Y0, bz0 + z + along[1], 0, 1.2, 1.1, 1.2)
    }
    const lamp = (x, z) => {
      const p = new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8); p.translate(x, Y0 + 2.3, z); proc.dark.push(p)
      const ring = new THREE.TorusGeometry(0.32, 0.045, 6, 24); ring.rotateX(Math.PI / 2); ring.translate(x, Y0 + 4.55, z); proc.cyan.push(ring)
      const cap = new THREE.CylinderGeometry(0.36, 0.3, 0.12, 16); cap.translate(x, Y0 + 4.68, z); proc.dark.push(cap)
      const glow = new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16); glow.translate(x, Y0 + 4.6, z); proc.gold.push(glow)
      pool(x, z, 3.2)
    }
    for (const [x, z] of [[mid - 1.3, 12.5], [mid + 1.3, 23.5], [12.5, mid + 1.3], [23.5, mid - 1.3]]) lamp(bx0 + x, bz0 + z)
    for (const t of [3, 18, 33]) { lamp(bx0 + t, bz0 + 2.2); lamp(bx0 + 2.2, bz0 + t) }
    // travertine benches along the paseo
    for (const [x, z, yaw] of [[mid - 1.25, 15, 0], [mid + 1.25, 21, 0], [15, mid + 1.25, Math.PI / 2], [21, mid - 1.25, Math.PI / 2]]) box('travertine', bx0 + x, Y0 + 0.23, bz0 + z, 0.5, 0.46, 2.2, yaw)
  }

  // ---- procedural materials (one merged mesh each)
  const curtainT = curtainTextures()
  const pm = {
    metal: new THREE.MeshStandardMaterial({ color: 0x8e99a8, metalness: 0.7, roughness: 0.42, envMapIntensity: 1.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.6, roughness: 0.45 }),
    fin: new THREE.MeshStandardMaterial({ color: 0xd8c08f, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.3 }),
    stuccoP: new THREE.MeshStandardMaterial({ color: 0xe4b06a, roughness: 0.92 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xc0623c, roughness: 0.85 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: C.cyan, emissiveIntensity: 0.6, roughness: 0.4 }),
    violet: new THREE.MeshStandardMaterial({ color: 0x1a1230, emissive: C.violet, emissiveIntensity: 0.6, roughness: 0.4 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a04a, emissive: C.gold, emissiveIntensity: 0.15, metalness: 0.8, roughness: 0.3 }),
    curtain: new THREE.MeshStandardMaterial({ map: curtainT.map, emissiveMap: curtainT.emissive, emissive: 0xffffff, emissiveIntensity: 0, metalness: 0.45, roughness: 0.18, envMapIntensity: 1.4 }),
    travertine: new THREE.MeshStandardMaterial({ color: 0xeadfc8, roughness: 0.8 }),
    paving: new THREE.MeshStandardMaterial({ map: pavingTex(), roughness: 0.85 }),
    wash: new THREE.MeshBasicMaterial({ map: canvasTex(64, 256, (g, W, H) => {
      const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.35, 'rgba(255,170,90,0.45)'); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H)
      // fade the sides so a wash never ends in a hard edge at a building corner
      g.globalCompositeOperation = 'destination-in'; const hz = g.createLinearGradient(0, 0, W, 0); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.18, 'rgba(0,0,0,1)'); hz.addColorStop(0.82, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hz; g.fillRect(0, 0, W, H)
    }), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }),
    pool: new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g, W) => { const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.5, 'rgba(255,190,120,0.35)'); gr.addColorStop(1, 'rgba(255,170,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W) }), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  }
  for (const [k, list] of Object.entries(proc)) {
    if (!list.length) continue
    const g = mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x)); g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, pm[k]); mesh.castShadow = !['paving', 'cyan', 'wash', 'pool'].includes(k); mesh.receiveShadow = true; mesh.name = 'bench-' + k
    group.add(mesh); stats.tris += g.attributes.position.count / 3
  }
  B.build(group, stats)
  scene.add(group)

  const api = {
    group, stats, materials: pm, interior,
    setNight(n) {
      for (const m of interior) m.emissiveIntensity = 0.14 + n * 1.9
      glass.opacity = 0.62 - n * 0.27   // at night the glass reads darker and the lit rooms come through
      pm.curtain.emissiveIntensity = n * 1.3
      pm.cyan.emissiveIntensity = 0.6 + n * 2.6
      pm.violet.emissiveIntensity = 0.6 + n * 2.4
      pm.gold.emissiveIntensity = 0.15 + n * 1.6
      pm.wash.opacity = n * 0.42; pm.pool.opacity = n * 0.7
      pm.wash.visible = pm.pool.visible = n > 0.02
    },
  }
  return api
}
