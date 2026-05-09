import * as THREE from 'three/webgpu'

const text = `
 █████╗ ██╗  ██╗███████╗██╗  ██╗ █████╗ ████████╗
██╔══██╗██║ ██╔╝██╔════╝██║  ██║██╔══██╗╚══██╔══╝
███████║█████╔╝ ███████╗███████║███████║   ██║
██╔══██║██╔═██╗ ╚════██║██╔══██║██╔══██║   ██║
██║  ██║██║  ██╗███████║██║  ██║██║  ██║   ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝

██████╗  █████╗ ██████╗  █████╗ ███╗   ██╗██╗    ██╗ █████╗ ██╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗████╗  ██║██║    ██║██╔══██╗██║
██████╔╝███████║██████╔╝███████║██╔██╗ ██║██║ █╗ ██║███████║██║
██╔══██╗██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║███╗██║██╔══██║██║
██████╔╝██║  ██║██║  ██║██║  ██║██║ ╚████║╚███╔███╔╝██║  ██║███████╗
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝

╔═ Intro ═══════════════╗
║ Hi, I'm Akshat — CS undergrad at Polaris School of Technology (AI-ML).
║ I work across frontend, backend, and ML. Drive around to explore.
╚═══════════════════════╝

╔═ Socials ═══════════════╗
║ Mail     ⇒ your-email@example.com
║ GitHub   ⇒ https://github.com/your-github-handle
║ LinkedIn ⇒ https://www.linkedin.com/in/your-linkedin-handle/
║ X        ⇒ https://x.com/your-x-handle
╚═══════════════════════╝

╔═ Experience ══════════╗
║ SDE Intern  ⇒ Autometa.ai (Aug 2025 – Jan 2026)
║ Full Stack  ⇒ ApartmentHub (Nov 2025 – April 2026)
║ GSoC 2025   ⇒ CHAOSS / Augur
║ SoB 2025    ⇒ Summer of Bitcoin (Round 2 Fellow)
╚═══════════════════════╝

╔═ Stack ═══════════════╗
║ Three.js release: ${THREE.REVISION}
╚═══════════════════════╝

╔═ Debug ═══════════════╗
║ Add #debug to the URL and reload to access debug mode.
║ Press [V] to toggle the free camera.
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]
