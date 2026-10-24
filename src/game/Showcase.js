import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Showcase block (downtown block 3,1, its two south lots): a hand-detailed street to judge the
// handcrafted art direction before rolling it out. Procedural only, no downloaded assets.
// Everything writes into City's material buckets (merged once), uses its own seeded generator,
// and registers no colliders; the lot rectangles and their colliders stay exactly as before.

export const SHOWCASE = { bx: 3, bz: 1 }
export const SHOWCASE_BUCKETS = ['brickTex', 'siding', 'showPaving', 'interior', 'awningStripe', 'showSign', 'props', 'clearGlass']

// ---------------------------------------------------------------- textures

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }
function tex(c, repeat = true) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// running-bond brick, 16 courses per 2.4 m tile; mortar light, bricks varied
function brickTexture() {
  const [c, g] = canvas(512, 512), r = rng(11)
  g.fillStyle = '#d9cfc2'; g.fillRect(0, 0, 512, 512)
  const rows = 16, rh = 512 / rows, bw = 512 / 6
  for (let y = 0; y < rows; y++) for (let x = -1; x < 7; x++) {
    const ox = (y % 2) * bw / 2, l = 0.82 + r() * 0.28
    const base = [[176, 82, 58], [160, 74, 52], [190, 96, 66], [150, 70, 50]][Math.floor(r() * 4)]
    g.fillStyle = `rgb(${base.map(v => Math.min(255, v * l)).join(',')})`
    g.fillRect(x * bw + ox + 3, y * rh + 3, bw - 6, rh - 6)
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x * bw + ox + 3, y * rh + 3, bw - 6, 3)
  }
  return tex(c)
}

// painted clapboard siding, 12 boards per 2.4 m tile, white (tinted per building)
function sidingTexture() {
  const [c, g] = canvas(256, 512)
  const n = 12, bh = 512 / n
  for (let i = 0; i < n; i++) {
    const grd = g.createLinearGradient(0, i * bh, 0, (i + 1) * bh)
    grd.addColorStop(0, '#f2f0ec'); grd.addColorStop(0.85, '#e4e1db'); grd.addColorStop(1, '#a9a49b')
    g.fillStyle = grd; g.fillRect(0, i * bh, 256, bh)
  }
  return tex(c)
}

// 0.6 m pavers in three tones with joints (4 × 4 per 2.4 m tile), half-offset rows
function pavingTexture() {
  const [c, g] = canvas(512, 512), r = rng(5)
  g.fillStyle = '#8f8a82'; g.fillRect(0, 0, 512, 512)
  const s = 128
  for (let y = 0; y < 4; y++) for (let x = -1; x < 5; x++) {
    const ox = (y % 2) * s / 2
    g.fillStyle = ['#d6cfc3', '#cbc3b5', '#ddd7cc', '#c4bcae'][Math.floor(r() * 4)]
    g.fillRect(x * s + ox + 3, y * s + 3, s - 6, s - 6)
  }
  return tex(c)
}

function stripeTexture() {
  const [c, g] = canvas(256, 256)
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3ead8' : '#c8423a'; g.fillRect(i * 32, 0, 32, 200) }
  // scalloped valance edge in the lower band (transparent between scallops)
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3ead8' : '#c8423a'; g.beginPath(); g.arc(i * 32 + 16, 200, 16, 0, Math.PI); g.fill() }
  return tex(c)
}

