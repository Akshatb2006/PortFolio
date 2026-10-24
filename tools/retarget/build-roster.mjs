// Offline tool (not shipped). Builds the runtime character set from the Quaternius Ultimate Modular Men/Women
// glTF packs and the Universal Animation Library (all CC0):
//   - one mesh-only GLB per character (no animations; meshopt)
//   - one shared animation GLB per body type (men / women): skeleton nodes + clips. Quaternius clips are kept
//     as authored; the jog, dance, sitting and talking clips are retargeted from the UAL onto the rig.
// Run from the repo root:
//   node tools/retarget/build-roster.mjs <men glTF dir> <women glTF dir> <UAL1_Standard.glb> <out dir>
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import fs from 'fs'; import path from 'path'; import os from 'os'
import { loadGLB } from './loadglb.mjs'
import { bake } from './retarget.mjs'

const [menDir, womenDir, ualPath, outDir] = process.argv.slice(2)
export const ROSTER = {
  men: ['Casual_Hoodie', 'Casual_2', 'Suit', 'Worker', 'Beach', 'Swat'],
  women: ['Casual', 'Formal', 'Suit', 'Worker', 'Punk', 'Adventurer'],
}
// reference character per body type for the shared clips
const REF = { men: 'Casual_2', women: 'Casual' }
const KEEP = ['Idle', 'Idle_Neutral', 'Walk', 'Wave', 'Interact', 'Punch_Left', 'Punch_Right', 'Kick_Right', 'HitRecieve', 'Death', 'Roll']
const UAL = { Run: 'Jog_Fwd_Loop', Dance: 'Dance_Loop', Sit: 'Sitting_Idle_Loop', Talk: 'Idle_Talking_Loop' }

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const ual = await loadGLB(ualPath)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'))
// compress via a binary round trip: compressing the documents read straight from the base64 .gltf files left
// them ~3.7x larger (measured 674 KB vs 184 KB for one character)
const compress = async (doc) => { await doc.transform(dedup()); const d2 = await io.readBinary(await io.writeBinary(doc)); await d2.transform(prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' })); return io.writeBinary(d2) }
const report = []

for (const [type, dir] of [['men', menDir], ['women', womenDir]]) {
  const prefix = type === 'men' ? 'M_' : 'W_'
  // ---- mesh-only characters
  for (const name of ROSTER[type]) {
    const doc = await io.read(path.join(dir, name + '.gltf'))
    for (const a of doc.getRoot().listAnimations()) a.dispose()
    await doc.transform(prune())
    const glb = await compress(doc); fs.writeFileSync(path.join(outDir, prefix + name + '.glb'), glb)
    report.push([prefix + name, glb.length])
  }
  // ---- shared animation set: Quaternius clips + retargeted UAL clips, skeleton only
  const doc = await io.read(path.join(dir, REF[type] + '.gltf'))
  for (const a of doc.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) a.dispose()
  // plain copy of the reference character for the three.js-side bake (needs the skinned rest pose)
  const plain = path.join(tmp, type + '.glb'); fs.writeFileSync(plain, await io.writeBinary(doc))
  const target = await loadGLB(plain)
  const root = doc.getRoot(), buffer = root.listBuffers()[0]
  const byKey = {}; for (const n of root.listNodes()) byKey[n.getName().replace(/[^A-Za-z0-9]/g, '')] = n
  for (const [clipName, src] of Object.entries(UAL)) {
    const fresh = await loadGLB(plain)   // bake poses the target; start from the rest pose each time
    const { clip } = bake(ual, ual.animations.find(c => c.name === src), fresh, { name: clipName })
    const anim = doc.createAnimation(clipName); let input = null
    for (const tr of clip.tracks) {
      const [bone, prop] = tr.name.split('.'), node = byKey[bone]; if (!node) throw new Error('no node ' + bone)
      input ??= doc.createAccessor().setType('SCALAR').setArray(new Float32Array(tr.times)).setBuffer(buffer)
      const out = doc.createAccessor().setType(prop === 'quaternion' ? 'VEC4' : 'VEC3').setArray(new Float32Array(tr.values)).setBuffer(buffer)
      const s = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR')
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(prop === 'quaternion' ? 'rotation' : 'translation').setSampler(s))
    }
  }
  // drop meshes, skins and materials: the clips bind to any character of this body type by bone name
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null) }
  for (const s of root.listSkins()) s.dispose()
  for (const m of root.listMeshes()) m.dispose()
  await doc.transform(prune({ keepLeaves: true, propertyTypes: ['Accessor', 'Material', 'Texture', 'Mesh', 'Skin'] }))
  const glb = await compress(doc); fs.writeFileSync(path.join(outDir, 'anims-' + type + '.glb'), glb)
  report.push(['anims-' + type, glb.length, root.listAnimations().map(a => a.getName()).join(',')])
  void target
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(JSON.stringify(report))
