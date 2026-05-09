// Verify each careerText.* node has an attached mesh with vertices.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])

function collect(node, out)
{
    out.push(node)
    for(const c of node.listChildren())
        collect(c, out)
}

const all = []
for(const scene of doc.getRoot().listScenes())
    for(const root of scene.listChildren())
        collect(root, all)

for(const node of all)
{
    const name = node.getName() || ''
    if(/^careerText/.test(name) || name === 'Text.003')
    {
        const mesh = node.getMesh()
        if(!mesh)
        {
            console.log(`${name}: NO MESH attached`)
            continue
        }
        const prims = mesh.listPrimitives()
        const vertCount = prims.reduce((sum, p) => {
            const pos = p.getAttribute('POSITION')
            return sum + (pos ? pos.getCount() : 0)
        }, 0)
        const mats = prims.map(p => p.getMaterial()?.getName() || '(none)').join(',')
        console.log(`${name}: mesh="${mesh.getName()}", prims=${prims.length}, vertices=${vertCount}, mat=${mats}`)
    }
}
