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
  for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0); a.play(); actions[clip.name] = a }
  actions.__gait = measureGait(gltf)
  // evaluate once so the skeleton leaves the bind (T) pose before the first render
  mixer.update(0)
  return { wrap, inner, mixer, actions }
}

// Natural ground speed of a rig's Walk and Run clips, measured once from the foot bone: the speed at which
// the planted foot moves backwards. Playing a clip at movingSpeed / naturalSpeed keeps feet from sliding.
const gaitCache = new WeakMap()
// Left-foot bone across the rigs we use: Mixamo "mixamorig:LeftFoot" (Soldier), Quaternius "Foot.L",
// Unreal-style "foot_l". Compared with separators removed and case ignored.
export function isLeftFootBone(name) {
  const n = name.replace(/[^A-Za-z]/g, '').toLowerCase()
  return n.endsWith('leftfoot') || n === 'footl'
}

// clipNames maps the roles Walk / Run to the rig's own clip names (defaults: same names).
export function measureGait(gltf, clipNames = { Walk: 'Walk', Run: 'Run' }) {
  if (gaitCache.has(gltf)) return gaitCache.get(gltf)
  const gait = { Walk: 1.5, Run: 4.0 }
  const model = SkeletonUtils.clone(gltf.scene), mixer = new THREE.AnimationMixer(model)
  let foot = null
  model.traverse(o => { if (!foot && o.isBone && isLeftFootBone(o.name)) foot = o })
  for (const name of ['Walk', 'Run']) {
    const clip = gltf.animations.find(c => c.name === clipNames[name])
    if (!clip || !foot) continue
    mixer.stopAllAction(); mixer.clipAction(clip).reset().play()
    const N = 120, pts = []
    for (let i = 0; i <= N; i++) { mixer.setTime(clip.duration * i / N); model.updateMatrixWorld(true); const p = foot.getWorldPosition(new THREE.Vector3()); pts.push(p) }
    const minY = Math.min(...pts.map(p => p.y))
    let dist = 0, time = 0
    for (let i = 1; i <= N; i++) if (pts[i].y < minY + 0.03 && pts[i - 1].y < minY + 0.03) { dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); time += clip.duration / N }
    if (time > 0) gait[name] = dist / time
  }
  gaitCache.set(gltf, gait)
  return gait
}

export function blendLocomotion(actions, speed, dt) {
  const gait = actions.__gait || { Walk: 1.5, Run: 4.0 }
  // Commit to the walk early (idle only below 0.5 m/s); half-blended idle + walk was the main cause of
  // "sliding": legs made half strides while the body moved at full speed.
  const w = { Idle: 0, Walk: 0, Run: 0 }
  const runFrom = gait.Walk * 1.35, runFull = gait.Run * 0.9
  if (speed < 0.5) { const t = speed / 0.5; w.Idle = 1 - t; w.Walk = t }
  else if (speed < runFrom) w.Walk = 1
  else { const t = Math.min(1, (speed - runFrom) / Math.max(0.1, runFull - runFrom)); w.Walk = 1 - t; w.Run = t }
  for (const k of ['Idle', 'Walk', 'Run']) { const a = actions[k]; if (!a) continue; a.setEffectiveWeight(a.getEffectiveWeight() + (w[k] - a.getEffectiveWeight()) * Math.min(1, dt * 10)) }
  // playback rate = moving speed / clip's natural ground speed, so planted feet stay planted
  if (actions.Walk) actions.Walk.timeScale = THREE.MathUtils.clamp(Math.max(speed, 0.5) / gait.Walk, 0.45, 1.8)
  if (actions.Run) actions.Run.timeScale = THREE.MathUtils.clamp(speed / gait.Run, 0.6, 2.2)
}

