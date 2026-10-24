// Builds public/assets/models/ferrari_lod.glb: exterior-only, decimated copy of the
// three.js Ferrari for background (parked / traffic) cars.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, prune, dedup } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptSimplifier } from 'meshoptimizer'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
const doc = await io.read('public/assets/models/ferrari.glb')
const DROP = new Set(['interior_light', 'leather', 'interior_dark', 'carpet', 'carbon_fibre_trim', 'carbon fibre', 'brakes', 'nuts', 'centre', 'wipers', 'leds', 'interior', 'brake', 'seats'])
let dropped = 0
for (const node of doc.getRoot().listNodes()) {
  if (DROP.has(node.getName()) && node.getMesh()) { node.setMesh(null); dropped++ }
}
// strip per-vertex attributes that create seams so the simplifier can collapse freely
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const sem of ['NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']) if (prim.getAttribute(sem)) prim.setAttribute(sem, null)
await doc.transform(prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.05, error: 0.02, lockBorder: false }), prune())
// strip draco so the LOD loads without the decoder
for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose()
await io.write('public/assets/models/ferrari_lod.glb', doc)
let tris = 0
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) tris += prim.getIndices() ? prim.getIndices().getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3
console.log('dropped meshes:', dropped, 'triangles:', Math.round(tris))
