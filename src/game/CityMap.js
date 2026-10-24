// Pure layout data for the city: grid maths, districts, colliders and the
// 2D ground painting (used both as the ground texture and the map/radar).

export const N = 8            // blocks per side
export const BLOCK = 36       // block size (units)
export const ROAD = 14        // road width (units)
export const PITCH = BLOCK + ROAD
export const SIZE = N * PITCH + ROAD
export const ORIGIN = -SIZE / 2
export const MAP_PX = 2048
export const PX = MAP_PX / SIZE

export const roadCoord = (i) => ORIGIN + ROAD / 2 + i * PITCH        // centre line of road i (0..N)
export const blockStart = (j) => ORIGIN + ROAD + j * PITCH             // start of block j (0..N-1)
export const blockCenter = (j) => blockStart(j) + BLOCK / 2

// Inclusive block ranges [bx0, bz0, bx1, bz1]
export const districts = [
  { id: 'home',         name: 'Grove Street',     range: [0, 3, 1, 7], ground: '#5f8a3f', pave: '#8c8778' },
  { id: 'lab',          name: 'Research Park',    range: [0, 0, 2, 2], ground: '#9ea9a6', pave: '#9ea9a6' },
  { id: 'downtown',     name: 'Downtown',         range: [3, 0, 5, 2], ground: '#8f8f93', pave: '#8f8f93' },
  { id: 'career',       name: 'Career Heights',   range: [6, 0, 7, 2], ground: '#7c7368', pave: '#7c7368' },
  { id: 'park',         name: 'Central Park',     range: [2, 3, 5, 4], ground: '#4f8c3a', pave: '#4f8c3a' },
  { id: 'skills',       name: 'Mod Garage',       range: [6, 3, 7, 4], ground: '#6b6560', pave: '#6b6560' },
  { id: 'social',       name: 'Sunset Pier',      range: [2, 5, 4, 7], ground: '#d9c48a', pave: '#d9c48a' },
  { id: 'achievements', name: 'Trophy Stadium',   range: [5, 5, 7, 7], ground: '#857f7a', pave: '#857f7a' },
]

export function districtOfBlock(bx, bz) {
  return districts.find(d => bx >= d.range[0] && bx <= d.range[2] && bz >= d.range[1] && bz <= d.range[3]) || null
}

export function districtAt(x, z) {
  const bx = Math.max(0, Math.min(N - 1, Math.floor((x - ORIGIN - ROAD / 2) / PITCH)))
  const bz = Math.max(0, Math.min(N - 1, Math.floor((z - ORIGIN - ROAD / 2) / PITCH)))
  return districtOfBlock(bx, bz)
}

export function districtCenter(d) {
  const [x0, z0, x1, z1] = d.range
  return { x: (blockStart(x0) + blockStart(x1) + BLOCK) / 2, z: (blockStart(z0) + blockStart(z1) + BLOCK) / 2 }
}

// Water rectangle (inside the beach blocks, south part)
export const WATER = { x0: blockStart(2), x1: blockStart(4) + BLOCK, z0: blockStart(7) + 12, z1: blockStart(7) + BLOCK }

// ---------------------------------------------------------------------------
// Colliders. Buildings are AABBs; trees/pillars are circles.
export const colliders = { boxes: [], circles: [], slabs: [] }
// Walkable block slabs (sidewalk rings, plazas, lawns, sand): low boxes from the ground up to height h.
export function addSlab(x0, z0, x1, z1, h) { colliders.slabs.push({ x0, z0, x1, z1, h }) }
export function addBox(x0, z0, x1, z1, h = 0) { colliders.boxes.push({ x0, z0, x1, z1, h }) }
export function addCircle(x, z, r, h = 0) { colliders.circles.push({ x, z, r, h }) }

// ---------------------------------------------------------------------------
// Deterministic PRNG so the city is identical on every visit.
export function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

