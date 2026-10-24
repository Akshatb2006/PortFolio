import * as THREE from 'three'
import * as M from './CityMap.js'
import { makeSoldier, blendLocomotion } from './Player.js'
import { makeCharacter, blendCivilian, FootLock, ankleMins, playAction, stopAction, updateLayer } from './Characters.js'
import { makeTextTexture } from './textures.js'

// People walking sidewalk loops around blocks, with rests and a "step aside / flee" reaction to the player.
// Civilians (Quaternius men and women) dressed by district; the Soldier is only used if they failed to load.
const Y_WALK = 0.18     // block slab top: the loops run on the sidewalk, not the road
const INSET = 1.8       // metres in from the curb (clear of curb-side trees and planters)
// outfit styles allowed per district (see Assets.ROSTER)
export const POOLS = {
  social: ['beach', 'casual'], downtown: ['office', 'casual'], career: ['office', 'casual'], lab: ['work', 'casual'],
  skills: ['work'], home: ['casual'], park: ['casual', 'beach'], achievements: ['casual', 'work'],
}

export class Pedestrians {
  // source: the civilian roster (array of { id, sex, style, gltf }) or, as a fallback, the Soldier glTF
  constructor(scene, source, count, rnd) {
    this.peds = []
    const roster = Array.isArray(source) ? source.filter(r => !r.player && !r.role) : null
    const tints = [0xffffff, 0xd8c8c0, 0xc0d0e8, 0xe8d0a0, 0xa0c0a0, 0xd0a0a0]
    const turn = {}
    // witness cue: a "!" above the head while a pedestrian is alarmed (one shared texture)
    this.alertMat = new THREE.SpriteMaterial({ map: makeTextTexture(['!'], { w: 128, h: 128, bg: 'rgba(0,0,0,0)', fg: '#ffd23a', border: null, font: 'bold 110px Anton, Impact, sans-serif' }), depthTest: false, transparent: true })
    this.onHit = null   // set by the game: called when the player's car knocks a pedestrian down
    this.effects = null // set by the game: blood spray / pools
    this.stats = { killed: 0, injured: 0, pushed: 0, respawned: 0 }
    for (let i = 0; i < count; i++) {
      // the shared rnd() is consumed in exactly the original order, so spawn blocks and timing are unchanged
      let bx, bz, d
      do { bx = Math.floor(rnd() * M.N); bz = Math.floor(rnd() * M.N); d = M.districtOfBlock(bx, bz) } while (!d || (d.id === 'achievements' && bx === 6 && bz === 6))
      let s, who = null
      if (roster) {
        const styles = POOLS[d.id] || ['casual']
        const pool = roster.filter(r => styles.includes(r.style))
        const want = i % 2 ? 'f' : 'm'
        const sexed = pool.filter(r => r.sex === want)
        const list = sexed.length ? sexed : pool
        // rotate through each district's outfits so neighbours differ (deterministic, no shared rnd)
        const key = d.id + want; turn[key] = (turn[key] ?? i) + 1
        who = list[turn[key] % list.length]
        s = makeCharacter(who.gltf)
        s.footLock = new FootLock(s.wrap, s.model, ankleMins(who.gltf))
      } else s = makeSoldier(source, new THREE.Color(tints[i % tints.length]))
      const phase = rnd() * 2
      scene.add(s.wrap)
      const x0 = M.blockStart(bx) + INSET, z0 = M.blockStart(bz) + INSET, L = M.BLOCK - 2 * INSET
      const t = rnd() * 4 * L, dir = rnd() < 0.5 ? 1 : -1, raw = rnd()
      // walking speed 1.0–1.35 m/s: the range where the walk clip's feet stay planted (measured)
      const speed = roster ? 1.0 + raw * 0.35 : 1.1 + raw * 0.8
      const ped = { ...s, who: who?.id || 'Soldier', district: d.id, civ: !!roster, x0, z0, L, t, dir, speed, pos: new THREE.Vector3(), heading: 0, panic: 0, stuck: 0 }
      // routine: walk, then stop and rest for a while. Own generator per pedestrian, so the shared rnd
      // sequence (and therefore every spawn position) is unchanged.
      let rs = (i + 1) * 2654435761 >>> 0
      ped.r = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296 }
      ped.cur = ped.speed; ped.rest = 0; ped.nextRest = 6 + ped.r() * 14
      ped.meshes = []; s.wrap.traverse(o => { if (o.isMesh) ped.meshes.push(o) }); ped.shadow = true
      ped.alert = new THREE.Sprite(this.alertMat); ped.alert.scale.set(0.55, 0.55, 1); ped.alert.position.y = 2.25; ped.alert.visible = false; s.wrap.add(ped.alert)
      ped.alertT = 0; ped.down = 0; ped.hp = 3
      // start in the walk blend for this pedestrian's speed (dt = 1 snaps the weights), then pose at a random phase
      if (ped.civ) blendCivilian(s.actions, ped.speed, 1); else blendLocomotion(s.actions, ped.speed, 1)
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

  // a witness: flee for a while and show the cue
  alarm(p, dur) { p.panic = Math.max(p.panic, dur); p.alertT = dur; p.rest = 0 }

  // knocked down (by a car or in a fight): fall, lie still, get up, then flee
  knockDown(p, dur = 3) {
    if (p.down > 0) return
    p.down = dur; p.cur = 0
    if (p.civ) playAction(p, 'Death', { hold: true, fade: 0.12 })
  }

  // run over at speed: thrown along the car's path, dies (stays down), blood spray then a spreading pool.
  // The body is cleared, and the pedestrian walks again elsewhere on its block, once it is out of view.
  kill(p, vx, vz, speed) {
    if (p.dead) return
    this.knockDown(p, 1e9)
    p.dead = true; p.deadT = 0; p.pooled = false
    const s = Math.min(speed, 25), len = Math.hypot(vx, vz) || 1
    p.fling = { vx: vx / len * s * 0.55, vz: vz / len * s * 0.55, t: 0.5 }   // slides ~2–4 m
    p.heading = Math.atan2(-vx, -vz)                                       // falls facing the car
    this.effects?.blood(p.pos.x, p.pos.y + 1.0, p.pos.z, vx / len * 2, vz / len * 2, Math.min(1, speed / 20))
    this.stats.killed++
  }

  // car-body contact: the pedestrian's offset across the car (car space x) when inside its footprint, else false
  touches(p, car) {
    const c = Math.cos(car.heading), s = Math.sin(car.heading)
    const rx = p.pos.x - car.pos.x, rz = p.pos.z - car.pos.z
    const lx = rx * c - rz * s, lz = rx * s + rz * c                     // car space: x across, z along
    return Math.abs(lx) < car.half.x + 0.3 && Math.abs(lz) < car.half.z + 0.3 ? lx : false
  }

  // the body is gone: the pedestrian walks again from the far side of its block
  revive(p) {
    p.dead = false; p.down = 0; p.fling = null; p.hp = 3; p.panic = 0; p.alertT = 0; p.alert.visible = false
    p.t += 2 * p.L; p.cur = 0
    if (p.civ) stopAction(p, 0.01)
    const [x, z] = this.at(p, p.t); p.pos.set(x, Y_WALK, z); p.wrap.position.copy(p.pos)
    this.stats.respawned++
  }

  // hit by the player in a fight (Combat): short reaction, then flee; the third hit knocks them down
  hit(p) {
    if (p.down > 0) return false
    p.hp -= 1
    if (p.hp <= 0) { this.knockDown(p, 4); p.hp = 3 }
    else if (p.civ) playAction(p, 'HitRecieve', { fade: 0.08 })
    this.alarm(p, 6)
    return true
  }

  // car: the player's vehicle ({ pos, heading, half: {x, z}, vel }) or null; carSpeed its speed in m/s
  update(dt, playerPos, threat, carSpeed = 0, car = null, camera = null) {
    const fr = camera ? new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)) : null
    for (const p of this.peds) {
      if (p.alertT > 0) { p.alertT -= dt; p.alert.visible = p.alertT > 0 }
      if (p.dead) {
        p.deadT += dt
        if (p.fling && p.fling.t > 0) {   // thrown by the impact: slide and slow down
          const k = Math.min(dt, p.fling.t); p.fling.t -= dt
          p.pos.x += p.fling.vx * k; p.pos.z += p.fling.vz * k; p.fling.vx *= 0.9; p.fling.vz *= 0.9
          p.wrap.position.copy(p.pos); p.wrap.rotation.y = p.heading
        } else if (!p.pooled && p.deadT > 0.6) {
          // centre the pool under the torso: halfway between the root (feet) and the head bone
          p.pooled = true
          let head = null; p.wrap.traverse(o => { if (!head && o.isBone && /^head/i.test(o.name)) head = o })
          const hp = head ? head.getWorldPosition(new THREE.Vector3()) : p.pos
          this.effects?.bloodPool((p.pos.x + hp.x) / 2, p.pos.y, (p.pos.z + hp.z) / 2, 1.5 + Math.random() * 0.6)
        }
        const far = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z)
        if (far < 90) { p.mixer.update(dt); if (p.civ) { updateLayer(p, dt); blendCivilian(p.actions, 0, dt) } }
        // clear the body after a while, only when nobody can see it happen
        if (p.deadT > 30 && far > 35 && !(fr && fr.containsPoint(p.pos))) this.revive(p)
        continue
      }
      if (p.down > 0) {
        // lying down after a knock: a fast car still kills (it no longer passes over them)
        if (car && carSpeed > 9 && this.touches(p, car) !== false) { this.kill(p, car.vel.x, car.vel.y, carSpeed); this.onHit?.(p); continue }
        // otherwise no walking; stand up when the timer runs out
        p.down -= dt
        if (p.down <= 0) { if (p.civ) stopAction(p, 0.5); this.alarm(p, 5) }
        if (Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z) < 90) { p.mixer.update(dt); if (p.civ) { updateLayer(p, dt); blendCivilian(p.actions, 0, dt) } }
        continue
      }
      const [x, z] = this.at(p, p.t)
      const dx = x - playerPos.x, dz = z - playerPos.z, dist = Math.hypot(dx, dz)
      if (threat && dist < 7) p.panic = Math.max(p.panic, 1.5)
      // the player's car: contact is tested against the car body (a rectangle), not its centre point
      if (car && dist < 6) {
        const c = Math.cos(car.heading), s = Math.sin(car.heading)
        const lx = this.touches(p, car)
        if (lx !== false) {
          if (carSpeed > 9) { this.kill(p, car.vel.x, car.vel.y, carSpeed); this.onHit?.(p); continue }          // > ~32 km/h
          if (carSpeed > 3) { this.knockDown(p, 3.5); this.effects?.blood(p.pos.x, p.pos.y + 0.9, p.pos.z, 0, 0, 0.15); this.stats.injured++; this.onHit?.(p); continue }
          // crawling speed: shoved out of the car's way to the nearer side
          const side = lx >= 0 ? 1 : -1, push = car.half.x + 0.35 - Math.abs(lx)
          p.pushX = (p.pushX || 0) + c * side * push; p.pushZ = (p.pushZ || 0) - s * side * push
          this.alarm(p, 3); this.stats.pushed++
        }
      }
      p.panic = Math.max(0, p.panic - dt)
      if (p.rest > 0) { p.rest -= dt; if (p.rest <= 0) p.nextRest = 8 + p.r() * 18 }
      else if ((p.nextRest -= dt) <= 0) p.rest = 3 + p.r() * 7
      const target = p.panic > 0 ? 5.5 : p.rest > 0 ? 0 : p.speed
      // ease speed so starting, stopping and fleeing blend through the animation instead of snapping
      p.cur += (target - p.cur) * Math.min(1, dt * (p.panic > 0 ? 6 : 2.5))
      const sp = p.cur
      p.t += p.dir * sp * dt
      const [nx, nz] = this.at(p, p.t + p.dir * 0.5)
      const want = Math.atan2(nx - x, nz - z)
      p.heading += Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading)) * Math.min(1, dt * 8)
      // sidestep away from the player when close
      let ox = 0, oz = 0
      if (dist < 1.2 && dist > 0.01) { ox = dx / dist * (1.2 - dist); oz = dz / dist * (1.2 - dist) }   // personal space
      // shoves from a slow car decay back onto the walking path
      if (p.pushX || p.pushZ) { ox += p.pushX; oz += p.pushZ; p.pushX *= Math.max(0, 1 - dt * 0.8); p.pushZ *= Math.max(0, 1 - dt * 0.8); if (Math.hypot(p.pushX, p.pushZ) < 0.01) p.pushX = p.pushZ = 0 }
      p.pos.set(x + ox, Y_WALK, z + oz)
      p.wrap.position.copy(p.pos); p.wrap.rotation.y = p.heading
      // shadows only near the player
      const sh = dist < 50; if (sh !== p.shadow) { p.shadow = sh; for (const m of p.meshes) m.castShadow = sh }
      if (dist < 90) {
        p.mixer.update(dt)
        if (p.civ) {
          updateLayer(p, dt)
          p.footLock.update(dt, { Walk: p.actions.Walk.getEffectiveWeight(), Run: p.actions.Run.getEffectiveWeight() }, sp > 0.3 && !p.layer)
          blendCivilian(p.actions, sp, dt)
        } else blendLocomotion(p.actions, sp, dt)
      }
    }
  }
}