// two shop interiors side by side: café (left half), bookshop (right half)
function interiorTexture() {
  const [c, g] = canvas(1024, 384)
  const room = (x0, wall, items) => {
    g.fillStyle = wall; g.fillRect(x0, 0, 512, 384)
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, 300, 512, 84)       // floor shadow
    g.fillStyle = '#6b4a33'; g.fillRect(x0, 300, 512, 84)                // floor
    for (let i = 0; i < 4; i++) {                                        // pendant lamps
      const x = x0 + 64 + i * 128
      g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 46); g.stroke()
      g.fillStyle = '#2d2d2d'; g.beginPath(); g.moveTo(x - 18, 62); g.lineTo(x + 18, 62); g.lineTo(x + 8, 46); g.lineTo(x - 8, 46); g.fill()
      const gl = g.createRadialGradient(x, 66, 2, x, 66, 46); gl.addColorStop(0, 'rgba(255,226,150,0.9)'); gl.addColorStop(1, 'rgba(255,226,150,0)'); g.fillStyle = gl; g.fillRect(x - 46, 50, 92, 70)
    }
    items(x0)
  }
  room(0, '#e9d6b6', (x0) => {                                           // café
    g.fillStyle = '#2f5d50'; g.fillRect(x0 + 40, 96, 200, 70)            // menu board
    g.fillStyle = '#f3ead8'; g.font = 'bold 22px Georgia, serif'; g.fillText('MENU', x0 + 105, 124)
    g.font = '14px Georgia, serif'; g.fillText('espresso  ·  latte  ·  chai', x0 + 52, 150)
    for (let s = 0; s < 3; s++) { g.fillStyle = '#7a5638'; g.fillRect(x0 + 290, 110 + s * 50, 190, 8)
      for (let j = 0; j < 7; j++) { g.fillStyle = ['#c8423a', '#e2a33c', '#f3ead8', '#3c5a99', '#2b7a78'][(s + j) % 5]; g.fillRect(x0 + 296 + j * 26, 84 + s * 50, 18, 26) } }
    g.fillStyle = '#5a3d29'; g.fillRect(x0 + 20, 220, 470, 80)           // counter
    g.fillStyle = '#8c6a4c'; g.fillRect(x0 + 20, 214, 470, 10)
    g.fillStyle = '#b9b2a6'; g.fillRect(x0 + 360, 176, 70, 40)           // espresso machine
    for (let j = 0; j < 6; j++) { g.fillStyle = ['#f0c48a', '#d98b5f', '#f3ead8'][j % 3]; g.beginPath(); g.arc(x0 + 70 + j * 40, 210, 13, Math.PI, 0); g.fill() }
  })
  room(512, '#d8e1d9', (x0) => {                                         // bookshop
    for (let s = 0; s < 5; s++) { g.fillStyle = '#6b4a33'; g.fillRect(x0 + 24, 80 + s * 44, 464, 8)
      let x = x0 + 30; const rr = rng(40 + s); while (x < x0 + 480) { const w = 8 + rr() * 12, h = 26 + rr() * 12; g.fillStyle = ['#c8423a', '#3c5a99', '#e2a33c', '#2b7a78', '#7b4b94', '#f3ead8'][Math.floor(rr() * 6)]; g.fillRect(x, 80 + s * 44 - h, w, h); x += w + 2 } }
    g.fillStyle = '#5a3d29'; g.fillRect(x0 + 140, 250, 230, 50)          // display table
    for (let j = 0; j < 6; j++) { g.fillStyle = ['#c8423a', '#3c5a99', '#e2a33c'][j % 3]; g.fillRect(x0 + 152 + j * 36, 236, 28, 14) }
  })
  return tex(c, false)
}

// sign atlas: [0] café fascia, [1] round café blade sign, [2] bookshop fascia
function signTexture() {
  const [c, g] = canvas(1024, 512)
  g.clearRect(0, 0, 1024, 512)
  // café fascia (0..1024 × 0..170)
  g.fillStyle = '#244a40'; g.fillRect(0, 0, 1024, 170)
  g.strokeStyle = '#d9b36a'; g.lineWidth = 8; g.strokeRect(14, 14, 996, 142)
  g.fillStyle = '#f3e3bf'; g.font = 'bold 92px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('CODE & COFFEE', 512, 92)
  // blade sign disc (0..340 × 170..510)
  g.fillStyle = '#d9b36a'; g.beginPath(); g.arc(170, 340, 166, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#244a40'; g.beginPath(); g.arc(170, 340, 150, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#f3e3bf'; g.fillRect(110, 300, 100, 90); g.beginPath(); g.arc(210, 340, 28, -Math.PI / 2, Math.PI / 2); g.lineWidth = 14; g.strokeStyle = '#f3e3bf'; g.stroke()
  g.fillRect(96, 392, 128, 12)
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(130 + i * 30, 290); g.bezierCurveTo(120 + i * 30, 270, 145 + i * 30, 260, 132 + i * 30, 238); g.lineWidth = 6; g.stroke() }
  // bookshop fascia (360..1024 × 200..330)
  g.fillStyle = '#3c3a6e'; g.fillRect(360, 200, 664, 130)
  g.strokeStyle = '#e2c27a'; g.lineWidth = 6; g.strokeRect(372, 212, 640, 106)
  g.fillStyle = '#f3ead8'; g.font = 'bold 64px Georgia, serif'; g.fillText('PIXEL BOOKS', 692, 268)
  const t = tex(c, false); return t
}

export function makeShowcaseMaterials() {
  const m = {}
  const mk = (map, tile, extra = {}) => { const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, vertexColors: true, ...extra }); if (tile) mat.userData.tile = tile; return mat }
  m.brickTex = mk(brickTexture(), 2.4)
  m.siding = mk(sidingTexture(), 2.4)
  m.showPaving = mk(pavingTexture(), 2.4, { roughness: 0.95 })
  const interior = interiorTexture()
  m.interior = new THREE.MeshStandardMaterial({ map: interior, emissiveMap: interior, emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.9, vertexColors: true })
  m.awningStripe = mk(stripeTexture(), 0, { side: THREE.DoubleSide, alphaTest: 0.5, transparent: false })
  const sign = signTexture()
  m.showSign = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true })
  m.props = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05, vertexColors: true })
  // shop windows you can see into: faint tint, sharp reflections, mostly transparent
  m.clearGlass = new THREE.MeshPhysicalMaterial({ color: 0xdbeaf2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.2, depthWrite: false, vertexColors: true })
  return m
}

