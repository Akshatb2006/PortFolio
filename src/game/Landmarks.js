import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SITES, heightAt } from './Scenery.js'
import { WATER, blockCenter } from './CityMap.js'
import { makeTextTexture } from './textures.js'

// Landmarks in the scenic ring (visual only, outside the play boundary; procedural geometry, no new downloads):
//   Hidden Falls       a waterfall off the north-west mesa into a plunge pool that feeds the river
//   Bay Falls          a waterfall down the western sea cliff into a cove
//   Temple of the Bay  an ancient temple on a cliff terrace above the bay: stepped podium, colonnade (partly
//                      fallen), sanctuary with pediment, grand stairs down into the lagoon, a flooded courtyard
//                      with a fountain and broken statues, a second shrine carved into the cliff wall, braziers
//   Aurora Point       an overlook on the eastern cliffs: round deck, railings, pavilion, telescopes, lamps, sign
// Because none of these can be walked to yet, a coin-operated Scenic Viewer at the end of Sunset Pier tours them.

// ---------------------------------------------------------------------------------------------- helpers
// box with UVs scaled to its size (tile metres per texture repeat), so stone textures keep a real-world scale
function sbox(w, h, d, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile) }
  return g
}
function scyl(r0, r1, h, seg = 14, tile = 3) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg), uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r0 / tile, uv.getY(i) * h / tile)
  return g
}
const place = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); return g }
const merge = (list) => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)))

function softTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = r; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c)
}

// ---------------------------------------------------------------------------------------------- waterfalls
const fallShared = { t: { value: 0 }, night: { value: 0 } }
const fallMat = new THREE.ShaderMaterial({
  uniforms: Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), fallShared),
  transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `uniform float t, night; varying vec2 vUv;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){
  // streaks falling down the ribbon (v = 0 at the lip, 1 at the pool), foam at the bottom, soft side edges
  float s = n(vec2(vUv.x * 26.0, vUv.y * 5.0 - t * 2.6)) * 0.6 + n(vec2(vUv.x * 60.0, vUv.y * 9.0 - t * 4.1)) * 0.4;
  vec3 c = mix(vec3(0.42, 0.78, 0.86), vec3(0.97, 0.99, 1.0), smoothstep(0.35, 0.8, s));
  c = mix(c, vec3(1.0), smoothstep(0.82, 1.0, vUv.y));
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  gl_FragColor = vec4(c * mix(1.0, 0.35, night), (0.55 + 0.4 * s) * edge);
#include <fog_fragment>
}`,
})

// a ribbon from the lip falling outward along dir (unit xz vector), width w, ending at the pool level
function buildFall(group, lip, dir, w, bottomY, mist) {
  const drop = lip.y - bottomY, seg = 24, pos = [], uv = [], idx = []
  const side = new THREE.Vector3(-dir.z, 0, dir.x)
  for (let i = 0; i <= seg; i++) {
    const v = i / seg, out = Math.sqrt(v) * Math.min(18, drop * 0.22) + 1, y = lip.y - drop * v
    for (const s of [0, 1]) {
      const spread = 1 + v * 0.35, o = (s - 0.5) * w * spread
      pos.push(lip.x + dir.x * out + side.x * o, y, lip.z + dir.z * out + side.z * o); uv.push(s, v)
    }
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx)
  const mesh = new THREE.Mesh(g, fallMat); mesh.renderOrder = 2; group.add(mesh)
  // mist: a few soft billboards at the base, breathing in size and opacity
  const end = new THREE.Vector3(lip.x + dir.x * (Math.min(18, drop * 0.22) + 1), bottomY + 2, lip.z + dir.z * (Math.min(18, drop * 0.22) + 1))
  for (let k = 0; k < 7; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mist, transparent: true, depthWrite: false, opacity: 0.5, fog: true }))
    sp.position.copy(end).add(new THREE.Vector3((k % 3 - 1) * w * 0.45, k * 1.2, (Math.floor(k / 3) - 0.5) * 6))
    sp.userData.base = 10 + k * 2.2; sp.userData.ph = k * 1.7; sp.scale.setScalar(sp.userData.base)
    group.add(sp); group.userData.mist.push(sp)
  }
  return { mesh, top: lip.clone(), end }
}

