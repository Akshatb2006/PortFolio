// Test harness (pasted into the console of http://localhost:5173/): replaces the page with a same-origin iframe
// of the game, so the viewport can be set to exact CSS sizes and resize events fire like a real window.
document.body.innerHTML = ''
document.body.style.cssText = 'margin:0;overflow:auto;background:#000'
const f = document.createElement('iframe')
f.src = '/?harness=' + Date.now()
f.style.cssText = 'border:0;display:block;width:960px;height:540px'
document.body.appendChild(f)
window.__f = f
window.__size = (w, h) => new Promise(r => { f.style.width = w + 'px'; f.style.height = h + 'px'; setTimeout(r, 900) })
window.__G = () => f.contentWindow.game
window.__D = () => f.contentWindow.akshatDev
window.__state = () => {
  const g = __G(), c = g.post.composer, gl = g.renderer.getContext(), s = c.passes.find(p => p.constructor.name === 'SMAAPass')
  return { css: [f.contentWindow.innerWidth, f.contentWindow.innerHeight], dpr: +g.dpr.toFixed(2), buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], composerRT: [c.renderTarget1.width, c.renderTarget1.height], composerPR: +c._pixelRatio.toFixed(2), smaa: s ? [s._edgesRT.width, s._edgesRT.height] : null, aspectOk: Math.abs(g.camera.aspect - f.contentWindow.innerWidth / f.contentWindow.innerHeight) < 1e-3, gpuMem: { geo: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures } }
}
'harness ready'