// Seated pose without a sitting clip: aim each limb bone (thigh, shin, upper arm, forearm) along a direction
// given in the character's own frame (+z forward, +y up, +x the character's left). Works for any rig whose
// bones match these names (Mixamo "LeftUpLeg", Quaternius "UpperLeg.L", Unreal "thigh_l" ...).
const SEAT_CHAIN = [
  // [bone names, child names (for the bone's direction), target direction]
  [['leftupleg', 'upperlegl', 'thighl'], ['leftleg', 'lowerlegl', 'calfl'], [0.12, 0.12, 1]],
  [['rightupleg', 'upperlegr', 'thighr'], ['rightleg', 'lowerlegr', 'calfr'], [-0.12, 0.12, 1]],
  [['leftleg', 'lowerlegl', 'calfl'], ['leftfoot', 'footl'], [0.05, -0.55, 1]],
  [['rightleg', 'lowerlegr', 'calfr'], ['rightfoot', 'footr'], [-0.05, -0.55, 1]],
  [['leftarm', 'upperarml'], ['leftforearm', 'lowerarml'], [0.1, -0.75, 0.6]],
  [['rightarm', 'upperarmr'], ['rightforearm', 'lowerarmr'], [-0.1, -0.75, 0.6]],
  [['leftforearm', 'lowerarml'], ['lefthand', 'wristl', 'handl'], [-0.2, 0.1, 1]],
  [['rightforearm', 'lowerarmr'], ['righthand', 'wristr', 'handr'], [0.2, 0.1, 1]],
]
const boneKey = n => n.replace(/[^A-Za-z]/g, '').toLowerCase().replace(/^mixamorig/, '')
export function applySeatPose(wrap) {
  const bones = {}; wrap.traverse(o => { if (o.isBone) bones[boneKey(o.name)] ??= o })
  const find = names => names.map(n => bones[n]).find(Boolean)
  const q = new THREE.Quaternion(), wq = new THREE.Quaternion(), pq = new THREE.Quaternion()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), t = new THREE.Vector3()
  // rigs whose feet are not children of the shins (Quaternius IK rig): remember where each foot sits on its shin
  wrap.updateMatrixWorld(true)
  const loose = [['lowerlegl', 'footl'], ['lowerlegr', 'footr']].map(([s, f]) => [bones[s], bones[f]]).filter(([s, f]) => s && f && f.parent !== s)
    .map(([shin, foot]) => ({ shin, foot, off: shin.worldToLocal(foot.getWorldPosition(new THREE.Vector3())) }))
  for (const [names, childNames, dir] of SEAT_CHAIN) {
    const bone = find(names), child = find(childNames); if (!bone || !child) continue
    wrap.updateMatrixWorld(true)
    bone.getWorldPosition(a); child.getWorldPosition(b); d.subVectors(b, a).normalize()
    t.set(...dir).normalize().transformDirection(wrap.matrixWorld)
    q.setFromUnitVectors(d, t)                                   // world-space swing
    bone.getWorldQuaternion(wq); bone.parent.getWorldQuaternion(pq)
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)))    // back to the bone's local space
  }
  wrap.updateMatrixWorld(true)
  for (const l of loose) { l.foot.position.copy(l.foot.parent.worldToLocal(l.shin.localToWorld(l.off.clone()))); l.foot.updateMatrixWorld(true) }
}

// Player on foot: Rapier kinematic character controller + animated Soldier.
export class Player {
  // character: optional civilian { gltf, make, blend, FootLock, ankleMins } (from Characters.js); without it the
  // Soldier fallback is used
  constructor(scene, physics, assets, { x, z } = {}, character = null) {
    this.physics = physics
    const R = physics.R, world = physics.world
    const s = character ? character.make(character.gltf) : makeSoldier(assets.soldier)
    this.mesh = s.wrap; this.mixer = s.mixer; this.actions = s.actions
    this.civ = character; this.ch = character ? s : null   // ch: the civilian character (action layer, clips)
    if (character) this.footLock = new character.FootLock(s.wrap, s.model, character.ankleMins(character.gltf))
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
    // 0.1 m: larger snap distances overshoot and bury the capsule about 16 cm into the ground (measured)
    this.ctrl.enableSnapToGround(0.1)
    this.ctrl.setApplyImpulsesToDynamicBodies(true)
    this.ctrl.setCharacterMass(85)
    this.ctrl.setSlideEnabled(true)
    this.teleport(x, z)   // start standing on the real ground (sidewalk slabs are 0.18 m high)
  }

  setActive(on) { this.mesh.visible = on; this.collider.setEnabled(on) }

