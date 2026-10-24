import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import * as M from './CityMap.js'

// Urban farm meadow in Central Park (block 2,4): farm animals (Gobkit Free Animal Pack Vol.3, CC0) wander
// inside a low timber fence, pause to graze and move away from the player. Visual only (no colliders).
export const MEADOW = { bx: 2, bz: 4, inset: 4 }
const Y = 0.18   // block slab top

// Which models appear (deterministic) and their ambling pace relative to the walk clip's natural speed.
const HERD = [['HolsteinCow', 1.25], ['HolsteinCow', 1.15], ['Calf', 1.3], ['Sheep', 1.2], ['Sheep', 1.3], ['Lamb', 1.25], ['Lamb', 1.35], ['Pig', 1.2]]

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// Scale that makes the model `height` metres tall, the model's forward yaw, and the walk clip's natural ground
// speed at that scale (hooves = the lowest bones; planted = within 2 % of the height of their lowest point).
const info = new WeakMap()
function measure(gltf, height) {
  if (info.has(gltf)) return info.get(gltf)
  const root = SkeletonUtils.clone(gltf.scene), mixer = new THREE.AnimationMixer(root)
  const idle = gltf.animations.find(c => c.name === 'idle'), walk = gltf.animations.find(c => c.name === 'walk')
  mixer.clipAction(idle).play(); mixer.update(0); root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root, true), size = box.getSize(new THREE.Vector3())
  const scale = height / size.y
  root.scale.setScalar(scale); mixer.stopAllAction(); mixer.clipAction(walk).play()
  // legs are single swinging bones (LeftLegF/B, RightLegF/B) without hoof bones: track a virtual hoof at ground
  // level under each leg's pivot in the rest pose, carried along by the leg bone
  mixer.update(0); root.updateMatrixWorld(true)
  const ground = new THREE.Box3().setFromObject(root, true).min.y
  const legs = []; root.traverse(o => { if (o.isBone && /Leg[FB]$/i.test(o.name)) { const pv = o.getWorldPosition(new THREE.Vector3()); legs.push({ bone: o, tip: o.worldToLocal(new THREE.Vector3(pv.x, ground, pv.z)) }) } })
  const N = 60, tr = legs.map(() => [])
  for (let i = 0; i <= N; i++) { mixer.setTime(walk.duration * i / N); root.updateMatrixWorld(true); legs.forEach((l, k) => tr[k].push(l.bone.localToWorld(l.tip.clone()))) }
  let dist = 0, time = 0; const dir = new THREE.Vector3()
  for (const p of tr) {
    const minY = Math.min(...p.map(v => v.y)), thr = minY + height * 0.02
    for (let i = 1; i <= N; i++) if (p[i].y < thr && p[i - 1].y < thr) { const dx = p[i].x - p[i - 1].x, dz = p[i].z - p[i - 1].z; dist += Math.hypot(dx, dz); time += walk.duration / N; dir.x += dx; dir.z += dz }
  }
  // a planted hoof moves backwards, so the model faces the opposite way
  const r = { scale, legs: legs.length, natural: time > 0 ? dist / time : 0.8, yaw: Math.atan2(-dir.x, -dir.z), length: Math.max(size.x, size.z) * scale }
  info.set(gltf, r)
  return r
}

