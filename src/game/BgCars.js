import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { prepareCar } from './CarModel.js'
import { instancedModel } from './KenneyCars.js'

// Background cars. Traffic uses ONE InstancedMesh built from the decimated Ferrari LOD (vertex colours carry
// each part's base colour; paintMask selects the vertices that take the per-instance colour). Parked cars use
// Kenney Car Kit models (`type`): one InstancedMesh per model, created in finalize() once every car is known.
// Indices returned by alloc() are stable handles for set() / hide() whichever mesh holds the car.
export class BgCars {
  constructor(scene, lodScene, capacity = 64, kenney = null) {
    this.scene = scene; this.kenney = kenney
    this.slots = []          // handle -> { mesh, i } (Kenney slots get their mesh in finalize)
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

  finalize() {
    this.mesh.count = Math.max(1, this.count)
    // one InstancedMesh per Kenney model, sized to the cars that use it
    const byType = {}
    for (const s of this.slots) if (s.type) (byType[s.type] ??= []).push(s)
    this.kenneyMeshes = []
    for (const [type, list] of Object.entries(byType)) {
      const { geometry, material } = instancedModel(this.kenney, type)
      const mesh = new THREE.InstancedMesh(geometry, material, list.length)
      const paint = new Float32Array(list.length * 3)
      list.forEach((s, i) => { s.mesh = mesh; s.i = i; mesh.setMatrixAt(i, s.matrix); s.color.toArray(paint, i * 3) })
      // per-instance paint colour (a custom attribute: three's instanceColor would tint the whole car)
      geometry.setAttribute('iPaint', new THREE.InstancedBufferAttribute(paint, 3))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false
      mesh.name = 'parked-' + type
      this.scene.add(mesh); this.kenneyMeshes.push(mesh)
    }
  }

  // type: a Kenney model name (parked cars) or undefined for the Ferrari LOD (traffic)
  alloc(color, type) {
    if (type && this.kenney?.[type]) {
      this.slots.push({ type, color: new THREE.Color(color), matrix: new THREE.Matrix4().makeScale(0, 0, 0), mesh: null, i: -1 })
      return this.slots.length - 1
    }
    if (this.count >= this.capacity) return -1
    const i = this.count++
    this.mesh.setColorAt(i, new THREE.Color(color)); this.mesh.instanceColor.needsUpdate = true
    this.slots.push({ mesh: this.mesh, i })
    return this.slots.length - 1
  }

  write(k, m) {
    const s = this.slots[k]; if (!s) return
    if (s.matrix) s.matrix.copy(m)
    if (s.mesh) { s.mesh.setMatrixAt(s.i, m); s.mesh.instanceMatrix.needsUpdate = true }
  }

  hide(k) { if (k >= 0) this.write(k, new THREE.Matrix4().makeScale(0, 0, 0)) }

  set(k, x, y, z, heading) { if (k >= 0) this.write(k, new THREE.Matrix4().makeRotationY(heading).setPosition(x, y, z)) }
}
