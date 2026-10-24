// Node helpers: parse a GLB with three's GLTFLoader (no textures needed) and measure clips.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import fs from 'fs'
export { THREE }
globalThis.self ??= globalThis
export async function loadGLB(path, meshopt = false) {
  const buf = fs.readFileSync(path); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const loader = new GLTFLoader()
  if (meshopt) { const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js'); loader.setMeshoptDecoder(MeshoptDecoder) }
  return new Promise((res, rej) => loader.parse(ab, '', res, rej))
}
const key = n => n.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
export function bonesByKey(root) { const b = {}; root.traverse(o => { if (o.isBone) b[key(o.name)] ??= o }); return b }
// Foot-contact analysis of a clip on a rig. feet: [leftKey, rightKey]. Returns natural speed (best fit),
// best achievable slip at timeScale 1, and the loop-seam jump.
export function analyse(root, clip, feet, thr = 0.03, N = 400) {
  const mixer = new THREE.AnimationMixer(root); mixer.clipAction(clip).play()
  const b = bonesByKey(root); const bones = []; root.traverse(o => { if (o.isBone) bones.push(o) })
  const dt = clip.duration / N, tr = feet.map(() => [])
  const pose = t => { mixer.setTime(t); root.updateMatrixWorld(true) }
  for (let i = 0; i <= N; i++) { pose(dt * i); feet.forEach((f, k) => tr[k].push(b[f].getWorldPosition(new THREE.Vector3()))) }
  const v = []
  tr.forEach(p => { const minY = Math.min(...p.map(q => q.y)); for (let i = 1; i <= N; i++) if (p[i].y < minY + thr && p[i - 1].y < minY + thr) v.push({ vz: (p[i].z - p[i - 1].z) / dt, vx: (p[i].x - p[i - 1].x) / dt }) })
  let best = null; for (let g = 0.3; g <= 9; g += 0.01) { const m = v.reduce((a, q) => a + Math.hypot(q.vz + g, q.vx), 0) / v.length; if (!best || m < best.m) best = { g, m } }
  // seam: pose just before the end vs start
  pose(clip.duration - dt * 0.5); const a = bones.map(o => o.getWorldPosition(new THREE.Vector3())); pose(0); let seam = 0; bones.forEach((o, j) => { seam = Math.max(seam, o.getWorldPosition(new THREE.Vector3()).distanceTo(a[j])) })
  let inner = 0; pose(0); let prev = bones.map(o => o.getWorldPosition(new THREE.Vector3())); for (let i = 1; i < N; i++) { pose(dt * i); const cur = bones.map(o => o.getWorldPosition(new THREE.Vector3())); cur.forEach((c, j) => inner = Math.max(inner, c.distanceTo(prev[j]))); prev = cur }
  // net root drift (root motion) over one cycle
  return { duration: +clip.duration.toFixed(3), naturalSpeed: +best.g.toFixed(2), bestSlip: +best.m.toFixed(3), slipPerMps: +(best.m / best.g).toFixed(3), seamCm: +(seam * 100).toFixed(2), maxStepCm: +(inner * 100).toFixed(2), contactSamples: v.length }
}