export function showcaseNight(m, n) {
  m.interior.emissiveIntensity = 0.18 + n * 0.85
  m.showSign.emissiveIntensity = 0.05 + n * 0.9
}

// ---------------------------------------------------------------- geometry helpers

function tint(g, color) {
  const c = new THREE.Color(color ?? 0xffffff), n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g
}
// atlas sub-rectangle in pixel coords of a W × H texture
function uvRect(g, x0, y0, x1, y1, W, H) {
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / W, 1 - (y1 - uv.getY(i) * (y1 - y0)) / H)
  return g
}
// a facade frame: centre (cx, cz) on the wall line, rotation so local +z is the outward normal
function face(cx, cz, nx, nz, len) { const rot = Math.atan2(nx, nz); return { cx, cz, rot, nx, nz, tx: Math.cos(rot), tz: -Math.sin(rot), len } }
function put(g, F, u, y, out) { g.rotateY(F.rot); g.translate(F.cx + F.tx * u + F.nx * out, y, F.cz + F.tz * u + F.nz * out); return g }

class Builder {
  constructor(city) { this.c = city; this.geo = city.geo }
  add(key, g, color) {
    // every geometry in a bucket must be indexed to merge (RoundedBoxGeometry is not)
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i))
    this.geo[key].push(tint(g, color)); return g
  }
  // axis-aligned box with its base at y
  box(key, x, y, z, w, h, d, color) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return this.add(key, g, color) }
  // box on a facade: w along the wall, h tall, d deep, centred at u, bottom at y, front face at out
  fbox(key, F, u, y, w, h, d, out, color) { return this.add(key, put(new THREE.BoxGeometry(w, h, d), F, u, y + h / 2, out - d / 2), color) }
  fplane(key, F, u, y, w, h, out, color) { return this.add(key, put(new THREE.PlaneGeometry(w, h), F, u, y + h / 2, out), color) }
  rbox(key, x, y, z, w, h, d, r, color, rotY = 0) { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.rotateY(rotY); g.translate(x, y + h / 2, z); return this.add(key, g, color) }
  cyl(key, x, y, z, r0, r1, h, seg, color) { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); return this.add(key, g, color) }
}

const IRON = '#2a2d31', STONE = '#e8e0d0', CREAM = '#f1ead9', SASH = '#f4f1ea'
const WARM = ['#ffd9a0', '#ffe6b8', '#ffcf8a']

function windowColor(r, lit) { return r() < lit ? new THREE.Color(WARM[Math.floor(r() * 3)]) : new THREE.Color(0.02, 0.02, 0.03) }

// ---------------------------------------------------------------- building A: brick walk-up

const P = 0.22   // projection of piers and spandrels in front of the wall (gives windows real reveals)

function walkupFacade(B, F, r, { from, floors, floorH, bays, skip = [], lit = 0.35, ac = [] }) {
  const bw = F.len / bays, ww = 1.25, wh = 1.75, sillH = 0.9
  for (let k = 0; k < floors; k++) {
    const y = from + k * floorH
    B.fbox('brickTex', F, 0, y, F.len, sillH, P, P)                                         // spandrel
    B.fbox('brickTex', F, 0, y + sillH + wh, F.len, floorH - sillH - wh, P, P)              // lintel band
    for (let b = 0; b <= bays; b++) {                                                       // piers
      const left = b === 0 ? -F.len / 2 : -F.len / 2 + (b - 0.5) * bw + ww / 2
      const right = b === bays ? F.len / 2 : -F.len / 2 + (b + 0.5) * bw - ww / 2
      if (right > left) B.fbox('brickTex', F, (left + right) / 2, y + sillH, right - left, wh, P, P)
    }
    for (let b = 0; b < bays; b++) {
      const u = -F.len / 2 + (b + 0.5) * bw, wy = y + sillH
      if (skip.includes(b)) { B.fbox('brickTex', F, u, wy, ww, wh, P, P); continue }
      const col = windowColor(r, lit)
      B.fplane('window', F, u, wy, ww, wh, 0.02, col)                                       // glass, recessed 0.2 m
      if (col.r < 0.1 && r() < 0.55) { const bh = wh * (0.3 + r() * 0.4); B.fplane('sill', F, u, wy + wh - bh, ww - 0.06, bh, 0.03, ['#efe7d8', '#e9d9c4', '#f4efe6'][Math.floor(r() * 3)]) }
      for (const [du, dy, w, h] of [[0, 0, ww, 0.07], [0, wh - 0.07, ww, 0.07], [-ww / 2 + 0.035, 0, 0.07, wh], [ww / 2 - 0.035, 0, 0.07, wh], [0, wh * 0.52, ww, 0.06]])
        B.fbox('sill', F, u + du, wy + dy, w, h, 0.06, 0.06, SASH)                          // sash frame + meeting rail
      B.fbox('sill', F, u, wy - 0.12, ww + 0.3, 0.12, 0.42, P + 0.16, STONE)                // stone sill
      B.fbox('sill', F, u, wy + wh, ww + 0.36, 0.26, 0.05, P + 0.04, STONE)                 // stone lintel
      if (ac.includes(k * 10 + b)) B.fbox('metal', F, u, wy + 0.02, 0.72, 0.44, 0.55, P + 0.55, '#d9dcd8') // AC unit
    }
  }
}

