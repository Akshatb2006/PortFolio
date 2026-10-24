# Living-city + futuristic art direction — audit and plan (no downloads, no code changes)

Branch `m2-building-kit`, last commit M2a `623fed2`; uncommitted: M2b, S1, S1.1, render fix, showcase block,
gait fix (6 source files + `Showcase.js`, ~490 lines).

## 1. Current state (measured)

| Topic | Finding | Where |
| --- | --- | --- |
| Why soldiers | One character asset, `Soldier.glb` (three.js example, Mixamo "Vanguard" military rig: 2 skinned meshes, 49 joints, clips Idle / Walk / Run / TPose). Player and all pedestrians clone it; pedestrians only get a colour tint. | `Assets.js` loads it; `Player.js makeSoldier()`; `Pedestrians.js` |
| Why empty | 14 pedestrians for a 414 m city (6 on low quality), one per random block. Measured: **0** within 40 m of the player over 20 s at spawn; 0 within 60 m of the downtown view; only 1 assigned to downtown, 4 to the beach, 3 park, 3 stadium. | `main.js` (count 14), `Pedestrians.js` constructor |
| Routes | Each pedestrian loops one block's perimeter, 1 m outside the block on the road surface; never crosses a street, never enters a sidewalk, no avoidance; 3–10 s rests (added last pass). | `Pedestrians.at()/update()` |
| Animation | Gait now measured per rig (walk 1.56 m/s, run 4.0 m/s); mean foot slip 0.11 m/s. Only 4 clips exist, so no sitting, talking, dancing or waving is possible with this rig. | `Player.js measureGait/blendLocomotion` |
| Cost per pedestrian | One cloned skinned mesh set + cloned material per pedestrian (no sharing), mixer within 90 m. | `makeSoldier()` |
| Asset pipeline | `Assets.loadAssets()`: HDRI, Ferrari (Draco), Ferrari LOD, Soldier, grass PBR set, water normals; 11.7 MB. GLTFLoader + DRACOLoader in place; no KTX2. | `Assets.js` |
| Portfolio presentation | Mission markers are glowing cylinders + floating text sprites on roads; billboards downtown; signposts on the pier. | `Markers.js`, `missions.js` |
| Render pipeline | Fullscreen fix verified (canvas, composer, SMAA match at 1280×720 / 1920×1080 / 1470×956). Not the limiting factor. | `Postfx.js`, `main.js` |

## 2. Verified portfolio data available

- **Social links** (identical to the original repo): GitHub `github.com/Akshatb2006`, LinkedIn
  `linkedin.com/in/akshat-baranwal-936797313/`, Mail `kysuakshat23@gmail.com`, X `x.com/Akshat_B23`, Instagram
  `instagram.com/akshatb_23`. Discord `discord.com/users/akshatbaranwal_99532` — already flagged in the original
  repo as not resolving to a profile; needs a numeric user ID or server invite.
