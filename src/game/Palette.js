import * as THREE from 'three'

// Art direction for the stylised look: one palette, matte materials, subtle procedural detail.
export const palette = {
  sky: { zenith: '#4f86c6', horizon: '#f2c9a0', ground: '#d9b08c' },
  road: '#3a3d46', roadNoise: 0.05, laneYellow: '#f0c04a', laneWhite: '#f1efe8',
  pavement: '#cfc4b2', pavementLine: '#bdb19f', grass: '#6fa74a', sand: '#e8d3a6',
  water: '#2f7fa8',
  trim: '#2d2f38', metal: '#5c6068', sill: '#f2eee6', roof: '#555862',
  districts: {
    downtown: ['#9fb2bf', '#b7c3cc', '#7f93a3', '#c9cfd4', '#8aa0b0'],
    lab: ['#eef1ec', '#dfe9e3', '#cfe3d6', '#f4f1e8'],
    career: ['#b65a42', '#c97a5a', '#9c4b3a', '#d08b6c'],
    home: ['#f1d5b3', '#e8b8a8', '#cfd9b2', '#f4e2b8', '#d8c8e8', '#f0c9a0'],
    skills: ['#4d4f58', '#5a5d66', '#3f424a'],
    achievements: ['#d8d0c4', '#c8c0b4'],
  },
  glass: '#1d3a52', glassTower: '#5e8db0', awnings: ['#c9473a', '#2b7a78', '#e2a33c', '#3c5a99', '#7b4b94'],
  leaf: ['#4e9a3a', '#5fae45', '#3f8a35', '#73b24f'], bark: '#6b4a33',
}

// low-contrast noise so flat colours still read as surfaces
export function noiseTexture(hex, variance = 0.06, size = 256, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'); const base = new THREE.Color(hex)
  const img = g.createImageData(size, size); const d = img.data
  let s = 1234567
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < d.length; i += 4) {
    const v = 1 + (rnd() - 0.5) * variance * 2
    d[i] = Math.min(255, base.r * 255 * v); d[i + 1] = Math.min(255, base.g * 255 * v); d[i + 2] = Math.min(255, base.b * 255 * v); d[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  t.repeat.set(repeat, repeat)
  return t
}

export function pavingTexture(hex, lineHex, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, size, size)
  g.strokeStyle = lineHex; g.lineWidth = 3
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * size / 2); g.lineTo(size, i * size / 2); g.stroke(); g.beginPath(); g.moveTo(i * size / 2, 0); g.lineTo(i * size / 2, size); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

export function matte(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra }) }
export function texMat(tex, tile, extra = {}) { const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, ...extra }); m.userData.tile = tile; return m }
