import * as THREE from 'three'
import { roadGraph } from './CityMap.js'
import { buildPlayerCar } from './CarModel.js'
import { buildKenneyCar } from './KenneyCars.js'
import { makeCharacter, blendCivilian, updateLayer, stopAction, FootLock, ankleMins } from './Characters.js'
import { makeTextTexture } from './textures.js'

// Police pursuit. One unit per wanted star (max 3): the Kenney Car Kit police car with a flashing light bar, driven as a kinematic body like traffic so it can never be pushed
// through walls. Each unit is a small state machine:
//   chase  – drive to the player (seen) or to the last-seen point; on roads, or straight at the player when
//            the path is clear and close
//   search – circle the area around the last-seen point
//   leave  – wanted level cleared: drive away and despawn out of view
// When the player is on foot nearby, the car stops and an officer (Quaternius "Swat") runs after the player.
// Busted: officer within reach for 1 s, or the player's car held still next to a police car for 3 s.
const SEE_RANGE = 70, SPAWN_MIN = 75, SPAWN_MAX = 170
const UP = new THREE.Vector3(0, 1, 0)
// the Kenney police model's light-bar lenses (measured, metres in car space): red on +x, blue on -x.
// Emissive boxes slightly larger than each lens sit over them and flash.
const POLICE_BAR = { x: 0.32, y: 1.565, z: 0.165, size: [0.28, 0.15, 0.36] }