- **Experience / skills / achievements / about**: from the original site's text (verified source).
- **Projects** (title, role, stack, link, image): InsightEdge (link is `github.com/Manishym956/IgniteEdge` — a
  different user's repo, please confirm), ApartmentHub (`apartmenthubs.com`), Resume Parser
  (`github.com/Akshatb2006/Resume-Parser`); lab repos ActiTrace, Life Drift, Paint Robot, Secure Transactions,
  VERIDICT.
- **Not verified — written by me during the rebuild:** the one-line project "blurbs" and all five lab blurbs.
- **Missing for restaurant case studies:** problem statement, your specific contribution, key technical
  achievements, demo links, for every project. I will not invent these.

## 3. Why it still looks dated (honest)

The renderer is fine. The look comes from content: every building, tree, prop and mountain is generated
from boxes, cones and icosahedra in code; materials are flat colour with faint noise; the only authored
models are a realistic Ferrari and a realistic soldier, which clash with everything else. Code can add
detail (the showcase block shows how far), but a modern game look needs **authored models with a single
art style**, authored textures/atlases, and characters from the same family. Genshin-level polish is
bespoke art; the realistic target is a cohesive, modern stylised indie look from curated kits.

## 4. Art direction proposal: "Near-future coastal metropolis"

- **Structure:** a glassy near-future downtown core (landmark towers, sky bridges, light strips at edges,
  not everywhere), surrounded by older warm neighbourhoods (the brick/clapboard showcase style) and a
  bright beach strip. Contrast between the two is what makes the futuristic core read as special.
- **Palette:** sunset gold `#F2B866`, deep navy `#14213D`, cyan `#3DD6F5`, violet `#7B5CD6`, magenta accents
  `#E94FA6` only for signage and nightlife; neutrals warm concrete `#D9CFC2` and charcoal `#2A2D33`.
- **Materials:** glass = dark blue-cyan with strong environment reflections; metal = brushed, low saturation;
  concrete/plaster = warm, slightly rough; asphalt dark warm grey with worn markings; vegetation saturated but
  not neon. Emissive only on signage, window interiors at night, and architectural light lines.
- **Lighting:** keep golden-hour day + the night mode; night gets cyan/magenta signage pools in nightlife only.
- **Characters:** stylised low-poly civilians from one family (see §5), shared materials, varied outfits.
- **Camera:** keep third-person; add slight look-ahead and a lower, wider framing on foot.

## 5. Asset shortlist (licences checked on official pages this session)

| Pack | Source | Licence | Formats | Use | Download size |
| --- | --- | --- | --- | --- | --- |
| Ultimate Modular Men | quaternius.com/packs/ultimatemodularcharacters.html | CC0 | glTF/FBX/Blend | civilians incl. **Beach**, Casual_2, Casual_Hoodie, Suit, Worker; 24 clips | not listed (Drive) |
| Ultimate Modular Women | quaternius.com/packs/ultimatemodularwomen.html | CC0 | glTF/FBX/Blend | Casual, Formal, Suit, Worker, Punk…; 24 clips | not listed (Drive) |
| Universal Animation Library (Standard) | quaternius.itch.io/universal-animation-library | CC0 | FBX/GLB | 45 extra clips (sitting, swimming…), humanoid rig, root-motion option | 15 MB |
| Downtown City MegaKit (Standard) | quaternius.itch.io/downtown-city-megakit | CC0 | glTF/FBX/OBJ | modern mid-rise modular buildings, fire escapes, street pieces (not futuristic) | 223 MB zip |
| Stylized Nature MegaKit (Standard) | quaternius.itch.io/stylized-nature-megakit | CC0 | glTF/FBX/OBJ | 81 trees/plants/rocks/bushes (replaces icosahedron trees and cone mountains) | 99 MB zip |
| KayKit City Builder Bits | kaylousberg.itch.io/city-builder-bits | CC0 | GLTF/FBX/OBJ | 32+ city props/buildings, one gradient atlas | 4.6 MB |
| Kenney City Kit Commercial / Suburban / Roads, Car Kit | kenney.nl | CC0 | (pages don't list; Kenney ships GLB/FBX/OBJ) | modern towers, houses, road props; 45-file car kit for traffic variety | not listed |

Zip sizes include every format and source files; the shipped subset (glTF only, used models, compressed)
is typically a few percent of that — measure after download, budget ≤ 10 MB added.
**No CC0 futuristic exterior kit was verified.** Futuristic landmarks would be built by extending
`BuildingKit` (glass curtain walls, crowns, light lines) on top of the modern kits, or from a paid kit
(e.g. Synty POLYGON City/Sci-Fi City — paid, non-CC0 licence; only if you want to buy one).
**Blocker:** the two character packs are on Google Drive, which currently returns "Quota exceeded".

Rig compatibility: Quaternius characters use a humanoid rig with named clips; `makeSoldier()` already clones
any skinned glTF; `measureGait()` adapts playback. Needed: clip-name mapping, scale (1.8 m), facing, shared
materials instead of per-pedestrian clones.

## 6. Destinations plan (fits the current map and missions)

| Place | Location | Missions preserved |
| --- | --- | --- |
| Home (about, education, skills, experience, achievements; desk computer opens a profile panel) | a Grove Street house lot next to the "Home Sweet Home" marker | Home Sweet Home unchanged; its final card can point to the house |
| Restaurant "Code & Coffee" (one exhibit per project: framed visual + menu entry + table terminal → project card) | showcase block café (downtown 3,1) | "Shipped It" billboards stay; cards gain a "visit the café" link |
| Bar / social club (social links wall, booths, DJ area, dance floor) | a downtown or pier-side lot near Sunset Pier | "Stay Connected" pier signposts can move into the bar in a later approved stage |
| Office / tech building (experience) | Career Heights | Career route unchanged |

**Interiors and colliders:** a walkable interior needs the lot's solid collider box replaced by wall
colliders with a door gap — a collider-layout change that needs explicit approval. Alternative without
collider changes: "step-in" interaction at the door that switches to an interior camera/scene.

## 7. Staged plan

| Stage | Scope | Files | Acceptance |
| --- | --- | --- | --- |
| A (this) | Audit and shortlist | docs only | approved shortlist |
| B Civilian prototype | 1 Quaternius character: load, map clips, verify bind pose, idle/walk/run, turning, grounding, facing; shared materials | `Assets.js`, `Player.js`, new `Characters.js` | no T-pose; foot slip ≤ 0.15 m/s; 60 fps |
| C Living pedestrians | sidewalk nav strips per block + crossings, seeded spawn weighted by district (downtown/commercial > residential), 12–20 visible, groups, bench sitting (if clip), LOD (full < 30 m, half-rate < 60 m, frozen > 90 m), diagnostics overlay (`akshatDev.peds()`) | `Pedestrians.js`, new `PedNav.js`, `CityMap.js` (read-only helpers) | ≥ 8 pedestrians within 40 m in downtown views; 0 stuck > 5 s; p95 ≤ 20 ms |
| D Destinations | home, restaurant exhibits, bar hub, profile/project/social UI panels; markers reduced | `City.js`/`Showcase.js`, `UI.js`, `missions.js` | missions still completable; every link verified; no invented content |
| E Visual polish | nature kit trees, kit facades/props in benchmark district, futuristic landmarks, ambient audio | `City.js`, `BuildingKit.js`, `Assets.js`, `Audio.js` | benchmark views approved day/night |
| F Future systems | vehicle variety + theft, NPC reactions, non-graphic combat, wanted/police — design only | docs | — |

## 8. Risks
- Payload: kit zips are large; ship only the used glTF subset, compressed; budget ≤ 10 MB added.
- Draw calls: skinned characters are 1–3 draw calls each plus shadows; 20 pedestrians ≈ 60–120 calls —
  share materials, cap shadow casters to near pedestrians.
- Style mixing: Quaternius characters + Quaternius/KayKit environment are compatible; Kenney is flatter.
  Pick one family per category.
- Interiors change colliders (needs approval). Determinism: new placements must use their own seeded
  generators (existing pattern).
- Performance numbers this session were taken while the GPU was contended; re-baseline with only one game
  tab open.
