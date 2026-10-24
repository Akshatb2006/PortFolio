// Builds public/assets/models/ferrari_mid.glb: a medium-detail Ferrari for drivable stolen and police cars.
// The background LOD (ferrari_lod.glb, 5 %) tears thin parts such as the windscreen frame up close; this one
// keeps normals, the cabin and mesh borders, and is meshopt-compressed.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, simplify, prune, dedup, meshopt } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer'

const RATIO = Number(process.argv[2] || 0.12), ERROR = Number(process.argv[3] || 0.012), LOCK = process.argv[4] !== 'free'
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read('public/assets/models/ferrari.glb')
const DROP = new Set(['interior_light', 'carbon_fibre_trim', 'carbon fibre', 'brakes', 'nuts', 'centre', 'wipers', 'leds', 'brake'])
for (const node of doc.getRoot().listNodes()) if (DROP.has(node.getName()) && node.getMesh()) node.setMesh(null)
// strip seam-creating attributes so the simplifier can work; smooth normals are recomputed at load time
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const sem of ['NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']) if (prim.getAttribute(sem)) prim.setAttribute(sem, null)
await doc.transform(prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR, lockBorder: LOCK }), prune())
for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose()
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write('public/assets/models/ferrari_mid.glb', doc)
let tris = 0
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) tris += prim.getIndices() ? prim.getIndices().getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3
console.log('triangles:', Math.round(tris))