// ---------------------------------------------------------------------------------------------- build
export function buildLandmarks(scene, assets) {
  const group = new THREE.Group(); group.name = 'landmarks'; group.userData.mist = []
  const mist = softTex()

  // ---- Hidden Falls: from the mesa lip south into the plunge pool
  const F = SITES.falls
  const lipY = heightAt(F.x, F.lip - 4) - 2.5
  const hidden = buildFall(group, new THREE.Vector3(F.x, lipY, F.lip - 2), new THREE.Vector3(0, 0, 1), 15, 0.2, mist)
  // ---- Bay Falls: off the western cliff east into the cove
  const C = SITES.cove
  let cx = C.x1 - 6; while (heightAt(cx, C.z) < 40 && cx > C.x1 - 120) cx -= 4   // walk west to the cliff top
  const bay = buildFall(group, new THREE.Vector3(cx + 2, heightAt(cx, C.z) - 2, C.z), new THREE.Vector3(1, 0, 0), 12, 0.2, mist)

  // ---- materials (stone from the shipped kit textures; sandstone and darker weathered stone tints)
  let rock = null; assets.kit?.village?.scenes.forEach(sc => sc.traverse(o => { if (!rock && o.isMesh && o.material.name === 'MI_RockTrim') rock = o.material }))
  const stoneMap = rock?.map ? rock.map.clone() : null; if (stoneMap) { stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping; stoneMap.needsUpdate = true }
  const M = {
    stone: new THREE.MeshStandardMaterial({ map: stoneMap, color: 0xfff6e6, roughness: 0.85, emissive: 0xffb36b, emissiveMap: stoneMap, emissiveIntensity: 0 }),   // pale limestone; floodlit warm at night
    dark: new THREE.MeshStandardMaterial({ map: stoneMap, color: 0xd8c8ac, roughness: 0.9, emissive: 0xffa25a, emissiveMap: stoneMap, emissiveIntensity: 0 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9953a, metalness: 0.9, roughness: 0.3, emissive: 0xf2b866, emissiveIntensity: 0.05 }),
    fire: new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff8a2a, emissiveIntensity: 0.3 }),
    void: new THREE.MeshBasicMaterial({ color: 0x0b0a0c }),
    deck: new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.4 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffd9a0, emissiveIntensity: 0.2 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x3dd6f5, emissiveIntensity: 0.4 }),
  }
  const L = { stone: [], dark: [], gold: [], fire: [], void: [], deck: [], metal: [], lamp: [], cyan: [] }

  // ================================================= Temple of the Bay (faces east, toward the bay and the city)
  {
    const T = SITES.temple, y0 = T.y, cx = T.x - 14, cz = T.z
    // stepped podium: three tiers
    const tiers = [[44, 60], [38, 52], [32, 44]]
    tiers.forEach(([dx, dz], i) => L.stone.push(place(sbox(dx, 1.6, dz), cx, y0 + 0.8 + i * 1.6, cz)))
    const top = y0 + 4.8
    // peristyle: columns around the top tier; a few broken, two fallen on the platform
    const colH = 11, ring = []
    for (let i = 0; i < 8; i++) ring.push([cx - 14 + i * 4, cz - 20], [cx - 14 + i * 4, cz + 20])
    for (let j = 1; j < 10; j++) ring.push([cx - 14, cz - 20 + j * 4], [cx + 14, cz - 20 + j * 4])
    ring.forEach(([x, z], k) => {
      const broken = k % 7 === 3 || k % 11 === 5, h = broken ? 3 + (k % 3) * 1.6 : colH
      L.stone.push(place(scyl(0.85, 0.95, h, 16), x, top + h / 2, z))
      L.dark.push(place(sbox(2.1, 0.5, 2.1), x, top + 0.25, z))
      if (!broken) L.dark.push(place(sbox(2.2, 0.6, 2.2), x, top + h + 0.3, z))
    })
    L.stone.push(place(scyl(0.85, 0.85, 9, 16), cx + 6, top + 0.9, cz + 24, 0.3, 0, Math.PI / 2))     // fallen drums
    L.stone.push(place(scyl(0.85, 0.85, 6, 16), cx - 10, top + 0.9, cz - 24, -0.5, 0, Math.PI / 2))
    // entablature over the intact east colonnade, sanctuary (cella) and pediment roof
    L.dark.push(place(sbox(2.4, 1.4, 42), cx + 14, top + colH + 1.3, cz))
    L.stone.push(place(sbox(18, 9, 26), cx - 2, top + 4.5, cz))                                             // sanctuary
    // gabled roof over the sanctuary: a triangular prism along x, with its pediment face toward the east
    const roof = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-15, 0), new THREE.Vector2(15, 0), new THREE.Vector2(0, 5.5)]), { depth: 21, bevelEnabled: false })
    roof.rotateY(Math.PI / 2); roof.translate(cx - 12.5, top + 9, cz); L.dark.push(roof)
    L.void.push(place(sbox(0.3, 6, 6), cx + 7.1, top + 3, cz))                                              // sanctuary door
    L.gold.push(place(new THREE.TorusGeometry(1.3, 0.22, 8, 24), cx + 8.7, top + 11.2, cz, Math.PI / 2))   // sun disc on the pediment
    // grand stairs east: podium → terrace, then terrace → down into the lagoon water
    for (let i = 0; i < 6; i++) L.stone.push(place(sbox(1.4, 0.8 * (i + 1), 16), cx + 22 + 1.4 * (6 - i) - 0.7, y0 + 0.4 * (i + 1), cz))
    const seaX = T.x + T.r + 6, steps = 26
    for (let i = 0; i < steps; i++) { const x0 = cx + 31 + i * ((seaX - cx - 25) / steps), y = y0 - (y0 + 2) * (i / steps); L.stone.push(place(sbox((seaX - cx - 25) / steps + 0.2, Math.max(0.6, y + 3), 14), x0, y - (Math.max(0.6, y + 3)) / 2 + 0.3, cz)) }
    // flooded courtyard north of the podium: stone rim, water, fountain, broken statues
    const fx = cx + 6, fz = cz + 46
    for (const [w, d, x, z] of [[30, 1.2, fx, fz - 9.4], [30, 1.2, fx, fz + 9.4], [1.2, 18, fx - 14.4, fz], [1.2, 18, fx + 14.4, fz]]) L.stone.push(place(sbox(w, 1.1, d), x, y0 + 0.55, z))
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(28, 17).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x1aa7b8, roughness: 0.08, transparent: true, opacity: 0.85, clearcoat: 1, envMapIntensity: 0.9, normalMap: assets.waterNormals }))
    pool.position.set(fx, y0 + 0.75, fz); group.add(pool); pool.material.emissive = new THREE.Color(0x1fb8c8); pool.material.emissiveIntensity = 0; M.pool = pool.material
    L.stone.push(place(scyl(3.2, 3.6, 1, 24), fx, y0 + 1.2, fz)); L.stone.push(place(scyl(0.5, 0.8, 3.2, 12), fx, y0 + 2.6, fz)); L.stone.push(place(scyl(1.6, 1.0, 0.5, 18), fx, y0 + 4.3, fz))
    const statue = (x, z, ry, fallen) => {
      L.dark.push(place(sbox(2.2, 2.4, 2.2), x, y0 + 1.2, z))
      if (fallen) { L.stone.push(place(sbox(1.4, 3.6, 1.0), x + 2.5, y0 + 0.7, z + 1, ry, 0, Math.PI / 2)); L.stone.push(place(new THREE.SphereGeometry(0.7, 10, 8), x + 4.8, y0 + 0.7, z + 1.8)) }
      else { L.stone.push(place(sbox(1.4, 3.6, 1.0), x, y0 + 4.2, z, ry)); L.stone.push(place(new THREE.SphereGeometry(0.7, 10, 8), x, y0 + 6.7, z)); L.stone.push(place(sbox(0.5, 2.6, 0.5), x + 0.9 * Math.cos(ry), y0 + 4.6, z - 0.9 * Math.sin(ry), ry, 0, 0.5)) }
    }
    statue(fx - 18, fz - 6, 0.4, false); statue(fx - 18, fz + 6, -0.4, true); statue(fx + 18, fz - 6, 2.7, false); statue(fx + 18, fz + 6, 3.4, false)
    // braziers on the podium corners
    for (const [x, z] of [[cx - 15, cz - 21], [cx + 15, cz - 21], [cx - 15, cz + 21], [cx + 15, cz + 21], [cx + 29, cz - 9], [cx + 29, cz + 9]]) { L.dark.push(place(scyl(0.9, 0.5, 1.6, 10), x, (x > cx + 20 ? y0 : top) + 0.8, z)); L.fire.push(place(new THREE.ConeGeometry(0.9, 2.2, 8), x, (x > cx + 20 ? y0 : top) + 2.6, z)) }
    // shrine carved into the cliff wall behind (west): facade, engaged columns, pediment, dark doorway
    let wx = T.x - T.r; while (heightAt(wx, cz) < y0 + 30 && wx > T.x - T.r - 120) wx -= 3
    const fy = y0, fh = 22
    L.stone.push(place(sbox(3, fh, 30), wx + 2, fy + fh / 2, cz))
    for (let i = 0; i < 4; i++) L.stone.push(place(scyl(0.9, 1.0, fh - 4, 16), wx + 3.6, fy + (fh - 4) / 2, cz - 9 + i * 6))
    L.dark.push(place(sbox(2, 2, 32), wx + 3.6, fy + fh - 1, cz))
    L.void.push(place(sbox(0.4, 9, 6), wx + 3.7, fy + 4.5, cz))
    for (let i = 0; i < 5; i++) L.stone.push(place(sbox(2, 0.5, 12 - i), wx + 5 + i * 1.8, fy + 0.25 + i * 0.5, cz))
  }

  // ================================================= Aurora Point (eastern cliffs, facing the bay and the city)
  {
    const V = SITES.view, y = heightAt(V.x, V.z)
    L.deck.push(place(scyl(16, 17, 1.2, 40, 4), V.x, y + 0.6, V.z))
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; L.metal.push(place(sbox(0.12, 1.1, 0.12), V.x + Math.cos(a) * 15.6, y + 1.75, V.z + Math.sin(a) * 15.6)) }
    const rail = new THREE.TorusGeometry(15.6, 0.07, 6, 96); rail.rotateX(Math.PI / 2); rail.translate(V.x, y + 2.3, V.z); L.metal.push(rail)
    const glow = new THREE.TorusGeometry(15.62, 0.05, 6, 96); glow.rotateX(Math.PI / 2); glow.translate(V.x, y + 1.25, V.z); L.cyan.push(glow)
    // pavilion
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; L.deck.push(place(scyl(0.3, 0.3, 4, 10), V.x + Math.cos(a) * 5, y + 3.2, V.z + Math.sin(a) * 5)) }
    L.deck.push(place(scyl(6.2, 6.2, 0.4, 30), V.x, y + 5.3, V.z)); L.deck.push(place(new THREE.ConeGeometry(6.4, 2.2, 30), V.x, y + 6.6, V.z))
    // telescopes facing west (the city)
    for (const dz of [-8, 8]) { L.metal.push(place(scyl(0.15, 0.2, 1.3, 8), V.x - 12, y + 1.85, V.z + dz)); L.metal.push(place(scyl(0.25, 0.3, 1.2, 10), V.x - 12.3, y + 2.6, V.z + dz, 0, 0, Math.PI / 2 - 0.2)) }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; L.metal.push(place(scyl(0.08, 0.1, 4, 8), V.x + Math.cos(a) * 13, y + 3.2, V.z + Math.sin(a) * 13)); L.lamp.push(place(new THREE.SphereGeometry(0.35, 10, 8), V.x + Math.cos(a) * 13, y + 5.3, V.z + Math.sin(a) * 13)) }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), new THREE.MeshBasicMaterial({ map: makeTextTexture(['AURORA POINT'], { w: 1024, h: 205, bg: 'rgba(0,0,0,0)', fg: '#f2b866', border: null, font: 'bold 150px Anton, Impact, sans-serif' }), transparent: true, fog: true }))
    sign.position.set(V.x - 17.2, y + 1.6, V.z); sign.rotation.y = -Math.PI / 2; group.add(sign)
  }

  // ---- merge per material
  for (const [k, list] of Object.entries(L)) {
    if (!list.length) continue
    const g = merge(list); g.computeVertexNormals()
    const mesh = new THREE.Mesh(g, M[k]); mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'landmark-' + k; group.add(mesh)
  }
  scene.add(group)

  let t = 0
  return {
    group, hidden, bay,
    update(dt) {
      t += dt; fallShared.t.value = t
      for (const sp of group.userData.mist) { const k = 0.5 + 0.5 * Math.sin(t * 0.7 + sp.userData.ph); sp.scale.setScalar(sp.userData.base * (0.85 + 0.3 * k)); sp.material.opacity = 0.25 + 0.3 * k }
      M.fire.emissiveIntensity = M.fire.userData.base * (0.85 + 0.15 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23))
    },
    setNight(n) {
      fallShared.night.value = n
      M.fire.userData.base = 0.3 + n * 3.2
      M.lamp.emissiveIntensity = 0.2 + n * 3
      M.cyan.emissiveIntensity = 0.4 + n * 3
      M.gold.emissiveIntensity = 0.05 + n * 0.8
      M.stone.emissiveIntensity = n * 0.22; M.dark.emissiveIntensity = n * 0.16   // floodlit monument
      if (M.pool) M.pool.emissiveIntensity = n * 0.6
    },
    // vistas for the Scenic Viewer: [name, camera position, look-at]
    vistas() {
      const T = SITES.temple, V = SITES.view, vy = heightAt(V.x, V.z)
      return [
        ['Aurora Point → the city', [V.x - 16.5, vy + 3.2, V.z], [0, 10, -40]],          // at the west railing, 300 m up
        ['Hidden Falls', [F.x + 70, 40, F.lip + 150], [F.x, lipY * 0.55, F.lip]],
        ['Temple of the Bay', [T.x + 95, T.y + 26, T.z - 12], [T.x - 18, T.y + 6, T.z + 6]],
        ['Bay Falls', [C.x1 + 70, 22, C.z + 95], [cx, heightAt(cx, C.z) * 0.45, C.z - 10]],   // looking back into the cove, not out to sea
        ['Celestial Bridge', [80, 28, -250], [0, 20, -300]],
      ]
    },
  }
}

