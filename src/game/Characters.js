import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { measureGait, isLeftFootBone } from './Player.js'
// Rig description for Quaternius "Ultimate Modular Men/Women" glTF characters (verified on Casual_2.gltf:
// one skin, 62 joints, Foot.L / Foot.R, 24 clips incl. Idle / Walk / Run; 1.86 m tall at scale 1).
export const QUATERNIUS_RIG = {
  clips: { Idle: 'Idle', Walk: 'Walk', Run: 'Run' },
  facing: 0,      // yaw that makes the model face +z (the game's heading-0 direction); 0 = authored facing +z
  scale: 1,
}

// Generic version of makeSoldier(): explicit clip-role map and facing, and materials stay shared with the
// source glTF (SkeletonUtils.clone keeps material references) instead of being cloned per character.
export function makeCharacter(gltf, rig = QUATERNIUS_RIG) {
  const model = SkeletonUtils.clone(gltf.scene)
  model.scale.setScalar(rig.scale)
  const wrap = new THREE.Group()
  const inner = new THREE.Group(); inner.add(model); inner.rotation.y = rig.facing
  wrap.add(inner)
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false } })
  const mixer = new THREE.AnimationMixer(model)
  const actions = {}
  for (const [role, name] of Object.entries(rig.clips)) {
    const clip = gltf.animations.find(c => c.name === name)
    if (!clip) { console.warn('[civilian] missing clip', name); continue }
    const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(role === 'Idle' ? 1 : 0); a.play(); actions[role] = a
  }
  actions.__gait = measureGait(gltf, rig.clips)
  actions.__w = { Idle: 1, Walk: 0, Run: 0 }; actions.__lw = 0
  mixer.update(0)   // leave the bind pose before the first render
  const clips = {}; for (const c of gltf.animations) clips[c.name] = c
  return { wrap, inner, model, mixer, actions, clips, layer: null }
}

// Action layer on top of locomotion: one-shots (punch, hit reaction, roll) and loops (dance, sit, talk).
// Locomotion keeps its own target weights (actions.__w); the final weights are scaled by (1 - layer weight),
// so the total always stays 1 and the rig never blends toward its bind pose.
export function playAction(s, name, { loop = false, fade = 0.12, timeScale = 1, hold = false, onDone = null, at = 0 } = {}) {
  const clip = s.clips?.[name]; if (!clip) return false
  const a = s.mixer.clipAction(clip)
  if (s.layer && s.layer.action !== a) { s.layer.action.stop(); s.layer.action.setEffectiveWeight(0) }
  a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop
  a.timeScale = timeScale; a.enabled = true; a.time = at; a.play()
  const w = s.layer && s.layer.action === a ? s.layer.w : (s.layer ? s.layer.w : 0)
  a.setEffectiveWeight(w)
  s.layer = { action: a, name, w, target: 1, fade, loop, hold, onDone, t: 0, dur: (clip.duration - at) / timeScale }
  return true
}
export function stopAction(s, fade = 0.18) { if (s.layer) { s.layer.target = 0; s.layer.fade = fade; s.layer.hold = false } }
// advance the layer; returns its weight. Call before the locomotion blend each frame.
export function updateLayer(s, dt) {
  const L = s.layer
  if (!L) { s.actions.__lw = 0; return 0 }
  L.t += dt
  if (!L.loop && !L.hold && L.t >= L.dur - L.fade) L.target = 0
  const d = L.target - L.w, step = dt / Math.max(0.01, L.fade)
  L.w = Math.abs(d) <= step ? L.target : L.w + Math.sign(d) * step
  L.action.setEffectiveWeight(L.w)
  s.actions.__lw = L.w
  if (L.target === 0 && L.w <= 0) { L.action.stop(); s.layer = null; s.actions.__lw = 0; L.onDone?.() }
  return L.w
}

