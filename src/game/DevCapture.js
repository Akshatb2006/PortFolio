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
  }
  window.akshatDev = api
  return api
}