// ---------------------------------------------------------------------------
// Paint the ground. Returns an HTMLCanvasElement of MAP_PX x MAP_PX.
export function paintGround() {
  const c = document.createElement('canvas')
  c.width = c.height = MAP_PX
  const g = c.getContext('2d')
  const u = (v) => (v - ORIGIN) * PX // units -> px

  // base
  g.fillStyle = '#3f6b2f'
  g.fillRect(0, 0, MAP_PX, MAP_PX)

  // blocks
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const d = districtOfBlock(bx, bz)
    g.fillStyle = d ? d.ground : '#777'
    g.fillRect(u(blockStart(bx)), u(blockStart(bz)), BLOCK * PX, BLOCK * PX)
    // sidewalk rim
    if (d && d.id !== 'park' && d.id !== 'social') {
      g.strokeStyle = 'rgba(255,255,255,0.18)'
      g.lineWidth = 2 * PX
      g.strokeRect(u(blockStart(bx)) + PX, u(blockStart(bz)) + PX, BLOCK * PX - 2 * PX, BLOCK * PX - 2 * PX)
    }
    if (d && d.id === 'home') {
      // lawns with a paved pad
      g.fillStyle = '#8c8778'
      g.fillRect(u(blockStart(bx)), u(blockStart(bz)), BLOCK * PX, 3 * PX)
      g.fillRect(u(blockStart(bx)), u(blockStart(bz) + BLOCK - 3), BLOCK * PX, 3 * PX)
    }
  }

  // park paths
  const parkD = districts.find(d => d.id === 'park')
  const pc = districtCenter(parkD)
  g.strokeStyle = '#c9b98a'
  g.lineWidth = 3 * PX
  g.beginPath(); g.moveTo(u(blockStart(2)), u(pc.z)); g.lineTo(u(blockStart(5) + BLOCK), u(pc.z)); g.stroke()
  g.beginPath(); g.moveTo(u(pc.x), u(blockStart(3))); g.lineTo(u(pc.x), u(blockStart(4) + BLOCK)); g.stroke()
  g.fillStyle = '#c9b98a'; g.beginPath(); g.arc(u(pc.x), u(pc.z), 9 * PX, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#4c9fd6'; g.beginPath(); g.arc(u(pc.x), u(pc.z), 6 * PX, 0, Math.PI * 2); g.fill()

  // roads
  g.fillStyle = '#2b2b30'
  for (let i = 0; i <= N; i++) {
    g.fillRect(0, u(roadCoord(i) - ROAD / 2), MAP_PX, ROAD * PX)
    g.fillRect(u(roadCoord(i) - ROAD / 2), 0, ROAD * PX, MAP_PX)
  }
  // lane markings: dashed yellow centre + white edges, only between intersections
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const a = blockStart(j), b = blockStart(j) + BLOCK
    const rc = roadCoord(i)
    // horizontal segment (along x) on road row i
    g.strokeStyle = '#e4c24a'; g.lineWidth = 0.6 * PX; g.setLineDash([3 * PX, 3 * PX])
    g.beginPath(); g.moveTo(u(a), u(rc)); g.lineTo(u(b), u(rc)); g.stroke()
    g.beginPath(); g.moveTo(u(rc), u(a)); g.lineTo(u(rc), u(b)); g.stroke()
    g.setLineDash([])
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.4 * PX
    for (const off of [-ROAD / 2 + 0.8, ROAD / 2 - 0.8]) {
      g.beginPath(); g.moveTo(u(a), u(rc + off)); g.lineTo(u(b), u(rc + off)); g.stroke()
      g.beginPath(); g.moveTo(u(rc + off), u(a)); g.lineTo(u(rc + off), u(b)); g.stroke()
    }
    // crosswalks at segment ends
    g.fillStyle = 'rgba(255,255,255,0.75)'
    for (const end of [a, b]) {
      const dir = end === a ? 1 : -1
      for (let k = 0; k < 6; k++) {
        const o = -ROAD / 2 + 1.2 + k * 2.1
        g.fillRect(u(end + dir * 0.6 - (dir < 0 ? 2 : 0)), u(rc + o), 2 * PX, 1.2 * PX)
        g.fillRect(u(rc + o), u(end + dir * 0.6 - (dir < 0 ? 2 : 0)), 1.2 * PX, 2 * PX)
      }
    }
  }

  // beach: sand gradient + water + pier
  g.fillStyle = '#2f7fb8'
  g.fillRect(u(WATER.x0), u(WATER.z0), (WATER.x1 - WATER.x0) * PX, (WATER.z1 - WATER.z0) * PX)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  for (let k = 0; k < 6; k++) g.fillRect(u(WATER.x0), u(WATER.z0 + 1 + k * 3.6), (WATER.x1 - WATER.x0) * PX, 0.5 * PX)
  // pier (wood)
  const pierX = blockCenter(3)
  g.fillStyle = '#7a4f2a'
  g.fillRect(u(pierX - 4), u(WATER.z0 - 2), 8 * PX, 20 * PX)
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.3 * PX
  for (let k = 0; k < 20; k++) { g.beginPath(); g.moveTo(u(pierX - 4), u(WATER.z0 - 2 + k)); g.lineTo(u(pierX + 4), u(WATER.z0 - 2 + k)); g.stroke() }

  // stadium pitch (centre block of the stadium district)
  const sx = blockCenter(6), sz = blockCenter(6)
  g.fillStyle = '#3f8a3a'; g.beginPath(); g.ellipse(u(sx), u(sz), 15 * PX, 11 * PX, 0, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#fff'; g.lineWidth = 0.4 * PX; g.beginPath(); g.ellipse(u(sx), u(sz), 12 * PX, 8 * PX, 0, 0, Math.PI * 2); g.stroke()

  return c
}

// Road graph for traffic
export function roadGraph() {
  const nodes = []
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) nodes.push({ i, j, x: roadCoord(i), z: roadCoord(j) })
  const idx = (i, j) => j * (N + 1) + i
  for (const n of nodes) {
    n.nb = []
    if (n.i > 0) n.nb.push(idx(n.i - 1, n.j))
    if (n.i < N) n.nb.push(idx(n.i + 1, n.j))
    if (n.j > 0) n.nb.push(idx(n.i, n.j - 1))
    if (n.j < N) n.nb.push(idx(n.i, n.j + 1))
  }
  return nodes
}
