// Offline tool (not shipped). Bakes the Universal Animation Library jog (CC0) onto a Quaternius modular
// character as its "Run" clip. Run from the repo root:
//   node tools/retarget/write-glb.mjs <UAL1_Standard.glb> <trimmed plain character.glb> <out.glb>
// Replace the Quaternius "Run" clip in a plain trimmed character GLB with the jog retargeted from the
// Universal Animation Library (CC0), then meshopt-compress. Usage: node write-glb.mjs <UAL.glb> <plain.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { loadGLB } from './loadglb.mjs'
import { bake } from './retarget.mjs'
const [ualPath, plainPath, outPath] = process.argv.slice(2)
const ual = await loadGLB(ualPath), men = await loadGLB(plainPath)
const { clip, info } = bake(ual, ual.animations.find(c => c.name === 'Jog_Fwd_Loop'), men, { name: 'Run' })
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(plainPath), root = doc.getRoot(), buffer = root.listBuffers()[0]
const byKey = {}; for (const n of root.listNodes()) byKey[n.getName().replace(/[^A-Za-z0-9]/g, '')] = n   // three strips '.' from names
for (const a of root.listAnimations()) if (a.getName() === 'Run') a.dispose()
const anim = doc.createAnimation('Run')
let input = null
for (const tr of clip.tracks) {
  const [bone, prop] = tr.name.split('.'), node = byKey[bone]; if (!node) throw new Error('no node ' + bone)
  input ??= doc.createAccessor().setType('SCALAR').setArray(new Float32Array(tr.times)).setBuffer(buffer)
  const out = doc.createAccessor().setType(prop === 'quaternion' ? 'VEC4' : 'VEC3').setArray(new Float32Array(tr.values)).setBuffer(buffer)
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR')
  anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(prop === 'quaternion' ? 'rotation' : 'translation').setSampler(sampler))
}
await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
const glb = await io.writeBinary(doc)
const fs = await import('fs'); fs.writeFileSync(outPath, glb)
console.log(JSON.stringify({ info, tracks: clip.tracks.length, bytes: glb.length, clips: root.listAnimations().map(a => a.getName()) }))
