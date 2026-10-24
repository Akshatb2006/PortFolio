import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Prepares the Ferrari glTF: normalises scale/orientation (4.5 m long, nose on +z),
// returns helpers for the player car (full materials) and merged background cars.
const CAR_LENGTH = 4.5
const cache = new WeakMap()

export function prepareCar(scene) {
  if (cache.has(scene)) return cache.get(scene)
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const long = size.z >= size.x ? 'z' : 'x'
  const scale = CAR_LENGTH / size[long]
  const fl = scene.getObjectByName('wheel_fl'), rl = scene.getObjectByName('wheel_rl')
  const pf = fl.getWorldPosition(new THREE.Vector3()), pr = rl.getWorldPosition(new THREE.Vector3())
  // rotation so that the front wheels are on +z
  let rotY = 0
  if (long === 'z') rotY = pf.z > pr.z ? 0 : Math.PI
  else rotY = pf.x > pr.x ? -Math.PI / 2 : Math.PI / 2
  const wrap = new THREE.Group(); wrap.name = 'carWrap'
  const inner = new THREE.Group(); inner.add(scene); inner.rotation.y = rotY; inner.scale.setScalar(scale)
  wrap.add(inner)
  wrap.updateMatrixWorld(true)
  const b2 = new THREE.Box3().setFromObject(wrap)
  inner.position.y = -b2.min.y
  wrap.updateMatrixWorld(true)
  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(n => scene.getObjectByName(n))
  const wheelRadius = (new THREE.Box3().setFromObject(fl).getSize(new THREE.Vector3()).y / 2) * scale
  const wheelPos = wheels.map(w => wrap.worldToLocal(w.getWorldPosition(new THREE.Vector3())))
  const prepared = { wrap, inner, wheels, wheelRadius, wheelPos, scale, rotY }
  cache.set(scene, prepared)
  return prepared
}

export function playerCarMaterials(color = 0xd0201a) {
  return {
    body: new THREE.MeshPhysicalMaterial({ color, metalness: 1.0, roughness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
    details: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1.0, transparent: true }),
  }
}

// Clone of the prepared car with upgraded materials for the player.
export function buildPlayerCar(gltfScene, color) {
  const prep = prepareCar(gltfScene)
  const clone = prep.wrap.clone(true)
  const mats = playerCarMaterials(color)
  clone.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = true; o.receiveShadow = true
    if (o.name === 'body') o.material = mats.body
    else if (['rim_fl', 'rim_fr', 'rim_rl', 'rim_rr', 'trim'].includes(o.name)) o.material = mats.details
    else if (o.name === 'glass') o.material = mats.glass
  })
  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(n => clone.getObjectByName(n))
  return { mesh: clone, wheels, wheelRadius: prep.wheelRadius, wheelPos: prep.wheelPos, mats }
}

// One geometry with vertex colours (material base colour) + paintMask attribute for recolouring.
export function carMergedGeometry(gltfScene) {
  const prep = prepareCar(gltfScene)
  if (prep.merged) return prep.merged
  const geos = []
  prep.wrap.updateMatrixWorld(true)
  prep.wrap.traverse(o => {
    if (!o.isMesh) return
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k)
    g.deleteAttribute('uv')
    const c = o.material.color || new THREE.Color(0.5, 0.5, 0.5)
    const isPaint = o.name === 'body'
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3), mask = new Float32Array(n)
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; mask[i] = isPaint ? 1 : 0 }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('paintMask', new THREE.BufferAttribute(mask, 1))
    if (!g.index) { /* fine */ }
    geos.push(g.toNonIndexed ? g.toNonIndexed() : g)
  })
  const geometry = mergeGeometries(geos)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4 })
  prep.merged = { geometry, material }
  return prep.merged
}