// Civilian gait blend. Walk below ~1.8 m/s, run alone from 70 % of the run clip's natural speed. In
// between, both clips keep the same phase and advance at one shared cycle rate (each clip covers
// naturalSpeed * duration metres per cycle), so the blended legs stay coherent instead of fighting.
export function blendCivilian(actions, speed, dt) {
  const gait = actions.__gait, W = actions.Walk, R = actions.Run
  const walkMax = gait.Walk * 1.3, runMin = gait.Run * 0.7
  const w = { Idle: 0, Walk: 0, Run: 0 }
  let t = 0
  if (speed < 0.5) { const k = speed / 0.5; w.Idle = 1 - k; w.Walk = k }
  else if (speed < walkMax) w.Walk = 1
  else if (speed < runMin) { t = (speed - walkMax) / (runMin - walkMax); w.Walk = 1 - t; w.Run = t }
  else w.Run = 1
  const lw = actions.__lw || 0, cur = actions.__w || (actions.__w = { Idle: 1, Walk: 0, Run: 0 })
  for (const k of ['Idle', 'Walk', 'Run']) { cur[k] += (w[k] - cur[k]) * Math.min(1, dt * 10); actions[k].setEffectiveWeight(cur[k] * (1 - lw)) }
  const wd = W.getClip().duration, rd = R.getClip().duration
  const walkCycles = Math.max(speed, 0.5) / (gait.Walk * wd), runCycles = speed / (gait.Run * rd)   // cycles per second
  if (w.Run === 0) { W.timeScale = THREE.MathUtils.clamp(walkCycles * wd, 0.45, 1.8); R.timeScale = W.timeScale * rd / wd }
  else if (w.Walk === 0) { R.timeScale = THREE.MathUtils.clamp(runCycles * rd, 0.4, 2.2); W.timeScale = R.timeScale * wd / rd }
  else {
    const cycles = walkCycles * (1 - t) + runCycles * t
    W.timeScale = cycles * wd; R.timeScale = cycles * rd
  }
  // keep the two clips on the same normalised phase while either is blended in
  if (w.Run > 0 && w.Walk > 0) R.time = (W.time / wd) * rd
  else if (w.Run > 0) W.time = (R.time / rd) * wd
  else R.time = (W.time / wd) * rd
}

