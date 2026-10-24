import * as THREE from 'three'
import { Kit, Batch } from './Benchmark.js'

// Grove Street as an Italian coastal village: every house lot of the "home" district rebuilt from the Quaternius
// Medieval Village MegaKit (CC0): rough stone ground floors, coloured plaster upper floors, arched windows with
// shutters, balconies, terracotta tile roofs, chimneys, vines, plus planting from the Nature kit.
// Visual only: the lot footprints, colliders and every random draw of the city are unchanged (City.js still runs
// the old house generator into a throwaway bucket). Each house takes its variation from a hash of its lot
// position, never from the shared random stream.
const Y0 = 0.18             // block slab top
const STOREY = 3.12         // kit wall height
const WHITE = new THREE.Color(1, 1, 1)
// plaster tints: ochre, salmon, terracotta, cream, rose, sage, pale yellow (multiplied onto the plaster texture)
const PLASTER = ['#f2cf96', '#f1b896', '#e8a47e', '#f7e6c4', '#f0c4b6', '#d9dcbc', '#f6dc9c'].map(c => new THREE.Color(c))
const SHUTTER = ['#4f7a5a', '#3f6a8a', '#6b4a32', '#7a8f5a', '#2f5f6f'].map(c => new THREE.Color(c))

function lotRand(x, z) { let s = (Math.round(x * 13.7) * 73856093 ^ Math.round(z * 7.3) * 19349663) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

export function buildVillage(scene, assets, lots, opts = {}) {
  const group = new THREE.Group(); group.name = 'village'
  const kit = new Kit(assets.kit.village), nature = new Kit(assets.kit.nature)
  const stats = { houses: lots.length, instances: 0, tris: 0 }
  const cache = new Map()
  const variant = (src, key, setup) => { const k = src.uuid + key; if (!cache.has(k)) { const m = src.clone(); m.vertexColors = false; setup(m); cache.set(k, m) } return cache.get(k) }
  // window glass: dark, slightly reflective; the room behind it comes from the interior quads
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a4652, metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 1.4 })
  // window latches / hinges (metal ornament parts, untextured in the free kit) render as dark wrought iron
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2a28, metalness: 0.7, roughness: 0.5 })
  const matFor = (m) => m.name === 'MI_WindowGlass' ? glass : (!m.name || /Metal/i.test(m.name)) ? iron : variant(m, 'v', (x) => { x.envMapIntensity = 0.9 })
  const B = new Batch([kit, nature], matFor)

  // rooms behind the windows: the downtown kit's interior images, lit at night (one InstancedMesh per image)
  const rooms = assets.kit.interiors.map((t) => {
    t.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.9 })
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif') }
    return { m, mtx: [], col: [] }
  })
  const roomGeo = new THREE.PlaneGeometry(1.25, 1.6)

  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4(), V = new THREE.Vector3(), S = new THREE.Vector3()
  const place = (name, x, y, z, yaw, sx = 1, sy = 1, sz = 1, color = WHITE) => { q.setFromAxisAngle(up, yaw); M4.compose(V.set(x, y, z), q, S.set(sx, sy, sz)); B.add(name, M4, color) }
  const room = (x, y, z, yaw, lit) => { const r = rooms[Math.floor(lit * 2.99) % rooms.length]; q.setFromAxisAngle(up, yaw); M4.compose(V.set(x, y, z), q, S.set(1, 1, 1)); r.mtx.push(M4.clone()); r.col.push(lit < 0.3 ? new THREE.Color(0.08, 0.08, 0.1) : lit < 0.55 ? new THREE.Color(0.45, 0.42, 0.38) : WHITE) }
  // sides of a rectangle; kit walls face +z with their depth behind the face line
  const sidesOf = (r) => [
    { id: 'N', yaw: Math.PI, sx: r.x0 + r.w, sz: r.z0, tx: -1, tz: 0, len: r.w },
    { id: 'S', yaw: 0, sx: r.x0, sz: r.z0 + r.d, tx: 1, tz: 0, len: r.w },
    { id: 'E', yaw: Math.PI / 2, sx: r.x0 + r.w, sz: r.z0 + r.d, tx: 0, tz: -1, len: r.d },
    { id: 'W', yaw: -Math.PI / 2, sx: r.x0, sz: r.z0, tx: 0, tz: 1, len: r.d },
  ]
  const doors = []

  for (const L of lots) {
    const R = lotRand(L.x0, L.z0), r = { x0: L.x0, z0: L.z0, w: L.w, d: L.d }
    const storeys = L.h > 5 ? 2 : 1
    const plaster = PLASTER[Math.floor(R() * PLASTER.length)], shutter = SHUTTER[Math.floor(R() * SHUTTER.length)]
    const stoneBase = storeys === 2 && R() < 0.7          // two-storey houses mostly get a rough stone ground floor
    // the front faces the nearest street: west for lots in the block's west half, else east (Akshat's house: west)
    const front = L.rx < 18 ? 'W' : 'E'
    R()   // keeps each lot's variation sequence stable (was a thin-window choice; the free kit's thin-window wall has a blank texture patch)
    for (let f = 0; f < storeys; f++) {
      const y = Y0 + f * STOREY, stone = f === 0 && stoneBase
      for (const s of sidesOf(r)) {
        // an odd bay count keeps a bay centred on each face (the door sits there)
        let n = Math.max(1, Math.round(s.len / 2)); if (n % 2 === 0) n += s.len / n > 2 ? 1 : -1
        const seg = s.len / n, sx = seg / 2
        for (let i = 0; i < n; i++) {
          const x = s.sx + s.tx * seg * (i + 0.5), z = s.sz + s.tz * seg * (i + 0.5)
          const isFront = s.id === front, centre = i === (n - 1) / 2
          const nx = Math.sin(s.yaw), nz = Math.cos(s.yaw)
          if (f === 0 && isFront && centre) {
            place(stone ? 'Wall_UnevenBrick_Door_Round' : 'Wall_Plaster_Door_Round', x, y, z, s.yaw, sx, 1, 1, stone ? WHITE : plaster)
            place('Door_1_Round', x - s.tx * 0.56 * sx, y, z - s.tz * 0.56 * sx, s.yaw, 1, 1, 1, WHITE)
            doors.push({ x: x + nx * 0.2, z: z + nz * 0.2, yaw: s.yaw, lot: L })
            continue
          }
          // windows on alternate bays (all bays on the front's upper floor), plain wall between
          const win = isFront ? (f > 0 || i % 2 === 0) : i % 2 === (f % 2)
          if (!win) { place(stone ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_Straight', x, y, z, s.yaw, sx, 1, 1, stone ? WHITE : plaster); continue }
          place(stone ? 'Wall_UnevenBrick_Window_Wide_Round' : 'Wall_Plaster_Window_Wide_Round', x, y, z, s.yaw, sx, 1, 1, stone ? WHITE : plaster)
          place('Window_Wide_Round1', x, y, z, s.yaw, 1, 1, 1, WHITE)
          const sh = R(); if (sh < 0.75) place(sh < 0.55 ? 'WindowShutters_Wide_Round_Open' : 'WindowShutters_Wide_Round_Closed', x, y, z, s.yaw, 1, 1, 1, shutter)
          room(x - nx * 0.32, y + 1.85, z - nz * 0.32, s.yaw, R())
          // a balcony on the centre bay of the front, upper floor
          if (f === 1 && isFront && centre && R() < 0.75) place('Balcony_Simple_Straight', x, y - 0.05, z, s.yaw, sx, 1, 1, WHITE)
        }
      }
      // timber corner posts
      for (const [cx, cz] of [[r.x0, r.z0], [r.x0 + r.w, r.z0], [r.x0, r.z0 + r.d], [r.x0 + r.w, r.z0 + r.d]]) place('Corner_Exterior_Wood', cx, y, cz, 0, 1, 1, 1, WHITE)   // the stone corner is 3.1k triangles; timber posts read the same at street distance
    }
    // terracotta roof over the whole footprint, ridge along the longer side, Mediterranean (low) pitch
    const top = Y0 + storeys * STOREY
    const roofName = L.w * L.d > 95 ? 'Roof_RoundTiles_8x10' : 'Roof_RoundTiles_8x8'
    const RW = roofName === 'Roof_RoundTiles_8x10' ? [9.95, 12.33] : [9.95, 10.33]
    const along = L.d >= L.w                                  // ridge along z when the lot is deeper than wide
    const yawR = along ? 0 : Math.PI / 2, rw = along ? L.w : L.d, rd = along ? L.d : L.w
    // the kit roof's origin is the wall top (eaves hang below it); it spans 8 m walls, so scale to the footprint
    const pitch = 0.62
    place(roofName, r.x0 + r.w / 2, top, r.z0 + r.d / 2, yawR, (rw + 0.8) / RW[0], pitch, (rd + 0.7) / RW[1], WHITE)
    // gable walls (plaster triangles, 8.3 m base) closing both ridge ends, tinted like the house
    for (const s of sidesOf(r)) {
      if (along ? (s.id !== 'N' && s.id !== 'S') : (s.id !== 'E' && s.id !== 'W')) continue
      place('Roof_Front_Brick8', s.sx + s.tx * s.len / 2, top, s.sz + s.tz * s.len / 2, s.yaw, s.len / 8.32, pitch, 1, plaster)
    }
    if (R() < 0.8) place('Prop_Chimney', r.x0 + r.w * (0.25 + R() * 0.5), top + 0.2, r.z0 + r.d * (0.25 + R() * 0.5), 0, 0.9, 0.9, 0.9, WHITE)
    // vines climbing a couple of walls
    for (const s of sidesOf(r)) if (R() < 0.35) { const t = 0.2 + R() * 0.6; place(['Prop_Vine2', 'Prop_Vine4', 'Prop_Vine6'][Math.floor(R() * 3)], s.sx + s.tx * s.len * t + Math.sin(s.yaw) * 0.12, top - 0.2, s.sz + s.tz * s.len * t + Math.cos(s.yaw) * 0.12, s.yaw, 1.2, 1.2, 1.2, WHITE) }
    // planting: flowers either side of the door, a cypress or a bush at a front corner
    const fd = doors[doors.length - 1]
    if (fd) for (const sgn of [-1, 1]) { const ax = Math.cos(fd.yaw) * sgn * 1.4, az = -Math.sin(fd.yaw) * sgn * 1.4; place('Bush_Common_Flowers', fd.x + ax + Math.sin(fd.yaw) * 0.5, Y0, fd.z + az + Math.cos(fd.yaw) * 0.5, R() * 6, 0.5, 0.5, 0.5, WHITE) }
    const fs = sidesOf(r).find(s => s.id === front), corner = R() < 0.5 ? 0 : 1
    const cx = fs.sx + fs.tx * fs.len * corner + Math.sin(fs.yaw) * 1.6, cz = fs.sz + fs.tz * fs.len * corner + Math.cos(fs.yaw) * 1.6
    if (R() < 0.6) place('CommonTree_3', cx, Y0, cz, R() * 6, 0.55, 0.75, 0.55, WHITE); else place('Bush_Common', cx, Y0, cz, R() * 6, 0.9, 0.9, 0.9, WHITE)
  }

  B.build(group, stats)
  // small recessed details cast no shadows (invisible at this scale, and it halves their cost)
  const NO_SHADOW = /^(Window_|WindowShutters_|Door_|Prop_Vine|Bush_Common_Flowers)/
  group.traverse(o => { if (o.isInstancedMesh && NO_SHADOW.test(o.name)) o.castShadow = false })
  for (const r of rooms) {
    if (!r.mtx.length) continue
    const im = new THREE.InstancedMesh(roomGeo, r.m, r.mtx.length)
    r.mtx.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, r.col[i]) })
    im.computeBoundingSphere(); im.receiveShadow = true; group.add(im)
    stats.instances += r.mtx.length; stats.tris += r.mtx.length * 2
  }
  scene.add(group)
  return {
    group, stats, doors,
    // the front door of the house on this lot (for Akshat's House)
    doorOf(lot) { return doors.find(d => Math.abs(d.lot.x0 - lot.x0) < 0.01 && Math.abs(d.lot.z0 - lot.z0) < 0.01) || null },
    setNight(n) { for (const r of rooms) r.m.emissiveIntensity = 0.1 + n * 1.6; glass.opacity = 0.45 - n * 0.2 },
  }
}
