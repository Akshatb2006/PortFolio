# Akshat City — a GTA-style portfolio

Akshat Baranwal's portfolio as a small open-world driving game. Visitors spawn in Grove Street,
walk or drive around eight districts, and complete missions to unlock each section of the
portfolio (about, experience, projects, lab, skills, achievements, socials). A plain
"Résumé mode" is one click away on the title screen for people who just want the facts.

## Stack

- [Three.js](https://threejs.org) for rendering (HDRI lighting, PBR materials, shadows, bloom, colour grade)
- [Rapier](https://rapier.rs) for physics (raycast vehicle with suspension, character controller, dynamic props, explosions)
- Vite for dev/build. No framework, no backend. Progress is saved in `localStorage`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview
```

Deploy `dist/` anywhere static (Vercel, Cloudflare Pages, GitHub Pages).

## Edit the content

Everything the city shows comes from two files:

- `src/data/content.js` — about, experience, projects, lab, skills, achievements, socials.
- `src/data/missions.js` — the 7 missions, billboard/sign landmarks, token positions and spawn point.

Images for projects go in `public/images/`.

## Controls

| Action | Keys |
| --- | --- |
| Move / drive | `W A S D` or arrows |
| Handbrake (drift) | `Space` |
| Interact / enter & exit car | `E` or `Enter` |
| Camera first ↔ third person | `V` |
| Map, missions, dossier | `M` or `Esc` |
| Day ↔ night | `N` |
| Respawn if stuck | `R` |

Touch devices get a virtual joystick and buttons automatically.

## Project layout

```
src/
  main.js              boot, loop, day/night, cinematic intro
  data/                content + missions (edit these)
  game/
    CityMap.js         grid maths, districts, colliders, minimap painting
    City.js            builds the whole city (roads, buildings, props, water)
    Assets.js          loads HDRI, PBR textures, GLB models
    Physics.js         Rapier world, static colliders, dynamic props
    Vehicle.js         player car (raycast vehicle) + Ferrari model
    Player.js          on-foot character (Soldier) + character controller
    Pedestrians.js     sidewalk walkers
    Traffic.js         AI cars on the road graph
    BgCars.js          one instanced mesh for all parked/traffic cars (LOD model)
    Markers.js         mission markers, checkpoints, tokens
    Missions.js        mission state machine
    UI.js              HUD, dialogue, cards, menu, radar, résumé mode
    Effects.js         particles (explosions, sparks, tyre smoke)
    Postfx.js          bloom + colour grade
    Audio.js           synthesised engine / UI / explosion sounds
scripts/make-car-lod.mjs   regenerates the decimated background car
```

## Credits

- Car: “Ferrari 458 Italia” by vicent091036 (CC-BY), from the three.js examples.
- Character: “Soldier” (Mixamo), from the three.js examples.
- Sky HDRI and the outer-terrain grass texture: [Poly Haven](https://polyhaven.com) (CC0). Water normal map: three.js examples.
- Everything else (city, buildings, props, UI, audio) is procedural / original.
