import * as THREE from 'three'

// Wanted level (0–3 stars). It only rises through defined, witnessed events:
//   theft      a parked car stolen in view of a civilian or police
//   hitrun     a civilian knocked down by the player's car
//   assault    a civilian punched or kicked (combat)
//   police     an officer or police car attacked (always seen: jumps to at least 2 stars)
// Witnesses: civilians within 30 m with a clear line of sight react (flee, "!" above the head) and report after
// ~2 s if they can still see the player. Police who see an incident report it at once.
// Escape: stay unseen by every police unit for a while AND get far enough from where you were last seen.
const SEVERITY = { theft: 1, hitrun: 1, assault: 1, police: 2 }
const WITNESS_RANGE = 30

export class Wanted {
  constructor(game) {
    this.game = game
    this.level = 0
    this.lastSeen = null     // last position where police saw the player
    this.unseen = 0          // seconds without police contact
    this.reports = []        // pending civilian reports
    this.incident = 0
    this.log = []            // dev diagnostics
    this.hud = document.getElementById('wanted')
  }

  get escapeTime() { return 6 + 4 * this.level }
  get escapeRadius() { return 35 + 15 * this.level }

  // line of sight between two points against static geometry only
  los(a, b) {
    const R = this.game.physics.R, d = new THREE.Vector3().subVectors(b, a), len = d.length()
    if (len < 0.5) return true
    d.divideScalar(len)
    const hit = this.game.physics.world.castRay(new R.Ray(a, d), len, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC | R.QueryFilterFlags.EXCLUDE_SENSORS)
    return !hit || (hit.timeOfImpact ?? hit.toi) > len - 0.4
  }

  crime(kind, pos) {
    const g = this.game, sev = SEVERITY[kind] || 1
    if (g.interior) return                       // nothing reportable happens inside venues
    const id = ++this.incident
    const at = pos.clone().setY(1.2)
    this.log.push({ t: performance.now() | 0, kind, at: [+pos.x.toFixed(1), +pos.z.toFixed(1)] })
    if (kind === 'police' || g.police.sees(at)) return this.raise(sev, kind)
    let witnesses = 0
    for (const p of g.peds.peds) {
      if (p.down) continue
      const eye = p.pos.clone().setY(p.pos.y + 1.6)
      if (eye.distanceTo(at) > WITNESS_RANGE || !this.los(eye, at)) continue
      witnesses++
      g.peds.alarm(p, 3.5)
      this.reports.push({ id, p, t: 1.6 + p.r() * 0.8, sev, kind })
    }
    if (!witnesses) g.ui.hint('Nobody saw that.')
  }

  raise(sev, kind) {
    const g = this.game, before = this.level
    this.level = Math.min(3, Math.max(this.level + sev, kind === 'police' ? 2 : 0))
    this.peak = Math.max(this.peak || 0, this.level)
    this.lastSeen = g.target().pos.clone(); this.unseen = 0
    if (this.level > before) { g.audio.wanted?.(); g.ui.hint(this.level === 1 ? 'Someone called the police!' : 'The police are after you!') }
    this.render()
  }

  clear(reason = 'escaped') {
    const g = this.game
    if (!this.level) return
    this.level = 0; this.reports = []; this.lastSeen = null; this.unseen = 0
    g.police.standDown()
    if (reason === 'escaped') { g.ui.banner('YOU LOST THEM', 'WANTED LEVEL CLEARED', false); g.audio.passed?.(); g.activities?.event('escaped', this.peak) }
    this.peak = 0
    this.render()
  }

  update(dt) {
    const g = this.game
    // pending civilian reports: only if the witness can still see the player
    for (const r of this.reports) {
      r.t -= dt
      if (r.t > 0) continue
      const tp = g.target().pos.clone().setY(1.2), eye = r.p.pos.clone().setY(r.p.pos.y + 1.6)
      r.done = true
      if (!r.p.down && eye.distanceTo(tp) < WITNESS_RANGE + 8 && this.los(eye, tp)) {
        this.raise(r.sev, r.kind)
        for (const o of this.reports) if (o.id === r.id) o.done = true   // one report per incident
      }
    }
    this.reports = this.reports.filter(r => !r.done)
    if (!this.level) return
    if (g.interior) { this.unseen += dt * 2; } // hiding indoors counts double
    else if (g.police.seesPlayer()) { this.lastSeen = g.target().pos.clone(); this.unseen = 0 }
    else this.unseen += dt
    const far = !this.lastSeen || g.target().pos.distanceTo(this.lastSeen) > this.escapeRadius || g.interior
    if (this.unseen > this.escapeTime && far) this.clear('escaped')
    this.render()
  }

  // HUD: stars plus a search state while unseen
  render() {
    if (!this.hud) return
    const k = `${this.level}|${this.level && this.unseen > 1 ? 1 : 0}`
    if (k === this.hudKey) return
    this.hudKey = k
    this.hud.classList.toggle('hidden', !this.level)
    this.hud.innerHTML = this.level ? `<span class="stars">${'★'.repeat(this.level)}<i>${'★'.repeat(3 - this.level)}</i></span>${this.unseen > 1 ? '<span class="search">SEARCHING — STAY OUT OF SIGHT</span>' : '<span class="search seen">SPOTTED</span>'}` : ''
  }

  describe() { return { level: this.level, unseen: +this.unseen.toFixed(1), escapeIn: +Math.max(0, this.escapeTime - this.unseen).toFixed(1), escapeRadius: this.escapeRadius, distFromLastSeen: this.lastSeen ? +this.game.target().pos.distanceTo(this.lastSeen).toFixed(1) : null, pendingReports: this.reports.length, log: this.log.slice(-6) } }
}
