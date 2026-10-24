import * as THREE from 'three'
import * as M from './CityMap.js'
import { prewarmInterior } from './prewarm.js'
import { makeCharacter, blendCivilian, updateLayer, playAction, stopAction } from './Characters.js'
import { makeTextTexture } from './textures.js'
import { verifiedSocials } from '../data/content.js'

// LUMEN — the nightclub by Sunset Pier (beach block 4,6, which was empty).
// Exterior: a new building with its own collider (no existing collider touched) and an entrance prompt.
// Interior: a separate room far south of the city (outside the boundary walls). Entering hides the city,
// swaps the lighting and starts the music; leaving restores the exact exterior state. Interior NPCs are
// created once on the first visit and reused.
// Roles (each a small state machine): bartender, DJ, dancers (dance / break / bar visit), talking groups,
// seated booth patrons, stage watchers. The pole stage is built but its performer is PENDING: none of the
// downloaded packs contains a pole or stage-performance animation, so none is faked.
export const CLUB_NAME = 'LUMEN'
export const VERIFIED_SOCIALS = verifiedSocials   // Discord stays unpublished until verified
const EXT = { bx: 4, bz: 6, w: 16, d: 12, h: 7 }
const IN = { x: 0, z: 520, w: 30, d: 22, h: 5.2 }   // interior room centre and size
const DRINKS = [
  { id: 'fizz', name: 'Neon Fizz', price: 8, desc: 'Citrus soda over crushed ice, with a glow stick for a stirrer.' },
  { id: 'sour', name: 'Sunset Sour', price: 12, desc: 'Blood orange, lime and a sugared rim. House favourite.' },
  { id: 'tonic', name: 'Midnight Tonic', price: 10, desc: 'Blueberry tonic with a sprig of mint.' },
  { id: 'water', name: 'Sparkling Water', price: 0, desc: 'On the house. Stay hydrated.' },
]

export class Club {
  constructor(game) {
    this.game = game
    this.inside = false
    this.stats = { visits: 0, drinks: 0, npcsCreated: 0 }
    this.buildExterior()
    this.room = null           // built lazily on the first visit
  }