function cornice(B, F, y) {
  B.fbox('sill', F, 0, y, F.len + 0.2, 0.32, P + 0.3, P + 0.3, STONE)
  for (let u = -F.len / 2 + 0.25; u < F.len / 2; u += 0.42) B.fbox('sill', F, u, y + 0.32, 0.18, 0.2, P + 0.42, P + 0.42, STONE)  // dentils
  B.fbox('trim', F, 0, y + 0.52, F.len + 0.6, 0.38, P + 0.7, P + 0.7)
}

function fireEscape(B, F, u0, width, ys, out) {
  for (let k = 0; k < ys.length; k++) {
    const y = ys[k]
    B.fbox('metal', F, u0, y, width, 0.06, 1.0, out + 1.0, IRON)                           // grate
    B.fbox('metal', F, u0, y + 1.0, width, 0.05, 0.05, out + 1.0, IRON)                     // top rail
    for (const s of [-1, 1]) B.fbox('metal', F, u0 + s * width / 2, y + 1.0, 0.05, 0.05, 1.0, out + 1.0, IRON)
    for (let b = 0; b <= Math.round(width / 0.36); b++) B.fbox('metal', F, u0 - width / 2 + b * width / Math.round(width / 0.36), y, 0.03, 1.0, 0.03, out + 1.0, IRON)
    if (k < ys.length - 1) {                                                                 // stair to the next landing
      const dy = ys[k + 1] - y, run = width * 0.62, dir = k % 2 ? -1 : 1, len = Math.hypot(run, dy)
      const g = new THREE.BoxGeometry(len, 0.07, 0.55); g.rotateZ(Math.atan2(dy, run) * dir); B.add('metal', put(g, F, u0 + dir * width * 0.05, y + dy / 2 + 0.03, out + 0.75), IRON)
    }
  }
  const yl = ys[0]                                                                          // drop ladder
  for (const s of [-0.22, 0.22]) B.fbox('metal', F, u0 + width / 2 - 0.5 + s, yl - 2.2, 0.04, 2.2, 0.04, out + 1.45, IRON)
  for (let i = 0; i < 6; i++) B.fbox('metal', F, u0 + width / 2 - 0.5, yl - 2.0 + i * 0.36, 0.44, 0.03, 0.03, out + 1.45, IRON)
}

function waterTower(B, x, y, z) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('metal', x + dx * 1.0, y, z + dz * 1.0, 0.14, 2.4, 0.14, IRON)
  B.box('metal', x, y + 2.3, z, 2.6, 0.12, 2.6, IRON)
  B.cyl('props', x, y + 2.42, z, 1.35, 1.35, 2.6, 16, '#8a6142')
  for (const h of [0.5, 1.3, 2.1]) B.cyl('metal', x, y + 2.42 + h, z, 1.38, 1.38, 0.06, 16, IRON)
  const cone = new THREE.ConeGeometry(1.55, 1.1, 16); cone.translate(x, y + 2.42 + 2.6 + 0.55, z); B.add('props', cone, '#3d3a38')
}