export class Animals {
  constructor(scene, animals) {
    this.list = []; this.group = new THREE.Group(); this.group.name = 'animals'; scene.add(this.group)
    if (!animals?.length) return
    const byId = Object.fromEntries(animals.map(a => [a.id, a]))
    const x0 = M.blockStart(MEADOW.bx) + MEADOW.inset, z0 = M.blockStart(MEADOW.bz) + MEADOW.inset, W = M.BLOCK - 2 * MEADOW.inset
    this.rect = { x0, z0, x1: x0 + W, z1: z0 + W }
    this.buildFence()
    const r = rng(2024)
    HERD.forEach(([id, pace], i) => {
      const a = byId[id]; if (!a) return
      const m = measure(a.gltf, a.height), speed = m.natural * pace
      const model = SkeletonUtils.clone(a.gltf.scene); model.scale.setScalar(m.scale)
      const inner = new THREE.Group(); inner.rotation.y = -m.yaw; inner.add(model)   // turn the model to face +z
      const wrap = new THREE.Group(); wrap.add(inner); this.group.add(wrap)
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false } })
      const mixer = new THREE.AnimationMixer(model)
      const idle = mixer.clipAction(a.gltf.animations.find(c => c.name === 'idle')), walk = mixer.clipAction(a.gltf.animations.find(c => c.name === 'walk'))
      idle.play(); walk.play(); idle.setEffectiveWeight(1); walk.setEffectiveWeight(0)
      walk.timeScale = speed / m.natural   // feet keep pace with the body
      mixer.setTime(r() * 3)
      const pos = new THREE.Vector3(x0 + 2 + r() * (W - 4), Y, z0 + 2 + r() * (W - 4))
      this.list.push({ id, wrap, mixer, idle, walk, speed, natural: m.natural, radius: m.length * 0.45, pos, heading: r() * Math.PI * 2, cur: 0, target: null, wait: 1 + r() * 4, r: rng(99 + i) })
    })
  }

  buildFence() {
    const { x0, z0, x1, z1 } = this.rect, wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 })
    const geos = []
    const rail = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az)
      for (const h of [0.45, 0.85]) { const g = new THREE.BoxGeometry(0.08, 0.09, len); g.rotateY(yaw); g.translate((ax + bx) / 2, Y + h, (az + bz) / 2); geos.push(g) }
      const n = Math.ceil(len / 2.4)
      for (let k = 0; k <= n; k++) { const t = k / n; if (len > 10 && Math.abs(t - 0.5) < 0.06) continue; const g = new THREE.BoxGeometry(0.12, 1.05, 0.12); g.translate(ax + (bx - ax) * t, Y + 0.52, az + (bz - az) * t); geos.push(g) }
    }
    rail(x0, z0, x1, z0); rail(x1, z0, x1, z1); rail(x1, z1, x0, z1); rail(x0, z1, x0, z0)
    const merged = new THREE.Mesh(mergeAll(geos), wood); merged.castShadow = merged.receiveShadow = true; this.group.add(merged)
  }

  update(dt, playerPos) {
    const R = this.rect
    for (const a of this.list) {
      const dx = a.pos.x - playerPos.x, dz = a.pos.z - playerPos.z, dist = Math.hypot(dx, dz)
      // pick the next spot: graze, then amble somewhere else in the meadow; move away from a close player
      if (dist < 3.5 && dist > 0.01) { a.target = new THREE.Vector3(THREE.MathUtils.clamp(a.pos.x + dx / dist * 5, R.x0 + 1, R.x1 - 1), Y, THREE.MathUtils.clamp(a.pos.z + dz / dist * 5, R.z0 + 1, R.z1 - 1)); a.wait = 0 }
      if (!a.target) { a.wait -= dt; if (a.wait <= 0) a.target = new THREE.Vector3(R.x0 + 1.5 + a.r() * (R.x1 - R.x0 - 3), Y, R.z0 + 1.5 + a.r() * (R.z1 - R.z0 - 3)) }
      let want = 0
      if (a.target) {
        const tx = a.target.x - a.pos.x, tz = a.target.z - a.pos.z, d = Math.hypot(tx, tz)
        if (d < 0.4) { a.target = null; a.wait = 3 + a.r() * 7 }
        else {
          const h = Math.atan2(tx, tz), turn = Math.atan2(Math.sin(h - a.heading), Math.cos(h - a.heading))
          a.heading += turn * Math.min(1, dt * 2)
          want = Math.abs(turn) < 0.6 ? a.speed * (dist < 3.5 ? 1.6 : 1) : a.speed * 0.3   // turn in place first
        }
      }
      // keep a little room between animals
      for (const b of this.list) { if (b === a) continue; const ex = a.pos.x - b.pos.x, ez = a.pos.z - b.pos.z, e = Math.hypot(ex, ez), m = a.radius + b.radius; if (e > 0.01 && e < m) { a.pos.x += ex / e * (m - e) * 0.5; a.pos.z += ez / e * (m - e) * 0.5 } }
      a.cur += (want - a.cur) * Math.min(1, dt * 3)
      a.pos.x = THREE.MathUtils.clamp(a.pos.x + Math.sin(a.heading) * a.cur * dt, R.x0 + 0.6, R.x1 - 0.6)
      a.pos.z = THREE.MathUtils.clamp(a.pos.z + Math.cos(a.heading) * a.cur * dt, R.z0 + 0.6, R.z1 - 0.6)
      a.wrap.position.copy(a.pos); a.wrap.rotation.y = a.heading
      if (dist < 90) {
        const w = THREE.MathUtils.clamp(a.cur / Math.max(0.1, a.speed * 0.6), 0, 1)
        a.walk.setEffectiveWeight(w); a.idle.setEffectiveWeight(1 - w)
        a.walk.timeScale = Math.max(0.3, a.cur) / a.natural
        a.mixer.update(dt)
      }
    }
  }
}

function mergeAll(list) {
  // small local merge (non-indexed boxes)
  let n = 0; for (const g of list) n += g.toNonIndexed().attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0
  for (const g0 of list) { const g = g0.toNonIndexed(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.computeBoundingSphere(); return g
}
