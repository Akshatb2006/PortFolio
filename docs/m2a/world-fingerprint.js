// World fingerprint: paste into the browser console on a loaded game. Compare against the values in docs/m2a/README.md.
const g = window.game
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16) }
const r3 = (v) => Math.round(v * 1000) / 1000
const arrSig = (a) => { let s = 0, w = 0; for (let i = 0; i < a.length; i++) { s += a[i]; w += a[i] * ((i % 97) + 1) } return [a.length, r3(s), r3(w)].join(':') }
const stat = []
g.physics.world.forEachCollider(c => { const p = c.parent(); if (p && !p.isFixed()) return; const t = c.translation(); const sh = c.shape; const dims = sh.halfExtents ? [sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z] : [sh.radius, sh.halfHeight]; stat.push([t.x, t.y, t.z, ...dims].map(r3).join(',')) })
stat.sort()
const parked = g.bgCars.count - g.traffic.cars.length
const props = g.physics.props.map(p => { const t = p.body.translation(); return p.kind + '@' + [t.x, t.z].map(v => Math.round(v * 10) / 10).join(',') })
const meshes = []
g.city.group.children.forEach((o) => { if (!o.isMesh) return; const geo = o.geometry; const parts = [o.type, o.material.type, arrSig(geo.attributes.position.array)]; if (geo.attributes.color) parts.push(arrSig(geo.attributes.color.array)); if (o.isInstancedMesh) { parts.push(arrSig(o.instanceMatrix.array)); if (o.instanceColor) parts.push(arrSig(o.instanceColor.array)) } meshes.push(parts.join('|')) })
JSON.stringify({ staticColliders: stat.length + ':' + fnv(stat.join(';')), trees: g.city.treeSpots.length + ':' + fnv(JSON.stringify(g.city.treeSpots.map(p => p.map(r3)))), palms: g.city.palmSpots.length + ':' + fnv(JSON.stringify(g.city.palmSpots.map(p => p.map(r3)))), parked: parked + ':' + fnv(arrSig(g.bgCars.mesh.instanceMatrix.array.slice(0, parked * 16))) + ':' + fnv(arrSig(g.bgCars.mesh.instanceColor.array.slice(0, parked * 3))), props: props.length + ':' + fnv(props.join(';')), cityMeshes: meshes.length + ':' + fnv(meshes.join('\n')) })