// Foot locking: while a foot is planted it is pinned to the spot where it touched down and the leg bends
// (two-bone IK) to reach it, so feet do not skate when the gait clip's stride and the body speed disagree.
// A foot counts as planted while its ankle is within 3 cm of the current clip's lowest ankle height.
const LEG_NAMES = { l: [['upperlegl', 'thighl', 'leftupleg'], ['lowerlegl', 'calfl', 'leftleg'], ['footl', 'leftfoot']], r: [['upperlegr', 'thighr', 'rightupleg'], ['lowerlegr', 'calfr', 'rightleg'], ['footr', 'rightfoot']] }
const bkey = n => n.replace(/[^A-Za-z]/g, '').toLowerCase().replace(/^mixamorig/, '')
export class FootLock {
  constructor(wrap, model, mixerRoles) {
    this.wrap = wrap
    const bones = {}; model.traverse(o => { if (o.isBone) bones[bkey(o.name)] ??= o })
    const find = names => names.map(n => bones[n]).find(Boolean)
    wrap.updateMatrixWorld(true)
    this.legs = ['l', 'r'].map(s => {
      const [up, low, foot] = LEG_NAMES[s].map(find)
      return { up, low, foot, off: low.worldToLocal(foot.getWorldPosition(new THREE.Vector3())), pin: null, w: 0, ox: 0, oz: 0 }
    }).filter(l => l.up && l.low && l.foot)
    this.minY = mixerRoles   // { Walk: lowest ankle height (m above the character origin), Run: ... }
    this.v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion()
  }
  // swing `bone` about its own origin so that world point `from` moves onto the line towards `to`
  aim(bone, from, to) {
    const pivot = bone.getWorldPosition(this.v[4]), a = from.clone().sub(pivot).normalize(), b = to.clone().sub(pivot).normalize()
    this.q.setFromUnitVectors(a, b).multiply(bone.getWorldQuaternion(this.q2))
    bone.quaternion.copy(bone.parent.getWorldQuaternion(this.q2).invert().multiply(this.q)); bone.updateMatrixWorld(true)
  }
  solve(leg, T) {
    const hip = leg.up.getWorldPosition(this.v[0]).clone(), knee = leg.low.getWorldPosition(this.v[1]).clone(), end = leg.low.localToWorld(leg.off.clone())
    const a = hip.distanceTo(knee), b = knee.distanceTo(end)
    const d = THREE.MathUtils.clamp(hip.distanceTo(T), 0.05, a + b - 0.002)
    const dir = T.clone().sub(hip).normalize()
    const pole = knee.clone().sub(hip); pole.addScaledVector(dir, -pole.dot(dir)); if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1); pole.normalize()
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x))
    this.aim(leg.up, knee, hip.clone().addScaledVector(dir, x).addScaledVector(pole, h))
    this.aim(leg.low, leg.low.localToWorld(leg.off.clone()), T)
    if (leg.foot.parent !== leg.low) { leg.foot.position.copy(leg.foot.parent.worldToLocal(leg.low.localToWorld(leg.off.clone()))); leg.foot.updateMatrixWorld(true) }
  }
  // weights: current blend weights { Walk, Run }; moving: body speed above ~0.3 m/s
  update(dt, weights, moving) {
    this.wrap.updateMatrixWorld(true)
    const wsum = (weights.Walk || 0) + (weights.Run || 0)
    const minY = wsum > 0 ? ((weights.Walk || 0) * this.minY.Walk + (weights.Run || 0) * this.minY.Run) / wsum : this.minY.Walk
    const base = this.wrap.position.y
    for (const leg of this.legs) {
      const f = leg.low.localToWorld(leg.off.clone())   // animated ankle
      const planted = moving && f.y - base < minY + 0.03
      if (planted && !leg.pin) leg.pin = f.clone()
      if (!planted) leg.pin = null
      // correction = pin - animated ankle while planted; after lift-off it is frozen and faded out
      if (leg.pin) { leg.ox = leg.pin.x - f.x; leg.oz = leg.pin.z - f.z }
      if (Math.hypot(leg.ox, leg.oz) > 0.3) { leg.pin = null; leg.w = 0; leg.ox = leg.oz = 0 }   // turned / teleported: let go
      leg.w = THREE.MathUtils.clamp(leg.w + (leg.pin ? dt / 0.04 : -dt / 0.08), 0, 1)
      if (leg.w <= 0) continue
      this.solve(leg, new THREE.Vector3(f.x + leg.ox * leg.w, f.y, f.z + leg.oz * leg.w))   // keep the animated height
    }
  }
}

// Lowest ankle height of each gait clip on this rig (metres above the character origin), measured once per model.
const ankleCache = new WeakMap()
export function ankleMins(gltf, rig = QUATERNIUS_RIG) {
  if (ankleCache.has(gltf)) return ankleCache.get(gltf)
  const out = {}
  for (const role of ['Walk', 'Run']) {
    const c = makeCharacter(gltf, rig), clip = c.actions[role].getClip()
    c.mixer.stopAllAction(); c.mixer.clipAction(clip).reset().setEffectiveWeight(1).play()
    const lock = new FootLock(c.wrap, c.model, { Walk: 0, Run: 0 })
    let mn = Infinity
    for (let i = 0; i <= 60; i++) { c.mixer.setTime(clip.duration * i / 60); c.wrap.updateMatrixWorld(true); for (const l of lock.legs) mn = Math.min(mn, l.low.localToWorld(l.off.clone()).y) }
    out[role] = mn
  }
  ankleCache.set(gltf, out)
  return out
}