// layered café shopfront projecting 0.6 m, with an interior card behind the glass
function cafeFront(B, F, u0, w, interiorX) {
  const green = '#2f5d50', dark = '#22443b', proj = P + 0.6
  // interior card on the wall, glass 0.6 m in front: real parallax behind the display windows
  const card = new THREE.PlaneGeometry(w - 0.8, 3.0); uvRect(card, interiorX, 0, interiorX + 512, 384, 1024, 384)
  B.add('interior', put(card, F, u0, 0.4 + 1.5, P + 0.01))
  B.fbox('props', F, u0, 0.2, w - 0.8, 0.2, 0.6, proj - 0.02, '#6b4a33')                   // shop floor seen through glass
  for (const s of [-1, 1]) B.fbox('props', F, u0 + s * (w / 2 - 0.25), 0, 0.5, 3.8, 0.7, proj + 0.1, green)  // pilasters
  B.fbox('props', F, u0, 3.4, w + 0.3, 0.95, 0.72, proj + 0.12, green)                     // fascia
  B.fbox('props', F, u0, 4.35, w + 0.6, 0.18, 0.95, proj + 0.3, dark)                      // fascia cap
  const sign = new THREE.PlaneGeometry(w - 0.6, 0.78); uvRect(sign, 0, 0, 1024, 170, 1024, 512)
  B.add('showSign', put(sign, F, u0, 3.85, proj + 0.13))
  // display windows either side of a recessed door
  const doorW = 1.3, sideW = (w - 1.0 - doorW) / 2
  for (const s of [-1, 1]) {
    const cu = u0 + s * (doorW / 2 + sideW / 2)
    B.fbox('props', F, cu, 0, sideW, 0.75, 0.6, proj, green)                               // kickplate
    B.fplane('clearGlass', F, cu, 0.75, sideW - 0.1, 2.5, proj - 0.04)
    B.fbox('props', F, cu, 0.75, sideW, 0.08, 0.66, proj + 0.03, dark)                      // glazing bar
    B.fbox('props', F, cu, 2.6, sideW, 0.08, 0.66, proj + 0.03, dark)                       // transom bar
    for (const t of [-1, 0, 1]) B.fbox('props', F, cu + t * sideW / 2 * 0.98, 0.75, 0.08, 2.6, 0.66, proj + 0.03, dark)
  }
  B.fbox('props', F, u0, 0, doorW, 2.4, 0.08, P + 0.12, dark)                               // door, recessed 0.5 m
  B.fplane('clearGlass', F, u0, 1.1, doorW - 0.4, 1.1, P + 0.13)
  B.fbox('metal', F, u0 + 0.45, 1.05, 0.04, 0.4, 0.04, P + 0.17, '#d9b36a')                // handle
  // layered awning: striped slope + scalloped valance + cheeks
  const aw = w + 0.2, reach = 1.8, drop = 0.75, yTop = 3.35
  const slope = new THREE.PlaneGeometry(aw, Math.hypot(reach, drop)); uvRect(slope, 0, 0, 256, 190, 256, 256)
  slope.rotateX(-Math.PI / 2 + Math.atan2(drop, reach)); B.add('awningStripe', put(slope, F, u0, yTop - drop / 2, proj + reach / 2))
  const val = new THREE.PlaneGeometry(aw, 0.34); uvRect(val, 0, 184, 256, 220, 256, 256); B.add('awningStripe', put(val, F, u0, yTop - drop - 0.17, proj + reach))
  for (const s of [-1, 1]) { const ch = new THREE.BufferGeometry(); ch.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, reach, 0, -drop, reach], 3)); ch.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3)); ch.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0.9, 0.12, 0.9, 0.12, 0.3], 2)); ch.setIndex([0, 1, 2]); B.add('awningStripe', put(ch, F, u0 + s * aw / 2, yTop, proj)) }
  // round blade sign on an iron bracket
  B.fbox('metal', F, u0 - w / 2 - 0.2, 4.15, 0.06, 0.06, 1.3, proj + 1.25, IRON)
  const disc = new THREE.PlaneGeometry(1.0, 1.0); uvRect(disc, 4, 174, 336, 506, 1024, 512); disc.rotateY(Math.PI / 2)
  B.add('showSign', put(disc, F, u0 - w / 2 - 0.2, 3.55, proj + 1.05))
}

// ---------------------------------------------------------------- building B: painted siding over a shop

function sidingWindows(B, F, r, from, floors, floorH, us, lit = 0.4) {
  for (let k = 0; k < floors; k++) for (const u of us) {
    const y = from + k * floorH + 0.9, ww = 1.1, wh = 1.6, col = windowColor(r, lit)
    B.fplane('window', F, u, y, ww, wh, 0.02, col)
    if (col.r < 0.1 && r() < 0.5) B.fplane('sill', F, u, y + wh * 0.45, ww - 0.06, wh * 0.55, 0.03, '#efe7d8')
    for (const [du, dy, w, h] of [[0, -0.1, ww + 0.36, 0.14], [0, wh, ww + 0.36, 0.2], [-ww / 2 - 0.09, 0, 0.18, wh], [ww / 2 + 0.09, 0, 0.18, wh], [0, wh * 0.5, ww, 0.06]])
      B.fbox('sill', F, u + du, y + dy, w, h, 0.1, 0.1, SASH)                               // casing projects 0.1 m
    if (r() < 0.5) for (const s of [-1, 1]) B.fbox('props', F, u + s * (ww / 2 + 0.5), y, 0.5, wh, 0.05, 0.08, '#2f5d50') // shutters
  }
}

// ---------------------------------------------------------------- public: lots and street

