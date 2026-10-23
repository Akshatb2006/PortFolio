import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

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
  const waterNormals = tex.load('/assets/tex/waternormals.jpg'); waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping

  const [hdr, car, carLod, soldier] = await Promise.all([
    rgbe.loadAsync('/assets/hdr/sky_2k.hdr'),
    gltf.loadAsync('/assets/models/ferrari.glb'),
    gltf.loadAsync('/assets/models/ferrari_lod.glb'),
    gltf.loadAsync('/assets/models/Soldier.glb'),
  ])
  hdr.mapping = THREE.EquirectangularReflectionMapping
  return { sets, waterNormals, hdr, car, carLod, soldier }
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
