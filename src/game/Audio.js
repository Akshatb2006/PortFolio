// All audio is synthesised with WebAudio: no asset downloads, no licensing.
export class GameAudio {
  constructor() { this.ctx = null; this.enabled = true; this.started = false }

  start() {
    if (this.started) return
    this.started = true
    const C = window.AudioContext || window.webkitAudioContext
    this.ctx = new C()
    this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.5 : 0; this.master.connect(this.ctx.destination)
    // engine: two detuned saws through a lowpass
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0
    this.engineFilter = this.ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 400
    this.oscs = [55, 55.7].map(f => { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(this.engineFilter); o.start(); return o })
    this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master)
    // wind / ambience: filtered noise
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const noise = this.ctx.createBufferSource(); noise.buffer = buf; noise.loop = true
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 0.4
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.03
    noise.connect(nf); nf.connect(this.windGain); this.windGain.connect(this.master); noise.start()
    this.footGain = null
  }

  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.05); return this.enabled }

  engine(speed, throttle, occupied) {
    if (!this.ctx) return
    const s = Math.abs(speed)
    const rpm = occupied ? 50 + s * 4 + Math.abs(throttle) * 25 : 0
    const t = this.ctx.currentTime
    this.oscs[0].frequency.setTargetAtTime(rpm || 55, t, 0.08)
    this.oscs[1].frequency.setTargetAtTime((rpm || 55) * 1.01, t, 0.08)
    this.engineFilter.frequency.setTargetAtTime(250 + s * 20 + Math.abs(throttle) * 300, t, 0.1)
    this.engineGain.gain.setTargetAtTime(occupied ? 0.12 + Math.abs(throttle) * 0.1 : 0, t, 0.1)
    this.windGain.gain.setTargetAtTime(0.03 + s * 0.004, t, 0.2)
  }

  blip(freq = 880, dur = 0.08, type = 'square', vol = 0.25) {
    if (!this.ctx) return
    const o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(vol, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur)
  }

  checkpoint() { this.blip(660, 0.1); setTimeout(() => this.blip(990, 0.15), 90) }
  pickup() { this.blip(1200, 0.08, 'triangle'); setTimeout(() => this.blip(1600, 0.12, 'triangle'), 70) }
  crash(strength) { if (!this.ctx) return; this.blip(80 + Math.random() * 40, 0.25, 'sawtooth', Math.min(0.5, 0.1 + strength * 0.02)) }
  passed() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, i === 5 ? 0.6 : 0.22, 'triangle', 0.3), i * 130)) }
  failed() { [440, 370, 311, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.2), i * 220)) }
  ui() { this.blip(440, 0.05, 'sine', 0.15) }
  explosion() { if (!this.ctx) return; this.blip(50, 0.9, 'sawtooth', 0.6); this.blip(90, 0.5, 'square', 0.3); setTimeout(() => this.blip(35, 1.2, 'triangle', 0.5), 60) }
}