// ---------------------------------------------------------------------------------------------- Scenic Viewer
// A coin viewer at the end of Sunset Pier. E starts a tour of the vistas; A / D (or ← →) switch, E / Esc leave.
// It uses the game's cinematic camera, so the world keeps running behind it.
export class ScenicViewer {
  constructor(game, landmarks) {
    this.game = game; this.lm = landmarks; this.on = false
    const pierX = blockCenter(3)
    this.at = new THREE.Vector3(pierX, 0, WATER.z0 + 17)
    const m = new THREE.MeshStandardMaterial({ color: 0x2f5f6f, metalness: 0.6, roughness: 0.4 })
    const g = new THREE.Group()
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.1, 10), m); post.position.y = 0.55
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.6), m); head.position.set(0, 1.25, 0.05)
    const eyes = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), m); eyes.rotation.x = Math.PI / 2; eyes.position.set(0, 1.28, 0.42)
    g.add(post, head, eyes); g.position.set(this.at.x, 0.38, this.at.z + 0.6); game.scene.add(g)
    this.onKey = (e) => {
      if (!this.on) return
      const k = e.key.toLowerCase()
      if (k === 'escape' || k === 'e') { this.exit(); game.input.consume(k) }
      else if (k === 'a' || k === 'arrowleft') this.go(this.i - 1)
      else if (k === 'd' || k === 'arrowright') this.go(this.i + 1)
    }
    addEventListener('keydown', this.onKey)
  }
  interactables() { return this.on || this.game.interior ? [] : [{ id: 'scenic-viewer', pos: this.at, radius: 2.4, priority: 2, prompt: 'Press E to use the scenic viewer', action: () => this.enter() }] }
  enter() {
    const g = this.game; if (g.player.inVehicle) return
    this.v = this.lm.vistas(); this.i = 0; this.on = true
    this.cam = { p: g.camera.position.clone(), l: new THREE.Vector3(...this.v[0][2]), tp: new THREE.Vector3(...this.v[0][1]), tl: new THREE.Vector3(...this.v[0][2]) }
    // shadows only cover ~60 m around the player (standing on the pier), so in these distant vistas they are
    // invisible: freeze the shadow map instead of re-rendering the whole city into it every frame (switching
    // shadows off would recompile every shader)
    g.renderer.shadowMap.autoUpdate = false
    // the vistas are hundreds of metres from the city: people, markers and cars are sub-pixel there but cost a
    // draw call per part (a character is ~20). Hide them for the tour (visibility only: no shader recompile)
    const small = [...g.peds.peds.map(p => p.wrap), g.player.mesh, g.markers.group, ...g.vehicles.list.map(v => v.mesh), ...g.traffic.cars.map(c => c.mesh), ...g.police.units.map(u => u.mesh), g.animals?.group]
    this.hidden = small.filter(o => o && o.visible); for (const o of this.hidden) o.visible = false
    g.bgCars?.mesh && (this.hidden.push(g.bgCars.mesh), g.bgCars.mesh.visible = false)
    g.cine.on = true
    g.cinematicFrame = (dt) => {
      const c = this.cam, k = Math.min(1, dt * 1.8)
      c.p.lerp(c.tp, k); c.l.lerp(c.tl, k)
      g.camera.position.copy(c.p); g.camera.lookAt(c.l)
    }
    this.label()
  }
  go(i) { const n = this.v.length; this.i = (i + n) % n; this.cam.tp.set(...this.v[this.i][1]); this.cam.tl.set(...this.v[this.i][2]); this.label() }
  label() { this.game.ui.hintHold(`${this.v[this.i][0]}  ·  A / D to look around  ·  E or Esc to leave`) }
  exit() {
    const g = this.game; this.on = false
    g.cine.on = false; g.cinematicFrame = Object.getPrototypeOf(g).cinematicFrame.bind(g)
    g.renderer.shadowMap.autoUpdate = true; g.renderer.shadowMap.needsUpdate = true
    for (const o of this.hidden || []) o.visible = true; this.hidden = []
    g.rig.snapTo(g.target()); g.ui.hintHold(null); g.lastHold = null
  }
}
