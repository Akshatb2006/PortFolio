import * as THREE from 'three'
import * as M from './CityMap.js'
import { makeCharacter, blendCivilian, updateLayer, playAction, stopAction, FootLock, ankleMins } from './Characters.js'

// Fictional, non-graphic arcade combat.
// Player: F = jab (alternating hands), G = heavy kick, Space (on foot) = dodge roll with brief invulnerability.
// One attack checks for a hit once, at the clip's contact frame, against the closest target in front within
// reach and with no wall in between. Targets: the hostile crew (yard in Research Park), civilians (they react,
// flee and report an assault) and police officers (knocked down; counts as attacking the police).
// Clip timings measured on the rig: Punch contact 0.57 s / 0.83 s (reach 0.61 m), Kick contact 0.50 s / 0.93 s
// (reach 1.07 m), Roll 1.33 s.
const MOVES = {
  jab:  { clips: ['Punch_Left', 'Punch_Right'], speed: 1.6, contact: 0.57, reach: 1.2, damage: 1, cone: 0.85 },
  kick: { clips: ['Kick_Right'], speed: 1.25, contact: 0.5, reach: 1.6, damage: 2, cone: 0.7 },
}
const ROLL = { speed: 1.45, iframes: [0.05, 0.5], push: 4.5 }
export const YARD = { bx: 1, bz: 1, x: 10, z: 26, r: 9 }   // open south-west corner of block (1,1), metres from block start
const CREW = [{ id: 'W_Punk', dx: -2, dz: 0 }, { id: 'M_Casual_2', dx: 2, dz: -1 }, { id: 'M_Worker', dx: 0, dz: 3 }]

