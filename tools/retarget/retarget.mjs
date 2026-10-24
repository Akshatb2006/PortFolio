// Bake a Universal Animation Library clip onto the Quaternius modular rig (offline). Returns a three.js clip
// with tracks named by the target's (sanitised) bone names.
import { THREE, bonesByKey } from './loadglb.mjs'

// target key -> [source bone, target child (direction), source child (direction)]
export const MAP = {
  hips: ['pelvis', 'abdomen', 'spine01'], abdomen: ['spine01', 'torso', 'spine02'], torso: ['spine02', 'chest', 'spine03'],
  chest: ['spine03', 'neck', 'neck01'], neck: ['neck01', 'head', 'head'], head: ['head', null, null],
  shoulderl: ['claviclel', 'upperarml', 'upperarml'], upperarml: ['upperarml', 'lowerarml', 'lowerarml'], lowerarml: ['lowerarml', 'wristl', 'handl'], wristl: ['handl', null, null],
  shoulderr: ['clavicler', 'upperarmr', 'upperarmr'], upperarmr: ['upperarmr', 'lowerarmr', 'lowerarmr'], lowerarmr: ['lowerarmr', 'wristr', 'handr'], wristr: ['handr', null, null],
  upperlegl: ['thighl', 'lowerlegl', 'calfl'], lowerlegl: ['calfl', 'footl', 'footl'], footl: ['footl', null, null],
  upperlegr: ['thighr', 'lowerlegr', 'calfr'], lowerlegr: ['calfr', 'footr', 'footr'], footr: ['footr', null, null],
}
const K = n => n.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
const wq = o => o.getWorldQuaternion(new THREE.Quaternion()), wp = o => o.getWorldPosition(new THREE.Vector3())

export function bake(src, srcClip, dst, { fps = 30, name = 'Run' } = {}) {
  const S = bonesByKey(src.scene), T = bonesByKey(dst.scene)
  src.scene.updateMatrixWorld(true); dst.scene.updateMatrixWorld(true)
  const sBind = {}, tRef = {}
  for (const [tk, [sk, tChild, sChild]] of Object.entries(MAP)) {
    sBind[tk] = wq(S[sk]); let ref = wq(T[tk])
    if (tChild && sChild) { const td = wp(T[tChild]).sub(wp(T[tk])).normalize(), sd = wp(S[sChild]).sub(wp(S[sk])).normalize(); ref = new THREE.Quaternion().setFromUnitVectors(td, sd).multiply(ref) }
    tRef[tk] = ref
  }
  const footOff = {}; for (const s of ['l', 'r']) footOff[s] = T['lowerleg' + s].worldToLocal(wp(T['foot' + s]))
  const tFootRest = Math.min(wp(T.footl).y, wp(T.footr).y), sFootRest = Math.min(wp(S.footl).y, wp(S.footr).y)
  const sHips0 = wp(S.pelvis), tBody0 = wp(T.body), scale = wp(T.hips).y / sHips0.y
  const order = []; dst.scene.traverse(o => { if (o.isBone && (MAP[K(o.name)] || K(o.name) === 'body')) order.push(o) })   // parents first

  const mixer = new THREE.AnimationMixer(src.scene); mixer.clipAction(srcClip).play()
  const n = Math.round(srcClip.duration * fps)
  const pose = (t, yAdj) => {
    mixer.setTime(t); src.scene.updateMatrixWorld(true)
    const bodyW = tBody0.clone().add(wp(S.pelvis).sub(sHips0).multiplyScalar(scale)); bodyW.x = tBody0.x; bodyW.z = tBody0.z; bodyW.y += yAdj   // in place
    for (const o of order) {
      const tk = K(o.name)
      if (tk === 'body') { o.position.copy(o.parent.worldToLocal(bodyW.clone())); o.updateMatrixWorld(true); continue }
      if (tk === 'footl' || tk === 'footr') continue
      o.quaternion.copy(wq(o.parent).invert().multiply(wq(S[MAP[tk][0]]).multiply(sBind[tk].clone().invert()).multiply(tRef[tk])))
      o.updateMatrixWorld(true)
    }
    for (const s of ['l', 'r']) {
      const f = T['foot' + s], tk = 'foot' + s
      f.position.copy(f.parent.worldToLocal(T['lowerleg' + s].localToWorld(footOff[s].clone())))
      f.quaternion.copy(wq(f.parent).invert().multiply(wq(S[MAP[tk][0]]).multiply(sBind[tk].clone().invert()).multiply(tRef[tk])))
      f.updateMatrixWorld(true)
    }
  }
  // ground: the source's lowest ankle height over the cycle (relative to its rest) maps to the target's
  let sMin = Infinity, tMin = Infinity
  for (let i = 0; i < n; i++) { pose(srcClip.duration * i / n, 0); sMin = Math.min(sMin, wp(S.footl).y, wp(S.footr).y); tMin = Math.min(tMin, wp(T.footl).y, wp(T.footr).y) }
  const yAdj = (tFootRest + (sMin - sFootRest) * scale) - tMin
  const times = [], data = {}; for (const o of order) data[o.name] = { q: [], p: [] }
  for (let i = 0; i <= n; i++) {
    pose(i === n ? 0 : srcClip.duration * i / n, yAdj)   // last key = first key: closed loop
    times.push(srcClip.duration * i / n)
    for (const o of order) { data[o.name].q.push(...o.quaternion.toArray()); data[o.name].p.push(...o.position.toArray()) }
  }
  const tracks = []
  for (const o of order) {
    const tk = K(o.name)
    if (tk === 'body' || tk === 'footl' || tk === 'footr') tracks.push(new THREE.VectorKeyframeTrack(o.name + '.position', times, data[o.name].p))
    if (tk !== 'body') tracks.push(new THREE.QuaternionKeyframeTrack(o.name + '.quaternion', times, data[o.name].q))
  }
  return { clip: new THREE.AnimationClip(name, srcClip.duration, tracks), info: { scale: +scale.toFixed(3), yAdj: +yAdj.toFixed(3), keys: n + 1, bones: order.length } }
}
