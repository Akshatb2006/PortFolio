import * as THREE from 'three'
import * as M from './CityMap.js'
import { prewarmInterior } from './prewarm.js'
import { profile, experience, projects, lab, skills, achievements, verifiedSocials } from '../data/content.js'

// Akshat's House — the "about me" home on Grove Street. Everything shown comes from src/data/content.js
// (unverified links stay hidden, like everywhere else in the game).
// Exterior: the existing house nearest the "Back home" checkpoint (block 0,4) gets a front door, porch light,
// path and a name sign on its street side. The house's collider is not touched; the door is a prompt.
// Interior: a separate room south of the city, built on the first visit (like the LUMEN club). Each station
// is a piece of furniture with a label and an E prompt that opens a panel:
//   TV (living room)        About me          career wall (framed posters)   Experience
//   desk with two monitors  Projects + Lab    bookshelf                      Skills
//   trophy cabinet          Achievements      corkboard by the door          Contact (verified links)
// Lighting copies the club's light set exactly (4 point, 1 spot, 1 hemisphere), so the shaders compiled for
// the club are reused here and entering never triggers a recompile.
export const HOUSE_NAME = 'Akshat’s House'
const IN = { x: -60, z: 520, w: 18, d: 13, h: 3.4 }
const BLOCK_ID = { bx: 0, bz: 4 }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// canvas poster: title, optional subtitle and wrapped body lines
function poster({ w = 512, h = 640, bg = '#f4efe6', fg = '#1d1a16', accent = '#c0582f', title, sub, lines = [], titleSize = 54, bodySize = 26 }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  x.fillStyle = bg; x.fillRect(0, 0, w, h)
  x.fillStyle = accent; x.fillRect(0, 0, w, 14)
  x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'top'
  const wrap = (text, font, y, lh, color = fg) => {
    x.font = font; x.fillStyle = color
    let line = ''
    for (const word of String(text).split(' ')) {
      const t = line ? line + ' ' + word : word
      if (x.measureText(t).width > w - 64 && line) { x.fillText(line, 32, y); y += lh; line = word } else line = t
    }
    if (line) { x.fillText(line, 32, y); y += lh }
    return y
  }
  let y = wrap(title, `bold ${titleSize}px Anton, Impact, sans-serif`, 40, titleSize * 1.1)
  if (sub) y = wrap(sub, `600 ${bodySize}px "Barlow Condensed", sans-serif`, y + 6, bodySize * 1.25, accent)
  y += 14
  for (const l of lines) { y = wrap(l, `${bodySize}px "Barlow Condensed", sans-serif`, y, bodySize * 1.3); y += 8; if (y > h - 40) break }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512
  const x = c.getContext('2d')
  for (let i = 0; i < 8; i++) {
    const shade = 120 + ((i * 37) % 30)
    x.fillStyle = `rgb(${shade + 40},${shade},${shade - 45})`; x.fillRect(0, i * 64, 512, 64)
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i * 64, 512, 2)
    const off = (i * 173) % 512; x.fillRect(off, i * 64, 2, 64)
    for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(60,30,10,${0.05 + ((k * 7 + i) % 5) * 0.02})`; x.fillRect(0, i * 64 + 6 + k * 4, 512, 1) }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

// view through the windows: sky gradient over a soft skyline
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 208
  const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 208)
  gr.addColorStop(0, '#6fa6d8'); gr.addColorStop(0.7, '#cfe2ee'); gr.addColorStop(1, '#f1e3cc'); x.fillStyle = gr; x.fillRect(0, 0, 256, 208)
  x.fillStyle = 'rgba(80,100,120,.45)'
  for (let i = 0, px = 0; px < 256; i++) { const w = 18 + (i * 37) % 26, hgt = 40 + (i * 53) % 70; x.fillRect(px, 208 - hgt, w, hgt); px += w + 4 }
  x.strokeStyle = '#f2efe8'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 208); x.moveTo(0, 104); x.lineTo(256, 104); x.stroke()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function label(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112
  const x = c.getContext('2d')
  x.fillStyle = 'rgba(12,16,24,.78)'; x.beginPath(); x.roundRect(4, 4, 504, 104, 26); x.fill()
  x.strokeStyle = '#f6c543'; x.lineWidth = 4; x.stroke()
  x.fillStyle = '#fff'; x.font = 'bold 56px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 58)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }))
  s.scale.set(1.6, 0.35, 1); s.renderOrder = 10
  return s
}

export class House {
  constructor(game) {
    this.game = game
    this.inside = false
    this.room = null
    this.stats = { visits: 0, panels: {} }
    this.buildExterior()
  }

  // ================================================================ exterior
  // the house lot on block (0,4) nearest the "Back home" checkpoint, read from the static collider boxes
  findHouse() {
    const x0 = M.blockStart(BLOCK_ID.bx), z0 = M.blockStart(BLOCK_ID.bz), B = M.BLOCK
    const home = { x: M.roadCoord(0), z: z0 + B / 2 }
    const lots = M.colliders.boxes.filter(b => b.x0 >= x0 - 0.01 && b.x1 <= x0 + B + 0.01 && b.z0 >= z0 - 0.01 && b.z1 <= z0 + B + 0.01 && b.x1 - b.x0 > 6 && b.z1 - b.z0 > 6)
    lots.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - home.x, (a.z0 + a.z1) / 2 - home.z) - Math.hypot((b.x0 + b.x1) / 2 - home.x, (b.z0 + b.z1) / 2 - home.z))
    return lots[0] || null
  }

  buildExterior() {
    const g = this.game, lot = this.findHouse()
    if (!lot) { console.warn('[house] no house lot found on block 0,4'); return }
    this.lot = lot
    // the front faces the west road (col 0); the door sits on the west wall, centred
    const fx = lot.x0, cz = (lot.z0 + lot.z1) / 2, Y = 0.18
    const grp = new THREE.Group(); grp.name = 'house-exterior'
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6 })
    const trim = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 })
    const lamp = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffc77a, emissiveIntensity: 1.4 })
    const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; grp.add(o); return o }
    // with the Grove Street village the house already has a real arched front door (Village.js); otherwise add one
    const vd = this.game.city.village?.doorOf(lot)
    if (!vd) {
      add(new THREE.BoxGeometry(0.16, 2.3, 1.3), trim, fx - 0.04, Y + 1.15, cz)          // frame
      add(new THREE.BoxGeometry(0.12, 2.1, 1.05), wood, fx - 0.1, Y + 1.05, cz)          // door
      add(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b36a, metalness: 1, roughness: 0.3 }), fx - 0.18, Y + 1.0, cz + 0.36)
    }
    add(new THREE.BoxGeometry(1.2, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0x8c8778, roughness: 0.9 }), fx - 0.6, Y + 0.06, cz)  // step
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.26, 0.16), lamp, fx - 0.14, Y + 2.15, cz + s * 0.85)
    // path to the street and a doormat
    const path = new THREE.Mesh(new THREE.PlaneGeometry(fx - (M.blockStart(BLOCK_ID.bx) - 0.2), 1.3), new THREE.MeshStandardMaterial({ color: 0xb9ad94, roughness: 0.95 }))
    path.rotation.x = -Math.PI / 2; path.position.set((fx + M.blockStart(BLOCK_ID.bx)) / 2 - 0.6, Y + 0.02, cz); path.receiveShadow = true; grp.add(path)
    // name sign above the door
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: poster({ w: 640, h: 160, bg: '#1d2a14', fg: '#ffffff', accent: '#b6f07a', title: 'AKSHAT’S HOUSE', titleSize: 64 }), transparent: false }))
    sign.position.set(fx - 0.14, Y + (vd ? 3.55 : 2.75), cz); sign.rotation.y = -Math.PI / 2; grp.add(sign)   // above the arch with the village door
    g.scene.add(grp)
    this.exterior = grp
    this.door = new THREE.Vector3(fx - 1.2, Y, cz)
  }

  // ================================================================ interior (built on the first visit)
  buildRoom() {
    const g = this.game, R = g.physics.R, W = g.physics.world
    const grp = new THREE.Group(); grp.name = 'house-interior'
    const X = IN.x, Z = IN.z, hw = IN.w / 2, hd = IN.d / 2, H = IN.h
    const m = {
      floor: new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xb09a86, roughness: 0.55 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.9 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.85 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.4, metalness: 0.4 }),
      sofa: new THREE.MeshStandardMaterial({ color: 0x8a6a4e, roughness: 0.85 }),
      rug: new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: 1 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd9a63a, roughness: 0.25, metalness: 1 }),
      plant: new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 }),
      pot: new THREE.MeshStandardMaterial({ color: 0xc0582f, roughness: 0.8 }),
      lampGlow: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 1.2 }),
      window: new THREE.MeshBasicMaterial({ map: skyTexture() }),
    }
    const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(X + x, y, Z + z); o.rotation.y = ry; o.receiveShadow = true; grp.add(o); return o }
    const box = (w, h, d, mat, x, y, z, ry = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry)
    const solid = (w, h, d, x, y, z) => W.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(X + x, y + h / 2, Z + z))
    const pic = (tex, w, h, x, y, z, ry, frame = m.wood) => { box(w + 0.12, h + 0.12, 0.05, frame, x, y - (h + 0.12) / 2, z, ry); return add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03, ry) }
    const tag = (text, x, y, z) => { const s = label(text); s.position.set(X + x, y, Z + z); grp.add(s); return s }

    // shell
    const fl = add(new THREE.PlaneGeometry(IN.w, IN.d), m.floor, 0, 0.01, 0); fl.rotation.x = -Math.PI / 2
    const ce = add(new THREE.PlaneGeometry(IN.w, IN.d), m.ceil, 0, H, 0); ce.rotation.x = Math.PI / 2
    for (const [w, d, x, z, mat] of [[IN.w, 0.3, 0, -hd, m.accent], [IN.w, 0.3, 0, hd, m.wall], [0.3, IN.d, -hw, 0, m.wall], [0.3, IN.d, hw, 0, m.wall]]) { box(w, H, d, mat, x, 0, z); solid(w, H, d, x, 0, z) }
    box(IN.w, 0.12, 0.04, m.wood, 0, 0, -hd + 0.17)   // skirting on the career wall
    // windows (bright sky panels) on the side walls
    for (const s of [-1, 1]) for (const z of [-2.5, 2.5]) { box(0.06, 1.5, 1.8, m.wood, s * (hw - 0.17), 1.0, z); add(new THREE.PlaneGeometry(1.6, 1.3), m.window, s * (hw - 0.21), 1.75, z, -s * Math.PI / 2) }
    // front door (south wall, centre) and a doormat
    box(1.3, 2.3, 0.1, m.wood, 0, 0, hd - 0.2)
    const mat = add(new THREE.PlaneGeometry(1.4, 0.8), m.rug, 0, 0.02, hd - 0.9); mat.rotation.x = -Math.PI / 2

    // ---- living room (west): TV wall + sofa + rug  → ABOUT
    box(0.1, 1.3, 2.4, m.dark, -hw + 0.22, 0.9, -1.0)
    const aboutTex = poster({ w: 1024, h: 560, bg: '#10161f', fg: '#e9eef5', accent: '#f6c543', title: profile.name.toUpperCase(), sub: profile.tagline, lines: profile.about, titleSize: 76, bodySize: 30 })
    add(new THREE.PlaneGeometry(2.26, 1.22), new THREE.MeshBasicMaterial({ map: aboutTex }), -hw + 0.28, 1.55, -1.0, Math.PI / 2)
    box(0.5, 0.5, 2.6, m.wood, -hw + 0.5, 0, -1.0); solid(0.5, 0.5, 2.6, -hw + 0.5, 0, -1.0)   // TV unit
    const rug = add(new THREE.PlaneGeometry(3.6, 2.8), m.rug, -hw + 3.6, 0.015, -1.0); rug.rotation.x = -Math.PI / 2
    box(1.0, 0.4, 1.6, m.wood, -hw + 3.2, 0, -1.0); solid(1.0, 0.4, 1.6, -hw + 3.2, 0, -1.0)        // coffee table
    box(1.0, 0.45, 3.0, m.sofa, -hw + 5.4, 0, -1.0); box(0.3, 0.95, 3.0, m.sofa, -hw + 5.85, 0, -1.0); solid(1.3, 0.95, 3.0, -hw + 5.5, 0, -1.0)
    for (const s of [-1, 1]) box(1.0, 0.65, 0.25, m.sofa, -hw + 5.4, 0, -1.0 + s * 1.5)
    tag('ABOUT ME', -hw + 0.6, 2.6, -1.0)

    // ---- career wall (north): one framed poster per experience entry → EXPERIENCE
    const n = experience.length, span = Math.min(IN.w - 6, n * 2.4)
    experience.forEach((e, i) => {
      const x = -span / 2 + span * (i + 0.5) / n
      pic(poster({ title: e.org, sub: `${e.role} · ${e.period}`, lines: e.points, titleSize: 46, bodySize: 24 }), 1.6, 2.0, x, 1.75, -hd + 0.2, 0)
    })
    tag('EXPERIENCE', 0, 3.05, -hd + 0.5)

    // ---- desk with two monitors (east) → PROJECTS + LAB
    box(0.8, 0.75, 2.4, m.wood, hw - 0.7, 0, 1.2); solid(0.8, 0.75, 2.4, hw - 0.7, 0, 1.2)
    const projTex = poster({ w: 640, h: 400, bg: '#0c1220', fg: '#d8e6ff', accent: '#3dd6f5', title: 'PROJECTS', lines: projects.map(p => `${p.title}: ${p.stack}`), titleSize: 54, bodySize: 26 })
    const labTex = poster({ w: 640, h: 400, bg: '#0c1220', fg: '#d8e6ff', accent: '#7fe0d0', title: 'LAB', lines: lab.map(p => p.title), titleSize: 54, bodySize: 26 })
    for (const [tex, z] of [[projTex, 0.6], [labTex, 1.8]]) {
      box(0.08, 0.62, 1.0, m.dark, hw - 0.95, 1.05, z); add(new THREE.PlaneGeometry(0.94, 0.58), new THREE.MeshBasicMaterial({ map: tex }), hw - 1.0, 1.36, z, -Math.PI / 2)
      box(0.06, 0.3, 0.06, m.dark, hw - 0.9, 0.75, z)
    }
    box(0.5, 0.45, 0.5, m.dark, hw - 1.6, 0, 1.2)   // chair
    tag('PROJECTS', hw - 1.0, 2.35, 1.2)

    // ---- bookshelf (north-east corner) with one labelled shelf per skill group → SKILLS
    const shelfX = hw - 2.2, shelfZ = -hd + 0.45
    box(2.6, 2.4, 0.5, m.wood, shelfX, 0, shelfZ); solid(2.6, 2.4, 0.6, shelfX, 0, shelfZ)
    const bookCols = [0xc0582f, 0x2f4a3a, 0x3d5a8a, 0xd9a63a, 0x7a3fa8, 0x8b2222]
    skills.forEach((s, k) => {
      const y = 0.15 + k * 0.37
      box(2.4, 0.03, 0.42, m.wood, shelfX, y, shelfZ + 0.04)
      const nb = Math.min(10, s.items.length * 2)
      for (let i = 0; i < nb; i++) box(0.09 + (i % 3) * 0.02, 0.26 + (i % 2) * 0.05, 0.3, new THREE.MeshStandardMaterial({ color: bookCols[(i + k) % bookCols.length], roughness: 0.8 }), shelfX - 1.1 + i * 0.13, y + 0.03, shelfZ + 0.08)
    })
    tag('SKILLS', shelfX, 2.85, shelfZ + 0.4)

    // ---- trophy cabinet (north-west corner) → ACHIEVEMENTS
    const cabX = -hw + 1.6, cabZ = -hd + 0.5
    box(2.0, 2.0, 0.5, m.wood, cabX, 0, cabZ); solid(2.0, 2.0, 0.6, cabX, 0, cabZ)
    box(1.9, 1.3, 0.04, m.glass, cabX, 0.6, cabZ + 0.27)
    achievements.forEach((a, i) => {
      const x = cabX - 0.6 + i * 0.6
      add(new THREE.CylinderGeometry(0.12, 0.06, 0.22, 12), m.gold, x, 1.25, cabZ)
      add(new THREE.CylinderGeometry(0.06, 0.1, 0.1, 10), m.gold, x, 1.09, cabZ)
    })
    pic(poster({ w: 512, h: 220, title: 'TROPHIES', lines: achievements.map(a => a.title), titleSize: 44, bodySize: 22 }), 1.4, 0.6, cabX, 2.45, -hd + 0.2, 0)
    tag('ACHIEVEMENTS', cabX, 3.05, cabZ + 0.4)

    // ---- corkboard by the door (south-east) → CONTACT
    const corkTex = poster({ w: 640, h: 480, bg: '#b88a5a', fg: '#1d1a16', accent: '#c0582f', title: 'GET IN TOUCH', lines: verifiedSocials.map(s => `${s.name}: ${s.handle}`), titleSize: 52, bodySize: 28 })
    pic(corkTex, 1.6, 1.2, hw - 3.0, 1.6, hd - 0.2, Math.PI)
    tag('CONTACT', hw - 3.0, 2.6, hd - 0.5)

    // decor: plants, floor lamp, ceiling lights
    for (const [x, z] of [[-hw + 0.6, hd - 0.7], [hw - 0.6, -2.4], [-hw + 0.6, 2.2]]) { add(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 12), m.pot, x, 0.2, z); add(new THREE.SphereGeometry(0.42, 10, 8), m.plant, x, 0.78, z); solid(0.5, 1, 0.5, x, 0, z) }
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), m.dark, -hw + 6.4, 0.75, -2.7); add(new THREE.CylinderGeometry(0.18, 0.25, 0.3, 14, 1, true), m.lampGlow, -hw + 6.4, 1.6, -2.7)
    for (const x of [-5, 0, 5]) add(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), m.lampGlow, x, H - 0.03, 0)

    // lighting: the same light set as the club (4 point, 1 spot, 1 hemisphere) so no shader recompiles
    this.lights = new THREE.Group()
    for (const x of [-5, 0, 5]) { const l = new THREE.PointLight(0xffe2b8, 14, 12, 1.4); l.position.set(X + x, H - 0.3, Z); this.lights.add(l) }
    const lampL = new THREE.PointLight(0xffc98a, 6, 6, 1.5); lampL.position.set(X - hw + 6.4, 1.7, Z - 2.7); this.lights.add(lampL)
    const spot = new THREE.SpotLight(0xfff4e0, 30, 9, 0.75, 0.6, 1.2); spot.position.set(X, H - 0.2, Z - 1.5); spot.target.position.set(X, 1.6, Z - hd); this.lights.add(spot, spot.target)
    this.lights.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 1.2))
    grp.add(this.lights)
    grp.visible = false
    g.scene.add(grp)
    this.room = grp
    this.spawn = new THREE.Vector3(X, 0, Z + hd - 1.4)
    this.exitAt = new THREE.Vector3(X, 0, Z + hd - 0.8)
    this.stations = [
      { id: 'about', at: new THREE.Vector3(X - hw + 2.4, 0, Z - 1.0), prompt: 'Press E to watch: About me', open: () => this.openAbout() },
      { id: 'experience', at: new THREE.Vector3(X, 0, Z - hd + 1.3), prompt: 'Press E to read the career wall', open: () => this.openExperience() },
      { id: 'projects', at: new THREE.Vector3(X + hw - 1.7, 0, Z + 1.2), prompt: 'Press E to browse projects', open: () => this.openProjects() },
      { id: 'skills', at: new THREE.Vector3(X + shelfX, 0, Z + shelfZ + 1.1), prompt: 'Press E to look at the bookshelf: Skills', open: () => this.openSkills() },
      { id: 'achievements', at: new THREE.Vector3(X + cabX, 0, Z + cabZ + 1.1), prompt: 'Press E to open the trophy cabinet', open: () => this.openAchievements() },
      { id: 'contact', at: new THREE.Vector3(X + hw - 3.0, 0, Z + hd - 1.1), prompt: 'Press E to read the corkboard: Contact', open: () => this.openContact() },
    ]
  }

  // ================================================================ enter / exit (same contract as the club)
  enter() {
    const g = this.game, pl = g.player
    if (this.inside || pl.inVehicle || !this.door) return
    if (!this.room) this.buildRoom()
    this.saved = { hidden: [] }
    g.fade(() => {
      for (const o of g.scene.children) if (o !== this.room && o !== pl.mesh && o.visible && !o.isLight) { o.visible = false; this.saved.hidden.push(o) }
      this.room.visible = true
      this.saved.light = { sun: g.sunLight.visible, hemi: g.hemi.visible, env: g.scene.environmentIntensity, fog: g.scene.fog.density, exp: g.renderer.toneMappingExposure }
      g.sunLight.visible = false; g.hemi.visible = false; g.scene.environmentIntensity = 0.35; g.scene.fog.density = 0; g.renderer.toneMappingExposure = 1.0
      g.interior = { name: HOUSE_NAME, noCombat: true, house: this }
      pl.teleport(this.spawn.x, this.spawn.z, Math.PI)
      g.rig.snapTo(g.target())
      this.inside = true; this.stats.visits++
      g.ui.district({ name: HOUSE_NAME })
      g.ui.objective('Walk up to the <strong>labelled</strong> spots and press <kbd>E</kbd> to learn about me')
    })
  }

  exit() {
    const g = this.game, pl = g.player
    if (!this.inside) return
    g.fade(() => {
      this.room.visible = false
      for (const o of this.saved.hidden) o.visible = true
      const L = this.saved.light; g.sunLight.visible = L.sun; g.hemi.visible = L.hemi; g.scene.environmentIntensity = L.env; g.scene.fog.density = L.fog; g.renderer.toneMappingExposure = L.exp
      g.interior = null
      pl.teleport(this.door.x - 0.6, this.door.z, -Math.PI / 2)
      g.applyNight(g.nightLerp, true)
      g.rig.snapTo(g.target())
      this.inside = false
      g.ui.objective(null)
      g.ui.district(M.districtAt(pl.pos.x, pl.pos.z))
    })
  }

  interactables() {
    if (!this.door) return []
    if (!this.inside) return [{ id: 'house-door', pos: this.door, radius: 2.2, priority: 2, prompt: `Press E to enter ${HOUSE_NAME}`, action: () => this.enter() }]
    return [
      { id: 'house-exit', pos: this.exitAt, radius: 1.4, priority: 2, prompt: 'Press E to go outside', action: () => this.exit() },
      ...this.stations.map(s => ({ id: 'house-' + s.id, pos: s.at, radius: 1.6, priority: 3, prompt: s.prompt, action: () => { this.stats.panels[s.id] = (this.stats.panels[s.id] || 0) + 1; s.open() } })),
    ]
  }

  // ================================================================ panels (content.js only)
  panel(title, html) { this.game.ui.venue(`${title} · ${HOUSE_NAME}`, `<div class="venue-scroll house-panel">${html}</div>`) }
  openAbout() { this.panel('About me', `<p class="venue-lead"><strong>${esc(profile.name)}</strong><br>${esc(profile.tagline)}</p>${profile.about.map(p => `<p>${esc(p)}</p>`).join('')}`) }
  openExperience() {
    this.panel('Experience', `<div class="venue-list">${experience.map(e => `<div class="venue-item house-entry"><span><strong>${esc(e.role)}</strong><em>${esc(e.org)} · ${esc(e.period)}</em><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></span></div>`).join('')}</div>`)
  }
  openProjects() {
    const item = (p, linked) => linked
      ? `<a class="venue-item" href="${esc(p.url)}" target="_blank" rel="noopener"><span><strong>${esc(p.title)}</strong><em>${esc(p.stack || p.blurb)}</em><em>${esc(p.blurb)}</em></span><b>Open ↗</b></a>`
      : `<div class="venue-item"><span><strong>${esc(p.title)}</strong><em>${esc(p.stack)}</em><em>${esc(p.blurb)}</em></span><b class="muted">Link pending</b></div>`
    this.panel('Projects', `<p class="venue-lead">Shipped work</p><div class="venue-list">${projects.map(p => item(p, p.verified !== false)).join('')}</div><p class="venue-lead" style="margin-top:16px">Lab experiments</p><div class="venue-list">${lab.map(p => item({ ...p, stack: 'GitHub' }, true)).join('')}</div>`)
  }
  openSkills() { this.panel('Skills', skills.map(s => `<p class="venue-lead" style="margin-bottom:6px"><strong>${esc(s.label)}</strong></p><div class="tags">${s.items.map(i => `<span class="tag">${esc(i)}</span>`).join('')}</div>`).join('')) }
  openAchievements() { this.panel('Achievements', `<div class="venue-list">${achievements.map(a => `<div class="venue-item"><span><strong>${esc(a.title)}</strong><em>${esc(a.detail)}</em></span><b>🏆</b></div>`).join('')}</div>`) }
  openContact() { this.panel('Contact', `<p class="venue-lead">Say hello.</p><div class="venue-list">${verifiedSocials.map(s => `<a class="venue-item" href="${esc(s.url)}" target="_blank" rel="noopener"><span><strong>${esc(s.name)}</strong><em>${esc(s.handle)}</em></span><b>Open ↗</b></a>`).join('')}</div>`) }

  // build the room and compile its shaders in the background once the player is near the door, so walking in
  // never stalls on shader compilation
  update() {
    if (this.room || !this.door || this.warming) return
    if (this.game.target().pos.distanceTo(this.door) > 30) return
    this.warming = true; this.buildRoom()
    prewarmInterior(this.game, this.room, [this.game.player.mesh]).then(() => { this.warm = true })
  }

  describe() { return { inside: this.inside, built: !!this.room, warm: !!this.warm, door: this.door && [+this.door.x.toFixed(1), +this.door.z.toFixed(1)], lot: this.lot, stats: this.stats } }
}
