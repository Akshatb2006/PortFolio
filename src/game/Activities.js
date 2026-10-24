import * as THREE from 'three'
import * as M from './CityMap.js'
import { makeTextTexture } from './textures.js'

// Side activities: a few replayable things to do between the portfolio missions.
//   trial   Coastal Time Trial — drive into the start sign and press E; six checkpoints along the coast road
//           against the clock. Reward on finish, best time saved.
//   yard    Clear the Yard — knock out the crew in the Research Park yard. Repeatable once the crew resets.
//   night   Night Out at LUMEN — enter the club, order a drink, open the social wall. One-time reward.
//   heat    Shake the Heat — escape a pursuit of 2 stars or more. Repeatable bonus (cooldown).
// Progress and rewards are saved in save.data.activities / best / money. The mission HUD is reused, but only
// while no portfolio mission is running.
const N = (i, j) => ({ x: M.roadCoord(i), z: M.roadCoord(j) })
const TRIAL = { start: { x: M.roadCoord(1) + 3, z: M.roadCoord(8) - 3 }, limit: 45, reward: 75,
  points: [N(3, 8), N(5, 8), N(5, 6), N(3, 6), N(1, 6), N(1, 8)] }
const REWARD = { yard: 60, night: 40, heat: 50 }

export const ACTIVITY_LIST = [
  { id: 'trial', title: 'Coastal Time Trial', where: 'Sunset Pier coast road', how: 'Drive into the start sign and press E.' },
  { id: 'yard', title: 'Clear the Yard', where: 'Research Park', how: 'Walk into the painted ring in the yard.' },
  { id: 'night', title: 'Night Out at LUMEN', where: 'Sunset Pier', how: 'Enter the club, order a drink, open the social wall.' },
  { id: 'heat', title: 'Shake the Heat', where: 'Anywhere', how: 'Lose a pursuit of two stars or more.' },
]

export class Activities {
  constructor(game) {
    this.game = game
    this.save = game.save.data; this.save.activities ??= {}; this.save.best ??= {}
    this.active = null       // { id, ... }
    this.night = { club: false, drink: false, socials: false }
    this.heatCd = 0
    this.buildStartSign()
  }