  // called after the physics step and sync(), so planted feet are pinned at the final position of the frame
  afterSync(dt) {
    if (!this.footLock || this.inVehicle) return
    this.footLock.update(dt, { Walk: this.actions.Walk.getEffectiveWeight(), Run: this.actions.Run.getEffectiveWeight() }, Math.abs(this.speed) > 0.3 && (this.actions.__lw || 0) < 0.5)
  }

  // Sit in a vehicle: the model rides in the driver's seat (visual only; the collider stays disabled).
  // seat = local position of the hips in the vehicle mesh. Leaving re-parents to the scene; the next
  // update() lets the animation mixer restore every bone.
  seatIn(vehicleMesh, seat = new THREE.Vector3(0.36, 0.48, -0.3)) {
    this.collider.setEnabled(false)
    this.scene ??= this.mesh.parent
    for (const k of ['Idle', 'Walk', 'Run']) if (this.actions[k]) { this.actions[k].setEffectiveWeight(k === 'Idle' ? 1 : 0); this.actions[k].timeScale = 1 }
    this.mixer.update(0)
    vehicleMesh.add(this.mesh)
    this.mesh.position.set(0, 0, 0); this.mesh.rotation.set(0, 0, 0)
    applySeatPose(this.mesh)
    // move the whole figure so its hips land on the seat
    let hips = null; this.mesh.traverse(o => { if (!hips && o.isBone && /hips$/.test(boneKey(o.name))) hips = o })
    const h = vehicleMesh.worldToLocal(hips.getWorldPosition(new THREE.Vector3()))
    this.mesh.position.set(seat.x - h.x, seat.y - h.y, seat.z - h.z)
    this.mesh.visible = true
  }

  unseat() { if (this.scene && this.mesh.parent !== this.scene) this.scene.add(this.mesh); this.mesh.rotation.set(0, 0, 0); this.mixer.update(0) }   // re-evaluate the clips so the seated bone overrides are gone at once

  // Tank-style on-foot control: turn = left/right (-1..1), move = forward/back (-1..1).
  update(dt, turn, move, sprint) {
    const TURN_RATE = 2.2   // rad/s at full input (about 126 deg/s)
    this.turnRate = (this.turnRate || 0) + (turn * TURN_RATE - (this.turnRate || 0)) * Math.min(1, dt * 10)
    this.heading -= this.turnRate * dt   // decreasing heading turns toward the screen's right
    const max = (move >= 0 ? (sprint ? 8.5 : 4.6) : 1.8) * (this.moveScale ?? 1)   // walking backwards is slow; attacks slow you down
    let target = THREE.MathUtils.clamp(move, -1, 1) * max
    if (this.force?.t > 0) { this.force.t -= dt; target = this.force.speed }      // dodge roll: carried forward
    this.speed += (target - this.speed) * Math.min(1, dt * 8)
    this.vy = Math.max(-20, this.vy - 15 * dt)
    const desired = { x: Math.sin(this.heading) * this.speed * dt, y: this.vy * dt, z: Math.cos(this.heading) * this.speed * dt }
    this.ctrl.computeColliderMovement(this.collider, desired)
    const mv = this.ctrl.computedMovement()
    const t = this.body.translation()
    this.body.setNextKinematicTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z })
    if (this.ctrl.computedGrounded()) this.vy = 0
    this.mixer.update(dt)
    if (this.civ) { this.civ.layer(this.ch, dt); this.civ.blend(this.actions, Math.abs(this.speed), dt) }
    else blendLocomotion(this.actions, Math.abs(this.speed), dt)
    // walking backwards: play the gait clips in reverse
    if (this.speed < -0.05) for (const k of ['Walk', 'Run']) if (this.actions[k]) this.actions[k].timeScale = -Math.abs(this.actions[k].timeScale)
    this.sync()
  }

  sync() {
    const t = this.body.translation()
    this.pos.set(t.x, t.y - 0.9, t.z)
    this.mesh.position.copy(this.pos)
    this.mesh.rotation.y = this.heading
  }

  // stand on whatever static ground is below (road, sidewalk slab, interior floor), not at a fixed height
  teleport(x, z, heading) {
    const y = this.physics.groundAt(x, z, this.collider) + 0.95
    this.body.setNextKinematicTranslation({ x, y, z }); this.body.setTranslation({ x, y, z }, true); this.vy = 0
    if (heading != null) this.heading = heading; this.sync()
  }
}
