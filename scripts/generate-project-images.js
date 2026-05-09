// Generates placeholder PNGs for projects + lab. Run with:
//   node scripts/generate-project-images.js
//
// projects/  → 960x540 full-size cards (shipped/client work)
// lab/       → 960x540 full-size + 240x136 thumbnails (research/personal work)
//
// Replace any of these with a real screenshot when you have one (same path
// and dimensions, or update the dimensions here and rerun).

import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectsDir = path.join(__dirname, '..', 'static', 'projects', 'images')
const labDir = path.join(__dirname, '..', 'static', 'lab', 'images')

const FULL = { w: 960, h: 540, titleSize: 80, taglineSize: 32, taglineY: 280, footerSize: 22, accentY: 220 }
const MINI = { w: 240, h: 136, titleSize: 26, taglineSize: 12,  taglineY: 78,  footerSize: 0,  accentY: 60  }

function buildSvg({ title, tagline, bg, accent }, dims)
{
    const showFooter = dims.footerSize > 0
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}">
  <rect width="${dims.w}" height="${dims.h}" fill="${bg}"/>
  <rect x="${dims.w * 0.0625}" y="${dims.accentY}" width="${dims.w * 0.125}" height="${dims.h * 0.011}" fill="${accent}"/>
  <text x="${dims.w * 0.0625}" y="${dims.accentY - 22}" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="${dims.titleSize}" fill="#ffffff" letter-spacing="-2">${title}</text>
  <text x="${dims.w * 0.0625}" y="${dims.taglineY}" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="400" font-size="${dims.taglineSize}" fill="${accent}">${tagline}</text>
  ${showFooter ? `<text x="${dims.w * 0.0625}" y="${dims.h - 40}" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="600" font-size="${dims.footerSize}" fill="#ffffff" opacity="0.6">akshat baranwal</text>` : ''}
</svg>`
}

const projects = [
    { stem: 'insightedge',   title: 'InsightEdge',   tagline: 'MERN analytics dashboard',           bg: '#1f2c3d', accent: '#5fb3ff' },
    { stem: 'apartmenthub',  title: 'ApartmentHub',  tagline: 'React property discovery platform',  bg: '#1c3a2e', accent: '#7ddc9b' },
    { stem: 'resume-parser', title: 'Resume Parser', tagline: 'Autometa.ai SaaS module',            bg: '#3b1f3a', accent: '#e08fe6' },
]

const lab = [
    { stem: 'actitrace',   title: 'ActiTrace',                  tagline: 'Human activity recognition (XGBoost)',   bg: '#3a2818', accent: '#ffb37a' },
    { stem: 'life-drift',  title: 'Life Drift',                 tagline: 'RL environment for cognitive load',      bg: '#2c2444', accent: '#a6a0ff' },
    { stem: 'robot-paint', title: 'Robot Paint Optimizer',      tagline: 'Trajectory + collision-aware planning',  bg: '#1a3536', accent: '#7adcd5' },
    { stem: 'secure-tx',   title: 'Secure Transaction Storage', tagline: 'AES-256-GCM envelope encryption',        bg: '#2a1a1a', accent: '#ff8e8e' },
    { stem: 'veridict',    title: 'VERIDICT',                   tagline: 'AI trading verification on Flare',       bg: '#1a2c1a', accent: '#cdf08a' },
]

async function write(filePath, svg)
{
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(filePath)
    console.log(`Wrote ${filePath}`)
}

// projects: 960x540 single full-size, named `<stem>-1.png`
for(const p of projects)
{
    await write(path.join(projectsDir, `${p.stem}-1.png`), buildSvg(p, FULL))
}

// lab: 960x540 `<stem>.png` + 240x136 `<stem>-mini.png`
for(const p of lab)
{
    await write(path.join(labDir, `${p.stem}.png`),       buildSvg(p, FULL))
    await write(path.join(labDir, `${p.stem}-mini.png`),  buildSvg(p, MINI))
}

console.log('\nDone. Replace any of these with a real screenshot when you have one (same filename + dimensions).')