export class Police {
  constructor(game) {
    this.game = game
    this.nodes = roadGraph()
    this.units = []
    this.spawnCd = 0; this.carBust = 0; this.footBust = 0; this.flash = 0
    this.stats = { spawned: 0, despawned: 0, officers: 0 }
    this.swat = game.assets.roster?.find(r => r.id === 'M_Swat')
    // shared materials for every unit
    this.mRed = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 2 })
    this.mBlue = new THREE.MeshStandardMaterial({ color: 0x000a40, emissive: 0x1a4dff, emissiveIntensity: 2 })
    this.mBar = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.4 })
    this.mDoor = new THREE.MeshBasicMaterial({ map: makeTextTexture(['POLICE'], { w: 512, h: 128, bg: 'rgba(0,0,0,0)', fg: '#10233f', border: null, font: 'bold 92px Anton, Impact, sans-serif' }), transparent: true, depthWrite: false })
    this.gBar = new THREE.BoxGeometry(0.9, 0.12, 0.3); this.gLight = new THREE.BoxGeometry(0.36, 0.14, 0.26); this.gDoor = new THREE.PlaneGeometry(1.6, 0.4)
  }

  // ---------------------------------------------------------------- perception
  los(a, b) { return this.game.wanted.los(a, b) }
  eyes() {
    const out = []
    for (const u of this.units) { if (u.state !== 'leave') out.push(u.pos.clone().setY(1.4)); if (u.officer && !u.officer.down) out.push(u.officer.pos.clone().setY(1.6)) }
    return out
  }
  sees(at, range = 45) { if (this.game.interior) return false; return this.eyes().some(e => e.distanceTo(at) < range && this.los(e, at)) }
  seesPlayer() { return this.sees(this.game.target().pos.clone().setY(1.2), SEE_RANGE) }

  // ---------------------------------------------------------------- spawning
  spawn() {
    const g = this.game, p = g.target().pos, near = g.wanted.lastSeen || p
    const cam = g.camera, fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    const cands = this.nodes.map((n, i) => ({ i, d: Math.hypot(n.x - p.x, n.z - p.z), dn: Math.hypot(n.x - near.x, n.z - near.z) }))
      .filter(c => c.d > SPAWN_MIN && c.d < SPAWN_MAX && !fr.containsPoint(new THREE.Vector3(this.nodes[c.i].x, 1, this.nodes[c.i].z)))
      .filter(c => !this.units.some(u => Math.hypot(u.pos.x - this.nodes[c.i].x, u.pos.z - this.nodes[c.i].z) < 25))
      .sort((a, b) => a.dn - b.dn)
    if (!cands.length) return
    const n = this.nodes[cands[0].i]
    const toIdx = [...n.nb].sort((a, b) => Math.hypot(this.nodes[a].x - near.x, this.nodes[a].z - near.z) - Math.hypot(this.nodes[b].x - near.x, this.nodes[b].z - near.z))[0], to = this.nodes[toIdx]
    this.units.push(this.makeUnit(n.x, n.z, Math.atan2(to.x - n.x, to.z - n.z), cands[0].i, toIdx))
    this.stats.spawned++
  }

  makeUnit(x, z, heading, from, to) {
    const g = this.game, R = g.physics.R
    const lib = g.assets.carLib
    let car, mesh
    if (lib?.police) {
      // Kenney police car: its livery and light bar are in the model; emissive lenses on the bar make it flash
      car = buildKenneyCar(lib, 'police'); mesh = car.mesh; g.scene.add(mesh)
      const b = POLICE_BAR
      this.gLens ??= new THREE.BoxGeometry(...b.size)
      const red = new THREE.Mesh(this.gLens, this.mRed); red.position.set(b.x, b.y, b.z); mesh.add(red)
      const blue = new THREE.Mesh(this.gLens, this.mBlue); blue.position.set(-b.x, b.y, b.z); mesh.add(blue)
    } else {
      // fallback: the Ferrari repainted white with a light bar and door decals
      car = buildPlayerCar(g.assets.car.scene, 0xf4f6f8); mesh = car.mesh; g.scene.add(mesh)
      const bar = new THREE.Mesh(this.gBar, this.mBar); bar.position.set(0, 1.27, -0.35); mesh.add(bar)
      const red = new THREE.Mesh(this.gLight, this.mRed); red.position.set(-0.24, 1.34, -0.35); mesh.add(red)
      const blue = new THREE.Mesh(this.gLight, this.mBlue); blue.position.set(0.24, 1.34, -0.35); mesh.add(blue)
      for (const s of [-1, 1]) { const d = new THREE.Mesh(this.gDoor, this.mDoor); d.position.set(s * 0.99, 0.62, -0.1); d.rotation.y = s * Math.PI / 2; mesh.add(d) }
    }
    const hx = car.half ? car.half.x : 0.95, hz = car.half ? car.half.z : 2.2, hy = car.half ? car.half.y / 2 : 0.5
    const body = g.physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0, z))
    g.physics.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(0, hy + 0.1, 0), body)
    const u = { mesh, mats: car.mats, body, pos: new THREE.Vector3(x, 0, z), heading, speed: 0, from, to, state: 'chase', officer: null, searchT: 0 }
    this.place(u)
    return u
  }

  remove(u) {
    const g = this.game
    if (u.officer) this.removeOfficer(u)
    g.physics.world.removeRigidBody(u.body)
    g.scene.remove(u.mesh); for (const m of Object.values(u.mats)) m.dispose()
    this.units = this.units.filter(x => x !== u); this.stats.despawned++
  }

  standDown() { for (const u of this.units) { u.state = 'leave'; if (u.officer) u.officer.state = 'return' } this.carBust = this.footBust = 0 }

  // ---------------------------------------------------------------- driving
  place(u) {
    // follow the ground under the car (roads 0, sidewalk / lawn slabs 0.18) instead of a fixed height
    const gy = this.groundY(u.pos); u.pos.y += (gy - u.pos.y) * 0.5
    u.mesh.position.copy(u.pos); u.mesh.rotation.set(0, u.heading, 0)
    u.body.setNextKinematicTranslation({ x: u.pos.x, y: u.pos.y, z: u.pos.z })
    u.body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(UP, u.heading))
  }

  // move toward a carrot point: turn at a limited rate, slow down for sharp turns, yield to traffic ahead
  // stopAt / stopPoint: brake so the car halts stopAt metres from stopPoint (default: the carrot), using a real
  // braking curve (speed cap = sqrt(2·a·remaining)) instead of a fixed slow-down zone
  drive(u, carrot, maxSpeed, dt, stopAt = 0, stopPoint = null) {
    const dx = carrot.x - u.pos.x, dz = carrot.z - u.pos.z, dist = Math.hypot(dx, dz)
    let diff = Math.atan2(dx, dz) - u.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    const turn = 2.2 * dt; u.heading += THREE.MathUtils.clamp(diff, -turn, turn)
    let target = maxSpeed * (1 - Math.min(0.75, Math.abs(diff) / Math.PI * 1.6))
    if (stopAt) { const sp = stopPoint ? Math.hypot(stopPoint.x - u.pos.x, stopPoint.z - u.pos.z) : dist; target = Math.min(target, Math.sqrt(2 * 9 * Math.max(0, sp - stopAt))) }
    const fx = Math.sin(u.heading), fz = Math.cos(u.heading)
    for (const c of this.game.traffic.cars) { const ax = (c.pos.x - u.pos.x) * fx + (c.pos.z - u.pos.z) * fz, sd = Math.abs((c.pos.x - u.pos.x) * fz - (c.pos.z - u.pos.z) * fx); if (ax > 0 && ax < 8 && sd < 2.4) { target = Math.min(target, 2); break } }
    u.speed += THREE.MathUtils.clamp(target - u.speed, -18 * dt, 8 * dt)
    u.pos.x += fx * u.speed * dt; u.pos.z += fz * u.speed * dt
    return dist
  }

  // next road node toward the goal (no U-turns unless it is the only way)
  pickNext(u, goal) {
    const n = this.nodes[u.to], prev = u.from
    const opts = n.nb.filter(j => j !== prev)
    const list = opts.length ? opts : n.nb
    let best = list[0], bd = Infinity
    for (const j of list) { const m = this.nodes[j], d = Math.hypot(m.x - goal.x, m.z - goal.z); if (d < bd) { bd = d; best = j } }
    u.from = u.to; u.to = best
  }

  nearestNode(p, needLos = true) {
    let best = 0, bd = Infinity
    for (let i = 0; i < this.nodes.length; i++) { const n = this.nodes[i], d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd && (!needLos || d < 12 || this.los(new THREE.Vector3(p.x, 0.8, p.z), new THREE.Vector3(n.x, 0.8, n.z)))) { bd = d; best = i } }
    return best
  }

  updateUnit(u, dt) {
    const g = this.game, pl = g.target(), w = g.wanted
    let goal, maxSpeed = 15 + w.level * 2.5, stopAt = 0
    if (u.state === 'leave') {
      goal = new THREE.Vector3(u.pos.x * 3, 0, u.pos.z * 3)   // away from the city centre / player
      maxSpeed = 12
    } else {
      const seen = this.los(u.pos.clone().setY(1.4), pl.pos.clone().setY(1.2)) && u.pos.distanceTo(pl.pos) < SEE_RANGE
      goal = seen ? pl.pos : (w.lastSeen || pl.pos)
      u.state = seen ? 'chase' : 'search'
      if (!pl.isCar) stopAt = 7          // on foot: park nearby and send the officer
      else { stopAt = 4.8; if (u.pos.distanceTo(pl.pos) < 14) maxSpeed = Math.max(6, Math.abs(pl.speed) + 3) }   // box the car in, never drive onto it
      if (u.state === 'search' && u.pos.distanceTo(goal) < 14) {
        // circle the search area: wander to neighbouring intersections around the last-seen point
        u.searchT -= dt
        if (u.searchT <= 0) { u.searchT = 6; const n = this.nodes[this.nearestNode(goal, false)], nb = n.nb[Math.floor(Math.random() * n.nb.length)]; u.wander = this.nodes[nb] }
        if (u.wander) goal = new THREE.Vector3(u.wander.x, 0, u.wander.z)
      }
    }
    // straight at the goal when it is close and the path is clear, otherwise along the roads
    const direct = u.state !== 'leave' && u.pos.distanceTo(goal) < 32 && this.los(u.pos.clone().setY(0.8), goal.clone().setY(0.8))
    if (direct) { u.mode = 'direct'; this.drive(u, goal, maxSpeed, dt, stopAt) }
    else {
      if (u.mode === 'direct') { u.to = this.nearestNode(u.pos); u.from = u.to; u.mode = 'road' }
      const n = this.nodes[u.to]
      // never drive right up to the player on the road either
      const d = this.drive(u, new THREE.Vector3(n.x, 0, n.z), maxSpeed, dt, stopAt, stopAt ? pl.pos : null)
      if (d < 7) this.pickNext(u, goal)
    }
    // keep units a car length apart (kinematic bodies do not push each other)
    for (const o of this.units) { if (o === u) continue; const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d > 0.01 && d < 5) { u.pos.x += dx / d * (5 - d) * 0.5; u.pos.z += dz / d * (5 - d) * 0.5 } }
    this.place(u)
    // officer on foot
    if (!pl.isCar && u.state !== 'leave' && !u.officer && u.speed < 1 && u.pos.distanceTo(pl.pos) < 16 && u.pos.distanceTo(pl.pos) > 4 && this.swat) this.spawnOfficer(u)
    if (u.officer) this.updateOfficer(u, dt)
  }

  // ---------------------------------------------------------------- officer
  spawnOfficer(u) {
    const s = makeCharacter(this.swat.gltf)
    s.footLock = new FootLock(s.wrap, s.model, ankleMins(this.swat.gltf))
    // get out on the side of the car away from the player
    const pl = this.game.target().pos, side = new THREE.Vector3(Math.cos(u.heading), 0, -Math.sin(u.heading))
    if (side.x * (pl.x - u.pos.x) + side.z * (pl.z - u.pos.z) > 0) side.negate()
    const pos = u.pos.clone().addScaledVector(side, 1.7)
    this.game.scene.add(s.wrap)
    u.officer = { ...s, pos, heading: u.heading, speed: 0, state: 'chase', down: 0, hp: 3, waitT: 0, kind: 'officer', unit: u, grace: 0.8 }
    this.stats.officers++
  }
  removeOfficer(u) { this.game.scene.remove(u.officer.wrap); u.officer = null }

  updateOfficer(u, dt) {
    const o = u.officer, g = this.game, pl = g.target()
    o.grace = Math.max(0, o.grace - dt)
    let target = 0, goal = null
    if (o.down > 0) { o.down -= dt; if (o.down <= 0) { o.state = 'return'; stopAction(o, 0.5) } }
    else if (o.state === 'chase') {
      if (pl.isCar) o.state = 'return'
      else if (this.los(o.pos.clone().setY(1.5), pl.pos.clone().setY(1.2))) { goal = pl.pos; target = o.pos.distanceTo(pl.pos) > 1.1 ? 5.2 : 0; o.waitT = 0 }
      else { o.waitT += dt; if (o.waitT > 3) o.state = 'return' }
    }
    if (o.state === 'return') { goal = u.pos; target = 3.5; if (o.pos.distanceTo(u.pos) < 1.8) { this.removeOfficer(u); return } }
    if (goal) {
      const h = Math.atan2(goal.x - o.pos.x, goal.z - o.pos.z)
      o.heading += Math.atan2(Math.sin(h - o.heading), Math.cos(h - o.heading)) * Math.min(1, dt * 8)
    }
    o.speed += (target - o.speed) * Math.min(1, dt * 5)
    o.pos.x += Math.sin(o.heading) * o.speed * dt; o.pos.z += Math.cos(o.heading) * o.speed * dt
    o.pos.y = this.groundY(o.pos)
    o.wrap.position.copy(o.pos); o.wrap.rotation.y = o.heading
    o.mixer.update(dt); updateLayer(o, dt)
    o.footLock.update(dt, { Walk: o.actions.Walk.getEffectiveWeight(), Run: o.actions.Run.getEffectiveWeight() }, o.speed > 0.3 && !o.layer)
    blendCivilian(o.actions, o.speed, dt)
  }

  groundY(p) {
    const R = this.game.physics.R
    const hit = this.game.physics.world.castRay(new R.Ray({ x: p.x, y: 1.2, z: p.z }, { x: 0, y: -1, z: 0 }), 3, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS)
    return hit ? 1.2 - (hit.timeOfImpact ?? hit.toi) : 0
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.game, w = g.wanted, pl = g.target()
    this.spawnCd -= dt
    const active = this.units.filter(u => u.state !== 'leave').length
    if (w.level > 0 && !g.interior && active < Math.min(3, w.level) && this.spawnCd <= 0) { this.spawn(); this.spawnCd = 4 }
    for (const u of [...this.units]) {
      this.updateUnit(u, dt)
      const d = u.pos.distanceTo(pl.pos)
      if ((u.state === 'leave' && d > 90) || d > 260) this.remove(u)
    }
    // light bars: alternate red / blue
    this.flash += dt * 6; const on = Math.floor(this.flash) % 2 === 0
    this.mRed.emissiveIntensity = on ? 3 : 0.2; this.mBlue.emissiveIntensity = on ? 0.2 : 3
    // busted?
    if (w.level > 0 && !g.interior) {
      const officerNear = this.units.some(u => u.officer && !u.officer.down && !u.officer.grace && u.officer.state === 'chase' && u.officer.pos.distanceTo(pl.pos) < 1.4)
      this.footBust = !pl.isCar && officerNear ? this.footBust + dt : 0
      const carNear = this.units.some(u => u.state !== 'leave' && u.pos.distanceTo(pl.pos) < 6.5)
      this.carBust = pl.isCar && Math.abs(pl.speed) < 1.5 && carNear ? this.carBust + dt : Math.max(0, this.carBust - dt)
      if (this.footBust > 1.0 || this.carBust > 3) g.busted()
    } else this.footBust = this.carBust = 0
    // siren: louder the closer the nearest chasing unit
    let nearest = Infinity; for (const u of this.units) if (u.state !== 'leave') nearest = Math.min(nearest, u.pos.distanceTo(pl.pos))
    g.audio.siren?.(nearest < 120 && !g.interior ? 1 - nearest / 120 : 0)
  }

  // pass-through for combat: officers are valid targets
  targets() { return this.units.filter(u => u.officer && !u.officer.down).map(u => u.officer) }

  describe() { return { units: this.units.map(u => ({ state: u.state, mode: u.mode, speed: +u.speed.toFixed(1), dist: +u.pos.distanceTo(this.game.target().pos).toFixed(0), officer: u.officer ? u.officer.state : null })), stats: this.stats, footBust: +this.footBust.toFixed(1), carBust: +this.carBust.toFixed(1) } }
}
