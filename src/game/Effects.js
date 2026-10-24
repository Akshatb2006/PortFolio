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

// irregular blood splat for ground decals (one shared texture)
function splatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  g.fillStyle = '#fff'
  g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.fill()
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 26 + r() * 26, s = 6 + r() * 12; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill() }
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = 50 + r() * 10; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + r() * 3, 0, Math.PI * 2); g.fill() }
  const t = new THREE.CanvasTexture(c); return t
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
    // blood: a droplet burst (particles) and ground pools (a fixed set of decals reused oldest-first)
    this.bloodDrops = new Pool(scene, 240, { color: 0x7a0606, size: 0.16, gravity: -9.8, drag: 0.985 })
    const splat = splatTexture()
    this.pools = Array.from({ length: 16 }, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a0303, roughness: 0.25, metalness: 0.1, alphaMap: splat, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
      // kept visible but parked far underground when unused, so the boot-time shader precompile covers it
      m.position.y = -500; m.renderOrder = 1; m.receiveShadow = true; scene.add(m)
      return { m, age: 0, size: 1, life: 0 }
    })
    this.poolNext = 0
  }

  // a short spray of droplets in the direction of the hit (dx, dz), amount 0..1
  blood(x, y, z, dx = 0, dz = 0, amount = 0.5) {
    const n = Math.round(10 + amount * 30)
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 2.2 * (0.5 + amount); this.bloodDrops.emit(x, y, z, dx * (1 + Math.random() * 2) + Math.cos(a) * s, 0.8 + Math.random() * 2.5, dz * (1 + Math.random() * 2) + Math.sin(a) * s, 0.45 + Math.random() * 0.4, 0.1 + Math.random() * 0.12, 0.7 + Math.random() * 0.3) }
  }

  // a pool that spreads on the ground under a body and fades after a while
  bloodPool(x, y, z, size = 1.6, life = 45) {
    const p = this.pools[this.poolNext]; this.poolNext = (this.poolNext + 1) % this.pools.length
    p.m.position.set(x, y + 0.025, z); p.m.rotation.y = Math.random() * Math.PI * 2
    p.size = size; p.age = 0; p.life = life; p.m.scale.setScalar(0.01); p.m.material.opacity = 0.92
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
    this.fire.update(dt); this.smoke.update(dt); this.sparks.update(dt); this.tyre.update(dt); this.bloodDrops.update(dt)
    for (const p of this.pools) {
      if (p.age >= p.life) continue
      p.age += dt
      p.m.scale.setScalar(p.size * Math.min(1, 0.25 + p.age / 2.5))                       // spreads over ~2 s
      const fade = p.life - p.age; if (fade < 5) p.m.material.opacity = Math.max(0, fade / 5) * 0.92
      if (p.age >= p.life) p.m.position.y = -500
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, 800 * this.flashT / 0.35) } else this.flash.intensity = 0
  }
  resize() { const s = innerHeight / 2; for (const p of [this.fire, this.smoke, this.sparks, this.tyre, this.bloodDrops]) p.mat.uniforms.uScale.value = s }
}
