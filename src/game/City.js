import * as THREE from 'three'
import { PARKED_TYPES } from './KenneyCars.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as M from './CityMap.js'
import { pbrMaterial, worldUV } from './Assets.js'
import { makeTextTexture } from './textures.js'
import { palette as P, noiseTexture, pavingTexture, matte, texMat } from './Palette.js'
import { BENCHMARK, buildBenchmark } from './Benchmark.js'
import { buildVillage } from './Village.js'
import { buildScenery } from './Scenery.js'
import { buildLandmarks as buildScenicLandmarks } from './Landmarks.js'
import { SHOWCASE, makeShowcaseMaterials, showcaseNight, buildShowcaseLot, buildShowcaseStreet } from './Showcase.js'
import { createBuckets, mergeBuckets, createRng, blockRng, legacyDraws, typologyFor, buildDowntown, DOWNTOWN_LANDMARKS, WALL_BUCKETS, wallBox } from './BuildingKit.js'

const { N, BLOCK, ROAD, SIZE, blockStart, blockCenter, roadCoord, districtOfBlock, addBox, addCircle } = M
const Y_SLAB = 0.18

const SHARED_STREAM_GUARD = () => { throw new Error('Building generation must not use the shared world-placement stream') }

export class City {
  constructor(scene, assets, landmarks, physics, quality, bgCars) {
    this.scene = scene; this.assets = assets; this.physics = physics; this.quality = quality; this.bgCars = bgCars
    this.group = new THREE.Group(); scene.add(this.group)
    this.rand = createRng(1337)   // shared stream (same generator as CityMap.rng)
    this.groundCanvas = M.paintGround()
    this.uNight = { value: 0 }
    this.treeSpots = []; this.palmSpots = []; this.neon = []; this.lampPos = []
    this.makeMaterials()
    this.buildGround()
    this.buildBlocks()
    this.buildPark()
    this.buildBeach()
    if (this.scenery) this.landmarks = buildScenicLandmarks(this.scene, this.assets)   // waterfalls, temple, Aurora Point
    this.buildStadium()
    this.buildLandmarks(landmarks)
    this.buildBoundary()
    this.buildTrees()
    this.buildStreetFurniture()
    this.buildParkedCars()
    this.buildDynamicProps()
  }

