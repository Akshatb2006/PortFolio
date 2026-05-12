import { Events } from './Events.js'
import { Game } from './Game.js'

export class Quality
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4
        const fewCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4
        this.isMobile = isMobileUA
        this.isConstrained = isMobileUA || lowMemory || fewCores
        this.level = this.isConstrained ? 1 : 0 // 0 = highest quality

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '⚙️ Quality',
                expanded: false,
            })

            this.game.debug.addButtons(
                debugPanel,
                {
                    low: () =>
                    {
                        this.changeLevel(1)
                    },
                    high: () =>
                    {
                        this.changeLevel(0)
                    },
                },
                'change'
            )
        }
    }

    changeLevel(level = 0)
    {
        // Same
        if(level === this.level)
            return
            
        this.level = level
        this.events.trigger('change', [ this.level ])
    }
}