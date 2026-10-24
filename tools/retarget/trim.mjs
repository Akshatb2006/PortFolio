// Offline tool (not shipped). Trims Quaternius modular characters (glTF) to the clips the game uses and
// writes plain GLBs. Run from the repo root:
//   node tools/retarget/trim.mjs <dir with .gltf files> <out dir> Casual_2 Beach ...
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup } from '@gltf-transform/functions'
import fs from 'fs'; import path from 'path'
const [src, out, ...names] = process.argv.slice(2)
const KEEP = new Set(['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact'])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const name of names) {
  const doc = await io.read(path.join(src, name + '.gltf'))
  for (const a of doc.getRoot().listAnimations()) if (!KEEP.has(a.getName())) a.dispose()
  await doc.transform(prune(), dedup())
  const glb = await io.writeBinary(doc); fs.writeFileSync(path.join(out, name + '.glb'), glb)
  console.log(name, glb.length)
}