  // ================================================================ exterior
  buildExterior() {
    const g = this.game, x0 = M.blockStart(EXT.bx), z0 = M.blockStart(EXT.bz)
    const cx = x0 + M.BLOCK / 2, cz = z0 + M.BLOCK / 2, Y = 0.18
    const grp = new THREE.Group(); grp.name = 'club-exterior'
    const shell = new THREE.MeshStandardMaterial({ color: 0x1b1a2a, metalness: 0.6, roughness: 0.35 })
    const glass = new THREE.MeshStandardMaterial({ color: 0x241a3a, metalness: 0.8, roughness: 0.12, envMapIntensity: 1.6 })
    this.neonM = new THREE.MeshStandardMaterial({ color: 0x220011, emissive: 0xe94fa6, emissiveIntensity: 1.6 })
    this.neonC = new THREE.MeshStandardMaterial({ color: 0x002230, emissive: 0x3dd6f5, emissiveIntensity: 1.4 })
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; grp.add(b); return b }
    box(EXT.w, EXT.h, EXT.d, shell, cx, Y + EXT.h / 2, cz)
    box(EXT.w + 0.6, 0.5, EXT.d + 0.6, shell, cx, Y + EXT.h + 0.25, cz)
    // glass front (west, facing the pier) with neon edges, canopy and the sign
    const fx = cx - EXT.w / 2 - 0.05
    box(0.12, EXT.h - 1.4, EXT.d - 2, glass, fx, Y + (EXT.h - 1.4) / 2 + 0.2, cz)
    box(0.1, 0.12, EXT.d - 1.6, this.neonC, fx - 0.06, Y + EXT.h - 1.0, cz)
    box(0.1, 0.12, EXT.d - 1.6, this.neonM, fx - 0.06, Y + 0.25, cz)
    box(3.2, 0.25, 4.2, shell, fx - 1.6, Y + 3.3, cz)                    // canopy
    box(0.1, 0.08, 4.2, this.neonM, fx - 3.2, Y + 3.2, cz)
    const door = box(0.14, 2.6, 2.0, new THREE.MeshStandardMaterial({ color: 0x100010, emissive: 0x7b5cd6, emissiveIntensity: 0.9 }), fx - 0.02, Y + 1.3, cz)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: makeTextTexture([CLUB_NAME], { w: 1024, h: 320, bg: 'rgba(0,0,0,0)', fg: '#ff6ac1', border: null, font: 'bold 230px Anton, Impact, sans-serif' }), transparent: true }))
    sign.position.set(fx - 0.12, Y + EXT.h - 2.2, cz); sign.rotation.y = -Math.PI / 2; grp.add(sign)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshBasicMaterial({ color: 0x7b5cd6, transparent: true, opacity: 0.45 }))
    mat.rotation.x = -Math.PI / 2; mat.position.set(fx - 1.6, Y + 0.02, cz); grp.add(mat)
    g.scene.add(grp)
    // a new collider for the new building (no existing collider changes)
    const R = g.physics.R
    this.extCollider = g.physics.world.createCollider(R.ColliderDesc.cuboid(EXT.w / 2, EXT.h / 2, EXT.d / 2).setTranslation(cx, Y + EXT.h / 2, cz))
    this.door = new THREE.Vector3(fx - 1.6, Y, cz)
    this.exterior = grp; this.extDoorMesh = door
  }

  // ================================================================ interior (built once)
  buildRoom() {
    const g = this.game, R = g.physics.R, W = g.physics.world
    const grp = new THREE.Group(); grp.name = 'club-interior'
    const X = IN.x, Z = IN.z, hw = IN.w / 2, hd = IN.d / 2
    const m = {
      wall: new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.8 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.35, metalness: 0.3 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.55 }),
      top: new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.2, metalness: 0.7 }),
      sofa: new THREE.MeshStandardMaterial({ color: 0x4a1c4f, roughness: 0.75 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xdadde6, roughness: 0.15, metalness: 1 }),
      neonM: this.neonM, neonC: this.neonC,
      neonV: new THREE.MeshStandardMaterial({ color: 0x120a24, emissive: 0x7b5cd6, emissiveIntensity: 1.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0x4a3410, emissive: 0xf2b866, emissiveIntensity: 1.2 }),
    }
    const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(X + x, y, Z + z); o.rotation.y = ry; o.receiveShadow = true; grp.add(o); return o }
    const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z)
    const solid = (w, h, d, x, y, z) => W.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(X + x, y + h / 2, Z + z))
    // shell: floor, ceiling, walls (+ colliders)
    box(IN.w, 0.02, IN.d, m.floor, 0, 0, 0)
    box(IN.w, 0.2, IN.d, m.wall, 0, IN.h, 0)
    for (const [w, d, x, z] of [[IN.w, 0.4, 0, -hd], [IN.w, 0.4, 0, hd], [0.4, IN.d, -hw, 0], [0.4, IN.d, hw, 0]]) { box(w, IN.h, d, m.wall, x, 0, z); solid(w, IN.h, d, x, 0, z) }
    // neon lines along the walls at head height and at the ceiling
    for (const [mat, y] of [[m.neonM, 2.6], [m.neonC, IN.h - 0.3]]) { box(IN.w - 1, 0.06, 0.05, mat, 0, y, -hd + 0.25); box(0.05, 0.06, IN.d - 1, mat, -hw + 0.25, y, 0) }
    // entrance (south wall centre): door frame + exit sign
    box(2.2, 2.8, 0.1, m.neonV, 0, 0, hd - 0.22)
    const exitSign = add(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: makeTextTexture(['EXIT'], { w: 256, h: 80, bg: '#0b2a12', fg: '#5aff8a', border: null, font: 'bold 60px Anton, sans-serif' }) }), 0, 3.2, hd - 0.28, Math.PI)
    void exitSign
    // dance floor: animated LED tiles (shader), centre
    this.floorU = { t: { value: 0 } }
    const led = new THREE.ShaderMaterial({ uniforms: this.floorU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float t; varying vec2 vUv;
        void main(){ vec2 c = floor(vUv * vec2(10.0, 8.0)); vec2 f = fract(vUv * vec2(10.0, 8.0));
          float h = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
          float beat = pow(0.5 + 0.5 * sin(t * 6.5 + h * 6.28), 3.0);
          vec3 a = vec3(0.91, 0.31, 0.65), b = vec3(0.24, 0.84, 0.96), v = vec3(0.48, 0.36, 0.84);
          vec3 col = mix(mix(a, b, h), v, step(0.66, h)) * (0.15 + beat * 0.85);
          float edge = step(0.06, f.x) * step(0.06, f.y) * step(f.x, 0.94) * step(f.y, 0.94);
          gl_FragColor = vec4(col * edge, 1.0); }` })
    const floor = add(new THREE.PlaneGeometry(10, 8), led, 0, 0.025, -2); floor.rotation.x = -Math.PI / 2
    // bar along the east wall: counter, back shelf with lit bottles, stools
    box(1.2, 1.1, 10, m.wood, 11.4, 0, -1); box(1.4, 0.08, 10.2, m.top, 11.4, 1.1, -1); solid(1.2, 1.1, 10, 11.4, 0, -1)
    box(0.08, 0.05, 10, m.gold, 10.78, 0.95, -1)
    box(0.6, 3.2, 10, m.wall, 14.5, 0, -1)
    for (let k = 0; k < 3; k++) box(0.5, 0.05, 9.6, m.gold, 14.3, 1.4 + k * 0.6, -1)
    const bottle = new THREE.CylinderGeometry(0.06, 0.07, 0.32, 8)
    const bottleMats = [m.neonM, m.neonC, m.neonV, m.gold]
    for (let k = 0; k < 3; k++) for (let i = 0; i < 18; i++) add(bottle, bottleMats[(i + k) % 4], 14.25, 1.62 + k * 0.6, -5.6 + i * 0.54)
    const stool = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), leg = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6)
    for (let i = 0; i < 6; i++) { add(stool, m.sofa, 10.2, 0.74, -5 + i * 1.6); add(leg, m.chrome, 10.2, 0.35, -5 + i * 1.6) }
    // DJ booth on a raised platform (north wall) — raised 0.6 m so it is not walkable
    box(7, 0.6, 3, m.wood, 0, 0, -hd + 1.7); solid(7, 0.6, 3, 0, 0, -hd + 1.7)
    box(3.2, 1.0, 0.9, m.top, 0, 0.6, -hd + 2.9); box(3.2, 0.06, 0.92, m.neonC, 0, 1.58, -hd + 2.9)
    for (const s of [-1, 1]) { const deck = add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), m.chrome, s * 0.8, 1.64, -hd + 2.9); void deck }
    const djSign = add(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: makeTextTexture([CLUB_NAME], { w: 1024, h: 200, bg: 'rgba(0,0,0,0)', fg: '#3dd6f5', border: null, font: 'bold 160px Anton, sans-serif' }), transparent: true }), 0, 3.6, -hd + 0.22)
    void djSign
    // pole stage (west), with a railing all along its edge: the stage is never part of the walkable floor
    box(5, 0.8, 9, m.wood, -hw + 2.7, 0, -1); solid(5, 0.8, 9, -hw + 2.7, 0, -1)
    box(5.1, 0.05, 9.1, m.neonM, -hw + 2.7, 0.8, -1)
    add(new THREE.CylinderGeometry(0.05, 0.05, IN.h - 0.8, 12), m.chrome, -hw + 2.7, 0.8 + (IN.h - 0.8) / 2, -1)
    box(0.08, 1.0, 9, m.chrome, -hw + 5.35, 0, -1); solid(0.3, 1.0, 9, -hw + 5.35, 0, -1)
    this.stageSign = add(new THREE.PlaneGeometry(3.6, 0.7), new THREE.MeshBasicMaterial({ map: makeTextTexture(['SHOWTIME 11PM'], { w: 512, h: 100, bg: 'rgba(20,0,20,0.75)', fg: '#ff6ac1', border: null, font: 'bold 64px Anton, sans-serif' }), transparent: true }), -hw + 0.3, 3.4, -1, Math.PI / 2)
    // booths (south-west and south-east): U sofas at seat height 0.45, tables
    this.seats = []
    for (const [bx, bz] of [[-10, 7.6], [6.5, 8]]) {
      box(4, 0.45, 1.0, m.sofa, bx, 0, bz + 1.4); box(4, 1.1, 0.25, m.sofa, bx, 0, bz + 2.0)        // back row
      box(1.0, 0.45, 2.6, m.sofa, bx - 2.0, 0, bz); box(1.0, 0.45, 2.6, m.sofa, bx + 2.0, 0, bz)
      box(1.6, 0.72, 1.0, m.top, bx, 0, bz - 0.2); box(1.6, 0.04, 1.0, m.neonV, bx, 0.72, bz - 0.2)
      solid(4.4, 0.75, 3.6, bx, 0, bz + 0.6)
      this.seats.push({ x: bx - 0.8, z: bz + 1.25, h: Math.PI }, { x: bx + 0.8, z: bz + 1.25, h: Math.PI }, { x: bx - 1.85, z: bz - 0.3, h: Math.PI / 2 })
    }
    // social wall: a big screen by the entrance (south wall, east of the door)
    const wall = add(new THREE.PlaneGeometry(5, 2.4), new THREE.MeshBasicMaterial({ map: this.socialTexture() }), 5.6, 2.0, hd - 0.23, Math.PI)
    void wall
    // lighting: three coloured moving lights + a stage spot, only while inside
    this.lights = new THREE.Group()
    this.movers = [0xe94fa6, 0x3dd6f5, 0x7b5cd6].map((c, i) => { const l = new THREE.PointLight(c, 40, 18, 1.6); l.position.set(X - 5 + i * 5, 4.4, Z - 2); this.lights.add(l); return l })
    const stage = new THREE.SpotLight(0xffb0e0, 120, 14, 0.5, 0.6, 1.2); stage.position.set(X - hw + 6, IN.h - 0.3, Z - 1); stage.target.position.set(X - hw + 2.7, 0, Z - 1); this.lights.add(stage, stage.target)
    const fill = new THREE.HemisphereLight(0x8a7cc4, 0x1c1628, 1.1); this.lights.add(fill)
    const bar = new THREE.PointLight(0xffc98a, 18, 10, 1.5); bar.position.set(X + 12.5, 3.2, Z - 1); this.lights.add(bar)
    grp.add(this.lights)
    grp.visible = false
    g.scene.add(grp)
    this.room = grp
    this.spawn = new THREE.Vector3(X, 0, Z + hd - 1.6)
    this.exitAt = new THREE.Vector3(X, 0, Z + hd - 0.9)
    this.barAt = new THREE.Vector3(X + 9.9, 0, Z - 1)
    this.wallAt = new THREE.Vector3(X + 5.6, 0, Z + hd - 1.3)
    this.buildPeople()
  }

  socialTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 492
    const x = c.getContext('2d')
    const gr = x.createLinearGradient(0, 0, 1024, 492); gr.addColorStop(0, '#1a0f2e'); gr.addColorStop(1, '#0b1f2e'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 492)
    x.strokeStyle = '#3dd6f5'; x.lineWidth = 8; x.strokeRect(8, 8, 1008, 476)
    x.fillStyle = '#ff6ac1'; x.font = 'bold 64px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.fillText('FIND AKSHAT ONLINE', 512, 92)
    x.font = 'bold 40px "Barlow Condensed", sans-serif'
    VERIFIED_SOCIALS.forEach((s, i) => { x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(s.name, 90, 170 + i * 58); x.fillStyle = '#3dd6f5'; x.textAlign = 'right'; x.fillText(s.handle, 934, 170 + i * 58) })
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '28px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText('Press E at the wall to open the links', 512, 462)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }

  // ================================================================ people
  buildPeople() {
    const g = this.game, roster = g.assets.roster || [], X = IN.x, Z = IN.z
    const byId = (id) => roster.find(r => r.id === id)
    const mk = (id, x, z, heading, role, extra = {}) => {
      const r = byId(id); if (!r) return null
      const s = makeCharacter(r.gltf)
      const n = { ...s, id, role, pos: new THREE.Vector3(X + x, 0, Z + z), heading, speed: 0, state: 'idle', t: 2 + Math.random() * 8, path: [], ...extra }
      n.wrap.position.copy(n.pos); n.wrap.rotation.y = heading
      for (const o of n.meshes || []) o.castShadow = false
      n.wrap.traverse(o => { if (o.isMesh) o.castShadow = false })
      this.room.add(n.wrap); this.stats.npcsCreated++
      return n
    }
    this.people = []
    const push = (n) => { if (n) this.people.push(n); return n }
    // bartender and DJ
    this.bartender = push(mk('W_Formal', 12.9, -1, -Math.PI / 2, 'bartender'))
    playAction(this.bartender, 'Idle_Neutral', { loop: true, fade: 0.01 })
    this.dj = push(mk('M_Casual_2', 0, -IN.d / 2 + 1.8, 0, 'dj'))
    this.dj.pos.y = 0.6; this.dj.wrap.position.y = 0.6
    playAction(this.dj, 'Interact', { loop: true, fade: 0.01, timeScale: 0.8 })
    // dancers on the LED floor, facing the DJ with some variety
    const dancers = ['W_Casual', 'M_Beach', 'W_Punk', 'M_Worker', 'W_Adventurer', 'M_Suit', 'W_Suit', 'M_Casual_2']
    dancers.forEach((id, i) => {
      const x = -3.6 + (i % 4) * 2.4 + (Math.random() - 0.5) * 0.6, z = -4.2 + Math.floor(i / 4) * 3.2 + (Math.random() - 0.5) * 0.6
      const d = push(mk(id, x, z, Math.PI + (Math.random() - 0.5) * 1.2, 'dancer', { spot: new THREE.Vector3(X + x, 0, Z + z) }))
      if (d) { d.state = 'dance'; d.t = 12 + Math.random() * 18; playAction(d, 'Dance', { loop: true, fade: 0.01, timeScale: 0.85 + Math.random() * 0.35, at: Math.random() * 1.5 }) }
    })
    // talking groups near the bar and by the stage rail
    for (const [cx, cz, ids] of [[7.6, 4.2, ['M_Suit', 'W_Formal', 'M_Worker']], [-7.3, 2.6, ['W_Punk', 'M_Beach']]]) {
      ids.forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2, x = cx + Math.sin(a) * 0.85, z = cz + Math.cos(a) * 0.85
        const p = push(mk(id, x, z, Math.atan2(cx - x, cz - z), 'talker'))
        if (p) { p.state = 'talk'; playAction(p, i % 2 ? 'Talk' : 'Idle_Neutral', { loop: true, fade: 0.01, at: Math.random() }) }
      })
    }
    // seated booth patrons
    ;[['W_Casual', 0], ['M_Casual_2', 1], ['W_Adventurer', 3], ['M_Suit', 4]].forEach(([id, k]) => {
      const s = this.seats[k]; const p = push(mk(id, s.x, s.z, s.h, 'seated'))
      if (p) { p.state = 'sit'; playAction(p, 'Sit', { loop: true, fade: 0.01, at: Math.random() }) }
    })
    // stage watchers behind the rail
    ;[['M_Worker', -9.2, -3], ['W_Suit', -9.4, 0.6]].forEach(([id, x, z]) => { const p = push(mk(id, x, z, -Math.PI / 2, 'watcher')); if (p) { p.state = 'watch'; playAction(p, 'Idle_Neutral', { loop: true, fade: 0.01, at: Math.random() }) } })
  }

  // dancers: dance -> short break -> (sometimes) a trip to the bar -> back to their spot
  updatePerson(p, dt) {
    const X = IN.x, Z = IN.z
    p.t -= dt
    if (p.role === 'dancer') {
      if (p.state === 'dance' && p.t <= 0) {
        if (Math.random() < 0.45) { p.state = 'toBar'; stopAction(p, 0.3); p.goal = new THREE.Vector3(X + 9.6, 0, Z - 5 + Math.random() * 8) }
        else { p.state = 'break'; p.t = 3 + Math.random() * 4; playAction(p, 'Idle_Neutral', { loop: true, fade: 0.3 }) }
      } else if (p.state === 'break' && p.t <= 0) { p.state = 'dance'; p.t = 14 + Math.random() * 16; playAction(p, 'Dance', { loop: true, fade: 0.4, timeScale: 0.85 + Math.random() * 0.35, at: Math.random() }) }
      else if (p.state === 'atBar' && p.t <= 0) { p.state = 'back'; stopAction(p, 0.3); p.goal = p.spot.clone() }
      if (p.state === 'toBar' || p.state === 'back') {
        const d = Math.hypot(p.goal.x - p.pos.x, p.goal.z - p.pos.z)
        if (d < 0.4) {
          if (p.state === 'toBar') { p.state = 'atBar'; p.t = 5 + Math.random() * 5; p.heading = Math.PI / 2; playAction(p, 'Idle_Neutral', { loop: true, fade: 0.3 }) }
          else { p.state = 'dance'; p.t = 14 + Math.random() * 16; p.heading = Math.PI; playAction(p, 'Dance', { loop: true, fade: 0.4, timeScale: 0.85 + Math.random() * 0.35 }) }
          p.speed = 0
        } else { p.heading += Math.atan2(Math.sin(Math.atan2(p.goal.x - p.pos.x, p.goal.z - p.pos.z) - p.heading), Math.cos(Math.atan2(p.goal.x - p.pos.x, p.goal.z - p.pos.z) - p.heading)) * Math.min(1, dt * 6); p.speed = 1.2 }
      }
    }
    // keep a little personal space from each other and from the player (only movers are pushed)
    if (p.speed > 0) {
      for (const o of this.people) { if (o === p) continue; const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d > 0.01 && d < 0.7) { p.pos.x += dx / d * (0.7 - d) * 0.5; p.pos.z += dz / d * (0.7 - d) * 0.5 } }
      p.pos.x += Math.sin(p.heading) * p.speed * dt; p.pos.z += Math.cos(p.heading) * p.speed * dt
    }
    p.wrap.position.set(p.pos.x, p.pos.y, p.pos.z); p.wrap.rotation.y = p.heading
    p.mixer.update(dt); updateLayer(p, dt); blendCivilian(p.actions, p.speed, dt)
  }

  // ================================================================ enter / exit
  enter() {
    const g = this.game, pl = g.player
    if (this.inside || pl.inVehicle) return
    if (!this.room) this.buildRoom()
    this.saved = { pos: pl.pos.clone(), heading: pl.heading, hidden: [] }
    g.fade(() => {
      // hide the city while inside (nothing out there is visible through the walls anyway)
      for (const o of g.scene.children) if (o !== this.room && o !== pl.mesh && o.visible && !o.isLight) { o.visible = false; this.saved.hidden.push(o) }
      this.room.visible = true
      this.saved.light = { sun: g.sunLight.visible, hemi: g.hemi.visible, env: g.scene.environmentIntensity, fog: g.scene.fog.density, exp: g.renderer.toneMappingExposure }
      g.sunLight.visible = false; g.hemi.visible = false; g.scene.environmentIntensity = 0.15; g.scene.fog.density = 0; g.renderer.toneMappingExposure = 1.05
      g.interior = { name: CLUB_NAME, noCombat: true, club: this }
      pl.teleport(this.spawn.x, this.spawn.z, Math.PI)
      g.rig.snapTo(g.target())
      g.audio.club?.(true)
      this.inside = true; this.stats.visits++
      g.ui.district({ name: CLUB_NAME })
      g.activities?.event('clubEnter')
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
      pl.teleport(this.door.x - 0.8, this.door.z, -Math.PI / 2)
      g.applyNight(g.nightLerp, true)   // in case day / night changed while inside
      g.rig.snapTo(g.target())
      g.audio.club?.(false)
      this.inside = false
      g.ui.district(M.districtAt(pl.pos.x, pl.pos.z))
    })
  }

  // ================================================================ interactions (consumed by the game's interaction list)
  interactables() {
    const out = []
    if (!this.inside) out.push({ id: 'club-door', pos: this.door, radius: 2.4, priority: 2, prompt: `Press E to enter ${CLUB_NAME}`, action: () => this.enter() })
    else {
      out.push({ id: 'club-exit', pos: this.exitAt, radius: 1.6, priority: 2, prompt: 'Press E to leave the club', action: () => this.exit() })
      out.push({ id: 'club-bar', pos: this.barAt, radius: 1.8, priority: 3, prompt: 'Press E to talk to the bartender', action: () => this.openBar() })
      out.push({ id: 'club-socials', pos: this.wallAt, radius: 1.8, priority: 3, prompt: 'Press E to open the social wall', action: () => this.openSocials() })
    }
    return out
  }

  openBar() {
    const g = this.game
    playAction(this.bartender, 'Wave', { fade: 0.15 })
    const body = `<p class="venue-lead">“Evening! What can I get you?”</p><div class="venue-list">${DRINKS.map(d => `<button class="venue-item" data-drink="${d.id}"><span><strong>${d.name}</strong><em>${d.desc}</em></span><b>${d.price ? '$' + d.price : 'FREE'}</b></button>`).join('')}</div><p class="venue-note">Drinks are fictional. Cash: <strong id="venue-cash">$${g.save.data.money ?? 0}</strong></p>`
    g.ui.venue('Bartender · ' + CLUB_NAME, body, (root) => {
      root.querySelectorAll('[data-drink]').forEach(b => b.addEventListener('click', () => this.buy(DRINKS.find(d => d.id === b.dataset.drink), root)))
    })
  }

  buy(d, root) {
    const g = this.game, money = g.save.data.money ?? 0
    const msg = root.querySelector('.venue-lead')
    if (money < d.price) { msg.textContent = `“That's $${d.price}, and you've got $${money}. Water's free, though.”`; g.audio.blip?.(200, 0.12, 'square', 0.12); return }
    g.save.data.money = money - d.price; g.save.write(); g.ui.cash()
    root.querySelector('#venue-cash').textContent = '$' + g.save.data.money
    msg.textContent = `The bartender slides over a ${d.name}. ${d.price ? `−$${d.price}.` : 'On the house.'}`
    playAction(this.bartender, 'Interact', { fade: 0.15 })
    g.audio.pickup?.()
    this.stats.drinks++
    // a short, gentle colour drift; never touches the controls
    const c = document.getElementById('game'); c.classList.remove('tipsy'); void c.offsetWidth; c.classList.add('tipsy')
    g.activities?.event('drink', d)
  }

  openSocials() {
    const g = this.game
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const body = `<p class="venue-lead">Find Akshat online.</p><div class="venue-list">${VERIFIED_SOCIALS.map(s => `<a class="venue-item" href="${esc(s.url)}" target="_blank" rel="noopener"><span><strong>${esc(s.name)}</strong><em>${esc(s.handle)}</em></span><b>Open ↗</b></a>`).join('')}</div>`
    g.ui.venue('Social wall · ' + CLUB_NAME, body)
    g.activities?.event('socials')
  }

  // ================================================================ frame
  update(dt) {
    // build + compile the interior in the background when the player approaches (no stall on entering)
    if (!this.room && !this.warming && this.game.target().pos.distanceTo(this.door) < 30) {
      this.warming = true; this.buildRoom()
      prewarmInterior(this.game, this.room, [this.game.player.mesh, ...this.people.map(p => p.wrap)]).then(() => { this.warm = true })
    }
    if (!this.inside || !this.room) return
    this.floorU.t.value += dt
    const t = this.floorU.t.value
    this.movers.forEach((l, i) => { l.position.x = IN.x - 5 + i * 5 + Math.sin(t * 0.7 + i * 2) * 3; l.position.z = IN.z - 2 + Math.cos(t * 0.5 + i) * 3; l.intensity = 30 + 20 * (0.5 + 0.5 * Math.sin(t * 6.5 + i)) })
    for (const p of this.people) this.updatePerson(p, dt)
  }

  describe() { return { inside: this.inside, built: !!this.room, people: this.people?.length || 0, roles: this.people ? Object.fromEntries(['bartender', 'dj', 'dancer', 'talker', 'seated', 'watcher'].map(r => [r, this.people.filter(p => p.role === r).length])) : null, dancerStates: this.people?.filter(p => p.role === 'dancer').map(p => p.state), performer: 'pending: no pole / stage-performance clip in the downloaded packs', stats: this.stats } }
}