export class Combat {
  constructor(game) {
    this.game = game
    this.health = 1; this.maxHp = 100; this.hp = 100
    this.attack = null; this.roll = null; this.hand = 0
    this.invuln = 0; this.sinceHit = 99; this.engaged = false
    this.stats = { attacks: 0, hits: 0, misses: 0, damageTaken: 0, knockouts: 0, defeats: 0 }
    const cx = M.blockStart(YARD.bx) + YARD.x, cz = M.blockStart(YARD.bz) + YARD.z
    this.yard = new THREE.Vector3(cx, 0, cz)
    this.enemies = []
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.0, depthWrite: false })
    this.ringGeo = new THREE.RingGeometry(0.45, 0.6, 28).rotateX(-Math.PI / 2)
    this.buildYard()
    this.spawnCrew()
  }

  // ---------------------------------------------------------------- the yard and its crew
  buildYard() {
    const g = this.game, Y = g.physics.groundAt(this.yard.x, this.yard.z)
    const group = new THREE.Group(); group.name = 'crew-yard'
    const paint = new THREE.MeshBasicMaterial({ color: 0xf2b866, transparent: true, opacity: 0.55, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(YARD.r - 0.25, YARD.r, 64).rotateX(-Math.PI / 2), paint); ring.position.set(this.yard.x, Y + 0.02, this.yard.z); group.add(ring)
    g.scene.add(group)
    this.yardY = Y
  }

  spawnCrew() {
    const g = this.game
    for (const e of this.enemies) g.scene.remove(e.wrap)
    this.enemies = []
    const roster = g.assets.roster || []
    for (const c of CREW) {
      const r = roster.find(x => x.id === c.id); if (!r) continue
      const s = makeCharacter(r.gltf)
      s.footLock = new FootLock(s.wrap, s.model, ankleMins(r.gltf))
      const home = new THREE.Vector3(this.yard.x + c.dx, this.yardY, this.yard.z + c.dz)
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat.clone()); ring.position.y = 0.03; s.wrap.add(ring)
      const e = { ...s, kind: 'hostile', id: c.id, home, pos: home.clone(), heading: Math.random() * 6.28, speed: 0, hp: 5, maxHp: 5, state: 'idle', t: 0, down: 0, ring, hit: false }
      e.wrap.position.copy(e.pos); g.scene.add(e.wrap)
      playAction(e, 'Idle_Neutral', { loop: true, fade: 0.01 })
      this.enemies.push(e)
    }
  }

  // ---------------------------------------------------------------- player input
  input(dt, input) {
    const g = this.game, pl = g.player
    if (pl.inVehicle || g.interior?.noCombat || !pl.ch) return
    if (!this.attack && !this.roll) {
      if (input.justPressed('f')) this.startAttack('jab')
      else if (input.justPressed('g')) this.startAttack('kick')
      else if (input.justPressed(' ')) this.startRoll()
    }
  }

  // all things the player can hit, nearest first
  targets() {
    const g = this.game, out = []
    for (const e of this.enemies) if (e.down <= 0) out.push(e)
    for (const p of g.peds.peds) if (!(p.down > 0)) out.push(p)
    for (const o of g.police.targets()) out.push(o)
    return out
  }

  startAttack(name) {
    const g = this.game, pl = g.player, mv = MOVES[name]
    // target assist: face the nearest valid target within 2.5 m and 70 degrees
    let best = null, bd = 2.5
    for (const t of this.targets()) {
      const dx = t.pos.x - pl.pos.x, dz = t.pos.z - pl.pos.z, d = Math.hypot(dx, dz)
      const ang = Math.atan2(Math.sin(Math.atan2(dx, dz) - pl.heading), Math.cos(Math.atan2(dx, dz) - pl.heading))
      if (d < bd && Math.abs(ang) < 1.2) { best = t; bd = d }
    }
    if (best) pl.heading = Math.atan2(best.pos.x - pl.pos.x, best.pos.z - pl.pos.z)
    const clip = mv.clips[this.hand++ % mv.clips.length]
    playAction(pl.ch, clip, { timeScale: mv.speed, fade: 0.06 })
    this.attack = { mv, name, t: 0, contact: mv.contact / mv.speed, end: pl.ch.clips[clip].duration / mv.speed, done: false }
    this.stats.attacks++; this.sinceHit = 0
  }

  startRoll() {
    const pl = this.game.player
    playAction(pl.ch, 'Roll', { timeScale: ROLL.speed, fade: 0.06 })
    this.roll = { t: 0, end: pl.ch.clips.Roll.duration / ROLL.speed }
    pl.force = { speed: ROLL.push, t: this.roll.end * 0.75 }
  }

  // the single hit check of an attack
  resolve(a) {
    const g = this.game, pl = g.player, mv = a.mv
    const fx = Math.sin(pl.heading), fz = Math.cos(pl.heading)
    let best = null, bd = mv.reach + 0.35
    for (const t of this.targets()) {
      const dx = t.pos.x - pl.pos.x, dz = t.pos.z - pl.pos.z, d = Math.hypot(dx, dz)
      if (d > bd || d < 0.05) continue
      if ((dx * fx + dz * fz) / d < mv.cone) continue
      if (!g.wanted.los(pl.pos.clone().setY(pl.pos.y + 1.2), t.pos.clone().setY(t.pos.y + 1.2))) continue
      best = t; bd = d
    }
    if (!best) { this.stats.misses++; g.audio.blip?.(180, 0.06, 'sine', 0.08); return }
    this.stats.hits++
    const at = best.pos.clone().setY(best.pos.y + 1.3)
    g.effects.blood(at.x, at.y - 0.1, at.z, fx * 0.6, fz * 0.6, 0.12 * mv.damage)   // a small spray in the direction of the blow
    g.audio.blip?.(mv.damage > 1 ? 140 : 220, 0.09, 'square', 0.22)
    g.rig.shake = Math.max(g.rig.shake, 0.15 * mv.damage)
    if (best.kind === 'hostile') this.hurtEnemy(best, mv.damage, fx, fz)
    else if (best.kind === 'officer') { best.hp -= mv.damage; if (best.hp <= 0) { best.down = 8; best.hp = 3; playAction(best, 'Death', { hold: true, fade: 0.1 }) } else playAction(best, 'HitRecieve', { fade: 0.06 }); g.onCrime('police', best.pos.clone()) }
    else { g.peds.hit(best); g.onCrime('assault', best.pos.clone()) }
  }

  hurtEnemy(e, dmg, fx, fz) {
    e.hp -= dmg
    e.pos.x += fx * 0.35; e.pos.z += fz * 0.35   // a little knockback
    if (e.hp <= 0) { e.down = 12; e.state = 'down'; this.stats.knockouts++; playAction(e, 'Death', { hold: true, fade: 0.1 }); e.ring.material.opacity = 0; this.game.activities?.event('crewDown', e) }
    else { e.state = 'stagger'; e.t = 0.55; playAction(e, 'HitRecieve', { fade: 0.06 }) }
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.game, pl = g.player
    this.invuln = Math.max(0, this.invuln - dt)
    this.sinceHit += dt
    // player's attack / roll timeline
    if (this.attack) {
      const a = this.attack; a.t += dt
      if (!a.done && a.t >= a.contact) { a.done = true; this.resolve(a) }
      if (a.t >= a.end) this.attack = null
    }
    if (this.roll) { this.roll.t += dt; if (this.roll.t >= this.roll.end) this.roll = null }
    pl.moveScale = this.attack ? 0.25 : 1
    // health regenerates once out of combat for a while
    if (this.sinceHit > 6 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 8 * dt)
    // hostile crew
    let attacking = 0
    for (const e of this.enemies) if (e.state === 'windup' || e.state === 'strike') attacking++
    this.engaged = false
    const target = g.target()
    for (const e of this.enemies) {
      const dist = e.pos.distanceTo(target.pos)
      if (dist > 120) continue                     // far: frozen
      this.updateEnemy(e, dt, target, dist, attacking)
      if (e.state !== 'idle' && e.state !== 'down' && e.state !== 'home') this.engaged = true
    }
    // the crew resets once the player has left and nobody is fighting
    if (this.enemies.length && this.enemies.every(e => e.state === 'down' || e.state === 'idle') && target.pos.distanceTo(this.yard) > 60 && this.enemies.some(e => e.state === 'down')) this.spawnCrew()
    g.ui.health(this.hp / this.maxHp)
  }

  updateEnemy(e, dt, target, dist, attacking) {
    const g = this.game, pl = g.player
    let speed = 0, face = null
    e.t -= dt
    const inYard = target.pos.distanceTo(this.yard) < YARD.r + 6
    const sees = !pl.inVehicle && dist < 12 && inYard && g.wanted.los(e.pos.clone().setY(e.pos.y + 1.5), target.pos.clone().setY(target.pos.y + 1.2))
    switch (e.state) {
      case 'idle': if (sees) { e.state = 'approach'; stopAction(e, 0.2) } break
      case 'home': face = e.home; speed = e.pos.distanceTo(e.home) > 0.6 ? 1.3 : 0; if (!speed) { e.state = 'idle'; playAction(e, 'Idle_Neutral', { loop: true }) } if (sees) e.state = 'approach'; break
      case 'approach':
        face = target.pos
        if (!sees && dist > 6) { e.state = 'home'; break }
        if (dist > 1.5) speed = dist > 5 ? 3.6 : 1.4
        else if (attacking < 2 && e.t <= 0) { e.state = 'windup'; e.t = 0.45; e.ring.material.opacity = 0.9 }   // telegraph
        break
      case 'windup': face = target.pos; if (e.t <= 0) { e.state = 'strike'; e.t = 0.83 / 1.4; playAction(e, Math.random() < 0.5 ? 'Punch_Left' : 'Punch_Right', { timeScale: 1.4, fade: 0.05 }); e.hit = false } break
      case 'strike':
        face = target.pos
        if (!e.hit && e.t < 0.83 / 1.4 - 0.57 / 1.4) { e.hit = true; this.enemyStrike(e) }
        if (e.t <= 0) { e.state = 'recover'; e.t = 1.0 + Math.random() * 0.7; e.ring.material.opacity = 0 }
        break
      case 'recover': face = target.pos; if (e.t <= 0) { e.state = 'approach'; e.t = 0.3 } break
      case 'stagger': e.ring.material.opacity = 0; if (e.t <= 0) { e.state = 'approach'; e.t = 0.4 } break
      case 'down': e.down -= dt; break
    }
    if (face) { const h = Math.atan2(face.x - e.pos.x, face.z - e.pos.z); e.heading += Math.atan2(Math.sin(h - e.heading), Math.cos(h - e.heading)) * Math.min(1, dt * 8) }
    e.speed += (speed - e.speed) * Math.min(1, dt * 6)
    // stay out of each other and out of the player
    for (const o of this.enemies) { if (o === e || o.state === 'down') continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d > 0.01 && d < 0.9) { e.pos.x += dx / d * (0.9 - d) * 0.5; e.pos.z += dz / d * (0.9 - d) * 0.5 } }
    if (!pl.inVehicle && dist < 0.8 && dist > 0.01) { e.pos.x += (e.pos.x - target.pos.x) / dist * (0.8 - dist); e.pos.z += (e.pos.z - target.pos.z) / dist * (0.8 - dist) }
    e.pos.x += Math.sin(e.heading) * e.speed * dt; e.pos.z += Math.cos(e.heading) * e.speed * dt
    e.pos.y = g.physics.groundAt(e.pos.x, e.pos.z)
    e.wrap.position.copy(e.pos); e.wrap.rotation.y = e.heading
    if (dist < 90) {
      e.mixer.update(dt); updateLayer(e, dt)
      e.footLock.update(dt, { Walk: e.actions.Walk.getEffectiveWeight(), Run: e.actions.Run.getEffectiveWeight() }, e.speed > 0.3 && !e.layer)
      blendCivilian(e.actions, e.speed, dt)
    }
  }

  enemyStrike(e) {
    const g = this.game, pl = g.player
    const dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z, d = Math.hypot(dx, dz)
    const facing = (dx * Math.sin(e.heading) + dz * Math.cos(e.heading)) / (d || 1)
    const rolling = this.roll && this.roll.t > ROLL.iframes[0] && this.roll.t < ROLL.iframes[1]
    if (pl.inVehicle || d > 1.6 || facing < 0.6 || this.invuln > 0 || rolling) return   // dodged / out of reach
    this.damage(8, e)
  }

  damage(n, from) {
    const g = this.game, pl = g.player
    this.hp -= n; this.sinceHit = 0; this.stats.damageTaken += n
    g.rig.shake = Math.max(g.rig.shake, 0.35)
    if (from?.pos) { const dx = pl.pos.x - from.pos.x, dz = pl.pos.z - from.pos.z, l = Math.hypot(dx, dz) || 1; g.effects.blood(pl.pos.x, pl.pos.y + 1.2, pl.pos.z, dx / l * 0.6, dz / l * 0.6, 0.12) }
    g.audio.blip?.(90, 0.14, 'sawtooth', 0.25)
    document.getElementById('hurt')?.classList.remove('flash'); void document.getElementById('hurt')?.offsetWidth; document.getElementById('hurt')?.classList.add('flash')
    if (this.hp <= 0) return this.defeat()
    if (!this.attack && !this.roll && pl.ch) playAction(pl.ch, 'HitRecieve', { fade: 0.05 })
  }

  // knocked out: short banner, wake up at home with full health and a moment of protection
  defeat() {
    const g = this.game, pl = g.player
    this.stats.defeats++
    const fee = Math.min(g.save.data.money ?? 0, 50); g.save.data.money -= fee; g.save.write(); g.ui.cash()
    this.attack = this.roll = null; pl.force = null
    for (const e of this.enemies) if (e.state !== 'down') { e.state = 'home'; e.ring.material.opacity = 0 }
    g.missions.active && g.missions.fail('KNOCKED OUT')
    g.wanted.clear('busted'); for (const u of [...g.police.units]) g.police.remove(u)
    const home = M.districtCenter(M.districts.find(d => d.id === 'home'))
    pl.teleport(M.roadCoord(1) + 8.5, home.z, 0)
    this.hp = this.maxHp; this.invuln = 3
    if (pl.ch) stopAction(pl.ch, 0.05)
    g.rig.snapTo(g.target())
    g.ui.banner('KNOCKED OUT', fee ? `PATCHED UP · $${fee}` : 'BACK ON YOUR FEET', true)
    g.audio.failed()
  }

  describe() { return { hp: Math.round(this.hp), invuln: +this.invuln.toFixed(1), attack: this.attack?.name || null, rolling: !!this.roll, engaged: this.engaged, crew: this.enemies.map(e => ({ id: e.id, state: e.state, hp: e.hp, dist: +e.pos.distanceTo(this.game.target().pos).toFixed(1) })), stats: this.stats } }
}
