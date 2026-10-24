import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { carLibrary } from './KenneyCars.js'

// sex: m / f. style: where the outfit fits (see Pedestrians.POOLS). player: the playable character.
export const ROSTER = [
  { id: 'M_Casual_Hoodie', sex: 'm', style: 'casual', player: true },
  { id: 'M_Casual_2', sex: 'm', style: 'casual' }, { id: 'M_Suit', sex: 'm', style: 'office' },
  { id: 'M_Worker', sex: 'm', style: 'work' }, { id: 'M_Beach', sex: 'm', style: 'beach' },
  { id: 'W_Casual', sex: 'f', style: 'casual' }, { id: 'W_Formal', sex: 'f', style: 'office' },
  { id: 'W_Suit', sex: 'f', style: 'office' }, { id: 'W_Worker', sex: 'f', style: 'work' },
  { id: 'W_Punk', sex: 'f', style: 'casual' }, { id: 'W_Adventurer', sex: 'f', style: 'casual' },
  { id: 'M_Swat', sex: 'm', style: 'police', role: true },   // police officers only, never a pedestrian
]
// height: target standing height in metres (the pack's models are authored at a different scale)
export const ANIMALS = [
  { id: 'HolsteinCow', height: 1.45 }, { id: 'Calf', height: 1.0 }, { id: 'Sheep', height: 0.95 },
  { id: 'Lamb', height: 0.65 }, { id: 'Pig', height: 0.8 },
]

export const BENCHMARK_ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('benchmark') !== '0'

// Loads every external asset once. HDRI and grass/water textures come from Poly Haven (CC0) / three.js,
// models from the three.js examples repository (see credits in the menu).
export async function loadAssets(onProgress) {
  const manager = new THREE.LoadingManager()
  manager.onProgress = (url, loaded, total) => onProgress && onProgress(loaded / total)
  const tex = new THREE.TextureLoader(manager)
  const gltf = new GLTFLoader(manager)
  const draco = new DRACOLoader(); draco.setDecoderPath('/draco/'); gltf.setDRACOLoader(draco)
  const rgbe = new RGBELoader(manager)

  // Only the outer-terrain grass still uses a photo PBR set (City.buildGround). The packed ARM map is
  // loaded once and shared by aoMap / roughnessMap (pbrMaterial ignores metalness).
  const pbr = (name) => {
    const load = (suffix, color) => { const t = tex.load(`/assets/tex/${name}_${suffix}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t }
    const arm = load('arm', false)
    return { map: load('diff', true), normalMap: load('nor', false), aoMap: arm, roughnessMap: arm }
  }
  const sets = {
    grass: pbr('aerial_grass_rock'),
  }
  // scenic terrain (Scenery.js): Poly Haven rock colour maps, CC0
  if (BENCHMARK_ON) for (const [k, n] of [['rockAerial', 'aerial_rocks_02'], ['rockFace', 'rock_face_03']]) { const t = tex.load(`/assets/tex/${n}_diff.jpg`); t.colorSpace = THREE.SRGBColorSpace; sets[k] = { map: t } }
  const waterNormals = tex.load('/assets/tex/waternormals.jpg'); waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping

  // visual benchmark kits (Quaternius Downtown City + Stylized Nature MegaKits, CC0; see docs/benchmark).
  // ?benchmark=0 skips them and keeps the original block (4,1) for comparison.
  let kit = null
  if (BENCHMARK_ON) {
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')
    const kl = new GLTFLoader(manager); kl.setMeshoptDecoder(MeshoptDecoder)
    const [downtown, nature, village, ...interiors] = await Promise.all([
      kl.loadAsync('/assets/models/city/downtown-kit.glb'), kl.loadAsync('/assets/models/city/nature-kit.glb'),
      kl.loadAsync('/assets/models/city/village-kit.glb'),   // Quaternius Medieval Village MegaKit (CC0): Grove Street
      ...['T_lit_interior_1', 'T_lit_interior_2', 'T_dark_interior'].map(n => tex.loadAsync(`/assets/tex/${n}.jpg`)),
    ])
    kit = { downtown, nature, village, interiors }
  }
  // civilians (Quaternius Ultimate Modular Men / Women, CC0; run clip baked from the Universal Animation
  // Library) and park animals (Gobkit Free Animal Pack Vol.3, CC0). The Soldier is only a fallback now.
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')
  const cl = new GLTFLoader(manager); cl.setMeshoptDecoder(MeshoptDecoder)
  // character meshes + one shared clip set per body type (same skeleton, clips bind by bone name)
  const rosterP = Promise.all([
    cl.loadAsync('/assets/models/characters/anims-men.glb'), cl.loadAsync('/assets/models/characters/anims-women.glb'),
    ...ROSTER.map(r => cl.loadAsync(`/assets/models/characters/${r.id}.glb`)),
  ]).then(([am, af, ...gs]) => ROSTER.map((r, i) => ({ ...r, gltf: { scene: gs[i].scene, animations: (r.sex === 'f' ? af : am).animations } })))
  const animalsP = Promise.all(ANIMALS.map(a => gltf.loadAsync(`/assets/models/animals/${a.id}.glb`).then(g => ({ ...a, gltf: g }))))
  // Kenney Car Kit (CC0): sedan / SUV / van for parked (and stolen) cars, police car for pursuits
  const carsP = cl.loadAsync('/assets/models/vehicles/kenney-cars.glb')
  const [hdr, car, carLod, rosterR, animalsR, cars] = await Promise.all([
    rgbe.loadAsync('/assets/hdr/sky_2k.hdr'),
    gltf.loadAsync('/assets/models/ferrari.glb'),
    gltf.loadAsync('/assets/models/ferrari_lod.glb'),
    rosterP.catch(e => { console.warn('[assets] civilians failed, using the Soldier fallback', e); return null }),
    animalsP.catch(e => { console.warn('[assets] animals failed to load', e); return [] }),
    carsP.catch(e => { console.warn('[assets] Kenney cars failed, parked and police cars fall back to the Ferrari', e); return null }),
  ])
  const soldier = rosterR ? null : await gltf.loadAsync('/assets/models/Soldier.glb')
  hdr.mapping = THREE.EquirectangularReflectionMapping
  return { sets, waterNormals, hdr, car, carLod, carLib: cars ? carLibrary(cars) : null, soldier, kit, roster: rosterR, animals: animalsR }
}

// Material factory for a PBR set with world-space tiling (metres per tile)
export function pbrMaterial(set, { tile = 4, color = 0xffffff, roughness = 1, normalScale = 1, metalness = 0 } = {}) {
  // all these surfaces are dielectric: ignore the packed metalness channel (some Poly Haven ARM maps carry non-zero blue)
  const m = new THREE.MeshStandardMaterial({ color, map: set.map, normalMap: set.normalMap, aoMap: set.aoMap, roughnessMap: set.roughnessMap, roughness, metalness })
  m.normalScale.set(normalScale, normalScale)
  m.userData.tile = tile
  return m
}

// Rewrite UVs so textures tile in world space (horizontal surfaces use xz, walls use the long axis + y)
export function worldUV(geo, tile, mode = 'xz') {
  const p = geo.attributes.position, n = geo.attributes.normal
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    let u, v
    if (mode === 'xz') { u = x / tile; v = z / tile }
    else { // auto by normal
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i))
      if (ny >= nx && ny >= nz) { u = x / tile; v = z / tile } else if (nx >= nz) { u = z / tile; v = y / tile } else { u = x / tile; v = y / tile }
    }
    uv[i * 2] = u; uv[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2))
  return geo
}