// One test civilian on a straight line: walk out, rest, run back, rest. Visual only (no collider); it
// follows the static ground (including the block slabs) with a downward ray.
export class CivilianTest {
  constructor(scene, physics, gltf, { x, z, length = 12, walk = 1.3, run = 5.5 } = {}) {
    this.physics = physics; this.gltf = gltf
    Object.assign(this, makeCharacter(gltf))
    scene.add(this.wrap)
    this.x = x; this.z0 = z; this.length = length
    this.plan = [{ speed: walk, dir: 1 }, { rest: 3 }, { speed: run, dir: -1 }, { rest: 3 }]
    this.step = 0; this.s = 0; this.t = 0; this.cur = 0; this.heading = 0; this.hold = null
    this.wrap.position.set(x, this.groundY(x, z), z)
    this.footLock = new FootLock(this.wrap, this.model, ankleMins(gltf, QUATERNIUS_RIG)); this.lockFeet = true
    this.foot = { L: null, R: null }
    this.model.traverse(o => { if (!o.isBone) return; if (isLeftFootBone(o.name)) this.foot.L = o; else if (o.name.replace(/[^A-Za-z]/g, '').toLowerCase() === 'footr') this.foot.R = o })
  }

  groundY(x, z) {
    const R = this.physics.R
    const hit = this.physics.world.castRay(new R.Ray({ x, y: 1.2, z }, { x: 0, y: -1, z: 0 }), 3, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC)
    return hit ? 1.2 - (hit.timeOfImpact ?? hit.toi) : 0   // start low so tree and pillar colliders are not hit from above
  }

  update(dt) {
    let target, dir
    if (this.hold != null) { target = this.hold.speed; dir = this.hold.dir }
    else {
      const p = this.plan[this.step]
      if (p.rest != null) { target = 0; dir = this.plan[(this.step + 1) % 4].dir; this.t += dt; if (this.t >= p.rest) { this.t = 0; this.step = (this.step + 1) % 4 } }
      else {
        dir = p.dir
        const left = dir > 0 ? this.length - this.s : this.s
        // ease in, and brake so the stop lands at the end of the line (exponential easing travels ~cur/k)
        target = left < this.cur / 2.5 + 0.05 ? 0 : p.speed
        if (left <= 0.05 || (target === 0 && this.cur < 0.08)) { this.step = (this.step + 1) % 4; this.t = 0 }
      }
    }
    this.cur += (target - this.cur) * Math.min(1, dt * 2.5)
    if (this.hold == null) this.s = THREE.MathUtils.clamp(this.s + dir * this.cur * dt, 0, this.length)
    else this.s += dir * this.cur * dt
    const want = dir > 0 ? 0 : Math.PI
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * Math.min(1, dt * 6)
    const x = this.x, z = this.z0 + this.s
    this.wrap.position.set(x, this.groundY(x, z), z)
    this.wrap.rotation.y = this.heading
    this.mixer.update(dt)
    if (this.lockFeet) this.footLock.update(dt, { Walk: this.actions.Walk.getEffectiveWeight(), Run: this.actions.Run.getEffectiveWeight() }, this.cur > 0.3)
    blendCivilian(this.actions, this.cur, dt)
  }
}

