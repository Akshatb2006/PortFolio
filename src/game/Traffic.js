import * as THREE from 'three'
import { roadGraph } from './CityMap.js'

const COLORS = [0x3a6fd1, 0xe8e2d0, 0x2d2d2d, 0xd9a441, 0x7a3fa8, 0x3aa06a, 0xc4c4c4, 0x8b2222, 0xf2f2f2, 0x204060]

// AI cars on the road graph. Kinematic Rapier bodies so the player collides with them.
export class Traffic {
  constructor(scene, physics, bgCars, count = 14, rnd = Math.random) {
    this.physics = physics; this.bgCars = bgCars
    this.nodes = roadGraph()
    this.cars = []
    const R = physics.R
    for (let i = 0; i < count; i++) {
      const inst = bgCars.alloc(COLORS[i % COLORS.length])
      const mesh = new THREE.Group(); scene.add(mesh)
      const from = Math.floor(rnd() * this.nodes.length)
      const to = this.nodes[from].nb[Math.floor(rnd() * this.nodes[from].nb.length)]
      const body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased())
      physics.world.createCollider(R.ColliderDesc.cuboid(0.95, 0.5, 2.2).setTranslation(0, 0.6, 0), body)
      // tail lights
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.14), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.4 })); tail.position.set(0, 0.74, -2.26); tail.rotation.y = Math.PI; mesh.add(tail)
      const head = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.16), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0 })); head.position.set(0, 0.64, 2.26); mesh.add(head)
      this.cars.push({ mesh, inst, body, from, to, t: rnd(), speed: 9 + rnd() * 5, pos: new THREE.Vector3(), heading: 0, stop: 0, tail, head })
    }
  }

  carPos(c) {
    const a = this.nodes[c.from], b = this.nodes[c.to]
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), fx = dx / len, fz = dz / len
    const off = 3.4
    return { x: a.x + dx * c.t + fz * off, z: a.z + dz * c.t - fx * off, heading: Math.atan2(fx, fz), len }
  }

  update(dt, playerPos, others = []) {
    for (const c of this.cars) {
      const p = this.carPos(c)
      const ahead = (playerPos.x - p.x) * Math.sin(p.heading) + (playerPos.z - p.z) * Math.cos(p.heading)
      const side = Math.abs((playerPos.x - p.x) * Math.cos(p.heading) - (playerPos.z - p.z) * Math.sin(p.heading))
      // also yield to other traffic right ahead
      let blocked = ahead > 0 && ahead < 10 && side < 3.5
      if (!blocked) for (const o of others) { const ax = (o.pos.x - p.x) * Math.sin(p.heading) + (o.pos.z - p.z) * Math.cos(p.heading); const sd = Math.abs((o.pos.x - p.x) * Math.cos(p.heading) - (o.pos.z - p.z) * Math.sin(p.heading)); if (ax > 0 && ax < 10 && sd < 3) { blocked = true; break } }
      if (!blocked) for (const o of this.cars) { if (o === c) continue; const ax = (o.pos.x - p.x) * Math.sin(p.heading) + (o.pos.z - p.z) * Math.cos(p.heading); const sd = Math.abs((o.pos.x - p.x) * Math.cos(p.heading) - (o.pos.z - p.z) * Math.sin(p.heading)); if (ax > 0 && ax < 8 && sd < 2.5) { blocked = true; break } }
      c.stop = blocked ? 1 : Math.max(0, c.stop - dt * 1.5)
      const v = c.speed * (1 - c.stop)
      c.t += v * dt / p.len
      if (c.t >= 1) { c.t = 0; const prev = c.from; c.from = c.to; const opts = this.nodes[c.from].nb.filter(n => n !== prev); c.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : prev }
      const q = this.carPos(c)
      let d = q.heading - c.heading; d = Math.atan2(Math.sin(d), Math.cos(d))
      c.heading += d * Math.min(1, dt * 5)
      c.pos.set(q.x, 0, q.z)
      c.mesh.position.copy(c.pos); c.mesh.rotation.y = c.heading
      this.bgCars.set(c.inst, q.x, 0, q.z, c.heading)
      c.body.setNextKinematicTranslation({ x: q.x, y: 0, z: q.z })
      c.body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.heading))
      c.tail.material.opacity = c.stop > 0.2 ? 1 : this.nightBase
    }
  }

  setNight(n) { this.nightBase = n > 0.4 ? 0.9 : 0.35; for (const c of this.cars) c.head.material.opacity = n > 0.4 ? 0.95 : 0 }
}
