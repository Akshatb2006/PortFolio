// Walk every scene's hierarchy and print tree with indentation.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const filter = process.argv[3]

function walk(node, depth)
{
    const name = node.getName() || '(unnamed)'
    if(!filter || name.includes(filter) || depth < 2)
        process.stdout.write('  '.repeat(depth) + name + '\n')
    for(const child of node.listChildren())
        walk(child, depth + 1)
}
for(const scene of doc.getRoot().listScenes())
    for(const root of scene.listChildren())
        walk(root, 0)