// Dev measurements, attached to window.akshatDev.civilian (development aid only).
export function installCivilianDev(game, civ) {
  const v = new THREE.Vector3()
  const api = {
    civ,
    // hold a constant speed along +z (dir 1) or -z (dir -1); null returns to the walk / rest / run loop
    hold(speed, dir = 1) { civ.hold = speed == null ? null : { speed, dir }; if (speed != null) { civ.cur = speed } },
    // camera beside the civilian (cinematic mode, game paused for the player)
    look(side = 4, h = 1.2) {
      game.cine.on = true
      game.cinematicFrame = () => { const p = civ.wrap.position; game.camera.position.set(p.x + side, p.y + h + 0.3, p.z + 1.5); game.camera.lookAt(p.x, p.y + 0.95, p.z) }
    },
    info() {
      civ.wrap.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(civ.model, true)
      const bone = n => { let b = null; civ.model.traverse(o => { if (!b && o.isBone && o.name.replace(/[^A-Za-z]/g, '') === n) b = o }); return b }   // GLTFLoader strips '.' from names
      const arm = bone('UpperArmL'), elbow = bone('LowerArmL')
      const a = arm.getWorldPosition(new THREE.Vector3()), e = elbow.getWorldPosition(new THREE.Vector3())
      const armDrop = THREE.MathUtils.radToDeg(Math.asin((a.y - e.y) / a.distanceTo(e)))
      const mats = new Set(); civ.model.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)) })
      const src = new Set(); civ.gltf.scene.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => src.add(m)) })
      return {
        heightM: +(box.max.y - box.min.y).toFixed(3), feetAboveGroundM: +(box.min.y - civ.wrap.position.y).toFixed(3),
        armBelowHorizontalDeg: +armDrop.toFixed(1), gait: civ.actions.__gait,
        weights: Object.fromEntries(['Idle', 'Walk', 'Run'].map(k => [k, +civ.actions[k].getEffectiveWeight().toFixed(2)])),
        timeScale: { Walk: +civ.actions.Walk.timeScale.toFixed(2), Run: +civ.actions.Run.timeScale.toFixed(2) },
        materialsShared: [...mats].every(m => src.has(m)), materials: mats.size,
      }
    },
    // foot slip: horizontal world speed of each foot while it is planted (within 3 cm of its lowest point),
    // sampled every frame for `ms`. Also reports the planted foot's direction relative to the heading
    // (should be backwards = -1 when the model faces its direction of travel).
    async slip(ms = 4000) {
      const s = { L: [], R: [] }, fwd = []
      await new Promise(res => { const end = performance.now() + ms; const tick = () => { civ.wrap.updateMatrixWorld(true); for (const k of ['L', 'R']) s[k].push(civ.foot[k].getWorldPosition(new THREE.Vector3())); fwd.push(new THREE.Vector3(Math.sin(civ.heading), 0, Math.cos(civ.heading))); s.t = (s.t || []); s.t.push(performance.now()); performance.now() < end ? requestAnimationFrame(tick) : res() }; requestAnimationFrame(tick) })
      const out = {}
      for (const k of ['L', 'R']) {
        const p = s[k], minY = Math.min(...p.map(q => q.y))
        let dist = 0, time = 0
        for (let i = 1; i < p.length; i++) if (p[i].y < minY + 0.03 && p[i - 1].y < minY + 0.03) { const dt = (s.t[i] - s.t[i - 1]) / 1000; if (dt > 0.1) continue; dist += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); time += dt }
        out[k] = time > 0 ? +(dist / time).toFixed(3) : null
      }
      return { speed: +civ.cur.toFixed(2), slipMs: out, mean: +(((out.L ?? 0) + (out.R ?? 0)) / 2).toFixed(3) }
    },
    // facing: with the character held in place, the planted foot moves backwards relative to a model that
    // faces its heading. Returns the cosine between the planted-foot motion and the heading (-1 = correct).
    facing() {
      const c = makeCharacter(civ.gltf), clip = c.actions.Walk.getClip()
      c.mixer.stopAllAction(); c.mixer.clipAction(clip).reset().setEffectiveWeight(1).play()
      const foot = []; let L = null; c.model.traverse(o => { if (!L && o.isBone && isLeftFootBone(o.name)) L = o })
      for (let i = 0; i <= 60; i++) { c.mixer.setTime(clip.duration * i / 60); c.wrap.updateMatrixWorld(true); foot.push(L.getWorldPosition(new THREE.Vector3())) }
      const minY = Math.min(...foot.map(p => p.y)); const d = new THREE.Vector3()
      for (let i = 1; i < foot.length; i++) if (foot[i].y < minY + 0.03 && foot[i - 1].y < minY + 0.03) d.add(v.subVectors(foot[i], foot[i - 1]))
      d.y = 0; d.normalize()
      return +d.dot(new THREE.Vector3(0, 0, 1)).toFixed(3)   // heading 0 faces +z
    },
  }
  if (window.akshatDev) window.akshatDev.civilian = api
  return api
}
