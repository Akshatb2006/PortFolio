import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Kenney Car Kit (CC0): sedan, SUV, van and police car packed into one GLB (tools/assets/build-cars.mjs), one
// shared palette texture. The models are authored as chunky ~2.6 m toys. Bodies are scaled to street size
// (width ×1.3, height ×1.25, length ×1.65: a 4.2 m sedan about 1.6 m tall). Wheels are re-parented to the
// unscaled wrapper with a round ×1.25 scale, so they spin without distorting and still touch the ground.
// Paint: the most-used *coloured* palette cell on the body; a `paint` vertex attribute marks those vertices
// with the cell's mean luminance so the shader can repaint them while keeping the cell's gradient.
// Liveried vehicles (police) keep their colours.
export const SX = 1.3, SY = 1.25, SZ = 1.65
export const PARKED_TYPES = ['sedan', 'suv', 'van']
const LIVERY = new Set(['police'])
const WHEELS = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']
const base = (name) => name.replace(/_\d+$/, '')   // GLTFLoader makes repeated node names unique with _N

const cache = new WeakMap()

// palette pixels: linear luminance and saturation per 64×128 px cell (8 columns × 4 rows)
function cellStats(tex) {
  const img = tex.image, W = img.width, H = img.height
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0)
  const px = cx.getImageData(0, 0, W, H).data
  const lin = (c) => Math.pow(c / 255, 2.2)
  const lum = new Float32Array(32), sat = new Float32Array(32), cw = W / 8, ch = H / 4
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    let s = 0, st = 0, n = 0
    for (let y = r * ch + 2; y < (r + 1) * ch - 2; y += 2) for (let x = c * cw + 2; x < (c + 1) * cw - 2; x += 2) {
      const k = (y * W + x) * 4, mx = Math.max(px[k], px[k + 1], px[k + 2]), mn = Math.min(px[k], px[k + 1], px[k + 2])
      s += 0.2126 * lin(px[k]) + 0.7152 * lin(px[k + 1]) + 0.0722 * lin(px[k + 2]); st += mx ? (mx - mn) / mx : 0; n++
    }
    lum[r * 8 + c] = s / n; sat[r * 8 + c] = st / n
  }
  return { lum, sat }
}

// meshopt-quantised attributes (int8/int16, normalised) → float, so geometry can be transformed and merged
function floatAttrs(g) {
  for (const [k, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) out[i * a.itemSize + j] = a.getComponent(i, j)
    g.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize))
  }
  return g
}