// Build the showcase building for a south lot. `which` is 'A' (west lot) or 'B' (east lot).
export function buildShowcaseLot(city, which, lot) {
  const B = new Builder(city), r = rng(which === 'A' ? 7101 : 7202)
  const { x0, z0, x1, z1 } = lot, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0
  if (which === 'A') {
    const floorH = 3.2, ground = 4.6, floors = 5, H = ground + floors * floorH
    B.box('brickTex', cx, 0, cz, W, H + 0.8, D)                                             // core
    const S = face(cx, z1, 0, 1, W), Wf = face(x0, cz, -1, 0, D)
    walkupFacade(B, S, r, { from: ground, floors, floorH, bays: 6, ac: [14, 22, 40] })
    walkupFacade(B, Wf, r, { from: ground, floors, floorH, bays: 6, ac: [3, 31] })
    for (const F of [S, Wf]) { B.fbox('brickTex', F, 0, H, F.len, 0.8, P, P); cornice(B, F, H + 0.8) }
    B.box('brickTex', x0 - P / 2, 0, z1 + P / 2, P, H + 0.8, P)                               // corner pier
    for (let y = 0.3; y < H; y += 0.9) B.box('sill', x0 - P / 2 - 0.02, y, z1 + P / 2 + 0.02, P + 0.06, 0.45, P + 0.06, STONE) // quoins
    for (const F of [S, Wf]) B.fbox('sill', F, 0, ground - 0.3, F.len + 0.2, 0.3, P + 0.35, P + 0.35, STONE)   // belt course
    // ground floor: café on the south face, apartment door at the east end, windows with grilles on the west face
    B.fbox('brickTex', S, 0, 0, W, ground - 0.3, P, P)
    cafeFront(B, S, -1.8, 8.6, 0)
    B.fbox('trim', S, 4.95, 0, 1.4, 2.6, 0.1, P + 0.02); B.fplane('clearGlass', S, 4.95, 1.6, 0.9, 0.8, P + 0.03)
    B.fbox('metal', S, 4.95, 2.75, 2.0, 0.12, 1.1, P + 1.1, IRON)                             // door canopy
    B.fbox('brickTex', Wf, 0, 0, D, ground - 0.3, P, P)
    for (const u of [-3.6, 0, 3.6]) {
      B.fplane('window', Wf, u, 1.2, 1.4, 2.0, P + 0.02, new THREE.Color(0.02, 0.02, 0.03))
      B.fbox('sill', Wf, u, 1.08, 1.7, 0.12, 0.4, P + 0.18, STONE)
      for (let b = 0; b < 6; b++) B.fbox('metal', Wf, u - 0.6 + b * 0.24, 1.2, 0.03, 2.0, 0.03, P + 0.12, IRON)   // grille
    }
    fireEscape(B, S, 3.85, 3.9, [ground + 0.85, ground + 0.85 + floorH, ground + 0.85 + 2 * floorH, ground + 0.85 + 3 * floorH, ground + 0.85 + 4 * floorH], P)
    waterTower(B, x0 + 9.2, H + 0.8, z0 + 4.6)
    B.box('metal', x0 + 4, H + 0.8, z0 + 3.5, 1.8, 1.2, 1.4, '#9aa0a6')                     // roof hatch / plant
  } else {
    const floorH = 3.2, ground = 4.6, floors = 3, H = ground + floors * floorH
    B.box('concreteWarm', cx, 0, cz, W, ground, D, '#efe2c8')                                // plaster ground floor
    B.box('siding', cx, ground, cz, W, H - ground, D, '#8a7fc4')                              // violet siding
    const S = face(cx, z1, 0, 1, W), E = face(x1, cz, 1, 0, D)
    // bay window on the south face
    B.box('siding', cx + 1.6, ground + 0.4, z1 + 0.4, 3.6, floors * floorH - 0.4, 0.8, '#8a7fc4')
    const SB = face(cx + 1.6, z1 + 0.8, 0, 1, 3.6)
    sidingWindows(B, SB, r, ground, floors, floorH, [-1.05, 1.05], 0.45)
    B.box('roof', cx + 1.6, H, z1 + 0.4, 3.9, 0.25, 1.1)
    sidingWindows(B, S, r, ground, floors, floorH, [-4.6, -2.3, 5.0], 0.4)
    sidingWindows(B, E, r, ground, floors, floorH, [-4.4, -1.5, 1.5, 4.4], 0.4)
    for (const [x, z] of [[x1, z1], [x0, z1], [x1, z0]]) B.box('sill', x, ground, z, 0.24, H - ground, 0.24, SASH)   // corner boards
    for (const F of [S, E]) {                                                                // bracketed eave
      B.fbox('sill', F, 0, H, F.len + 0.4, 0.22, 0.7, 0.7, SASH)
      for (let u = -F.len / 2 + 0.6; u < F.len / 2; u += 1.3) B.fbox('sill', F, u, H - 0.45, 0.14, 0.45, 0.5, 0.5, SASH)
      B.fbox('sill', F, 0, ground - 0.25, F.len + 0.1, 0.25, 0.3, 0.3, CREAM)               // belt
    }
    // bookshop on the south face
    const card = new THREE.PlaneGeometry(6.6, 2.8); uvRect(card, 512, 0, 1024, 384, 1024, 384); B.add('interior', put(card, S, -1.8, 0.5 + 1.4, 0.01))
    B.fplane('clearGlass', S, -1.8, 0.7, 7.0, 2.6, 0.45)
    B.fbox('props', S, -1.8, 0, 7.6, 0.7, 0.5, 0.5, '#3c3a6e')
    for (const t of [-1, -0.33, 0.33, 1]) B.fbox('props', S, -1.8 + t * 3.6, 0.7, 0.1, 2.7, 0.52, 0.52, '#2a2950')
    B.fbox('props', S, -1.8, 3.3, 7.8, 0.85, 0.55, 0.6, '#3c3a6e')
    const sign = new THREE.PlaneGeometry(6.8, 0.7); uvRect(sign, 360, 200, 1024, 330, 1024, 512); B.add('showSign', put(sign, S, -1.8, 3.38, 0.61))
    const aw = new THREE.BoxGeometry(7.4, 0.08, 1.4); aw.rotateX(0.32); B.add('awning', put(aw, S, -1.8, 3.15, 1.15), '#2b7a78')
    B.fbox('trim', S, 3.4, 0, 1.2, 2.5, 0.08, 0.06)                                           // side door
    B.box('metal', cx - 2, H + 0.2, cz - 1, 2.0, 1.1, 1.6, '#9aa0a6')
  }
}

