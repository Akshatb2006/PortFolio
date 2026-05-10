import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class TreasureBox
{
    constructor()
    {
        this.game = Game.getInstance()

        // Default position derived from the user-provided minimap pin (upper-right
        // beside the time-machine lake on a 192-unit terrain). Drag in #debug to
        // fine-tune, then update these values to make it permanent.
        this.position = { x: 19, y: 0.5, z: -69 }

        this.setObject()
        this.setInteractivePoint()
        this.setCopyButton()
        this.setRespawn()
        this.setDebug()
    }

    setRespawn()
    {
        // Register a respawn entry so the map pin and the nearest-respawn key
        // (R) work the same way as for Blender-authored areas. Offset in +X so
        // the car drops next to the chest instead of stacking on top of it.
        this.game.respawns.items.set('treasureBox', {
            name: 'treasureBox',
            position: new THREE.Vector3(this.position.x + 3, 4, this.position.z),
            rotation: 0,
        })
    }

    setCopyButton()
    {
        const button = document.querySelector('.js-upi-copy')
        if(!button)
            return

        const idElement = document.querySelector('.js-upi-id')
        let resetTimer = null

        button.addEventListener('click', async () =>
        {
            const value = button.dataset.copy || (idElement && idElement.textContent.trim())
            if(!value)
                return

            try
            {
                if(navigator.clipboard?.writeText)
                    await navigator.clipboard.writeText(value)
                else
                {
                    const tmp = document.createElement('textarea')
                    tmp.value = value
                    document.body.appendChild(tmp)
                    tmp.select()
                    document.execCommand('copy')
                    document.body.removeChild(tmp)
                }
                button.textContent = 'Copied!'
            }
            catch
            {
                button.textContent = 'Copy failed'
            }

            clearTimeout(resetTimer)
            resetTimer = setTimeout(() => { button.textContent = 'Copy' }, 1500)
        })
    }

    setObject()
    {
        const sourceCrate = this.game.resources.explosiveCratesModel.scene.children[0]
        const model = sourceCrate.clone(true)
        model.position.set(0, 0, 0)
        model.rotation.set(0, 0, 0)

        // Skip the default material assignment so the explosive-crate look (TNT
        // labels, dark wood) doesn't survive on the clone, then paint every mesh
        // with a single gold material. hasWater is disabled so the chest stays
        // gold even when the lake water-surface band passes over its meshes,
        // and brighter gold survives night-time light intensity.
        const goldMaterial = new MeshDefaultMaterial({
            colorNode: color('#ffd95a'),
            hasWater: false,
        })

        model.traverse((node) =>
        {
            if(node.isMesh)
                node.material = goldMaterial
        })

        this.object = this.game.objects.add(
            {
                model: model,
                updateMaterials: false,
            },
            {
                type: 'fixed',
                position: { x: this.position.x, y: this.position.y, z: this.position.z },
                friction: 0.7,
                colliders: [ { shape: 'cuboid', parameters: [ 0.5, 0.5, 0.5 ], category: 'object' } ],
            }
        )
    }

    setInteractivePoint()
    {
        const pointPosition = new THREE.Vector3(this.position.x, this.position.y + 1.2, this.position.z)

        this.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            'Tip Jar',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.modals.open('upi')
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    moveTo(x, y, z)
    {
        this.position.x = x
        this.position.y = y
        this.position.z = z

        if(this.object?.physical?.body)
            this.object.physical.body.setTranslation({ x, y, z }, true)

        if(this.object?.visual?.object3D)
            this.object.visual.object3D.position.set(x, y, z)
    }

    setDebug()
    {
        if(!this.game.debug.active)
            return

        const folder = this.game.debug.panel.addFolder({
            title: '🎁 Treasure box',
            expanded: false,
        })

        folder.addBinding(this.position, 'x', { min: -96, max: 96, step: 0.1 })
            .on('change', (e) => this.moveTo(e.value, this.position.y, this.position.z))
        folder.addBinding(this.position, 'y', { min: -5, max: 10, step: 0.1 })
            .on('change', (e) => this.moveTo(this.position.x, e.value, this.position.z))
        folder.addBinding(this.position, 'z', { min: -96, max: 96, step: 0.1 })
            .on('change', (e) => this.moveTo(this.position.x, this.position.y, e.value))

        folder.addButton({ title: 'Log position' }).on('click', () =>
        {
            console.log(`TreasureBox position: x=${this.position.x.toFixed(2)}, y=${this.position.y.toFixed(2)}, z=${this.position.z.toFixed(2)}`)
        })
    }
}
