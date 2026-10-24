// Offline tool (not shipped). Packs selected Kenney Car Kit models (CC0) into ONE runtime GLB: each model
// becomes a named scene (body, wheel-* and extra part nodes kept), the shared colormap is de-duplicated,
// meshes are meshopt-compressed. Run from the repo root:
//   node tools/assets/build-cars.mjs <Car Kit "Models/GLB format" dir> <out.glb> <model1> <model2> ...
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { mergeDocuments, unpartition, prune, dedup, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import fs from 'fs'; import path from 'path'

const [dir, out, ...models] = process.argv.slice(2)
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(path.join(dir, models[0] + '.glb'))
doc.getRoot().listScenes()[0].setName(models[0])
for (const m of models.slice(1)) {
  const src = await io.read(path.join(dir, m + '.glb'))
  src.getRoot().listScenes()[0].setName(m)
  mergeDocuments(doc, src)
}
await doc.transform(unpartition(), dedup(), prune({ keepLeaves: true }))
// binary round trip before compressing (meshopt on a freshly merged document keeps unshared buffers)
const mid = await io.readBinary(await io.writeBinary(doc))
await mid.transform(dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
const glb = await io.writeBinary(mid); fs.writeFileSync(out, glb)
const r = mid.getRoot()
console.log(JSON.stringify({ out, bytes: glb.length, scenes: r.listScenes().map(s => s.getName()), meshes: r.listMeshes().length, materials: r.listMaterials().length, textures: r.listTextures().map(t => `${t.getURI()} ${t.getImage().byteLength}B`) }))