// shader patch shared by instanced (per-instance attribute) and single (uniform) paint
function paintable(material, instanced) {
  const m = material.clone()
  m.userData.paint = { value: new THREE.Color(1, 1, 1) }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = m.userData.paint
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float paint;\nvarying float vPaint;\nvarying vec3 vPaintCol;\n${instanced ? 'attribute vec3 iPaint;' : 'uniform vec3 uPaint;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPaint = paint;\nvPaintCol = ${instanced ? 'iPaint' : 'uPaint'};`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPaint;\nvarying vec3 vPaintCol;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vPaint > 0.0) {
          float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = vPaintCol * clamp(l / vPaint, 0.55, 1.45);
        }`)
  }
  m.customProgramCacheKey = () => 'kenney-paint-' + instanced
  return m
}

// Prepares every model in the pack once: scaled wrapper, bounds, wheel layout, paint attribute.
export function carLibrary(gltf) {
  if (cache.has(gltf)) return cache.get(gltf)
  let stats = null, tex = null
  const lib = {}
  for (const scene of gltf.scenes) {
    const name = base(scene.name)
    const wrap = new THREE.Group(); wrap.name = 'kenney-' + name
    const inner = new THREE.Group(); inner.scale.set(SX, SY, SZ); wrap.add(inner)
    for (const c of [...scene.children]) inner.add(c.clone(true))
    wrap.updateMatrixWorld(true)
    // wheels: out of the non-uniformly scaled body group, round scale, hub kept at its scaled position
    for (const w of WHEELS) {
      let n = null; inner.traverse(o => { if (!n && base(o.name) === w) n = o }); if (!n) continue
      const hub = n.getWorldPosition(new THREE.Vector3())
      wrap.add(n); n.position.copy(hub); n.scale.multiplyScalar(SY)
    }
    wrap.updateMatrixWorld(true)
    wrap.traverse(o => { if (o.isMesh) o.geometry = floatAttrs(o.geometry.clone()) })
    let body = null, material = null
    // the body is the mesh named "body" (or the mesh inside a "body" group, never a part like the SUV's spare wheel)
    wrap.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; material ??= o.material; tex ??= o.material.map; if (base(o.name) === 'body') body = o })
    if (!body) wrap.traverse(o => { if (o.isMesh && base(o.parent?.name || '') === 'body' && !base(o.name).startsWith('wheel')) body ??= o })
    if (!stats && tex) { stats = cellStats(tex); tex.updateMatrix() }
    const lum = stats.lum
    // paint cell: the coloured palette cell covering the most body surface (grey trim, tyres, glass skipped)
    const uvAt = (uv, i) => new THREE.Vector2(uv.getX(i), uv.getY(i)).applyMatrix3(tex.matrix)
    const cellOf = (v) => Math.min(3, Math.max(0, Math.floor(v.y * 4))) * 8 + Math.min(7, Math.max(0, Math.floor(v.x * 8)))
    let paintCell = -1
    if (body && !LIVERY.has(name)) {
      const g = body.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index
      const area = new Float32Array(32), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
      const tri = idx ? idx.count / 3 : pos.count / 3
      for (let t = 0; t < tri; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
        const ctr = uvAt(uv, i0).add(uvAt(uv, i1)).add(uvAt(uv, i2)).divideScalar(3)
        area[cellOf(ctr)] += b.sub(a).cross(c.sub(a)).length()
      }
      for (let k = 0; k < 32; k++) if (stats.sat[k] < 0.3) area[k] *= 0.01   // greys only win if nothing is coloured
      paintCell = area.indexOf(Math.max(...area))
    }
    // paint attribute on every mesh (0 = keep palette colour)
    wrap.traverse(o => {
      if (!o.isMesh) return
      const g = o.geometry, uv = g.attributes.uv, n = g.attributes.position.count, p = new Float32Array(n)
      if (o === body && paintCell >= 0) for (let i = 0; i < n; i++) if (cellOf(uvAt(uv, i)) === paintCell) p[i] = Math.max(0.02, lum[paintCell])
      g.setAttribute('paint', new THREE.BufferAttribute(p, 1))
    })
    wrap.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(wrap), size = box.getSize(new THREE.Vector3())
    const half = new THREE.Vector3(size.x / 2, size.y, size.z / 2)   // y: full height
    const wheelNodes = WHEELS.map(w => { let f = null; wrap.traverse(o => { if (!f && base(o.name) === w) f = o }); return f })
    const wheelRadius = wheelNodes[0] ? new THREE.Box3().setFromObject(wheelNodes[0]).getSize(new THREE.Vector3()).y / 2 : 0.5
    const wheelPos = wheelNodes.map(w => w ? new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3()) : new THREE.Vector3())
    lib[name] = { name, wrap, material, half, wheelRadius, wheelPos, paintCell, paintable: paintCell >= 0 }
  }
  cache.set(gltf, lib)
  return lib
}

// one merged geometry + instanced paint material per model (background traffic and parked cars)
export function instancedModel(lib, name) {
  const t = lib[name]
  if (t.instanced) return t.instanced
  const geos = []
  t.wrap.updateMatrixWorld(true)
  t.wrap.traverse(o => {
    if (!o.isMesh) return
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'paint'].includes(k)) g.deleteAttribute(k)
    if (g.index) g = g.toNonIndexed()
    geos.push(g)
  })
  t.instanced = { geometry: mergeGeometries(geos), material: paintable(t.material, true) }
  return t.instanced
}

// A drivable / animated copy (stolen cars, police): same layout as CarModel.buildPlayerCar returns
export function buildKenneyCar(lib, name, color = 0xffffff) {
  const t = lib[name]
  const mesh = t.wrap.clone(true)
  const mat = paintable(t.material, false); mat.userData.paint.value.set(color)
  mesh.traverse(o => { if (o.isMesh) o.material = mat })
  const wheels = WHEELS.map(w => { let f = null; mesh.traverse(o => { if (!f && base(o.name) === w) f = o }); return f })
  return { mesh, wheels, wheelRadius: t.wheelRadius, wheelPos: t.wheelPos, mats: { body: mat }, wheelScale: 1, half: t.half }
}
