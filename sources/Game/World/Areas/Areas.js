import { Game } from '../../Game.js'
import { AltarArea } from './AltarArea.js'
import { CookieArea } from './CookieArea.js'
import { LandingArea } from './LandingArea.js'
import { ProjectsArea } from './ProjectsArea.js'
import { LabArea } from './LabArea.js'
import { CareerArea } from './CareerArea.js'
import { SocialArea } from './SocialArea.js'
import { ToiletArea } from './ToiletArea.js'
import { BowlingArea } from './BowlingArea.js'
import { CircuitArea } from './CircuitArea.js'
import { BehindTheSceneArea } from './BehindTheSceneArea.js'
import { AchievementsArea } from './AchievementsArea.js'
import { TimeMachineArea } from './TimeMachineArea.js'
import { EasterArea } from './EasterArea.js'

export class Areas
{
    constructor()
    {
        this.game = Game.getInstance()

        const list = [
            [ 'achievements', AchievementsArea ],
            [ 'altar', AltarArea ],
            [ 'behindTheScene', BehindTheSceneArea ],
            [ 'bowling', BowlingArea ],
            [ 'career', CareerArea ],
            [ 'circuit', CircuitArea ],
            [ 'cookie', CookieArea ],
            [ 'lab', LabArea ],
            [ 'landing', LandingArea ],
            [ 'projects', ProjectsArea ],
            [ 'social', SocialArea ],
            [ 'toilet', ToiletArea ],
            [ 'timeMachine', TimeMachineArea ],
        ]

        const model = [...this.game.resources.areasModel.scene.children]

        // Bruno-baked 3D text removed at runtime so the world only shows
        // Akshat-relevant content. We can't easily edit the .blend's extruded-
        // letter meshes inside areas.glb without breaking Bruno's marker
        // meshes / Rapier trimesh colliders, so we drop the affected nodes
        // before the area classes process them.
        for(const child of model)
        {
            // 1) The drivable "BRUNO SIMON" billboard is built from a stack of
            //    physical-dynamic letter meshes (refLettersPhysicalDynamic.NNN).
            //    Remove them outright — that skips both the visual and the
            //    physics body that would otherwise be created.
            const lettersToRemove = []
            child.traverse((node) =>
            {
                if(node.name && node.name.startsWith('refLettersPhysicalDynamic'))
                    lettersToRemove.push(node)
            })
            for(const node of lettersToRemove)
                node.removeFromParent()

            // 2) The 3D-extruded company-name letters above each career sign
            //    (UZIK, HETIC, FREELANCER, IMMERSIVE GARDEN, ONLINE TEACHER,
            //    IRL TEACHER). Pure visual meshes — just hide them.
            child.traverse((node) =>
            {
                if(node.name && /^careerText(\.\d+)?$/.test(node.name))
                    node.visible = false
            })
        }

        for(const child of model)
        {
            for(const [ name, AreaClass ] of list)
            {
                if(child.name.startsWith(name))
                    this[name] = new AreaClass(child)
            }
        }

        // // Test how many areas are visible
        // this.game.ticker.events.on('tick', () =>
        // {
        //     let i = 0
        //     if(this.achievements.frustum.isIn)
        //         i++
        //     if(this.altar.frustum.isIn)
        //         i++
        //     if(this.behindTheScene.frustum.isIn)
        //         i++
        //     if(this.bowling.frustum.isIn)
        //         i++
        //     if(this.career.frustum.isIn)
        //         i++
        //     if(this.circuit.frustum.isIn)
        //         i++
        //     if(this.cookie.frustum.isIn)
        //         i++
        //     if(this.lab.frustum.isIn)
        //         i++
        //     if(this.landing.frustum.isIn)
        //         i++
        //     if(this.projects.frustum.isIn)
        //         i++
        //     if(this.social.frustum.isIn)
        //         i++
        //     if(this.toilet.frustum.isIn)
        //         i++

        //     console.log(i)
        // }, 6)
    }
}