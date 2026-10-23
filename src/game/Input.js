// Unified input: keyboard + touch. Exposes continuous axes and edge-triggered actions.
export class Input {
  constructor() {
    this.keys = new Set()
    this.axis = { x: 0, y: 0 }      // steer / move
    this.look = { dx: 0, dy: 0 }
    this.handbrake = false
    this.sprint = false
    this.pressed = new Set()         // edge-triggered this frame
    this.touch = { x: 0, y: 0, active: false }
    this.enabled = true
    this.isTouch = matchMedia('(pointer: coarse)').matches

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      const k = e.key.toLowerCase()
      if (!this.keys.has(k)) this.pressed.add(k)
      this.keys.add(k)
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault()
    })
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    addEventListener('blur', () => this.keys.clear())

    // mouse drag to look
    let dragging = false, lx = 0, ly = 0
    const canvas = document.getElementById('game')
    canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY })
    addEventListener('mouseup', () => dragging = false)
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.look.dx += e.movementX; this.look.dy += e.movementY; return }
      if (!dragging) return
      this.look.dx += e.clientX - lx; this.look.dy += e.clientY - ly; lx = e.clientX; ly = e.clientY
    })

    this.setupTouch()
  }

  setupTouch() {
    const wrap = document.getElementById('touch')
    if (!this.isTouch) return
    wrap.classList.remove('hidden')
    // buttons
    const held = {}
    wrap.querySelectorAll('.touch-btn').forEach((b) => {
      const key = b.dataset.key
      const on = (e) => { e.preventDefault(); held[key] = true; b.classList.add('active'); if (key === 'interact' || key === 'camera') this.pressed.add(key) }
      const off = (e) => { e.preventDefault(); held[key] = false; b.classList.remove('active') }
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off)
    })
    this.touchHeld = held
    // joystick
    const stick = document.getElementById('stick'), knob = document.getElementById('stick-knob')
    let id = null, cx = 0, cy = 0
    const R = 48
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; id = t.identifier
      const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2
      e.preventDefault()
    }, { passive: false })
    const move = (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        let dx = t.clientX - cx, dy = t.clientY - cy
        const len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len }
        knob.style.transform = `translate(${dx}px, ${dy}px)`
        this.touch.x = dx / R; this.touch.y = -dy / R; this.touch.active = true
        e.preventDefault()
      }
    }
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; knob.style.transform = ''; this.touch.x = this.touch.y = 0; this.touch.active = false } }
    addEventListener('touchmove', move, { passive: false }); addEventListener('touchend', end); addEventListener('touchcancel', end)
    // look: drag on right half of screen (not on buttons)
    let lid = null, lx = 0, ly = 0
    const canvas = document.getElementById('game')
    canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; if (t.clientX > innerWidth * 0.5 && lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY } }, { passive: true })
    canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) { this.look.dx += (t.clientX - lx) * 1.5; this.look.dy += (t.clientY - ly) * 1.5; lx = t.clientX; ly = t.clientY } }, { passive: true })
    const lend = (e) => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null }
    canvas.addEventListener('touchend', lend); canvas.addEventListener('touchcancel', lend)
  }

  key(...ks) { return ks.some(k => this.keys.has(k)) }

  update() {
    if (!this.enabled) { this.axis.x = this.axis.y = 0; this.handbrake = false; this.pressed.clear(); this.look.dx = this.look.dy = 0; return }
    let x = 0, y = 0
    if (this.key('a', 'arrowleft')) x -= 1
    if (this.key('d', 'arrowright')) x += 1
    if (this.key('w', 'arrowup')) y += 1
    if (this.key('s', 'arrowdown')) y -= 1
    const h = this.touchHeld || {}
    if (h.up) y += 1
    if (h.brake) y -= 1
    if (this.touch.active) { x += this.touch.x; y += this.touch.y }
    this.axis.x = Math.max(-1, Math.min(1, x)); this.axis.y = Math.max(-1, Math.min(1, y))
    this.handbrake = this.key(' ') || !!h.handbrake
    this.sprint = this.key('shift') || !!h.handbrake
  }

  // call at end of frame
  flush() { this.pressed.clear(); this.look.dx = 0; this.look.dy = 0 }
  justPressed(...ks) { return ks.some(k => this.pressed.has(k)) }
}
