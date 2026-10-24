// Development-only helpers for reproducible screenshots and metrics.
// Exposed as window.akshatDev; no effect on gameplay unless called.
import * as THREE from 'three'
import * as M from './CityMap.js'

export function installDevCapture(game) {
  const d2 = M.districtCenter(M.districts.find(d => d.id === 'downtown'))
  const pk = M.districtCenter(M.districts.find(d => d.id === 'park'))
  const pierX = M.blockCenter(3)
  const views = {
    skyline: { pos: [d2.x - 60, 10, d2.z + 130], look: [d2.x, 22, d2.z] },
    downtown: { pos: [M.blockCenter(3) + 6, 3.5, M.blockStart(1) + M.BLOCK + 12], look: [M.blockCenter(3) - 4, 9, M.blockStart(1) + M.BLOCK - 6] },
    residential: { pos: [M.roadCoord(1) + 3, 2.0, M.blockStart(5) + 30], look: [M.roadCoord(1) - 2, 4, M.blockStart(5) - 20] },
    pier: { pos: [pierX + 18, 5, M.WATER.z0 - 26], look: [pierX, 2, M.WATER.z0 + 14] },
  }
  // benchmark block (4,1) review views: establishing, pedestrian street, driving, plaza close-up
  const bx = M.blockStart(4), bz = M.blockStart(1), B = M.BLOCK
  Object.assign(views, {
    'bench-establishing': { pos: [bx - 52, 64, bz + 22], look: [bx + B / 2, 42, bz + B / 2] },
    'bench-street': { pos: [bx - 1.6, 1.7, bz + B + 2], look: [bx + 6, 7, bz + 6] },
    'bench-driving': { pos: [M.roadCoord(4) + 2, 2.6, bz - 22], look: [bx + 8, 6, bz + 14] },
    'bench-plaza': { pos: [bx + B / 2 - 0.6, 1.65, bz + B - 2.5], look: [bx + B / 2 + 0.3, 3.2, bz + B / 2 - 4] },
  })

  const api = {
    views: Object.keys(views),
    // park the camera at a fixed view (game stays paused in cinematic mode)
    view(name) {
      const v = views[name]; if (!v) throw new Error('unknown view ' + name)
      if (!game.started) { document.getElementById('btn-start').click(); game.endCinematic() }
      game.cine.on = true
      game.cinematicFrame = () => { game.camera.position.set(...v.pos); game.camera.lookAt(...v.look) }
      document.getElementById('hint')?.classList.add('hidden')
      return name
    },
    release() { game.cine.on = false; game.cinematicFrame = Object.getPrototypeOf(game).cinematicFrame.bind(game); game.rig.snapTo(game.target()) },
    // GPU ms (gl.finish timing), draw calls, triangles, memory for the current view
    metrics(frames = 8) {
      const gl = game.renderer.getContext()
      game.post.render(0.016, game.night); gl.finish()
      const t = performance.now()
      for (let i = 0; i < frames; i++) game.post.render(0.016, game.night)
      gl.finish()
      const gpuMs = +((performance.now() - t) / frames).toFixed(2)
      const info = game.renderer.info
      info.autoReset = false; info.reset(); game.post.render(0.016, game.night)
      const out = { gpuMs, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs.length, buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], dpr: game.dpr, night: +game.night.toFixed(2) }
      info.autoReset = true
      return out
    },
    // CPU frame time over N frames: average and p95
    async frameTimes(ms = 3000) {
      const t = []; let last = performance.now(); const end = last + ms
      await new Promise(res => { const raf = () => { const n = performance.now(); t.push(n - last); last = n; if (n < end) requestAnimationFrame(raf); else res() }; requestAnimationFrame(raf) })
      t.shift(); t.sort((a, b) => a - b)
      return { frames: t.length, avgMs: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(2), p95Ms: +t[Math.floor(t.length * 0.95)].toFixed(2) }
    },
    async all() {
      const out = {}
      for (const n of api.views) { api.view(n); await new Promise(r => setTimeout(r, 400)); out[n] = api.metrics() }
      return out
    },
    night(on) { game.nightTarget = on ? 1 : 0 },
    // gameplay diagnostics
    vehicles() { return game.vehicles.describe() },
    wanted() { return game.wanted.describe() },
    combat() { return game.combat.describe() },
    police() { return game.police.describe() },
    npcs() { const pp = game.target().pos; const near = game.peds.peds.filter(p => p.pos.distanceTo(pp) < 40).length; return { pedestrians: game.peds.peds.length, within40m: near, animating: game.peds.peds.filter(p => p.pos.distanceTo(pp) < 90).length, down: game.peds.peds.filter(p => p.down > 0).length, officers: game.police.units.filter(u => u.officer).length, hostiles: game.combat?.enemies?.length ?? 0 } },
    bodies() { const w = game.physics.world; let fixed = 0, dyn = 0, kin = 0; w.forEachRigidBody(b => { if (b.isFixed()) fixed++; else if (b.isKinematic()) kin++; else dyn++ }); let cols = 0; w.forEachCollider(() => cols++); return { bodies: w.bodies.len(), fixed, dynamic: dyn, kinematic: kin, colliders: cols } },
    where() { const p = game.target().pos; const d = M.districtAt(p.x, p.z); return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), district: d?.name, inVehicle: !!game.player.inVehicle, prompt: game.lastHold || null } },
    // hitch budget (docs/gameplay/ACCEPTANCE.md): every frame over 33 ms is logged with where it happened
    hitches(reset = false) { const h = hitch; const out = { frames: h.frames, over33: h.over33, over50: h.over50, over100: h.over100, worst: +h.worst.toFixed(1), last: h.log.slice(-10), withinBudget: h.over100 === 0 && h.over50 <= h.oneTimeAllowance }; if (reset) Object.assign(hitch, { frames: 0, over33: 0, over50: 0, over100: 0, worst: 0, log: [] }); return out },
  }
  // passive frame monitor (cheap: one comparison per frame); a hitch is a frame over 33 ms
  const hitch = { frames: 0, over33: 0, over50: 0, over100: 0, worst: 0, log: [], oneTimeAllowance: 3 }
  let last = performance.now()
  const watch = () => {
    const now = performance.now(), dt = now - last; last = now
    if (document.visibilityState === 'visible' && game.started && !game.ui.blocking) {
      hitch.frames++
      if (dt > hitch.worst) hitch.worst = dt
      if (dt > 33.4) {
        hitch.over33++; if (dt > 50) hitch.over50++; if (dt > 100) hitch.over100++
        const p = game.target().pos
        hitch.log.push({ ms: +dt.toFixed(1), at: game.interior?.name || M.districtAt(p.x, p.z)?.name || '?', mission: game.missions.active?.def.id || null, t: +(now / 1000).toFixed(1) })
        if (hitch.log.length > 50) hitch.log.shift()
      }
    }
    requestAnimationFrame(watch)
  }
  requestAnimationFrame(watch)
  window.akshatDev = api
  return api
}
