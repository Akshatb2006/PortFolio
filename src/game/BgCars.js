import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { prepareCar } from './CarModel.js'

// All background cars (parked + traffic) in ONE InstancedMesh built from the decimated LOD.
// Vertex colours carry each part's base colour; the paintMask attribute selects which
// vertices take the per-instance colour.
export class BgCars {
  constructor(scene, lodScene, capacity = 64) {
    const prep = prepareCar(lodScene)
    prep.wrap.updateMatrixWorld(true)
    const geos = []
    prep.wrap.traverse(o => {
      if (!o.isMesh) return
      let g = o.geometry.clone()
      if (g.index) g = g.toNonIndexed()
      g.applyMatrix4(o.matrixWorld)
      for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k)
      const isPaint = o.name === 'body'
      const c = isPaint ? new THREE.Color(1, 1, 1) : (o.material.color || new THREE.Color(0.4, 0.4, 0.4))
      const n = g.attributes.position.count
      const col = new Float32Array(n * 3), mask = new Float32Array(n)
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; mask[i] = isPaint ? 1 : 0 }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('paintMask', new THREE.BufferAttribute(mask, 1))
      geos.push(g)
    })
    const geometry = mergeGeometries(geos)
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 })
    material.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float paintMask;\n' + sh.vertexShader.replace('#include <color_vertex>', `
        vColor = vec3(1.0);
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor = mix(vColor, vColor * instanceColor, paintMask);
        #endif`)
    }
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.castShadow = true; this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
    this.count = 0
    this.capacity = capacity
    const hide = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < capacity; i++) { this.mesh.setMatrixAt(i, hide); this.mesh.setColorAt(i, new THREE.Color(1, 1, 1)) }
    this.mesh.count = capacity
    scene.add(this.mesh)
  }

  finalize() { this.mesh.count = Math.max(1, this.count) }

  alloc(color) {
    if (this.count >= this.capacity) return -1
    const i = this.count++
    this.mesh.setColorAt(i, new THREE.Color(color)); this.mesh.instanceColor.needsUpdate = true
    return i
  }

  set(i, x, y, z, heading) {
    if (i < 0) return
    const m = new THREE.Matrix4().makeRotationY(heading).setPosition(x, y, z)
    this.mesh.setMatrixAt(i, m); this.mesh.instanceMatrix.needsUpdate = true
  }
}
