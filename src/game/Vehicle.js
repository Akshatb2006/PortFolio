import * as THREE from 'three'
import { buildPlayerCar } from './CarModel.js'
import { buildKenneyCar } from './KenneyCars.js'

// Drivable car: Rapier raycast-vehicle on a dynamic chassis + either the Ferrari (your own car) or a Kenney
// Car Kit model (`type`, e.g. a stolen parked sedan / SUV / van).
export class Vehicle {
  constructor(scene, physics, assets, { x, z, heading = 0, color = 0xd0201a, type = null, headlights = !type } = {}) {
    this.physics = physics; this.scene = scene
    const R = physics.R, world = physics.world
    const car = type ? buildKenneyCar(assets.carLib, type, color) : buildPlayerCar(assets.car.scene, color)
    this.type = type
    this.mesh = car.mesh; scene.add(this.mesh)
    this.wheels = car.wheels; this.wheelOrig = this.wheels.map(w => w.position.clone()); this.wheelScale = car.wheelScale ?? car.mesh.children[0].scale.x
    // body size: Kenney models report theirs; the Ferrari keeps its tuned 1.9 × 4.3 m chassis box
    const hw = car.half ? car.half.x - 0.05 : 0.95, hl = car.half ? car.half.z - 0.08 : 2.15
    const lightY = car.half ? car.half.y * 0.36 : 0.62, nose = car.half ? car.half.z + 0.02 : 2.26
    this.half = { x: hw + 0.05, z: hl + 0.08 }   // body footprint (half extents) for pedestrian contact
    this.mats = car.mats
    this.radius = 2.4
    this.occupied = false
    this.speed = 0; this.steer = 0; this.drifting = false; this.lastHit = 0; this.flipTimer = 0
    this.pos = new THREE.Vector3(x, 0, z)
    this.heading = heading
    this.vel = new THREE.Vector2()
    this.prevVel = new THREE.Vector3()

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading)
    this.body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, 0.6, z).setRotation(q).setLinearDamping(0.2).setAngularDamping(1.2).setCanSleep(false))
    // taller Kenney bodies get a taller box, kept low (0.4–1.3 m) so the centre of mass stays near the Ferrari's
    this.collider = world.createCollider((car.half ? R.ColliderDesc.cuboid(hw, 0.45, hl).setTranslation(0, 0.85, 0) : R.ColliderDesc.cuboid(hw, 0.3, hl).setTranslation(0, 0.58, 0)).setMass(1200).setFriction(0.5).setRestitution(0.05), this.body)
    this.ctrl = world.createVehicleController(this.body)
    const rest = 0.28, stiffness = 150, g = 9.81 * 1.6
    this.rest = rest
    // connection height chosen so the car sits at mesh y = 0 under its own weight
    this.sag = 0.045
    car.wheelPos.forEach((p, i) => {
      this.ctrl.addWheel({ x: p.x, y: car.wheelRadius + rest - this.sag, z: p.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, car.wheelRadius)
      this.ctrl.setWheelSuspensionStiffness(i, stiffness)
      this.ctrl.setWheelSuspensionCompression(i, 8)
      this.ctrl.setWheelSuspensionRelaxation(i, 12)
      this.ctrl.setWheelMaxSuspensionTravel(i, 0.2)
      this.ctrl.setWheelMaxSuspensionForce(i, 60000)
      this.ctrl.setWheelFrictionSlip(i, 9)
      this.ctrl.setWheelSideFrictionStiffness(i, 1.0)
    })
    this.headlights = []
    if (headlights) for (const s of [-1, 1]) {   // real spot lights only on the player's own car (each light costs every material)
      const sp = new THREE.SpotLight(0xfff1c8, 0, 70, 0.5, 0.55, 1.4)
      sp.position.set(s * 0.7, 0.7, 2.0); sp.target.position.set(s * 0.9, 0.1, 25)
      this.mesh.add(sp, sp.target); this.headlights.push(sp)
    }
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0 })
    this.glows = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), glowMat); m.position.set(s * hw * 0.7, lightY, nose); this.mesh.add(m); return m })
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0 })
    this.tails = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), this.tailMat); m.position.set(s * hw * 0.72, lightY + 0.1, -nose); m.rotation.y = Math.PI; this.mesh.add(m); return m })
    this.sync()
  }

  forward() { return new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading)) }

  update(dt, input) {
    const R = this.physics.R
    const throttle = this.occupied ? input.axis.y : 0
    // positive wheel steering turns toward +x, which is the car's left; right arrow (+1) must turn right
    const steerIn = this.occupied ? -input.axis.x : 0
    const hb = this.occupied && input.handbrake
    // signed speed along the chassis forward axis (rapier's currentVehicleSpeed sign is not reliable here)
    const lv0 = this.body.linvel(), rq = this.body.rotation()
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(rq.x, rq.y, rq.z, rq.w))
    const v = fwd.x * lv0.x + fwd.y * lv0.y + fwd.z * lv0.z
    this.speed = v
    const MAX = 46
    // steering: less lock at speed, and the wheels swing in gradually (slower than before for easier control)
    const lock = 0.62 * (1 - Math.min(0.78, Math.abs(v) / 45))
    this.steer += (steerIn * lock - this.steer) * Math.min(1, dt * 4.5)
    this.ctrl.setWheelSteering(0, this.steer); this.ctrl.setWheelSteering(1, this.steer)
    let force = 0, brake = 0
    if (throttle > 0) force = v < MAX ? 6500 * throttle * (1 - Math.max(0, v) / MAX * 0.7) : 0
    else if (throttle < 0) { if (v > 1.5) brake = 220; else force = -2800 * -throttle }
    else brake = 6
    if (hb) brake = 0
    for (let i = 0; i < 4; i++) { this.ctrl.setWheelEngineForce(i, force); this.ctrl.setWheelBrake(i, i >= 2 ? (hb ? 160 : brake) : brake) }
    // handbrake lowers rear grip for drifts
    for (let i = 2; i < 4; i++) { this.ctrl.setWheelFrictionSlip(i, hb ? 2.5 : 9); this.ctrl.setWheelSideFrictionStiffness(i, hb ? 0.3 : 1.0) }
    this.ctrl.updateVehicle(1 / 60, R.QueryFilterFlags.EXCLUDE_DYNAMIC)
    // impacts: velocity change
    const lv = this.body.linvel(); const cur = new THREE.Vector3(lv.x, lv.y, lv.z)
    const dv = cur.distanceTo(this.prevVel)
    this.lastHit = dv > 5 ? dv : 0
    if (this.lastHit) this.impactVel = this.prevVel.clone()   // velocity just before the impact
    this.prevVel.copy(cur)
    // lateral slip -> drifting
    const rot = this.body.rotation(); const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    const lateral = cur.dot(right)
    this.lateral = lateral
    this.drifting = Math.abs(lateral) > 3.5 && Math.abs(v) > 6
    // flipped? auto-right after 2 s
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    if (up.y < 0.3) { this.flipTimer += dt; if (this.flipTimer > 2) this.reset() } else this.flipTimer = 0
    this.sync()
  }

  sync() {
    const t = this.body.translation(), r = this.body.rotation()
    this.mesh.position.set(t.x, t.y, t.z); this.mesh.quaternion.set(r.x, r.y, r.z, r.w)
    this.pos.copy(this.mesh.position)
    const e = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ'); this.heading = e.y
    const lv = this.body.linvel(); this.vel.set(lv.x, lv.z)
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i]; if (!w) continue
      const sl = this.ctrl.wheelSuspensionLength(i) ?? this.rest
      w.position.copy(this.wheelOrig[i]); w.position.y -= (sl - (this.rest - this.sag)) / this.wheelScale
      w.rotation.set(0, 0, 0)
      if (i < 2) w.rotation.y = this.steer
      w.rotateX(this.ctrl.wheelRotation(i) || 0)
    }
    this.tailMat.opacity = (this.occupied && this.physics.braking ? 1 : 0.35) * this.tailBase
  }

  get tailBase() { return this._tailBase ?? 0.5 }

  reset(x, z, heading) {
    const t = this.body.translation()
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading ?? this.heading)
    this.body.setTranslation({ x: x ?? t.x, y: 1.2, z: z ?? t.z }, true)
    this.body.setRotation(q, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.sync()
  }

  // remove everything this vehicle created (mesh, materials, physics body, collider, vehicle controller)
  dispose() {
    const w = this.physics.world
    w.removeVehicleController(this.ctrl)
    w.removeRigidBody(this.body)
    this.scene.remove(this.mesh)
    for (const m of Object.values(this.mats)) m.dispose()
    this.tailMat.dispose(); this.glows[0].material.dispose(); for (const g of this.glows) g.geometry.dispose(); for (const t of this.tails) t.geometry.dispose()
    this.disposed = true
  }

  setNight(n) {
    const on = n > 0.4
    for (const h of this.headlights) h.intensity = on ? 260 : 0
    this.glows[0].material.opacity = on ? 0.8 : 0
    this._tailBase = on ? 1 : 0.5
  }
}
