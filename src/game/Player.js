import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

export const CHARACTER_HEIGHT = 1.8

export function makeSoldier(gltf, tint = null) {
  const model = SkeletonUtils.clone(gltf.scene)
  // the three.js Soldier is authored in metres (~1.8 m tall) and faces -z
  const wrap = new THREE.Group()
  const inner = new THREE.Group(); inner.add(model); inner.rotation.y = Math.PI
  wrap.add(inner)
  model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (tint) { o.material = o.material.clone(); o.material.color.multiply(tint) } } })
  const mixer = new THREE.AnimationMixer(model)
  const actions = {}
  for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play(); actions[clip.name] = a }
  return { wrap, inner, mixer, actions }
}

export function blendLocomotion(actions, speed, dt, sprintSpeed) {
  // weights: Idle < 0.3 m/s, Walk up to 3 m/s, Run above
  const w = { Idle: 0, Walk: 0, Run: 0 }
  if (speed < 0.3) w.Idle = 1
  else if (speed < 3) { const t = (speed - 0.3) / 2.7; w.Idle = 1 - t; w.Walk = t }
  else { const t = Math.min(1, (speed - 3) / 3.5); w.Walk = 1 - t; w.Run = t }
  for (const k of ['Idle', 'Walk', 'Run']) { const a = actions[k]; if (!a) continue; a.setEffectiveWeight(a.getEffectiveWeight() + (w[k] - a.getEffectiveWeight()) * Math.min(1, dt * 10)) }
  if (actions.Walk) actions.Walk.timeScale = THREE.MathUtils.clamp(speed / 1.8, 0.6, 1.8)
  if (actions.Run) actions.Run.timeScale = THREE.MathUtils.clamp(speed / 6, 0.8, 1.4)
}

// Player on foot: Rapier kinematic character controller + animated Soldier.
export class Player {
  constructor(scene, physics, assets, { x, z } = {}) {
    this.physics = physics
    const R = physics.R, world = physics.world
    const s = makeSoldier(assets.soldier)
    this.mesh = s.wrap; this.mixer = s.mixer; this.actions = s.actions
    scene.add(this.mesh)
    this.pos = new THREE.Vector3(x, 0, z)
    this.heading = 0
    this.radius = 0.4
    this.speed = 0
    this.vy = 0
    this.inVehicle = null
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z))
    this.collider = world.createCollider(R.ColliderDesc.capsule(0.55, 0.35), this.body)
    this.ctrl = world.createCharacterController(0.04)
    this.ctrl.enableAutostep(0.45, 0.25, true)
    this.ctrl.enableSnapToGround(0.4)
    this.ctrl.setApplyImpulsesToDynamicBodies(true)
    this.ctrl.setCharacterMass(85)
    this.ctrl.setSlideEnabled(true)
    this.sync()
  }

  setActive(on) { this.mesh.visible = on; this.collider.setEnabled(on) }

  update(dt, moveDir, sprint) {
    const len = Math.min(1, moveDir.length())
    const max = sprint ? 8.5 : 4.6
    const target = len * max
    this.speed += (target - this.speed) * Math.min(1, dt * 8)
    if (len > 0.05) {
      const want = Math.atan2(moveDir.x, moveDir.y)
      let d = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading))
      this.heading += d * Math.min(1, dt * 12)
    }
    this.vy = Math.max(-20, this.vy - 15 * dt)
    const desired = { x: Math.sin(this.heading) * this.speed * dt, y: this.vy * dt, z: Math.cos(this.heading) * this.speed * dt }
    this.ctrl.computeColliderMovement(this.collider, desired)
    const mv = this.ctrl.computedMovement()
    const t = this.body.translation()
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z })
    if (this.ctrl.computedGrounded()) this.vy = 0
    this.mixer.update(dt)
    blendLocomotion(this.actions, this.speed, dt)
    this.sync()
  }

  sync() {
    const t = this.body.translation()
    this.pos.set(t.x, t.y - 0.9, t.z)
    this.mesh.position.copy(this.pos)
    this.mesh.rotation.y = this.heading
  }

  teleport(x, z, heading) { this.body.setNextKinematicTranslation({ x, y: 1.0, z }); this.body.setTranslation({ x, y: 1.0, z }, true); if (heading != null) this.heading = heading; this.sync() }
}
