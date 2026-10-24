import * as THREE from 'three'

// Compile an interior's shaders in the background before the player walks in.
// A program depends on the scene's light set, so the room is compiled against a stand-in scene holding exactly
// the lights that are on while inside: the room's own lights plus the scene-level lights that stay visible
// (everything except the sun and the sky light, which the venues switch off). The player's character is
// compiled too, since it is the one outdoor object that stays visible indoors.
export function prewarmInterior(game, room, extra = []) {
  const r = game.renderer, temp = new THREE.Scene()
  temp.environment = game.scene.environment; temp.fog = game.scene.fog
  for (const o of game.scene.children) if (o.isLight && o !== game.sunLight && o !== game.hemi && o.visible) temp.add(o.clone())
  room.traverse(o => { if (o.isLight) { const c = o.clone(); temp.add(c); if (c.target) temp.add(c.target) } })
  const was = room.visible; room.visible = true
  const jobs = [room, ...extra].map(obj => r.compileAsync(obj, game.camera, temp).catch(() => {}))   // the synchronous part runs now
  room.visible = was
  return Promise.all(jobs)
}
