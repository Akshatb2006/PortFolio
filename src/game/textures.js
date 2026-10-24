import * as THREE from 'three'

export function makeTextTexture(lines, { w = 512, h = 256, bg = '#111', fg = '#f6c543', font = 'bold 56px Anton, Impact, sans-serif', sub = null, subColor = '#fff', border = '#f6c543', image = null } = {}) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10) }
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const arr = Array.isArray(lines) ? lines : [lines]
  g.font = font; g.fillStyle = fg
  const total = arr.length + (sub ? 1 : 0)
  const step = h / (total + 1)
  arr.forEach((t, i) => g.fillText(t, w / 2, step * (i + 1)))
  if (sub) { g.font = 'bold 30px "Barlow Condensed", sans-serif'; g.fillStyle = subColor; g.fillText(sub, w / 2, step * total) }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Window tiles: 4x4 windows per texture, repeat = (width/16, height/12)
export function makeWindowTextures(seed = 7) {
  let s = seed
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const size = 256
  const map = document.createElement('canvas'); map.width = map.height = size
  const emi = document.createElement('canvas'); emi.width = emi.height = size
  const gm = map.getContext('2d'), ge = emi.getContext('2d')
  gm.fillStyle = '#d8d8d8'; gm.fillRect(0, 0, size, size)
  ge.fillStyle = '#000'; ge.fillRect(0, 0, size, size)
  const cols = 4, rows = 4, cw = size / cols, ch = size / rows
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw + cw * 0.22, y = j * ch + ch * 0.2, w = cw * 0.56, h = ch * 0.55
    gm.fillStyle = '#5d7d9a'; gm.fillRect(x, y, w, h)
    gm.fillStyle = 'rgba(255,255,255,0.25)'; gm.fillRect(x, y, w * 0.4, h)
    gm.fillStyle = 'rgba(0,0,0,0.25)'; gm.fillRect(x, y + h - 3, w, 3)
    const lit = rnd() < 0.55
    ge.fillStyle = lit ? (rnd() < 0.5 ? '#ffd27a' : '#fff1c8') : '#111'
    ge.fillRect(x, y, w, h)
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }
  return { map: mk(map), emissive: mk(emi) }
}

export function makeGarageDoorTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#5a5651'; g.fillRect(0, 0, 256, 128)
  g.fillStyle = '#c9c3b8'; g.fillRect(24, 20, 208, 108)
  g.strokeStyle = '#8a847a'; g.lineWidth = 3
  for (let y = 36; y < 128; y += 16) { g.beginPath(); g.moveTo(24, y); g.lineTo(232, y); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}
