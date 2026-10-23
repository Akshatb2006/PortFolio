import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { colliders, SIZE } from './CityMap.js'

// Thin wrapper over Rapier. Static world from CityMap colliders, plus dynamic props.
export class Physics {
  static async create() { await RAPIER.init(); return new Physics() }

  constructor() {
    this.R = RAPIER
    this.world = new RAPIER.World({ x: 0, y: -9.81 * 1.6, z: 0 })
    this.world.timestep = 1 / 60
    this.props = []
    this.accum = 0
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(SIZE * 3, 1, SIZE * 3).setTranslation(0, -1, 0).setFriction(1.1))
  }

  buildStatic() {
    const R = this.R
    for (const b of colliders.boxes) {
      const hx = (b.x1 - b.x0) / 2, hz = (b.z1 - b.z0) / 2, hy = b.h ? b.h / 2 : 20
      this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation((b.x0 + b.x1) / 2, hy, (b.z0 + b.z1) / 2))
    }
    for (const c of colliders.circles) this.world.createCollider(R.ColliderDesc.cylinder(c.h ? c.h / 2 : 6, c.r).setTranslation(c.x, c.h ? c.h / 2 : 6, c.z))
  }

  addProp(mesh, { hx, hy, hz, mass = 20, kind = 'crate', x, y, z, rotY = 0, shape = 'box', r = 0.4 }) {
    const R = this.R
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
    const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setLinearDamping(0.3).setAngularDamping(0.8))
    const desc = shape === 'cyl' ? R.ColliderDesc.cylinder(hy, r) : R.ColliderDesc.cuboid(hx, hy, hz)
    desc.setMass(mass).setFriction(0.8).setRestitution(0.1)
    const col = this.world.createCollider(desc, body)
    const p = { body, mesh, kind, col, alive: true }
    this.props.push(p)
    mesh.position.set(x, y, z); mesh.rotation.y = rotY
    return p
  }

  removeProp(p) { if (!p.alive) return; p.alive = false; this.world.removeRigidBody(p.body); p.mesh.parent?.remove(p.mesh) }

  explode(x, y, z, radius = 10, strength = 40) {
    for (const p of this.props) {
      if (!p.alive) continue
      const t = p.body.translation()
      const d = new THREE.Vector3(t.x - x, t.y - y, t.z - z)
      const dist = d.length(); if (dist > radius) continue
      const f = strength * (1 - dist / radius) * p.body.mass()
      d.normalize().multiplyScalar(f); d.y += f * 0.8
      p.body.applyImpulse(d, true)
    }
  }

  step(dt) {
    this.accum += dt
    let n = 0
    while (this.accum >= 1 / 60 && n < 4) { this.world.step(); this.accum -= 1 / 60; n++ }
    if (n === 4) this.accum = 0
    for (const p of this.props) {
      if (!p.alive) continue
      const t = p.body.translation(), r = p.body.rotation()
      p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w)
      if (t.y < -20) this.removeProp(p)
    }
  }
}
