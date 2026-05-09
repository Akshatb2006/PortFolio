// Patches the original areas.glb by copying just the text-mesh primitives
// from a Blender-rebuilt GLB. Avoids the fragility of re-exporting the entire
// scene from .blend (which can drop tiny marker meshes like Cube.212).
//
// Usage:
//   node scripts/patch-areas-text.js <orig.glb> <new.glb> <out.glb>
//
// Targets: Text.003 (BRUNO SIMON → AKSHAT BARANWAL) and careerText[.001..005].

import { NodeIO, Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const [origPath, newPath, outPath] = process.argv.slice(2)
if(!origPath || !newPath || !outPath)
{
    console.error('Usage: node scripts/patch-areas-text.js <orig.glb> <new.glb> <out.glb>')
    process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const orig = await io.read(origPath)
const fresh = await io.read(newPath)

function indexNodes(doc)
{
    const out = new Map()
    function walk(node)
    {
        const n = node.getName()
        if(n && !out.has(n)) out.set(n, node)
        for(const c of node.listChildren()) walk(c)
    }
    for(const scene of doc.getRoot().listScenes())
        for(const root of scene.listChildren())
            walk(root)
    return out
}

const origMap = indexNodes(orig)
const newMap  = indexNodes(fresh)

const TARGETS = [
    'Text.003',
    'careerText',
    'careerText.001', 'careerText.002', 'careerText.003',
    'careerText.004', 'careerText.005',
]

// Helper: copy an Accessor's data buffer and attributes from `fresh` into a
// fresh Accessor inside the `orig` document.
function cloneAccessor(orig, freshAcc)
{
    if(!freshAcc) return null
    const acc = orig.createAccessor(freshAcc.getName())
    acc.setType(freshAcc.getType())
    acc.setArray(freshAcc.getArray().slice())
    if(freshAcc.getNormalized()) acc.setNormalized(true)
    return acc
}

for(const name of TARGETS)
{
    const origNode = origMap.get(name)
    const newNode  = newMap.get(name)
    if(!origNode) { console.warn(`  skip ${name}: not in orig`); continue }
    if(!newNode)  { console.warn(`  skip ${name}: not in new`);  continue }

    const newMesh = newNode.getMesh()
    if(!newMesh)
    {
        console.warn(`  skip ${name}: new node has no mesh`)
        continue
    }

    // Build a fresh Mesh inside the orig document. Re-bind to the original's
    // existing material if a same-named one exists; else fall back to the
    // material currently attached to the orig node.
    const origMesh = origNode.getMesh()
    const fallbackMat = origMesh?.listPrimitives()?.[0]?.getMaterial() || null

    const newPrim = newMesh.listPrimitives()[0]
    const matName = newPrim.getMaterial()?.getName()
    const origMat = matName
        ? orig.getRoot().listMaterials().find(m => m.getName() === matName)
        : null
    const targetMat = origMat || fallbackMat

    const prim = orig.createPrimitive()
    prim.setMode(newPrim.getMode())
    if(targetMat) prim.setMaterial(targetMat)

    // Copy attributes (POSITION, NORMAL, TEXCOORD_0, etc.) and indices.
    for(const semantic of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0'])
    {
        const a = newPrim.getAttribute(semantic)
        if(a) prim.setAttribute(semantic, cloneAccessor(orig, a))
    }
    const indexAcc = newPrim.getIndices()
    if(indexAcc) prim.setIndices(cloneAccessor(orig, indexAcc))

    const mesh = orig.createMesh(newMesh.getName() || name)
    mesh.addPrimitive(prim)

    origNode.setMesh(mesh)

    const verts = prim.getAttribute('POSITION').getCount()
    console.log(`  patched ${name}  verts=${verts}  mat=${targetMat?.getName() || '∅'}`)
}

await io.write(outPath, orig)
console.log(`\nWrote: ${outPath}`)
