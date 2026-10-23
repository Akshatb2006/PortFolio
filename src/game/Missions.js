// Mission state machine. Talks to the UI through callbacks so it stays testable.
export class Missions {
  constructor(defs, markers, ui, audio, save) {
    this.defs = defs
    this.markers = markers
    this.ui = ui
    this.audio = audio
    this.save = save
    this.active = null       // { def, index, collected:Set, timeLeft }
    this.placeMarkers()
  }

  isDone(id) { return this.save.data.missions.includes(id) }
  get doneCount() { return this.defs.filter(d => this.isDone(d.id)).length }

  placeMarkers() {
    for (const d of this.defs) this.markers.add('m:' + d.id, { x: d.marker.x, z: d.marker.z, kind: this.isDone(d.id) ? 'done' : 'mission', label: d.title })
  }

  // player stepped into a mission marker
  offer(id) {
    const def = this.defs.find(d => d.id === id)
    if (!def || this.active) return
    this.pending = def
    this.ui.dialogue(def.briefing, () => this.start(def), () => { this.pending = null })
  }

  start(def) {
    this.pending = null
    this.active = { def, index: 0, collected: new Set(), timeLeft: def.timeLimit || 0 }
    this.markers.remove('m:' + def.id)
    this.refreshPoints()
    this.ui.objective(def.objective)
    this.ui.timer(def.timeLimit ? def.timeLimit : null)
    this.ui.refreshMenu()
  }

  refreshPoints() {
    this.markers.clearKind('checkpoint'); this.markers.clearKind('pickup')
    const a = this.active; if (!a) return
    if (a.def.type === 'route') {
      const p = a.def.points[a.index]
      if (p) this.markers.add('p:' + a.index, { x: p.x, z: p.z, kind: 'checkpoint', label: p.label, radius: p.radius || 3.5 })
    } else {
      a.def.points.forEach((p, i) => { if (!a.collected.has(i)) this.markers.add('p:' + i, { x: p.x, z: p.z, kind: 'pickup', label: p.label, radius: p.radius || 3, height: 3 }) })
    }
  }

  // current objective position for the radar
  target() {
    const a = this.active; if (!a) return null
    if (a.def.type === 'route') return a.def.points[a.index] || null
    const rest = a.def.points.filter((_, i) => !a.collected.has(i))
    return rest.length ? rest : null
  }

  update(dt, hitId, inVehicle) {
    const a = this.active; if (!a) return
    if (a.def.timeLimit) {
      a.timeLeft -= dt
      this.ui.timer(a.timeLeft)
      if (a.timeLeft <= 0) return this.fail('OUT OF TIME')
    }
    if (!hitId || !hitId.startsWith('p:')) return
    const i = parseInt(hitId.slice(2))
    const p = a.def.points[i]
    if (!p) return
    if (a.def.onFoot && inVehicle) { this.ui.hint('Get out of the car (E) to reach this one.'); return }
    if (a.def.needsVehicle && !inVehicle) { this.ui.hint('You need a car for this run.'); return }
    if (a.def.type === 'route') { if (i !== a.index) return; a.index++ } else a.collected.add(i)
    this.markers.remove(hitId)
    const done = a.def.type === 'route' ? a.index >= a.def.points.length : a.collected.size >= a.def.points.length
    const after = () => { if (done) this.complete(); else { this.refreshPoints(); this.ui.objective(a.def.objective + (a.def.type === 'collect' ? ` <strong>${a.collected.size}/${a.def.points.length}</strong>` : ` <strong>${a.index}/${a.def.points.length}</strong>`)) } }
    if (p.card) { this.audio.pickup(); this.ui.card(p.card, after) } else { this.audio.checkpoint(); after() }
  }

  complete() {
    const def = this.active.def
    this.active = null
    this.markers.clearKind('checkpoint'); this.markers.clearKind('pickup')
    if (!this.isDone(def.id)) { this.save.data.missions.push(def.id); this.save.write() }
    this.markers.add('m:' + def.id, { x: def.marker.x, z: def.marker.z, kind: 'done', label: def.title })
    this.ui.objective(null); this.ui.timer(null)
    this.audio.passed()
    this.ui.banner('MISSION PASSED!', def.passedText, false)
    this.ui.refreshHud(); this.ui.refreshMenu()
    if (this.doneCount === this.defs.length) setTimeout(() => this.ui.banner('CITY COMPLETE', '100% — YOU KNOW EVERYTHING ABOUT ME NOW', false), 4200)
  }

  fail(reason) {
    const def = this.active.def
    this.active = null
    this.markers.clearKind('checkpoint'); this.markers.clearKind('pickup')
    this.markers.add('m:' + def.id, { x: def.marker.x, z: def.marker.z, kind: 'mission', label: def.title })
    this.ui.objective(null); this.ui.timer(null)
    this.audio.failed()
    this.ui.banner('MISSION FAILED', reason, true)
    this.ui.refreshMenu()
  }

  abort() { if (this.active) this.fail('MISSION ABANDONED') }
}
