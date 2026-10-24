// Offline tool (not shipped). Packs selected glTF modules from a Quaternius kit (CC0) into ONE runtime GLB:
// each module becomes a named scene, textures are de-duplicated, resized with macOS `sips` and re-encoded,
// meshes are meshopt-compressed. Run from the repo root:
//   node tools/assets/build-kit.mjs <kit glTF dir> <out.glb> <maxTexturePx> <Module1> <Module2> ...
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { mergeDocuments, unpartition, prune, dedup, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { execFileSync } from 'child_process'
import fs from 'fs'; import os from 'os'; import path from 'path'

const [dir, out, maxPx, ...modules] = process.argv.slice(2)
const MAX = parseInt(maxPx)
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(path.join(dir, modules[0] + '.gltf'))
doc.getRoot().listScenes()[0].setName(modules[0])
for (const m of modules.slice(1)) {
  const src = await io.read(path.join(dir, m + '.gltf'))
  src.getRoot().listScenes()[0].setName(m)
  mergeDocuments(doc, src)
}
await doc.transform(unpartition(), dedup(), prune({ keepLeaves: false }))
// textures: resize + re-encode (JPEG for opaque colour/ORM/normal data, PNG when the image has alpha)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'))
const report = []
for (const t of doc.getRoot().listTextures()) {
  const name = (t.getURI() || t.getName() || 'tex').replace(/\.[a-z]+$/i, '')
  const inFile = path.join(tmp, name + '.' + (t.getMimeType() === 'image/png' ? 'png' : 'jpg')); fs.writeFileSync(inFile, t.getImage())
  const props = execFileSync('sips', ['-g', 'hasAlpha', '-g', 'pixelWidth', inFile]).toString()
  // keep alpha only where a non-opaque material samples this texture as its base colour
  const needsAlpha = doc.getRoot().listMaterials().some(m => m.getBaseColorTexture() === t && m.getAlphaMode() !== 'OPAQUE')
  const alpha = needsAlpha && /hasAlpha: yes/.test(props), w = parseInt(/pixelWidth: (\d+)/.exec(props)[1])
  const fmt = alpha ? 'png' : 'jpeg', outFile = path.join(tmp, name + '.out.' + (alpha ? 'png' : 'jpg'))
  const args = ['-s', 'format', fmt]; if (!alpha) args.push('-s', 'formatOptions', '82'); if (w > MAX) args.push('-Z', String(MAX))
  execFileSync('sips', [...args, inFile, '--out', outFile], { stdio: 'ignore' })
  const data = fs.readFileSync(outFile)
  t.setImage(new Uint8Array(data)).setMimeType(alpha ? 'image/png' : 'image/jpeg').setURI(name + (alpha ? '.png' : '.jpg'))
  report.push(`${name} ${w}->${Math.min(w, MAX)} ${alpha ? 'png' : 'jpg'} ${(data.length / 1024).toFixed(0)}KB`)
}
// vertex colours in these exports are Unreal/Godot wear masks, not albedo: drop them (three would multiply by them)
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) for (const sem of ['COLOR_0', 'COLOR_1']) { const a = p.getAttribute(sem); if (a) p.setAttribute(sem, null) }
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
const glb = await io.writeBinary(doc); fs.writeFileSync(out, glb)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(JSON.stringify({ out, bytes: glb.length, scenes: doc.getRoot().listScenes().length, materials: doc.getRoot().listMaterials().map(m => m.getName()), textures: report }, null, 1))
