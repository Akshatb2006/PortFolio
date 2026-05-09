// Generates static/social/share-image.png — the 1200x630 OG/Twitter card
// preview. Run with: node scripts/generate-share-image.js
//
// This is the social-preview shown when the portfolio URL is shared on
// Twitter/X, LinkedIn, etc. Tune the gradient / text below as you like.

import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'static', 'social', 'share-image.png')

const W = 1200
const H = 630

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f1626"/>
      <stop offset="100%" stop-color="#1a2c4a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5fb3ff"/>
      <stop offset="100%" stop-color="#7ddc9b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Accent bar -->
  <rect x="80" y="220" width="180" height="8" fill="url(#accent)"/>

  <!-- Name -->
  <text x="80" y="200" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="120" fill="#ffffff" letter-spacing="-3">Akshat Baranwal</text>

  <!-- Tagline -->
  <text x="80" y="290" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="500" font-size="40" fill="#cdd9e8">CS undergrad · Frontend &amp; ML developer</text>

  <!-- Highlights -->
  <text x="80" y="360" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="400" font-size="30" fill="#5fb3ff">GSoC 2025 · CHAOSS / Augur</text>
  <text x="80" y="402" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="400" font-size="30" fill="#7ddc9b">SDE Intern · Autometa.ai</text>
  <text x="80" y="444" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="400" font-size="30" fill="#e08fe6">Full Stack · ApartmentHub</text>

  <!-- URL hint -->
  <text x="80" y="${H - 60}" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="600" font-size="26" fill="#ffffff" opacity="0.55">portfolio · drive around to explore</text>
</svg>`

await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(outPath)

console.log(`Wrote ${outPath}`)
