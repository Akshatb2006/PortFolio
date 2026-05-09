// Print extras (Blender custom-properties / userData) for ref* nodes.
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

const filter = process.argv[3] || ''
for(const node of all)
{
    const name = node.getName() || ''
    if(filter && !name.includes(filter)) continue
    const extras = node.getExtras()
    const hasExtras = extras && Object.keys(extras).length > 0
    const meshName = node.getMesh()?.getName() || ''
    if(name.startsWith('ref') || hasExtras)
    {
        console.log(`${name}  mesh=${meshName ? meshName : '∅'}  extras=${JSON.stringify(extras || {})}`)
    }
}
