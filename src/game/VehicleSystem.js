import * as THREE from 'three'
import { Vehicle } from './Vehicle.js'
import { playAction, stopAction } from './Characters.js'

// Every drivable car: the player's own Ferrari plus cars stolen from the parked rows. Owns entering, exiting
// (with a free-space check), theft (hold E next to a parked car) and recycling of abandoned stolen cars.
const ENTER_RANGE = 3.6
const STEAL_TIME = 0.9     // seconds of holding E
const MAX_STOLEN = 4

export class VehicleSystem {
  constructor(game) {
    this.game = game
    this.list = [game.vehicle]
    Object.assign(game.vehicle, { owned: true, label: 'Your Ferrari', stolen: false })
    this.hold = 0; this.holdTarget = null
    this.stats = { stolen: 0, recycled: 0, enters: 0, exits: 0 }
  }

  get current() { return this.game.player.inVehicle }

  // ---------------------------------------------------------------- what can the player do right now?
  // deterministic priority: the nearest free drivable car, then the nearest parked car (theft)
  candidate() {
    const p = this.game.player.pos
    let best = null
    for (const v of this.list) {
      if (v.occupied || v.disposed || v.police) continue
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z)
      if (d < ENTER_RANGE + 0.9 && (!best || d < best.d)) best = { kind: 'enter', v, d }
    }
    if (best) return best
    for (const pk of this.game.city.parked) {
      if (pk.taken) continue
      const d = Math.hypot(pk.x - p.x, pk.z - p.z)
      if (d < ENTER_RANGE && (!best || d < best.d)) best = { kind: 'steal', pk, d }
    }
    return best
  }

  prompt() {
    if (this.current) return null
    const c = this.candidate(); if (!c) return null
    if (c.kind === 'enter') return c.v.owned ? 'Press E to drive your Ferrari' : 'Press E to get in'
    return this.hold > 0 ? `Stealing… ${Math.round(this.hold / STEAL_TIME * 100)}%` : 'Hold E to steal this car'
  }

  // tap E (not near a mission marker)
  tap() {
    if (this.current) return this.exit()
    const c = this.candidate()
    if (c?.kind === 'enter') return this.enter(c.v)
    if (c?.kind === 'steal') this.game.ui.hint('Hold E to steal it.')
  }

  // holding E next to a parked car fills the theft meter; letting go cancels it
  updateHold(dt, input) {
    const g = this.game, pl = g.player
    const c = !this.current && !g.ui.blocking ? this.candidate() : null
    const holding = c?.kind === 'steal' && input.key('e', 'enter')
    if (!holding) { if (this.hold > 0 && pl.ch) stopAction(pl.ch); this.hold = 0; this.holdTarget = null; return }
    if (this.holdTarget !== c.pk) { this.hold = 0; this.holdTarget = c.pk; if (pl.ch) playAction(pl.ch, 'Interact', { loop: true, fade: 0.15 }) }
    pl.heading = Math.atan2(c.pk.x - pl.pos.x, c.pk.z - pl.pos.z)
    this.hold += dt
    if (this.hold >= STEAL_TIME) { this.hold = 0; this.holdTarget = null; if (pl.ch) stopAction(pl.ch, 0.1); this.steal(c.pk) }
  }

  steal(pk) {
    const g = this.game
    pk.taken = true
    g.bgCars.hide(pk.inst)
    const col = g.physics.boxColliders?.[pk.box]; if (col) g.physics.world.removeCollider(col, true)
    // you drive away in the same model and colour that was parked (Kenney sedan / SUV / van; at most MAX_STOLEN exist)
    const v = new Vehicle(g.scene, g.physics, g.assets, { x: pk.x, z: pk.z, heading: pk.rot, color: pk.color, type: pk.type, headlights: false })
    Object.assign(v, { owned: false, stolen: true, label: pk.type ? `Stolen ${pk.type}` : 'Stolen car', alarm: 3, from: pk })
    v.setNight(g.night)
    this.list.push(v); this.stats.stolen++
    g.audio.alarm?.()
    g.onCrime?.('theft', v.pos.clone())
    this.enter(v)
    this.recycle()
  }

  enter(v) {
    const g = this.game, p = g.player
    if (v.occupied || p.inVehicle) return
    p.inVehicle = v; v.occupied = true; p.seatIn(v.mesh)
    g.vehicle = v
    g.rig.yaw = 0; g.audio.ui(); this.stats.enters++
  }

  // place the player beside the car where a standing capsule fits: driver side, passenger side, behind, front
  exit() {
    const g = this.game, p = g.player, v = p.inVehicle
    if (!v) return
    if (Math.abs(v.speed) > 5) { g.ui.hint('Slow down before getting out.'); return }
    const spot = this.freeSpot(v)
    if (!spot) { g.ui.hint('No room to get out here.'); return }
    p.inVehicle = null; v.occupied = false
    p.unseat(); p.setActive(true); p.teleport(spot.x, spot.z, v.heading)
    g.rig.yaw = 0; g.audio.ui(); this.stats.exits++
  }

  freeSpot(v) {
    const R = this.game.physics.R, world = this.game.physics.world
    const h = v.heading, fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h)
    const shape = new R.Capsule(0.55, 0.35), rot = { x: 0, y: 0, z: 0, w: 1 }
    for (const [a, b] of [[2.3, 0], [-2.3, 0], [0, -3.6], [0, 3.6], [2.3, -2], [-2.3, -2]]) {
      const x = v.pos.x + lx * a + fx * b, z = v.pos.z + lz * a + fz * b
      const hit = world.intersectionWithShape({ x, y: 1.3, z }, rot, shape, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, v.body)
      if (!hit) return { x, z }
    }
    return null
  }

  // keep at most MAX_STOLEN stolen cars: remove the oldest one nobody is in, far away and out of view
  recycle() {
    const stolen = this.list.filter(v => v.stolen && !v.disposed)
    if (stolen.length <= MAX_STOLEN) return
    const cam = this.game.camera, frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    for (const v of stolen) {
      if (v.occupied || v === this.game.vehicle) continue
      if (v.pos.distanceTo(this.game.player.pos) < 60 || frustum.containsPoint(v.pos)) continue
      v.dispose(); this.list = this.list.filter(x => x !== v); this.stats.recycled++
      if (this.list.filter(x => x.stolen).length <= MAX_STOLEN) return
    }
  }

  update(dt, input) {
    for (const v of this.list) {
      v.update(dt, input)
      if (v.alarm > 0) { v.alarm -= dt; const on = Math.floor(v.alarm * 6) % 2 === 0; for (const gl of v.glows) gl.material.opacity = on ? 0.9 : 0; v.tailMat.opacity = on ? 1 : 0.2; if (v.alarm <= 0) v.setNight(this.game.night) }
    }
  }
  sync() { for (const v of this.list) v.sync() }
  setNight(n) { for (const v of this.list) v.setNight(n) }

  // dev diagnostics
  describe() {
    return this.list.map(v => ({ label: v.label, police: !!v.police, occupied: v.occupied, driver: v.occupied ? (v.police ? 'police' : 'player') : null, speed: +v.speed.toFixed(1), pos: [+v.pos.x.toFixed(1), +v.pos.z.toFixed(1)] }))
  }
}