  makeMaterials() {
    const asphaltTex = noiseTexture(P.road, P.roadNoise, 512)
    const grassTex = noiseTexture(P.grass, 0.07, 256)
    const sandTex = noiseTexture(P.sand, 0.04, 256)
    const wallTex = noiseTexture('#ffffff', 0.035, 256)
    this.mat = {
      asphalt: texMat(asphaltTex, 9, { roughness: 0.9 }),
      pavement: texMat(pavingTexture(P.pavement, P.pavementLine), 4),
      // lawns: the photo grass set (Poly Haven, already shipped for the outer terrain), tinted to a lawn green
      grass: this.assets?.sets?.grass ? pbrMaterial(this.assets.sets.grass, { tile: 5, color: 0x9fbf6a }) : texMat(grassTex, 6),
      sand: texMat(sandTex, 6),
      brick: texMat(wallTex, 4, { vertexColors: true }),
      concrete: texMat(wallTex, 4, { vertexColors: true }),
      concreteDark: texMat(wallTex, 4, { vertexColors: true }),
      concreteWarm: texMat(wallTex, 4, { vertexColors: true }),
      trim: matte(P.trim, { roughness: 0.7 }),
      metal: matte(P.metal, { roughness: 0.5, metalness: 0.3, vertexColors: true }),
      line: matte(P.laneWhite, { roughness: 0.8 }),
      lineYellow: matte(P.laneYellow, { roughness: 0.8 }),
      glassTower: new THREE.MeshStandardMaterial({ color: P.glassTower, roughness: 0.25, metalness: 0.55, envMapIntensity: 0.9, vertexColors: true }),
      roof: matte(P.roof, { vertexColors: true }),
      awning: matte('#ffffff', { vertexColors: true, side: THREE.DoubleSide }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
      bark: matte(P.bark),
      lampHead: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 0 }),
      crate: matte('#d9a35a'),
      barrel: matte('#c9382c', { roughness: 0.5, metalness: 0.2 }),
      cone: matte('#ff7a1f'),
      sill: matte(P.sill, { vertexColors: true }),
      shopGlass: new THREE.MeshStandardMaterial({ color: '#7fb3d6', roughness: 0.15, metalness: 0.4, envMapIntensity: 0.8, transparent: true, opacity: 0.9 }),
    }
    this.signAtlas = this.makeSignAtlas()
    this.mat.shopSign = new THREE.MeshStandardMaterial({ map: this.signAtlas.tex, emissive: 0xffffff, emissiveMap: this.signAtlas.tex, emissiveIntensity: 0, roughness: 0.6 })
    this.neonMats = [this.mat.shopSign]
    // windows: flat tinted glass by day, vertex-colour emissive by night
    const win = new THREE.MeshStandardMaterial({ color: P.glass, metalness: 0.4, roughness: 0.2, vertexColors: true, envMapIntensity: 0.8 })
    win.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = this.uNight
      sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '')
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor * uNight * 1.5;')
    }
    this.mat.window = win
    Object.assign(this.mat, makeShowcaseMaterials())
  }

  makeSignAtlas() {
    const names = ['CAFÉ', 'DELI', 'BOOKS', 'PIZZA', 'BARBER', 'RECORDS', 'NOODLES', 'TACOS', 'LAUNDRY', 'GYM', 'FLOWERS', 'BAKERY', 'PHARMACY', 'SUSHI', 'DINER', 'TAILOR']
    const cols = 4, rows = 4, W = 2048, H = 1024, cw = W / cols, ch = H / rows
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')
    const palettes = [['#1d1d1f', '#f6c543'], ['#7a1f1f', '#ffffff'], ['#113c5a', '#ffd27a'], ['#223322', '#e8f0d0'], ['#f0e6d2', '#222222'], ['#3b1a4a', '#ffb3e6'], ['#0d3b3b', '#9fe8d8'], ['#5a3410', '#ffe4b5']]
    names.forEach((n, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch
      const [bg, fg] = palettes[i % palettes.length]
      g.fillStyle = bg; g.fillRect(x, y, cw, ch)
      g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(x + 18, y + 18, cw - 36, ch - 36)
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = `bold ${n.length > 7 ? 120 : 150}px Anton, Impact, sans-serif`; g.fillText(n, x + cw / 2, y + ch / 2 + 8)
    })
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
    return { tex, cols, rows, count: names.length }
  }

  // ---------------------------------------------------------------- ground
  buildGround() {
    const g = this.group, m = this.mat
    // roads: rows full length, columns only between rows (no coplanar overlap)
    const roads = []
    for (let i = 0; i <= N; i++) { const p = new THREE.PlaneGeometry(SIZE, ROAD).rotateX(-Math.PI / 2); p.translate(0, 0, roadCoord(i)); roads.push(p) }
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { const p = new THREE.PlaneGeometry(ROAD, BLOCK).rotateX(-Math.PI / 2); p.translate(roadCoord(i), 0, blockCenter(j)); roads.push(p) }
    const roadGeo = worldUV(mergeGeometries(roads), m.asphalt.userData.tile)
    const road = new THREE.Mesh(roadGeo, m.asphalt); road.receiveShadow = true; g.add(road)

    // lane markings
    const white = [], yellow = []
    const dash = (x, z, w, l) => { const p = new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2); p.translate(x, 0.015, z); return p }
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
      const a = blockStart(j), b = a + BLOCK, rc = roadCoord(i)
      for (let d = a + 1.5; d < b - 2; d += 6) { yellow.push(dash(d + 1.5, rc, 3, 0.22)); yellow.push(dash(rc, d + 1.5, 0.22, 3)) }
      white.push(dash((a + b) / 2, rc - ROAD / 2 + 0.6, BLOCK, 0.14)); white.push(dash((a + b) / 2, rc + ROAD / 2 - 0.6, BLOCK, 0.14))
      white.push(dash(rc - ROAD / 2 + 0.6, (a + b) / 2, 0.14, BLOCK)); white.push(dash(rc + ROAD / 2 - 0.6, (a + b) / 2, 0.14, BLOCK))
      for (const end of [a, b]) {
        const dir = end === a ? 1 : -1, zc = end + dir * 1.4
        for (let k = 0; k < 6; k++) { const o = -ROAD / 2 + 1.6 + k * 2.1; white.push(dash(zc, rc + o, 2.2, 1.0)); white.push(dash(rc + o, zc, 1.0, 2.2)) }
      }
    }
    const wl = new THREE.Mesh(mergeGeometries(white), m.line), yl = new THREE.Mesh(mergeGeometries(yellow), m.lineYellow)
    wl.receiveShadow = yl.receiveShadow = true; g.add(wl, yl)

    // block slabs: sidewalk ring + interior fill
    const byMat = { pavement: [], grass: [], sand: [], cobble: [] }
    // Grove Street village: cobbled sidewalks from the Medieval kit's uneven-stone material (2 m tiles)
    const kitStone = (() => { let f = null; this.assets?.kit?.village?.scene && this.assets.kit.village.scenes.forEach(sc => sc.traverse(o => { if (!f && o.isMesh && o.material.name === 'MI_UnevenBrick') f = o.material })); return f })()
    if (kitStone) { m.cobble = kitStone.clone(); m.cobble.color.set(0xd8cfc0); m.cobble.userData.tile = 2; for (const t of [m.cobble.map, m.cobble.normalMap, m.cobble.roughnessMap]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 } }
    const stadiumSkip = (bx, bz) => bx === 6 && bz === 6
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
      const d = districtOfBlock(bx, bz); if (!d) continue
      const x0 = blockStart(bx), z0 = blockStart(bz)
      // the slab is also solid, so people and cars stand on the sidewalk instead of 18 cm inside it
      M.addSlab(x0, z0, x0 + BLOCK, z0 + BLOCK, Y_SLAB)
      const inner = d.id === 'home' || d.id === 'park' ? 'grass' : d.id === 'social' ? 'sand' : 'pavement'
      const ring = 2.6
      const box = (x, z, w, dd, mat) => { const b = new THREE.BoxGeometry(w, Y_SLAB, dd); b.translate(x, Y_SLAB / 2, z); byMat[mat].push(b) }
      if (inner === 'pavement') box(x0 + BLOCK / 2, z0 + BLOCK / 2, BLOCK, BLOCK, 'pavement')
      else {
        const walk = d.id === 'home' && m.cobble ? 'cobble' : 'pavement'
        box(x0 + BLOCK / 2, z0 + ring / 2, BLOCK, ring, walk); box(x0 + BLOCK / 2, z0 + BLOCK - ring / 2, BLOCK, ring, walk)
        box(x0 + ring / 2, z0 + BLOCK / 2, ring, BLOCK - 2 * ring, walk); box(x0 + BLOCK - ring / 2, z0 + BLOCK / 2, ring, BLOCK - 2 * ring, walk)
        box(x0 + BLOCK / 2, z0 + BLOCK / 2, BLOCK - 2 * ring, BLOCK - 2 * ring, inner)
        if (d.id === 'social' && stadiumSkip(bx, bz)) {}
      }
    }
    for (const [k, arr] of Object.entries(byMat)) {
      if (!arr.length) continue
      const geo = worldUV(mergeGeometries(arr), m[k].userData.tile, 'auto')
      const mesh = new THREE.Mesh(geo, m[k]); mesh.receiveShadow = true; mesh.castShadow = false; g.add(mesh)
    }
    // park paths (pavement strips above grass)
    const park = M.districts.find(d => d.id === 'park'), pc = M.districtCenter(park)
    const paths = [new THREE.BoxGeometry(4 * BLOCK + 3 * ROAD - 4, 0.05, 3.5).translate(pc.x, Y_SLAB + 0.02, pc.z), new THREE.BoxGeometry(3.5, 0.05, 2 * BLOCK + ROAD - 4).translate(pc.x, Y_SLAB + 0.02, pc.z)]
    const pm = new THREE.Mesh(worldUV(mergeGeometries(paths), 3, 'auto'), this.mat.pavement); pm.receiveShadow = true; g.add(pm)

    // outer terrain + mountains. With the scenic ring (Scenery.js) the heightfield replaces both; the old cone loop
    // still runs below (without adding its mesh) so the shared random stream, and the rest of the world, is unchanged
    const scenic = !!this.assets?.sets?.rockAerial
    if (scenic) this.scenery = buildScenery(this, this.assets)
    const outer = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(SIZE * 5, SIZE * 5).rotateX(-Math.PI / 2), 12), pbrMaterial(this.assets.sets.grass, { tile: 14, color: 0xb8b890 }))
    outer.position.y = -0.05; outer.receiveShadow = true; if (!scenic) g.add(outer)
    const mtnMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, vertexColors: true })
    const mtnGeo = new THREE.ConeGeometry(1, 1, 11, 4)
    { const uv = mtnGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 24, uv.getY(i) * 10)
      const pos = mtnGeo.attributes.position, col = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) { const t = THREE.MathUtils.clamp((pos.getY(i) + 0.5 - 0.72) / 0.28, 0, 1); const c = new THREE.Color('#9fb6c9').lerp(new THREE.Color('#f7f3ec'), t); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
      mtnGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); mtnGeo.setAttribute('uv1', mtnGeo.attributes.uv) }
    const mtn = new THREE.InstancedMesh(mtnGeo, mtnMat, 44)
    const mm = new THREE.Matrix4()
    for (let i = 0; i < 44; i++) {
      const side = i % 3, t = this.rand(), r = 70 + this.rand() * 80, h = 50 + this.rand() * 110
      let x, z
      if (side === 0) { x = -SIZE * 1.2 + t * SIZE * 2.4; z = -SIZE / 2 - 120 - this.rand() * 160 }
      else if (side === 1) { x = -SIZE / 2 - 120 - this.rand() * 160; z = -SIZE / 2 + t * SIZE * 1.1 }
      else { x = SIZE / 2 + 120 + this.rand() * 160; z = -SIZE / 2 + t * SIZE * 1.1 }
      mm.compose(new THREE.Vector3(x, h / 2 - 3, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rand() * 6), new THREE.Vector3(r, h, r * (0.7 + this.rand() * 0.6)))
      mtn.setMatrixAt(i, mm)
    }
    if (!scenic) g.add(mtn)
  }

  // ---------------------------------------------------------------- buildings
  buildBlocks() {
    this.geo = createBuckets()
    const benchLots = [], villageLots = []
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
      const d = districtOfBlock(bx, bz)
      if (!d || d.id === 'park' || d.id === 'social') continue
      if (d.id === 'achievements' && bx === 6 && bz === 6) continue
      const x0 = blockStart(bx), z0 = blockStart(bz)
      // buildings draw from their own per-block generator. The shared stream is swapped for a
      // tripwire while they run, so any accidental use fails loudly instead of moving the trees.
      this.brand = blockRng(bx, bz)
      const shared = this.rand
      this.rand = SHARED_STREAM_GUARD
      const lots = this.lotsFor(d.id, bx, bz)
      const landmark = d.id === 'downtown' && DOWNTOWN_LANDMARKS[bx + ',' + bz]
      const tallest = landmark ? lots.reduce((a, l, i) => (l.h > lots[a].h ? i : a), 0) : -1
      const showLots = {}
      const bench = !!this.assets?.kit && bx === BENCHMARK.bx && bz === BENCHMARK.bz
      lots.forEach((lot, i) => {
        const lx0 = x0 + lot.x, lz0 = z0 + lot.z, cx = lx0 + lot.w / 2, cz = lz0 + lot.d / 2
        const type = typologyFor(d.id, lot, this.brand, { landmark: i === tallest ? landmark : null })
        if (type === 'legacyHouse' && this.assets?.kit?.village) {
          // Grove Street village (Village.js): the old house still runs into a throwaway bucket so it consumes the
          // same random draws; footprint and collider unchanged
          const keep = this.geo; this.geo = createBuckets(); this.house(cx, cz, lot.w, lot.d, lot.h); this.geo = keep
          villageLots.push({ x0: lx0, z0: lz0, w: lot.w, d: lot.d, h: lot.h, rx: lot.x + lot.w / 2, rz: lot.z + lot.d / 2 })
        } else if (type === 'legacyHouse') this.house(cx, cz, lot.w, lot.d, lot.h)
        else if (type === 'legacyGarage') this.garage(cx, cz, lot.w, lot.d, lot.h)
        else if (type === 'legacyBuilding') this.building(cx, cz, lot.w, lot.d, lot.h, d.id)
        else {
          // street faces: 0 +z, 1 -z, 2 +x, 3 -x (the sides of the lot that touch the block edge)
          const streets = [lot.z + lot.d / 2 > BLOCK / 2 ? 0 : 1, lot.x + lot.w / 2 > BLOCK / 2 ? 2 : 3]
          const showcase = bx === SHOWCASE.bx && bz === SHOWCASE.bz && lot.z + lot.d / 2 > BLOCK / 2
          if (showcase) {
            // Run the original typology into a throwaway bucket set so it consumes exactly the same random
            // draws as before: the block's other lots stay identical. Then build the showcase building.
            const keep = this.geo; this.geo = createBuckets()
            buildDowntown(this, type, { m: { cx, cz, w: lot.w, d: lot.d }, h: lot.h, streets })
            this.geo = keep
            const rect = { x0: lx0, z0: lz0, x1: lx0 + lot.w, z1: lz0 + lot.d }
            showLots[lot.x < BLOCK / 2 ? 'A' : 'B'] = rect
            buildShowcaseLot(this, lot.x < BLOCK / 2 ? 'A' : 'B', rect)
          } else if (bench) {
            // benchmark block: the original typology runs into a throwaway bucket set (same random draws);
            // the lot is drawn by Benchmark.js from kit modules instead. Footprint and collider unchanged.
            const keep = this.geo; this.geo = createBuckets()
            buildDowntown(this, type, { m: { cx, cz, w: lot.w, d: lot.d }, h: lot.h, streets })
            this.geo = keep
            benchLots.push({ x0: lx0, z0: lz0, w: lot.w, d: lot.d, h: lot.h, rx: lot.x + lot.w / 2, rz: lot.z + lot.d / 2 })
          } else buildDowntown(this, type, { m: { cx, cz, w: lot.w, d: lot.d }, h: lot.h, streets })
        }
        addBox(lx0, lz0, lx0 + lot.w, lz0 + lot.d, lot.h + 2)
      })
      if (showLots.A && showLots.B) buildShowcaseStreet(this, { x0, z0, size: BLOCK }, showLots, Y_SLAB)
      this.rand = shared
      // keep the shared stream where the original code left it, so later placements are unchanged
      this.rand.skip(legacyDraws(bx, bz))
      if (d.id === 'home') for (let k = 0; k < 3; k++) this.treeSpots.push([x0 + 4 + this.rand() * (BLOCK - 8), z0 + (k % 2 ? 4.5 : BLOCK - 4.5) + (this.rand() - 0.5)])
    }
    this.brand = null
    mergeBuckets(this.geo, this.mat, this.group, worldUV, (g, c) => this.tint(g, c))
    if (benchLots.length) this.bench = buildBenchmark(this.scene, this.assets, benchLots)
    if (villageLots.length) this.village = buildVillage(this.scene, this.assets, villageLots)
    const sd = M.districts.find(d => d.id === 'skills'), sc = M.districtCenter(sd)
    this.addSign(['MOD GARAGE'], sc.x, blockStart(sd.range[1]) + 2.5, 0, { sub: 'SKILLS & TOOLS', w: 20, h: 6, y: 9 })
  }

  lotsFor(id, bx, bz) {
    const r = this.brand, lots = [], pad = 3.2
    if (id === 'downtown') {
      const s = (BLOCK - pad * 3) / 2
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) lots.push({ x: pad + i * (s + pad), z: pad + j * (s + pad), w: s, d: s, h: 22 + r() * 42 + (bx === 4 && bz === 1 ? 28 : 0) })
    } else if (id === 'lab') {
      if (r() < 0.5) lots.push({ x: pad, z: pad, w: BLOCK - pad * 2, d: BLOCK / 2 - pad, h: 10 + r() * 9 })
      else lots.push({ x: pad, z: pad, w: BLOCK / 2 - pad, d: BLOCK - pad * 2, h: 10 + r() * 9 })
      lots.push({ x: BLOCK / 2 + 1, z: BLOCK / 2 + 1, w: BLOCK / 2 - pad - 1, d: BLOCK / 2 - pad - 1, h: 7 + r() * 6 })
    } else if (id === 'career') {
      lots.push({ x: pad, z: pad, w: BLOCK - pad * 2, d: BLOCK / 2 - pad, h: 8 + r() * 5 })
      lots.push({ x: pad, z: BLOCK / 2 + 1, w: BLOCK - pad * 2, d: BLOCK / 2 - pad - 1, h: 8 + r() * 5 })
    } else if (id === 'home') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { if (r() < 0.2) continue; lots.push({ x: 4.5 + i * 17.5 + r() * 2, z: 4.5 + j * 17.5 + r() * 2, w: 9.5, d: 9, h: 3.4 + (r() < 0.5 ? 3 : 0) }) }
    } else if (id === 'skills') {
      lots.push({ x: BLOCK - 12.5, z: pad, w: 9.5, d: BLOCK - pad * 2, h: 5.5 })
    } else if (id === 'achievements') {
      if (r() < 0.6) lots.push({ x: pad, z: pad, w: 15, d: 15, h: 6 })
    }
    return lots
  }

  tint(g, color) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color ?? 0xffffff)
    const arr = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g
  }
  box(key, cx, y, cz, w, h, d, color) { const g = WALL_BUCKETS.has(key) ? wallBox(w, h, d) : new THREE.BoxGeometry(w, h, d); g.translate(cx, y + h / 2, cz); this.tint(g, color); this.geo[key].push(g); return g }

  // windows on 4 faces of a box footprint
  windows(cx, cz, w, d, y0, y1, { floorH = 3.2, spacing = 2.7, ww = 1.5, wh = 1.9, lit = 0.45, skipFaces = [], balcony = false } = {}) {
    const faces = [[0, 0, 1, cz + d / 2, w, 0], [0, 0, -1, cz - d / 2, w, Math.PI], [1, 0, 0, cx + w / 2, d, Math.PI / 2], [-1, 0, 0, cx - w / 2, d, -Math.PI / 2]]
    faces.forEach((f, fi) => {
      if (skipFaces.includes(fi)) return
      const [nx, , nz, off, len, rot] = f
      const cols = Math.max(1, Math.floor((len - 1.6) / spacing))
      const startU = -(cols - 1) * spacing / 2
      for (let fl = 0; y0 + fl * floorH + wh + 0.8 <= y1; fl++) {
        const y = y0 + 1.1 + fl * floorH + wh / 2
        for (let c = 0; c < cols; c++) {
          const u = startU + c * spacing
          const p = new THREE.PlaneGeometry(ww, wh)
          p.rotateY(rot)
          const x = nx ? off + nx * 0.03 : cx + u, z = nz ? off + nz * 0.03 : cz + u
          p.translate(x, y, z)
          const isLit = this.brand() < lit
          const col = isLit ? new THREE.Color().setHSL(0.1 + this.brand() * 0.05, 0.7, 0.55 + this.brand() * 0.2) : new THREE.Color(0.02, 0.02, 0.03)
          const arr = new Float32Array(p.attributes.position.count * 3)
          for (let i = 0; i < arr.length; i += 3) { arr[i] = col.r; arr[i + 1] = col.g; arr[i + 2] = col.b }
          p.setAttribute('color', new THREE.BufferAttribute(arr, 3))
          this.geo.window.push(p)
          // frame and sill give the window depth. The 0.1 m-deep frame is centred
          // 4 cm inside the wall so its front face (+0.01) stays behind the glass (+0.03); only its
          // 0.11 m border shows. (Previously its front face at +0.07 covered the glass entirely.)
          const px = nx ? off - nx * 0.04 : cx + u, pz = nz ? off - nz * 0.04 : cz + u
          const fr = new THREE.BoxGeometry(ww + 0.22, wh + 0.22, 0.1); fr.rotateY(rot); fr.translate(px, y, pz); this.geo.trim.push(fr)
          // pale blinds or curtains on 55 % of unlit windows. Chosen by a hash of the window position,
          // not by this.brand, so the building's own random sequence (colours, roofs, lit pattern) is unchanged.
          if (!isLit) {
            const hx = nx ? off : cx + u, hz = nz ? off : cz + u
            const hsh = (k) => { const v = Math.sin(hx * 12.9898 + y * 78.233 + hz * 37.719 + k * 4.581) * 43758.5453; return v - Math.floor(v) }
            if (hsh(0) < 0.55) {
              const shade = ['#efe7d8', '#e4dccb', '#f4efe6', '#e9d9c4'][Math.floor(hsh(1) * 4)]
              const at = (g, ox, oy) => { g.rotateY(rot); g.translate((nx ? off + nx * 0.04 : cx + u) + (nx ? 0 : ox), y + oy, (nz ? off + nz * 0.04 : cz + u) + (nz ? 0 : (nx > 0 ? -ox : ox))); this.tint(g, shade); this.geo.sill.push(g) }
              if (hsh(2) < 0.65) { const bh = wh * (0.25 + hsh(3) * 0.45); at(new THREE.PlaneGeometry(ww - 0.08, bh), 0, wh / 2 - bh / 2) }
              else { const cw = ww * 0.28; at(new THREE.PlaneGeometry(cw, wh - 0.08), -(ww - cw) / 2 + 0.04, 0); at(new THREE.PlaneGeometry(cw, wh - 0.08), (ww - cw) / 2 - 0.04, 0) }
            }
          }
          const sill = new THREE.BoxGeometry(ww + 0.4, 0.12, 0.3); sill.rotateY(rot); sill.translate(nx ? off + nx * 0.12 : cx + u, y - wh / 2 - 0.08, nz ? off + nz * 0.12 : cz + u); this.geo.sill.push(sill)
          if (balcony && fl > 0 && fi === 0 && this.brand() < 0.6) {
            const slab = new THREE.BoxGeometry(ww + 1.2, 0.16, 1.1); slab.rotateY(rot); slab.translate(nx ? off + nx * 0.55 : cx + u, y - wh / 2 - 0.1, nz ? off + nz * 0.55 : cz + u); this.geo.sill.push(slab)
            const rail = new THREE.BoxGeometry(ww + 1.2, 1.0, 0.05); rail.rotateY(rot); rail.translate(nx ? off + nx * 1.07 : cx + u, y - wh / 2 + 0.42, nz ? off + nz * 1.07 : cz + u); this.geo.trim.push(rail)
          }
        }
      }
    })
  }

  building(cx, cz, w, d, h, district) {
    const r = this.brand
    const glass = district === 'downtown' && r() < 0.45
    const wallKey = glass ? 'glassTower' : district === 'career' ? 'brick' : district === 'lab' ? (r() < 0.5 ? 'concrete' : 'concreteWarm') : (r() < 0.5 ? 'concrete' : 'concreteDark')
    let baseH = h, towerH = 0
    if (district === 'downtown' && h > 34) { baseH = 8 + r() * 6; towerH = h - baseH }
    const pal = P.districts[district] || P.districts.downtown
    const tintCol = glass ? 0xffffff : new THREE.Color(pal[Math.floor(r() * pal.length)])
    // base
    this.box(wallKey, cx, 0, cz, w, baseH, d, tintCol)
    const shop = district !== 'career' && !glass
    if (!glass) this.windows(cx, cz, w, d, shop ? 3.4 : 0, baseH, { lit: district === 'career' ? 0.2 : 0.4, spacing: district === 'career' ? 4 : 2.7, wh: district === 'career' ? 1.2 : 1.9, balcony: district === 'lab' || district === 'downtown' })
    else this.windows(cx, cz, w, d, 0, baseH, { lit: 0.5, spacing: 2.4, ww: 2.1, wh: 2.6, floorH: 3.4 })
    // plinth
    if (!glass) this.box('concreteDark', cx, 0, cz, w + 0.16, 0.7, d + 0.16, 0x8a8f99)
    if (shop) this.storefront(cx, cz, w, d)
    // ledges & parapet
    const parapet = (x, y, z, ww, dd) => { this.box('trim', x, y, z, ww + 0.5, 0.5, dd + 0.5) }
    parapet(cx, baseH, cz, w, d)
    if (!glass) for (let y = 3.5; y < baseH - 1; y += 3.2 * 2) this.box('trim', cx, y, cz, w + 0.3, 0.18, d + 0.3)
    // loading doors on warehouses
    if (district === 'career') { this.box('trim', cx - w * 0.25, 0, cz + d / 2 - 0.1, 4, 3.6, 0.3); this.box('metal', cx + w * 0.2, 0, cz + d / 2 - 0.1, 4, 3.6, 0.3) }
    // tower
    if (towerH > 0) {
      const tw = w * (0.6 + r() * 0.25), td = d * (0.6 + r() * 0.25)
      const tx = cx + (r() - 0.5) * (w - tw) * 0.8, tz = cz + (r() - 0.5) * (d - td) * 0.8
      this.box(wallKey, tx, baseH, tz, tw, towerH, td, tintCol)
      this.windows(tx, tz, tw, td, baseH, baseH + towerH, glass ? { lit: 0.5, spacing: 2.4, ww: 2.1, wh: 2.6, floorH: 3.4 } : { lit: 0.45 })
      parapet(tx, baseH + towerH, tz, tw, td)
      if (!glass) for (let y = baseH + 3.5; y < baseH + towerH - 1; y += 3.2 * 2) this.box('trim', tx, y, tz, tw + 0.3, 0.18, td + 0.3)
      this.rooftop(tx, tz, tw, td, baseH + towerH)
      if (towerH > 35) { const s = new THREE.CylinderGeometry(0.25, 0.35, 10, 6); s.translate(tx, baseH + towerH + 5, tz); this.geo.metal.push(s) }
    } else this.rooftop(cx, cz, w, d, baseH)
    // glass mullions
    if (glass) {
      const H = baseH + towerH
      for (const [x, z, horiz] of [[cx, cz + d / 2 + 0.05, true], [cx, cz - d / 2 - 0.05, true], [cx + w / 2 + 0.05, cz, false], [cx - w / 2 - 0.05, cz, false]]) {
        const len = horiz ? w : d
        for (let u = -len / 2; u <= len / 2 + 0.01; u += 2.4) { const g = new THREE.BoxGeometry(horiz ? 0.1 : 0.1, H, horiz ? 0.1 : 0.1); g.translate(horiz ? x + u : x, H / 2, horiz ? z : z + u); this.geo.trim.push(g) }
        for (let y = 3.4; y < H; y += 3.4) { const g = new THREE.BoxGeometry(horiz ? len : 0.1, 0.1, horiz ? 0.1 : len); g.translate(x, y, z); this.geo.trim.push(g) }
      }
    }
  }

  // ground-floor shops on the +z face: glass band, pilasters, coloured awning, sign from the atlas
  storefront(cx, cz, w, d) {
    const r = this.brand, zf = cz + d / 2
    const gw = w - 1.2
    const glass = new THREE.PlaneGeometry(gw, 2.4); glass.translate(cx, 0.7 + 1.2, zf + 0.03); this.geo.shopGlass.push(glass)
    const nSeg = Math.max(1, Math.round(gw / 4))
    for (let i = 0; i <= nSeg; i++) this.box('trim', cx - gw / 2 + i * (gw / nSeg), 0.6, zf + 0.05, 0.18, 2.6, 0.2)
    const lintel = this.box('trim', cx, 3.15, zf + 0.1, gw + 0.4, 0.25, 0.3)
    const aw = new THREE.Color(P.awnings[Math.floor(r() * P.awnings.length)])
    const awn = new THREE.BoxGeometry(gw * 0.6, 0.1, 1.5); awn.rotateX(0.22); awn.translate(cx, 3.35, zf + 0.8); this.tint(awn, aw); this.geo.awning.push(awn)
    // sign
    const idx = Math.floor(r() * this.signAtlas.count), cols = this.signAtlas.cols, rows = this.signAtlas.rows
    const sw = Math.min(gw * 0.55, 6), shh = sw / 2
    const sign = new THREE.PlaneGeometry(sw, shh); sign.translate(cx, 3.55 + shh / 2 + 0.15, zf + 0.14)
    const uv = sign.attributes.uv, u0 = (idx % cols) / cols, v0 = 1 - (Math.floor(idx / cols) + 1) / rows
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / cols, v0 + uv.getY(i) / rows)
    this.geo.shopSign.push(sign)
    this.box('trim', cx, 3.55 + 0.1, zf - 0.02, sw + 0.2, shh + 0.3, 0.1)
  }

  rooftop(cx, cz, w, d, y) {
    const r = this.brand
    const n = 1 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) this.box('metal', cx + (r() - 0.5) * (w - 4), y, cz + (r() - 0.5) * (d - 4), 1.6 + r(), 1 + r() * 0.6, 1.6 + r())
    if (r() < 0.4) { const t = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12); t.translate(cx + (r() - 0.5) * (w - 5), y + 1.6, cz + (r() - 0.5) * (d - 5)); this.geo.metal.push(t); const legs = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 12); }
    const slab = new THREE.BoxGeometry(w - 0.2, 0.1, d - 0.2); slab.translate(cx, y + 0.05, cz); this.geo.roof.push(slab)
  }

  house(cx, cz, w, d, h) {
    const r = this.brand
    const key = r() < 0.5 ? 'brick' : 'concreteWarm'
    const tintCol = new THREE.Color(P.districts.home[Math.floor(r() * P.districts.home.length)])
    this.box(key, cx, 0, cz, w, h, d, tintCol)
    this.box('concreteDark', cx, 0, cz, w + 0.14, 0.5, d + 0.14, 0x8a8f99)
    this.windows(cx, cz, w, d, 0, h, { floorH: 3, spacing: 3, ww: 1.3, wh: 1.4, lit: 0.5 })
    // door + porch
    this.box('trim', cx + 1.5, 0, cz + d / 2 - 0.1, 1.2, 2.2, 0.3); this.box('awning', cx + 1.5, 2.4, cz + d / 2 + 0.8, 2.6, 0.12, 2)
    // pitched roof
    const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.8, 3, 4); roof.rotateY(Math.PI / 4); roof.translate(cx, h + 1.5, cz)
    this.geo.roof.push(roof)
    const chimney = new THREE.BoxGeometry(0.8, 2.2, 0.8); chimney.translate(cx - w * 0.3, h + 1.8, cz - d * 0.2); this.tint(chimney, tintCol); this.geo[key].push(chimney)
  }

  garage(cx, cz, w, d, h) {
    this.box('concreteDark', cx, 0, cz, w, h, d, P.districts.skills[Math.floor(this.brand() * 3)])
    this.box('trim', cx, h, cz, w + 0.4, 0.4, d + 0.4)
    const bays = Math.floor(d / 6)
    for (let i = 0; i < bays; i++) { const z = cz - d / 2 + 3 + i * 6; this.box('metal', cx - w / 2 - 0.05, 0.1, z, 0.12, h - 1.2, 4.2); this.box('trim', cx - w / 2 - 0.1, h - 1.1, z, 0.2, 0.3, 4.6) }
  }

  // ---------------------------------------------------------------- park, beach, stadium
  buildPark() {
    const d = M.districts.find(d => d.id === 'park'), c = M.districtCenter(d)
    for (let bx = d.range[0]; bx <= d.range[2]; bx++) for (let bz = d.range[1]; bz <= d.range[3]; bz++) for (let k = 0; k < 8; k++) {
      const x = blockStart(bx) + 4 + this.rand() * (BLOCK - 8), z = blockStart(bz) + 4 + this.rand() * (BLOCK - 8)
      if (Math.hypot(x - c.x, z - c.z) < 14 || Math.abs(x - c.x) < 3.5 || Math.abs(z - c.z) < 3.5) continue
      this.treeSpots.push([x, z])
    }
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 1.1, 28), this.mat.concrete); basin.position.set(c.x, 0.55 + Y_SLAB, c.z); basin.castShadow = basin.receiveShadow = true
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 4, 14), this.mat.concrete); column.position.set(c.x, 2 + Y_SLAB, c.z); column.castShadow = true
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.2, 0.6, 16), this.mat.concrete); bowl.position.set(c.x, 3.5 + Y_SLAB, c.z)
    this.group.add(basin, column, bowl)
    this.fountain = this.makeWater(c.x, 0.95 + Y_SLAB, c.z, 11.5, 11.5, true)
    addCircle(c.x, c.z, 7, 2)
  }

  makeWater(x, y, z, w, d, round) {
    const geo = round ? new THREE.CircleGeometry(w / 2, 32) : new THREE.PlaneGeometry(w, d)
    const n1 = this.assets.waterNormals.clone(); n1.needsUpdate = true; n1.repeat.set(w / 12, d / 12)
    const mat = new THREE.MeshPhysicalMaterial({ color: P.water, roughness: 0.12, metalness: 0.0, normalMap: n1, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.0, transparent: true, opacity: 0.92, clearcoat: 1, clearcoatRoughness: 0.08 })
    const water = new THREE.Mesh(geo, mat)
    water.rotation.x = -Math.PI / 2; water.position.set(x, y, z)
    water.userData.n = n1; water.userData.speed = round ? 0.02 : 0.012
    this.group.add(water)
    this.waters = this.waters || []; this.waters.push(water)
    return water
  }

  buildBeach() {
    const W = M.WATER, pierX = blockCenter(3)
    addBox(W.x0, W.z0, pierX - 4, W.z1, 1); addBox(pierX + 4, W.z0, W.x1, W.z1, 1); addBox(pierX - 4, W.z0 + 18, pierX + 4, W.z1, 1)
    addCircle(pierX - 2.3, W.z0 - 2.5, 0.45, 1.2); addCircle(pierX + 2.3, W.z0 - 2.5, 0.45, 1.2)
    // water surface slightly below the slab, with sand slope
    this.sea = this.makeWater((W.x0 + W.x1) / 2, Y_SLAB - 0.12, (W.z0 + W.z1) / 2 + 40, W.x1 - W.x0 + 60, W.z1 - W.z0 + 80, false)
    if (this.scenery) this.sea.visible = false   // the scenic sea (same level) takes over; avoids two overlapping water planes
    for (const bx of [pierX - 2.3, pierX + 2.3]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.2, 10), this.mat.metal); b.position.set(bx, 0.6 + Y_SLAB, W.z0 - 2.5); b.castShadow = true; this.group.add(b) }
    // wooden pier deck + rails
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: 0.85 })
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 22), wood); deck.position.set(pierX, Y_SLAB + 0.05, W.z0 + 8); deck.castShadow = deck.receiveShadow = true
    this.group.add(deck)
    for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 22), wood); rail.position.set(pierX + s * 3.9, Y_SLAB + 0.8, W.z0 + 8); this.group.add(rail); for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), wood); p.position.set(pierX + s * 3.9, Y_SLAB + 0.6, W.z0 - 2 + k * 3); this.group.add(p) } }
    for (let i = 0; i < 20; i++) {
      const x = blockStart(2) + 3 + this.rand() * (3 * BLOCK + 2 * ROAD - 6), z = blockStart(5) + 3 + this.rand() * (2 * BLOCK + ROAD + 6)
      if (Math.abs(x - pierX) < 6 && z > W.z0 - 12) continue
      const onRoad = [5, 6, 7].some(i => Math.abs(z - roadCoord(i)) < ROAD / 2 + 2) || [2, 3, 4, 5].some(i => Math.abs(x - roadCoord(i)) < ROAD / 2 + 2)
      if (onRoad) continue
      this.palmSpots.push([x, z])
    }
    this.addSign(['SUNSET PIER'], pierX, W.z0 - 14, 0, { sub: 'SOCIALS · FIND ME ONLINE', w: 16, h: 5, y: 7, bg: '#1b2a3a', fg: '#ffb060' })
  }

  buildStadium() {
    const cx = blockCenter(6), cz = blockCenter(6)
    const outerMat = this.mat.concrete.clone(); outerMat.side = THREE.DoubleSide
    const outer = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(17, 17.6, 12, 48, 1, true), 4.5, 'auto'), outerMat)
    outer.position.set(cx, 6 + Y_SLAB, cz); outer.castShadow = outer.receiveShadow = true
    const ring = new THREE.Mesh(new THREE.RingGeometry(13, 17.6, 48).rotateX(-Math.PI / 2), this.mat.trim); ring.position.set(cx, 12 + Y_SLAB, cz)
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 12, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a847c, roughness: 0.9, side: THREE.DoubleSide })); inner.position.set(cx, 6 + Y_SLAB, cz)
    const seats = new THREE.Mesh(new THREE.RingGeometry(13, 16.5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.8, side: THREE.DoubleSide })); seats.position.set(cx, 8 + Y_SLAB, cz)
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(13, 40).rotateX(-Math.PI / 2), this.mat.grass); pitch.position.set(cx, Y_SLAB + 0.01, cz)
    this.group.add(outer, ring, inner, seats, pitch)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 10), this.mat.metal); pole.position.set(cx + Math.cos(a) * 18, 13, cz + Math.sin(a) * 18); pole.castShadow = true
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff6e0, emissiveIntensity: 0.6 })); lamp.position.set(cx + Math.cos(a) * 18, 26, cz + Math.sin(a) * 18); lamp.lookAt(cx, 24, cz)
      this.group.add(pole, lamp); this.neon.push(lamp)
    }
    addCircle(cx, cz, 17.8, 12)
    this.addSign(['TROPHY STADIUM'], cx, blockStart(6) - 1, 0, { sub: 'ACHIEVEMENTS · TIME TRIAL', w: 22, h: 6, y: 14, bg: '#2a1a0a' })
  }

  // ---------------------------------------------------------------- landmarks
  buildLandmarks(landmarks) {
    const loader = new THREE.TextureLoader()
    for (const lm of landmarks) {
      if (lm.kind === 'billboard') {
        const w = 16, h = 9
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 10, 10), this.mat.metal); post.position.set(lm.x, 5, lm.z); post.castShadow = true
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.4), this.mat.trim); frame.position.set(lm.x, 10 + h / 2, lm.z); frame.rotation.y = lm.rot; frame.castShadow = true
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 })
        const apply = (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true }
        if (lm.image) loader.load(lm.image, apply)
        else apply(makeTextTexture(lm.lines, { sub: lm.sub, bg: lm.bg || '#101418', w: 1024, h: 576, font: 'bold 120px Anton, Impact, sans-serif' }))
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); face.position.set(lm.x, 10 + h / 2, lm.z); face.rotation.y = lm.rot; face.translateZ(0.25)
        const capMat = new THREE.MeshStandardMaterial({ map: makeTextTexture([lm.caption || ''], { w: 1024, h: 120, bg: '#f6c543', fg: '#1a1205', border: null, font: 'bold 72px Anton, Impact, sans-serif' }), roughness: 0.6 })
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), capMat); cap.position.set(lm.x, 10 + h + 1.3, lm.z); cap.rotation.y = lm.rot; cap.translateZ(0.25)
        // spotlights on the billboard at night
        for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), this.mat.lampHead); l.position.set(lm.x, 10 + h + 2.6, lm.z); l.rotation.y = lm.rot; l.translateX(s * w * 0.3); l.translateZ(0.8); this.group.add(l) }
        this.group.add(post, frame, face, cap); this.neon.push(face)
        addCircle(lm.x, lm.z, 0.6, 10)
      } else if (lm.kind === 'sign') this.addSign(lm.lines, lm.x, lm.z, lm.rot, lm.opts || {})
      else if (lm.kind === 'signpost') {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), this.mat.metal); post.position.set(lm.x, 1.5 + Y_SLAB, lm.z)
        const tex = makeTextTexture([lm.lines[0]], { w: 512, h: 192, bg: lm.bg || '#1b2a3a', fg: '#fff', font: 'bold 80px Anton, Impact, sans-serif', sub: lm.sub, subColor: '#ffb060' })
        const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.6, side: THREE.DoubleSide }))
        board.position.set(lm.x, 2.6 + Y_SLAB, lm.z); board.rotation.y = lm.rot
        this.group.add(post, board); this.neon.push(board)
      }
    }
  }

  addSign(lines, x, z, rot, { sub = null, w = 18, h = 6, y = 8, bg = '#101418', fg = '#f6c543' } = {}) {
    const tex = makeTextTexture(lines, { sub, bg, fg, w: 1024, h: Math.round(1024 * h / w), font: 'bold 150px Anton, Impact, sans-serif' })
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.5 })
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); front.position.set(x, y, z); front.rotation.y = rot
    const back = front.clone(); back.rotation.y = rot + Math.PI
    front.translateZ(0.06); back.translateZ(0.06)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.1), this.mat.trim); panel.position.set(x, y, z); panel.rotation.y = rot
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, y + h / 2, 10), this.mat.metal); p.position.set(x, (y + h / 2) / 2, z); p.rotation.y = rot; p.translateX(s * (w / 2 - 1)); p.castShadow = true; this.group.add(p); addCircle(p.position.x, p.position.z, 0.35, y + h / 2) }
    this.group.add(front, back, panel); this.neon.push(front, back)
  }

  buildBoundary() {
    const half = SIZE / 2
    const barrier = (x, z, w, d) => { const b = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, 1.1, d), 4.5, 'auto'), this.mat.concrete); b.position.set(x, 0.55, z); b.castShadow = b.receiveShadow = true; this.group.add(b) }
    barrier(0, -half - 1, SIZE + 4, 1.2); barrier(0, half + 1, SIZE + 4, 1.2); barrier(-half - 1, 0, 1.2, SIZE + 4); barrier(half + 1, 0, 1.2, SIZE + 4)
    addBox(-half - 50, -half - 50, half + 50, -half, 4); addBox(-half - 50, half, half + 50, half + 50, 4); addBox(-half - 50, -half, -half, half, 4); addBox(half, -half, half + 50, half, 4)
  }

  // ---------------------------------------------------------------- vegetation
  buildTrees() {
    const spots = this.treeSpots
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.42, 3.2, 7), this.mat.bark, spots.length)
    const blob = (r, x, y, z) => { const g = new THREE.IcosahedronGeometry(r, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 0.5) * 0.12; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k) } g.computeVertexNormals(); return g.translate(x, y, z) }
    const crownGeo = mergeGeometries([blob(2.3, 0, 0, 0), blob(1.8, 1.3, 0.8, 0.7), blob(1.7, -1.2, 1.0, -0.6), blob(1.6, 0.3, 1.9, 0.4), blob(1.4, -0.4, -0.2, 1.4), blob(1.4, 0.9, -0.1, -1.3)])
    const crown = new THREE.InstancedMesh(crownGeo, this.mat.leaf, spots.length)
    const m = new THREE.Matrix4(), col = new THREE.Color()
    spots.forEach(([x, z], i) => {
      const s = 0.8 + this.rand() * 0.6, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rand() * 6)
      m.compose(new THREE.Vector3(x, 1.6 * s + Y_SLAB, z), q, new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(x, 4.4 * s + Y_SLAB, z), q, new THREE.Vector3(s, s * 1.05, s)); crown.setMatrixAt(i, m)
      crown.setColorAt(i, col.set(P.leaf[Math.floor(this.rand() * P.leaf.length)]))
      addCircle(x, z, 0.5, 3.5)
    })
    trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true
    this.group.add(trunk, crown)
    // palms
    const p = this.palmSpots
    const ptrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.42, 8, 7), this.mat.bark, p.length)
    const leafGeo = mergeGeometries(Array.from({ length: 7 }, (_, i) => { const g = new THREE.ConeGeometry(0.8, 5, 4); g.rotateX(Math.PI / 2 + 0.55); g.rotateY((i / 7) * Math.PI * 2); g.translate(0, 0.2, 0); return g }))
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }), p.length)
    p.forEach(([x, z], i) => {
      const lean = (this.rand() - 0.5) * 0.25, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.rand() * 6, lean))
      m.compose(new THREE.Vector3(x, 4 + Y_SLAB, z), q, new THREE.Vector3(1, 1, 1)); ptrunk.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(x - Math.sin(lean) * 4, 8 + Y_SLAB, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rand() * 6), new THREE.Vector3(1, 1, 1)); leaves.setMatrixAt(i, m)
      addCircle(x, z, 0.45, 8)
    })
    ptrunk.castShadow = leaves.castShadow = true
    this.group.add(ptrunk, leaves)
  }

  // ---------------------------------------------------------------- street furniture
  buildStreetFurniture() {
    const lamps = []
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { lamps.push([blockCenter(j), roadCoord(i) - ROAD / 2 - 0.9, 0]); lamps.push([roadCoord(i) + ROAD / 2 + 0.9, blockCenter(j), Math.PI / 2]) }
    const poleGeo = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.14, 7, 8).translate(0, 3.5, 0), new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6).rotateZ(Math.PI / 2).translate(1.0, 6.9, 0)])
    const poles = new THREE.InstancedMesh(poleGeo, this.mat.metal, lamps.length)
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), this.mat.lampHead, lamps.length)
    const m = new THREE.Matrix4()
    lamps.forEach(([x, z, rot], i) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot + (z < 0 || x < 0 ? 0 : 0))
      // arm points toward the road
      const toward = rot === 0 ? Math.PI : 0
      const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot + toward)
      m.compose(new THREE.Vector3(x, Y_SLAB, z), q2, new THREE.Vector3(1, 1, 1)); poles.setMatrixAt(i, m)
      const hx = x + Math.cos(rot + toward) * 2.0, hz = z - Math.sin(rot + toward) * 2.0
      m.compose(new THREE.Vector3(hx, 6.85 + Y_SLAB, hz), q2, new THREE.Vector3(1, 1, 1)); heads.setMatrixAt(i, m)
      this.lampPos.push([hx, hz])
    })
    poles.castShadow = true
    this.group.add(poles, heads)
    this.lampHeads = heads
    // fake light pools on the ground (cheap replacement for 160 point lights)
    const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 128
    const pg = poolCanvas.getContext('2d'); const grd = pg.createRadialGradient(64, 64, 2, 64, 64, 64); grd.addColorStop(0, 'rgba(255,225,170,0.55)'); grd.addColorStop(0.5, 'rgba(255,215,150,0.18)'); grd.addColorStop(1, 'rgba(255,200,120,0)'); pg.fillStyle = grd; pg.fillRect(0, 0, 128, 128)
    const poolTex = new THREE.CanvasTexture(poolCanvas); poolTex.colorSpace = THREE.SRGBColorSpace
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), this.poolMat, lamps.length)
    this.lampPos.forEach(([x, z], i) => { m.makeTranslation(x, 0.04, z); pools.setMatrixAt(i, m) })
    pools.renderOrder = 2
    this.group.add(pools)
    // traffic lights at every intersection (two diagonal corners)
    const tl = []
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { tl.push([roadCoord(i) + ROAD / 2 + 0.8, roadCoord(j) - ROAD / 2 - 0.8, 0]); tl.push([roadCoord(i) - ROAD / 2 - 0.8, roadCoord(j) + ROAD / 2 + 0.8, Math.PI]) }
    const tlGeo = mergeGeometries([new THREE.CylinderGeometry(0.09, 0.12, 5.5, 8).translate(0, 2.75, 0), new THREE.CylinderGeometry(0.07, 0.07, 3.5, 6).rotateZ(Math.PI / 2).translate(-1.75, 5.3, 0), new THREE.BoxGeometry(0.35, 1.0, 0.3).translate(-3.2, 4.9, 0)])
    const tls = new THREE.InstancedMesh(tlGeo, this.mat.trim, tl.length)
    const lightGeo = mergeGeometries([new THREE.SphereGeometry(0.1, 8, 6).translate(-3.2, 5.2, 0.16), new THREE.SphereGeometry(0.1, 8, 6).translate(-3.2, 4.9, 0.16), new THREE.SphereGeometry(0.1, 8, 6).translate(-3.2, 4.6, 0.16)])
    const lightsMesh = new THREE.InstancedMesh(lightGeo, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x33ff44, emissiveIntensity: 1.5 }), tl.length)
    tl.forEach(([x, z, rot], i) => { m.compose(new THREE.Vector3(x, Y_SLAB, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1)); tls.setMatrixAt(i, m); lightsMesh.setMatrixAt(i, m) })
    tls.castShadow = true
    this.group.add(tls, lightsMesh)
    // hydrants + benches around the park and pier
    const park = M.districts.find(d => d.id === 'park'), pc = M.districtCenter(park)
    const benchGeo = mergeGeometries([new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.4, 0.06).translate(0, 0.72, -0.25), new THREE.BoxGeometry(0.08, 0.45, 0.5).translate(-0.8, 0.22, 0), new THREE.BoxGeometry(0.08, 0.45, 0.5).translate(0.8, 0.22, 0)])
    const benchSpots = []
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; benchSpots.push([pc.x + Math.cos(a) * 11, pc.z + Math.sin(a) * 11, -a + Math.PI / 2]) }
    const benches = new THREE.InstancedMesh(benchGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }), benchSpots.length)
    benchSpots.forEach(([x, z, rot], i) => { m.compose(new THREE.Vector3(x, Y_SLAB, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1)); benches.setMatrixAt(i, m) })
    benches.castShadow = true; this.group.add(benches)
  }

  buildParkedCars() {
    const spots = []
    const r = this.rand
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
      if (r() < 0.55) continue
      const side = r() < 0.5 ? -1 : 1
      const horiz = r() < 0.5
      const t = 0.2 + r() * 0.6
      if (horiz) spots.push([blockStart(j) + BLOCK * t, roadCoord(i) + side * (ROAD / 2 - 1.5), side > 0 ? Math.PI / 2 : -Math.PI / 2])
      else spots.push([roadCoord(i) + side * (ROAD / 2 - 1.5), blockStart(j) + BLOCK * t, side > 0 ? Math.PI : 0])
    }
    const colors = [0x3a6fd1, 0xe8e2d0, 0x2d2d2d, 0xd9a441, 0x7a3fa8, 0x3aa06a, 0xc4c4c4, 0x8b2222, 0x1c1c1c, 0xf0f0f0]
    // parked cars are recorded so they can be stolen (VehicleSystem): instance, pose, colour and collider box
    this.parked = []
    // models (Kenney sedan / SUV / van) cycle by index so the random stream, and with it the rest of the world, is unchanged
    const lib = this.bgCars.kenney
    spots.slice(0, 30).forEach(([x, z, rot], n) => {
      const color = colors[Math.floor(r() * colors.length)]
      const type = lib ? PARKED_TYPES[n % PARKED_TYPES.length] : undefined
      const i = this.bgCars.alloc(color, type)
      this.bgCars.set(i, x, 0, z, rot)
      const box = M.colliders.boxes.length
      // collider from the model's real footprint (the Ferrari LOD fallback keeps the old 4.6 × 2.2 m box)
      const hl = type ? lib[type].half.z + 0.05 : 2.3, hw = type ? lib[type].half.x + 0.05 : 1.1, h = type ? lib[type].half.y : 1.4
      if (Math.abs(Math.abs(rot) - Math.PI / 2) < 0.1) addBox(x - hl, z - hw, x + hl, z + hw, h); else addBox(x - hw, z - hl, x + hw, z + hl, h)
      this.parked.push({ inst: i, x, z, rot, color, type, box, taken: false })
    })
  }

  // ---------------------------------------------------------------- dynamic props (physics)
  buildDynamicProps() {
    const P = this.physics, g = this.group
    const crateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1)
    const crate = (x, y, z, rot = 0) => { const m = new THREE.Mesh(crateGeo, this.mat.crate); m.castShadow = m.receiveShadow = true; g.add(m); P.addProp(m, { hx: 0.55, hy: 0.55, hz: 0.55, mass: 25, kind: 'crate', x, y, z, rotY: rot }) }
    const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 14)
    const barrel = (x, z) => { const m = new THREE.Mesh(barrelGeo, this.mat.barrel); m.castShadow = true; const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 0.3 })); band.position.y = 0.25; m.add(band); g.add(m); P.addProp(m, { hy: 0.55, r: 0.42, shape: 'cyl', mass: 40, kind: 'barrel', x, y: 0.8, z }) }
    const coneGeo = mergeGeometries([new THREE.ConeGeometry(0.28, 0.9, 10).translate(0, 0.45, 0), new THREE.BoxGeometry(0.7, 0.06, 0.7).translate(0, 0.03, 0)])
    const cone = (x, z) => { const m = new THREE.Mesh(coneGeo, this.mat.cone); m.castShadow = true; g.add(m); P.addProp(m, { hx: 0.3, hy: 0.45, hz: 0.3, mass: 3, kind: 'cone', x, y: 0.7, z }) }
    // loading docks in Career Heights
    for (const bx of [6, 7]) for (const bz of [0, 1, 2]) {
      const x0 = blockStart(bx), z0 = blockStart(bz)
      for (let i = 0; i < 4; i++) crate(x0 + 3 + (i % 2) * 1.2, 0.9 + Math.floor(i / 2) * 1.15, z0 + BLOCK - 1.5, this.rand() * 0.4)
      barrel(x0 + BLOCK - 3, z0 + 1.5); barrel(x0 + BLOCK - 4.2, z0 + 1.6)
    }
    // mod garage lots
    for (const bz of [3, 4]) for (const bx of [6, 7]) {
      const x0 = blockStart(bx), z0 = blockStart(bz)
      for (let i = 0; i < 3; i++) crate(x0 + 5 + i * 1.3, 0.9, z0 + 5, 0.2 * i)
      barrel(x0 + 4, z0 + BLOCK - 5); barrel(x0 + 5.2, z0 + BLOCK - 5.6)
      for (let i = 0; i < 4; i++) cone(x0 + 12 + i * 1.6, z0 + BLOCK - 4)
    }
    // road works cones along Central Park's north road
    for (let i = 0; i < 7; i++) cone(blockStart(3) + 3 + i * 3.5, roadCoord(3) - ROAD / 2 + 1.4)
    for (let i = 0; i < 6; i++) cone(roadCoord(5) + ROAD / 2 - 1.4, blockStart(1) + 3 + i * 4)
    // stadium parking
    for (let i = 0; i < 5; i++) crate(blockStart(5) + 20 + i * 1.3, 0.9, blockStart(7) + 6)
    barrel(blockStart(7) + 26, blockStart(5) + 6); barrel(blockStart(7) + 27.2, blockStart(5) + 6.8)
  }

  update(dt) { if (this.waters) for (const w of this.waters) { w.userData.n.offset.x += dt * w.userData.speed; w.userData.n.offset.y += dt * w.userData.speed * 0.7 } this.landmarks?.update(dt) }

  setNight(n) {
    this.uNight.value = n
    this.mat.asphalt.roughness = 0.9 - n * 0.55; this.mat.asphalt.metalness = n * 0.15
    this.mat.lampHead.emissiveIntensity = n > 0.3 ? 1.6 : 0
    if (this.poolMat) this.poolMat.opacity = Math.max(0, (n - 0.3) / 0.7)
    for (const s of this.neon) if (s.material) s.material.emissiveIntensity = n * 1.1
    for (const m of this.neonMats || []) m.emissiveIntensity = n * 0.9
    showcaseNight(this.mat, n)
    this.bench?.setNight(n)
    this.village?.setNight(n)
    this.scenery?.setNight(n)
    this.landmarks?.setNight(n)
  }
}