// curbs, paving, tree pits, street furniture and the alley gate around the showcase block
export function buildShowcaseStreet(city, block, lots, Y) {
  const B = new Builder(city), r = rng(7303)
  const { x0, z0, size } = block, x1 = x0 + size, z1 = z0 + size
  const A = lots.A, Bl = lots.B
  // curbs (light concrete, slightly proud of the sidewalk) and a dark gutter strip on the road
  for (const [x, z, w, d] of [[x0 + size / 2, z1 - 0.17, size, 0.34], [x0 + size / 2, z0 + 0.17, size, 0.34], [x0 + 0.17, z0 + size / 2, 0.34, size - 0.68], [x1 - 0.17, z0 + size / 2, 0.34, size - 0.68]])
    B.rbox('props', x, 0, z, w, Y + 0.05, d, 0.04, '#d3cfc6')
  for (const [x, z, w, d] of [[x0 + size / 2, z1 + 0.25, size, 0.5], [x0 - 0.25, z0 + size / 2, 0.5, size]]) B.box('props', x, 0.002, z, w, 0.01, d, '#2a2c33')
  // patterned paving on the two street-facing sidewalks
  const pave = (xa, xb, za, zb) => { const g = new THREE.PlaneGeometry(xb - xa, zb - za); g.rotateX(-Math.PI / 2); g.translate((xa + xb) / 2, Y + 0.006, (za + zb) / 2); B.add('showPaving', g) }
  pave(x0 + 0.34, x1 - 0.34, A.z1, z1 - 0.34)
  pave(x0 + 0.34, A.x0, z0 + 0.34, A.z1)
  // tree pits with small street trees
  const tree = (x, z) => {
    B.box('props', x, Y, z, 1.4, 0.03, 1.4, '#3b2f25')
    for (const [dx, dz, w, d] of [[0, 0.68, 1.4, 0.06], [0, -0.68, 1.4, 0.06], [0.68, 0, 0.06, 1.4], [-0.68, 0, 0.06, 1.4]]) B.box('metal', x + dx, Y, z + dz, w, 0.06, d, IRON)
    B.cyl('props', x, Y, z, 0.1, 0.14, 3.0, 7, '#5a4030')
    const greens = ['#4f8f3a', '#5ea245', '#447f33']
    for (const [dx, dy, dz, s] of [[0, 3.6, 0, 1.25], [0.6, 3.3, 0.3, 0.9], [-0.55, 3.4, -0.25, 0.95], [0.1, 4.2, -0.1, 0.85], [-0.2, 3.1, 0.55, 0.8]]) { const g = new THREE.IcosahedronGeometry(s, 1); g.translate(x + dx, Y + dy, z + dz); B.add('props', g, greens[Math.floor(r() * 3)]) }
  }
  tree(x0 + 2.4, z1 - 1.1); tree(x0 + 25.4, z1 - 1.1); tree(x0 + 1.2, z0 + 9)
  // furniture: hydrant, bins, bench, bike rack, news boxes, bollards, mailbox, café tables, planters, A-board
  const hydrant = (x, z) => { B.cyl('props', x, Y, z, 0.17, 0.2, 0.62, 10, '#c8352c'); B.cyl('props', x, Y + 0.62, z, 0.12, 0.17, 0.16, 10, '#c8352c'); B.cyl('props', x, Y + 0.4, z, 0.07, 0.07, 0.42, 8, '#c8352c').rotateZ(0); const n = new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8); n.rotateZ(Math.PI / 2); n.translate(x, Y + 0.42, z); B.add('props', n, '#d9b36a') }
  hydrant(x0 + 4.3, z1 - 0.75)
  const bin = (x, z, col) => { B.rbox('props', x, Y, z, 0.62, 0.95, 0.62, 0.08, col); B.rbox('props', x, Y + 0.95, z, 0.68, 0.08, 0.68, 0.03, '#2a2d31') }
  bin(x0 + 15.6, z1 - 0.8, '#2f6b45'); bin(A.x1 + 1.0, A.z1 - 1.2, '#3c4a52'); bin(A.x1 + 1.8, A.z1 - 1.0, '#3c4a52')
  const bench = (x, z, rot) => {
    for (const s of [-0.75, 0.75]) B.rbox('props', x + Math.cos(rot) * s, Y, z - Math.sin(rot) * s, 0.08, 0.45, 0.5, 0.02, IRON, rot)
    for (let i = 0; i < 3; i++) B.rbox('props', x - Math.sin(rot) * (-0.15 + i * 0.12), Y + 0.45, z - Math.cos(rot) * (-0.15 + i * 0.12), 1.8, 0.05, 0.1, 0.02, '#a8794e', rot)
    for (let i = 0; i < 2; i++) { const g = new RoundedBoxGeometry(1.8, 0.1, 0.05, 2, 0.02); g.translate(0, 0.62 + i * 0.16, -0.24); g.rotateY(rot); g.translate(x, Y, z); B.add('props', g, '#a8794e') }
  }
  bench(x0 + 13.6, z1 - 1.1, Math.PI)
  for (let i = 0; i < 3; i++) { const g = new THREE.TorusGeometry(0.38, 0.035, 6, 16, Math.PI); g.translate(x0 + 20.6 + i * 0.8, Y, z1 - 1.0); B.add('props', g, '#8f969c') }
  B.rbox('props', Bl.x1 - 1.4, Y, Bl.z1 + 0.35, 0.5, 1.05, 0.45, 0.04, '#2f5ea3'); B.rbox('props', Bl.x1 - 0.8, Y, Bl.z1 + 0.35, 0.5, 1.05, 0.45, 0.04, '#c8423a')
  for (let i = 0; i < 4; i++) B.cyl('props', x1 - 0.6, Y, z1 - 2.2 - i * 1.3, 0.11, 0.13, 0.85, 10, '#3a3d42')
  B.rbox('props', x0 + 0.75, Y, z0 + 25.5, 0.5, 1.15, 0.45, 0.12, '#2f5ea3')
  const table = (x, z) => { B.cyl('props', x, Y, z, 0.05, 0.22, 0.74, 10, IRON); B.cyl('props', x, Y + 0.74, z, 0.36, 0.36, 0.04, 16, '#e8e0d0')
    for (const s of [-1, 1]) { B.rbox('props', x + s * 0.6, Y + 0.42, z, 0.42, 0.05, 0.42, 0.02, '#2f5d50'); B.rbox('props', x + s * 0.8, Y + 0.42, z, 0.05, 0.42, 0.42, 0.02, '#2f5d50'); B.cyl('props', x + s * 0.6, Y, z, 0.03, 0.03, 0.42, 6, IRON) } }
  table(x0 + 4.8, A.z1 + 1.55); table(x0 + 11.0, A.z1 + 1.55)
  const planter = (x, z, w) => { B.rbox('props', x, Y, z, w, 0.55, 0.55, 0.05, '#b5653d'); for (let i = 0; i < Math.round(w / 0.35); i++) { const g = new THREE.IcosahedronGeometry(0.22 + r() * 0.08, 0); g.translate(x - w / 2 + 0.2 + i * 0.35, Y + 0.68, z); B.add('props', g, ['#5ea245', '#e86a8a', '#f2c94c', '#4f8f3a'][Math.floor(r() * 4)]) } }
  planter(x0 + 6.4, A.z1 + 1.05, 1.0); planter(x0 + 9.6, A.z1 + 1.05, 1.0); planter(x0 + 28.6, Bl.z1 + 0.95, 1.6)
  const ab = new THREE.BoxGeometry(0.62, 1.0, 0.04); ab.rotateX(0.18); ab.translate(x0 + 8.0, Y + 0.48, A.z1 + 1.75); B.add('props', ab, '#2b2b2b')
  // alley gate between the two buildings
  const gx0 = A.x1, gx1 = Bl.x0
  for (let x = gx0 + 0.1; x < gx1; x += 0.16) B.box('metal', x, Y, A.z1 - 0.05, 0.03, 2.2, 0.03, IRON)
  for (const y of [0.15, 2.1]) B.box('metal', (gx0 + gx1) / 2, Y + y, A.z1 - 0.05, gx1 - gx0, 0.05, 0.05, IRON)
}
