import * as THREE from 'three'

// Chase (third person) and first person camera with smooth transitions.
export class CameraRig {
  constructor(camera) {
    this.camera = camera
    this.mode = 'third'   // 'third' | 'first' | 'cinematic'
    this.yaw = 0          // orbit offset applied on top of target heading
    this.pitch = 0.32
    this.pos = new THREE.Vector3()
    this.look = new THREE.Vector3()
    this.idle = 0
    this.shake = 0
  }

  toggle() { this.mode = this.mode === 'third' ? 'first' : 'third'; this.yaw = 0 }

  update(dt, target, input, moving) {
    // target: { pos, heading, isCar, speed }
    const sens = 0.0035
    if (this.mode === 'first') {
      this.yaw -= input.look.dx * sens
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.look.dy * sens, -0.6, 0.6)
      // first person yaw is relative to heading; when driving, snap back to forward slowly
      if (target.isCar) this.yaw += (0 - this.yaw) * Math.min(1, dt * 1.5)
      const h = target.heading + this.yaw
      const eye = target.isCar ? new THREE.Vector3(0.35, 1.05, -0.2) : new THREE.Vector3(0, 1.68, 0.15)
      const p = eye.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), target.heading).add(target.pos)
      this.camera.position.copy(p)
      const dir = new THREE.Vector3(Math.sin(h) * Math.cos(this.pitch), -Math.sin(this.pitch) * (target.isCar ? 0.3 : 1) , Math.cos(h) * Math.cos(this.pitch))
      this.camera.lookAt(p.clone().add(dir))
      return
    }
    // third person
    if (Math.abs(input.look.dx) > 0) { this.yaw -= input.look.dx * sens; this.idle = 0 } else this.idle += dt
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.look.dy * sens * 0.6, 0.12, 0.9)
    if (this.idle > 1.2 && moving) this.yaw += (0 - this.yaw) * Math.min(1, dt * 2)
    const dist = target.isCar ? 8.5 + Math.min(4, Math.abs(target.speed) * 0.08) : 4.6
    const height = target.isCar ? 2.6 : 1.9
    const h = target.heading + this.yaw
    const desired = new THREE.Vector3(
      target.pos.x - Math.sin(h) * dist * Math.cos(this.pitch),
      target.pos.y + height + dist * Math.sin(this.pitch),
      target.pos.z - Math.cos(h) * dist * Math.cos(this.pitch))
    const k = Math.min(1, dt * (target.isCar ? 5 : 8))
    if (this.collide) desired.copy(this.collide(new THREE.Vector3(target.pos.x, target.pos.y + 1.5, target.pos.z), desired))
    if (this.pos.lengthSq() === 0) this.pos.copy(desired)
    this.pos.lerp(desired, k)
    const lookAt = new THREE.Vector3(target.pos.x, target.pos.y + (target.isCar ? 1.2 : 1.4), target.pos.z)
    if (target.isCar) lookAt.add(new THREE.Vector3(Math.sin(target.heading), 0, Math.cos(target.heading)).multiplyScalar(Math.min(3, Math.abs(target.speed) * 0.08)))
    this.look.lerp(lookAt, Math.min(1, dt * 10))
    if (this.shake > 0) { this.pos.x += (Math.random() - 0.5) * this.shake; this.pos.y += (Math.random() - 0.5) * this.shake; this.shake *= 0.85 }
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
    this.camera.fov += ((target.isCar ? 60 + Math.min(14, Math.abs(target.speed) * 0.3) : 58) - this.camera.fov) * Math.min(1, dt * 3)
    this.camera.updateProjectionMatrix()
  }

  snapTo(target) { this.pos.set(0, 0, 0); this.update(1, target, { look: { dx: 0, dy: 0 } }, false) }
}
