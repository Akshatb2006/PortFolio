import { NodeIO } from '@gltf-transform/core'
import { getBounds } from '@gltf-transform/core'
const io = new NodeIO()
const dir = process.argv[2]
for (const f of process.argv.slice(3)) {
  const doc = await io.read(`${dir}/${f}${f.includes(".") ? "" : ".glb"}`)
  const r = doc.getRoot(), scene = r.listScenes()[0]
  const b = getBounds(scene)
  const sz = b.max.map((v, i) => +(v - b.min[i]).toFixed(2))
  let tris = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  const nodes = r.listNodes().map(n => `${n.getName()}@${n.getTranslation().map(v => +v.toFixed(2)).join(',')}${n.getMesh() ? '' : '(empty)'}`)
  const tex = r.listTextures().map(t => (t.getURI() || 'embedded') + ':' + t.getImage()?.byteLength)
  console.log(f, 'size', sz, 'min', b.min.map(v => +v.toFixed(2)), 'tris', tris, 'mats', r.listMaterials().map(m => m.getName()).join('/'), 'tex', tex.join(','))
  console.log('   ', nodes.join(' | '))
}
