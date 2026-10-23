import * as THREE from 'three'

// Particle explosions, smoke and sparks using a single Points cloud per effect type.
function makeSoftTexture(inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, inner); r.addColorStop(0.4, inner); r.addColorStop(1, outer)
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

class Pool {
  constructor(scene, max, { color, size, blending = THREE.NormalBlending, gravity = 0, drag = 0.98 }) {
    this.max = max; this.n = 0; this.gravity = gravity; this.drag = drag
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.sz = new Float32Array(max); this.col = new Float32Array(max * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1))
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1))
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1))
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeSoftTexture() }, uColor: { value: new THREE.Color(color) }, uScale: { value: innerHeight / 2 } },
      transparent: true, depthWrite: false, blending, vertexColors: true,
      vertexShader: `attribute float aSize, aAge, aLife; varying float vA; varying vec3 vColor; uniform float uScale; void main(){ vColor = color; float t = clamp(aAge / max(aLife, 0.001), 0.0, 1.0); vA = (1.0 - t) * step(aAge, aLife); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (1.0 + t * 1.5) * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uColor; varying vec3 vColor; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor * vColor, t.a * vA * 0.75); if (gl_FragColor.a < 0.01) discard; }`,
    })
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false
    scene.add(this.points)
    this.life.fill(0); this.age.fill(1)
  }
  emit(x, y, z, vx, vy, vz, life, size, tint = 1) {
    const i = this.n; this.n = (this.n + 1) % this.max
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.age[i] = 0; this.sz[i] = size
    this.col.set([tint, tint, tint], i * 3)
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) continue
      this.age[i] += dt
      this.vel[i * 3 + 1] += this.gravity * dt
      this.vel[i * 3] *= this.drag; this.vel[i * 3 + 1] *= this.drag; this.vel[i * 3 + 2] *= this.drag
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
    }
    const g = this.points.geometry
    g.attributes.position.needsUpdate = g.attributes.aAge.needsUpdate = g.attributes.aLife.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.color.needsUpdate = true
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.fire = new Pool(scene, 400, { color: 0xff7a1a, size: 2.2, blending: THREE.AdditiveBlending, gravity: 3, drag: 0.96 })
    this.smoke = new Pool(scene, 600, { color: 0x6a6a6a, size: 1.9, gravity: 1.0, drag: 0.98 })
    this.sparks = new Pool(scene, 300, { color: 0xffd080, size: 0.35, blending: THREE.AdditiveBlending, gravity: -12, drag: 0.99 })
    this.tyre = new Pool(scene, 400, { color: 0xdddddd, size: 1.0, gravity: 0.3, drag: 0.97 })
    this.flash = new THREE.PointLight(0xffa040, 0, 40, 2); scene.add(this.flash)
    this.flashT = 0
    this.debris = []
  }

  explosion(x, y, z) {
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI / 2, s = 4 + Math.random() * 9; this.fire.emit(x, y + 0.5, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 3, Math.sin(a) * Math.cos(b) * s, 0.5 + Math.random() * 0.5, 2 + Math.random() * 3, 0.8 + Math.random() * 0.4) }
    for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 5; this.smoke.emit(x + (Math.random() - 0.5), y + 1, z + (Math.random() - 0.5), Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 1.2 + Math.random() * 1.6, 1.5 + Math.random() * 2.5, 0.35 + Math.random() * 0.45) }
    for (let i = 0; i < 80; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI / 2, s = 8 + Math.random() * 14; this.sparks.emit(x, y + 0.5, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s, 0.6 + Math.random() * 0.8, 0.3 + Math.random() * 0.4) }
    this.flash.position.set(x, y + 2, z); this.flash.intensity = 800; this.flashT = 0.35
  }

  impact(x, y, z, strength) {
    const n = Math.min(30, Math.floor(strength * 2))
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * strength * 0.5; this.sparks.emit(x, y, z, Math.cos(a) * s, 1 + Math.random() * 4, Math.sin(a) * s, 0.3 + Math.random() * 0.4, 0.25) }
  }

  tyreSmoke(x, y, z, amount) {
    for (let i = 0; i < amount; i++) this.tyre.emit(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.6, 0.8 + Math.random() * 0.8, 0.6 + Math.random() * 0.3)
  }

  update(dt) {
    this.fire.update(dt); this.smoke.update(dt); this.sparks.update(dt); this.tyre.update(dt)
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, 800 * this.flashT / 0.35) } else this.flash.intensity = 0
  }
  resize() { const s = innerHeight / 2; for (const p of [this.fire, this.smoke, this.sparks, this.tyre]) p.mat.uniforms.uScale.value = s }
}
