import * as THREE from 'three'
import * as M from './CityMap.js'
import { makeSoldier, blendLocomotion } from './Player.js'

// People walking sidewalk loops around blocks. Purely visual, with a simple
// "step aside" reaction to the player.
export class Pedestrians {
  constructor(scene, assets, count, rnd) {
    this.peds = []
    const tints = [0xffffff, 0xd8c8c0, 0xc0d0e8, 0xe8d0a0, 0xa0c0a0, 0xd0a0a0]
    for (let i = 0; i < count; i++) {
      let bx, bz, d
      do { bx = Math.floor(rnd() * M.N); bz = Math.floor(rnd() * M.N); d = M.districtOfBlock(bx, bz) } while (!d || (d.id === 'achievements' && bx === 6 && bz === 6))
      const s = makeSoldier(assets, new THREE.Color(tints[i % tints.length]))
      const phase = rnd() * 2
      scene.add(s.wrap)
      const x0 = M.blockStart(bx) - 1.0, z0 = M.blockStart(bz) - 1.0, L = M.BLOCK + 2.0
      const ped = { ...s, x0, z0, L, t: rnd() * 4 * L, dir: rnd() < 0.5 ? 1 : -1, speed: 1.1 + rnd() * 0.8, pos: new THREE.Vector3(), heading: 0, panic: 0 }
      // start in the walk blend for this pedestrian's speed (dt = 1 snaps the weights), then pose at a random phase
      blendLocomotion(s.actions, ped.speed, 1)
      s.mixer.setTime(phase)
      this.peds.push(ped)
    }
  }

  // position on the sidewalk rectangle perimeter at distance t
  at(p, t) {
    const L = p.L; t = ((t % (4 * L)) + 4 * L) % (4 * L)
    if (t < L) return [p.x0 + t, p.z0, 0]
    if (t < 2 * L) return [p.x0 + L, p.z0 + (t - L), 1]
    if (t < 3 * L) return [p.x0 + L - (t - 2 * L), p.z0 + L, 2]
    return [p.x0, p.z0 + L - (t - 3 * L), 3]
  }

  update(dt, playerPos, threat) {
    for (const p of this.peds) {
      const [x, z] = this.at(p, p.t)
      const dx = x - playerPos.x, dz = z - playerPos.z, dist = Math.hypot(dx, dz)
      if (threat && dist < 7) p.panic = 1.5
      p.panic = Math.max(0, p.panic - dt)
      const sp = p.panic > 0 ? 5.5 : p.speed
      p.t += p.dir * sp * dt
      const [nx, nz] = this.at(p, p.t + p.dir * 0.5)
      const want = Math.atan2(nx - x, nz - z)
      p.heading += Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading)) * Math.min(1, dt * 8)
      // sidestep away from the player when close
      let ox = 0, oz = 0
      if (dist < 2.5 && dist > 0.01) { ox = dx / dist * (2.5 - dist); oz = dz / dist * (2.5 - dist) }
      p.pos.set(x + ox, M.districtAt(x, z) ? 0.18 : 0, z + oz)
      p.wrap.position.copy(p.pos); p.wrap.rotation.y = p.heading
      if (dist < 90) { p.mixer.update(dt); blendLocomotion(p.actions, sp, dt) }
    }
  }
}
