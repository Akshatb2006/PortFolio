import * as THREE from 'three'
import { makeTextTexture } from './textures.js'

// Mission markers (yellow cylinders), checkpoints (red), tokens (blue), with floating labels.
export class Markers {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group(); scene.add(this.group)
    this.items = new Map()
    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true)
    this.t = 0
  }

  add(id, { x, z, kind = 'mission', label = '', radius = 3.5, height = 6 }) {
    this.remove(id)
    const color = kind === 'mission' ? 0xf6c543 : kind === 'done' ? 0x5ad36a : kind === 'checkpoint' ? 0xff4a3d : 0x4fb6ff
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    const cyl = new THREE.Mesh(this.cylGeo, mat)
    cyl.scale.set(radius, height, radius); cyl.position.y = height / 2
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius * 1.05, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }))
    ring.position.y = 0.06
    const glow = new THREE.PointLight(color, 0, 18, 2); glow.position.y = 2
    g.add(cyl, ring, glow)
    let icon = null
    if (kind === 'token' || kind === 'pickup') {
      icon = new THREE.Mesh(kind === 'token' ? new THREE.OctahedronGeometry(0.8) : new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 }))
      icon.position.y = 1.6; icon.castShadow = true
      g.add(icon)
    }
    if (label) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeTextTexture([label], { w: 512, h: 128, bg: 'rgba(0,0,0,0.65)', fg: '#fff', border: null, font: 'bold 64px Anton, Impact, sans-serif' }), transparent: true, depthTest: false }))
      sprite.scale.set(8, 2, 1); sprite.position.y = height + 1.5
      g.add(sprite)
    }
    g.position.set(x, 0, z)
    this.group.add(g)
    this.items.set(id, { group: g, mat, glow, icon, kind, x, z, radius, cyl })
  }

  remove(id) { const it = this.items.get(id); if (it) { this.group.remove(it.group); this.items.delete(id) } }
  clearKind(kind) { for (const [id, it] of this.items) if (it.kind === kind) this.remove(id) }
  has(id) { return this.items.has(id) }

  update(dt, night) {
    this.t += dt
    for (const it of this.items.values()) {
      it.mat.opacity = 0.35 + Math.sin(this.t * 3) * 0.12
      it.glow.intensity = night * 40
      if (it.icon) { it.icon.rotation.y += dt * 2; it.icon.position.y = 1.6 + Math.sin(this.t * 2) * 0.25 }
      it.cyl.rotation.y += dt * 0.3
    }
  }

  // first marker id within radius of pos
  hit(pos, extra = 0) {
    for (const [id, it] of this.items) {
      if (Math.hypot(pos.x - it.x, pos.z - it.z) < it.radius + extra) return id
    }
    return null
  }
}
