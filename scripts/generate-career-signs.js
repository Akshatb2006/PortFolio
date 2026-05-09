// Regenerates the 168x60 career sign PNGs in static/career/ to reflect Akshat
// Baranwal's experience. Run with: node scripts/generate-career-signs.js
//
// Each original sign keeps its filename (the .glb model references those material
// names). Run `npm run compress` afterwards to also regenerate the .ktx versions.

import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'static', 'career')

const W = 168
const H = 60
const RED = '#FF0000'
const GREEN = '#00FF00'
const BLACK = '#000000'

// Each sign: filename → list of rows. Each row: { text, bg }
// Two-row signs use 30px rows; three-row signs use 20px rows.
const signs = {
    // Was UZIK / LEAD DEV. → Autometa.ai SDE intern
    careerUzik: [
        { text: 'AUTOMETA.AI', bg: BLACK },
        { text: 'SDE INTERN',  bg: GREEN },
    ],
    // Was IMMERSIVE GARDEN / LEAD DEV. → ApartmentHub full stack
    careerImmersiveGarden: [
        { text: 'APARTMENTHUB',   bg: BLACK },
        { text: 'FULL STACK DEV.', bg: GREEN },
    ],
    // Was FREELANCER / CREATIVE DEV. → Freelance React work
    careerFreelancer: [
        { text: 'FREELANCE',  bg: BLACK },
        { text: 'REACT DEV.', bg: GREEN },
    ],
    // Was HETIC STUDENT / +5 YEARS DIPLOMA → Polaris School (school sign)
    careerHetic: [
        { text: 'POLARIS SCHOOL', bg: BLACK },
        { text: 'B.TECH AI-ML',   bg: GREEN },
    ],
    // 3-row: was ONLINE TEACHER / THREE.JS JOURNEY / +46K STUDENTS
    careerOnlineTeacher: [
        { text: 'GOOGLE GSOC',    bg: BLACK },
        { text: 'CHAOSS / AUGUR', bg: GREEN },
        { text: 'OPEN SRC DEV.',  bg: BLACK },
    ],
    // 3-row: was IRL TEACHER / WEB DEV. / +400 STUDENTS
    careerIRLTeacher: [
        { text: 'SUMMER OF',    bg: BLACK },
        { text: 'BITCOIN 2025', bg: GREEN },
        { text: 'DEV FELLOW',   bg: BLACK },
    ],
}

function buildSvg(rows)
{
    const rowH = Math.floor(H / rows.length)
    const padding = 4
    const widthBudget = W - padding * 2
    // librsvg's default bold sans renders at ~0.7em per char. Use that to
    // compute a per-row font size that's guaranteed to fit horizontally.
    const charRatio = 0.7
    const maxByHeight = rows.length === 3 ? 16 : 24

    let body = ''
    rows.forEach((row, i) =>
    {
        const y = i * rowH
        const sizeByWidth = widthBudget / (row.text.length * charRatio)
        const fontSize = Math.max(8, Math.floor(Math.min(maxByHeight, sizeByWidth)))

        body += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="${row.bg}"/>`
        body += `<text x="${W / 2}" y="${y + rowH / 2}" font-family="Impact, 'Arial Black', sans-serif" font-weight="900" font-size="${fontSize}" fill="${RED}" text-anchor="middle" dominant-baseline="central">${row.text}</text>`
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
}

for(const [name, rows] of Object.entries(signs))
{
    const svg = buildSvg(rows)
    const outPath = path.join(outDir, `${name}.png`)

    await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, palette: false })
        .toFile(outPath)

    console.log(`Wrote ${outPath}`)
}

console.log('\nDone. Run `npm run compress` to regenerate the matching .ktx files for production builds.')