  buildStartSign() {
    const g = this.game, s = TRIAL.start
    const tex = makeTextTexture(['TIME TRIAL'], { w: 512, h: 192, bg: '#0b1f2e', fg: '#3dd6f5', sub: 'DRIVE IN · PRESS E', subColor: '#f2b866', border: '#3dd6f5', font: 'bold 84px Anton, Impact, sans-serif' })
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
    sign.position.set(s.x, 3.4, s.z); sign.rotation.y = Math.PI / 2
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 8), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.6 })); post.position.set(s.x, 1.35, s.z)
    const pad = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3dd6f5, transparent: true, opacity: 0.7, depthWrite: false })); pad.position.set(s.x, 0.03, s.z)
    g.scene.add(sign, post, pad)
  }

  // ---------------------------------------------------------------- prompts and E
  inTrialStart() { const t = this.game.target().pos; return Math.hypot(t.x - TRIAL.start.x, t.z - TRIAL.start.z) < 4 }
  prompt() {
    if (!this.active && this.inTrialStart()) return this.game.player.inVehicle ? `Press E to start the Coastal Time Trial (${TRIAL.limit}s)` : 'Time trial: come back in a car'
    return null
  }
  tryInteract() {
    if (!this.active && this.inTrialStart() && this.game.player.inVehicle && !this.game.missions.active) { this.startTrial(); return true }
    return false
  }
  interactables() { return [] }

  // ---------------------------------------------------------------- trial
  startTrial() {
    const g = this.game
    this.active = { id: 'trial', i: 0, t: 0 }
    this.placeCheckpoint()
    g.ui.timer(TRIAL.limit); g.audio.checkpoint()
    this.objective()
  }
  placeCheckpoint() {
    const a = this.active, g = this.game
    g.markers.remove('a:cp')
    const p = TRIAL.points[a.i]
    if (p) g.markers.add('a:cp', { x: p.x, z: p.z, kind: 'checkpoint', label: a.i === TRIAL.points.length - 1 ? 'Finish' : `Checkpoint ${a.i + 1}`, radius: 5 })
  }
  endTrial(ok) {
    const g = this.game, a = this.active; this.active = null
    g.markers.remove('a:cp'); g.ui.timer(null); g.ui.objective(null)
    if (!ok) { g.ui.banner('TIME TRIAL FAILED', 'OUT OF TIME', true); g.audio.failed(); return }
    const t = +a.t.toFixed(2), best = this.save.best.trial
    const record = !best || t < best
    if (record) this.save.best.trial = t
    this.pay('trial', TRIAL.reward)
    g.ui.banner('TIME TRIAL COMPLETE', `${t.toFixed(2)} s${record ? ' · NEW BEST' : ` · BEST ${best.toFixed(2)} s`} · +$${TRIAL.reward}`, false)
    g.audio.passed()
  }

  // ---------------------------------------------------------------- events from other systems
  event(kind, data) {
    const g = this.game
    if (kind === 'clubEnter' || kind === 'drink' || kind === 'socials') {
      if (this.save.activities.night) return
      if (kind === 'clubEnter') this.night.club = true
      if (kind === 'drink') this.night.drink = true
      if (kind === 'socials') this.night.socials = true
      if (this.night.club && this.night.drink && this.night.socials) { this.save.activities.night = true; this.pay('night', REWARD.night); g.ui.banner('NIGHT OUT', `ACTIVITY COMPLETE · +$${REWARD.night}`, false); g.audio.passed() }
      else this.objective()
    }
    if (kind === 'crewDown' && this.active?.id === 'yard') {
      if (g.combat.enemies.every(e => e.state === 'down')) { this.active = null; g.ui.objective(null); this.pay('yard', REWARD.yard); g.ui.banner('YARD CLEARED', `+$${REWARD.yard}`, false); g.audio.passed() }
      else this.objective()
    }
    if (kind === 'escaped' && data >= 2 && this.heatCd <= 0) { this.heatCd = 120; this.pay('heat', REWARD.heat); setTimeout(() => g.ui.hint(`Shake the Heat: +$${REWARD.heat}`), 1600) }
  }

  pay(id, amount) {
    const s = this.save; s.money = (s.money ?? 0) + amount
    s.activities[id + 'Count'] = (s.activities[id + 'Count'] || 0) + 1
    this.game.save.write(); this.game.ui.cash()
  }

  objective() {
    const g = this.game, a = this.active
    if (g.missions.active) return
    if (a?.id === 'trial') return g.ui.objective(`Coastal Time Trial: checkpoint <strong>${a.i + 1}/${TRIAL.points.length}</strong>`)
    if (a?.id === 'yard') return g.ui.objective(`Clear the Yard: <strong>${g.combat.enemies.filter(e => e.state === 'down').length}/${g.combat.enemies.length}</strong> down · <kbd>F</kbd> jab · <kbd>G</kbd> kick · <kbd>Space</kbd> roll`)
    if (g.interior?.club && !this.save.activities.night) { const n = this.night; return g.ui.objective(`Night Out: ${n.club ? '✓' : '·'} arrive · ${n.drink ? '✓' : '·'} order at the bar · ${n.socials ? '✓' : '·'} social wall`) }
    if (!a) g.ui.objective(null)
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.game, a = this.active
    this.heatCd = Math.max(0, this.heatCd - dt)
    if (a?.id === 'trial') {
      a.t += dt; g.ui.timer(TRIAL.limit - a.t)
      const p = TRIAL.points[a.i], pos = g.target().pos
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 6) { a.i++; g.audio.checkpoint(); if (a.i >= TRIAL.points.length) return this.endTrial(true); this.placeCheckpoint(); this.objective() }
      if (a.t > TRIAL.limit) this.endTrial(false)
      if (!g.player.inVehicle && a.t > 2) this.endTrial(false)
    }
    // the yard starts itself when the player steps into the painted ring with the crew standing
    if (!a && !g.missions.active && !g.player.inVehicle && g.player.pos.distanceTo(g.combat.yard) < 9 && g.combat.enemies.some(e => e.state !== 'down')) { this.active = { id: 'yard' }; this.objective() }
    if (a?.id === 'yard' && g.player.pos.distanceTo(g.combat.yard) > 40) { this.active = null; g.ui.objective(null) }
    if (g.interior?.club && !a) this.objective()
  }

  blips() {
    const out = [{ x: TRIAL.start.x, z: TRIAL.start.z, color: '#3dd6f5' }, { x: this.game.combat.yard.x, z: this.game.combat.yard.z, color: '#ff4a6a' }, { x: this.game.club.door.x, z: this.game.club.door.z, color: '#ff6ac1' }]
    if (this.active?.id === 'trial') { const p = TRIAL.points[this.active.i]; if (p) out.push({ x: p.x, z: p.z, color: '#ff4a3d' }) }
    return out
  }

  // for the map's place list / GPS
  places() {
    const y = this.game.combat.yard
    return [
      { id: 'trial', name: 'Coastal Time Trial', sub: 'Activity', x: TRIAL.start.x, z: TRIAL.start.z, color: '#3dd6f5', tag: 'TIME TRIAL' },
      { id: 'yard', name: 'Clear the Yard', sub: 'Activity', x: y.x, z: y.z, color: '#ff4a6a', tag: 'YARD' },
    ]
  }

  // pause-menu summary
  summary() {
    const s = this.save
    return ACTIVITY_LIST.map(a => ({ ...a, done: a.id === 'night' ? !!s.activities.night : (s.activities[a.id + 'Count'] || 0) > 0, count: s.activities[a.id + 'Count'] || 0, best: a.id === 'trial' ? s.best.trial : null }))
  }
}
