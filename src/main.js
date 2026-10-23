import * as THREE from 'three'
import * as M from './game/CityMap.js'
import { loadAssets } from './game/Assets.js'
import { Physics } from './game/Physics.js'
import { City } from './game/City.js'
import { Vehicle } from './game/Vehicle.js'
import { Player } from './game/Player.js'
import { Pedestrians } from './game/Pedestrians.js'
import { CameraRig } from './game/CameraRig.js'
import { Traffic } from './game/Traffic.js'
import { BgCars } from './game/BgCars.js'
import { Markers } from './game/Markers.js'
import { Missions } from './game/Missions.js'
import { Input } from './game/Input.js'
import { UI } from './game/UI.js'
import { GameAudio } from './game/Audio.js'
import { Effects } from './game/Effects.js'
import { createPostfx } from './game/Postfx.js'
import { save } from './game/Save.js'
import { missions as missionDefs, landmarks, tokens, spawn } from './data/missions.js'
import { profile } from './data/content.js'
import { palette as P } from './game/Palette.js'

const $ = (s) => document.querySelector(s)

class Game {
  constructor() {
    this.save = save; save.load()
    this.started = false
    this.tokenDefs = tokens
    this.quality = this.pickQuality()
  }

  async boot() {
    const canvas = $('#game')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.dpr = Math.min(devicePixelRatio, this.quality === 'high' ? 1.5 : 1.25); this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.shadowMap.enabled = this.quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 1200)
    this.scene.fog = new THREE.FogExp2(P.sky.horizon, 0.0010)   // light haze toward the horizon colour

    const setPct = (p) => { $('#load-pct').textContent = Math.round(p * 100) + '%' }
    this.assets = await loadAssets((p) => setPct(p * 0.8))
    this.physics = await Physics.create()
    setPct(0.85)

    // lighting: HDRI environment + matching sun
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envDay = pmrem.fromEquirectangular(this.assets.hdr).texture
    this.scene.environment = this.envDay
    this.scene.environmentIntensity = 0.6
    // gradient sky dome (stylised), HDRI kept only for reflections on the car and glass
    this.skyUniforms = { uZenith: { value: new THREE.Color(P.sky.zenith) }, uHorizon: { value: new THREE.Color(P.sky.horizon) }, uGround: { value: new THREE.Color(P.sky.ground) }, uNight: { value: 0 } }
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 uZenith, uHorizon, uGround; uniform float uNight; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(uHorizon, uZenith, pow(h, 0.55)) : mix(uHorizon, uGround, pow(-h, 0.4));
          vec3 night = mix(vec3(0.10, 0.11, 0.18), vec3(0.02, 0.025, 0.06), clamp(h * 2.0, 0.0, 1.0));
          c = mix(c, night, uNight);
          // sun glow near the horizon
          float sun = pow(max(dot(vP, normalize(vec3(-0.62, 0.36, 0.7))), 0.0), 40.0);
          c += vec3(1.0, 0.85, 0.6) * sun * 0.35 * (1.0 - uNight);
          gl_FragColor = vec4(c, 1.0); }` })
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat); this.skyDome.frustumCulled = false
    this.scene.add(this.skyDome)
    this.scene.background = null
    this.sunDir = new THREE.Vector3(-0.62, 0.36, 0.7).normalize()   // late afternoon, long shadows
    this.sunLight = new THREE.DirectionalLight(0xffdcb0, 2.6)
    this.sunLight.castShadow = this.quality !== 'low'
    const sh = this.sunLight.shadow; const S = this.quality === 'high' ? 2048 : 1024
    sh.mapSize.set(S, S); sh.camera.left = sh.camera.bottom = -60; sh.camera.right = sh.camera.top = 60; sh.camera.near = 20; sh.camera.far = 450; sh.bias = -0.0003; sh.normalBias = 0.5; sh.radius = 6
    this.scene.add(this.sunLight, this.sunLight.target)
    this.hemi = new THREE.HemisphereLight(0xbcd4f5, 0xa58a6e, 1.25); this.scene.add(this.hemi)

    // world
    this.bgCars = new BgCars(this.scene, this.assets.carLod.scene, 64)
    this.city = new City(this.scene, this.assets, landmarks, this.physics, this.quality, this.bgCars)
    this.physics.buildStatic()
    setPct(0.92)
    this.vehicle = new Vehicle(this.scene, this.physics, this.assets, { ...spawn.car, color: 0xd0201a })
    this.player = new Player(this.scene, this.physics, this.assets, spawn.player)
    this.traffic = new Traffic(this.scene, this.physics, this.bgCars, this.quality === 'low' ? 8 : 14, M.rng(99))
    this.bgCars.finalize()
    this.peds = new Pedestrians(this.scene, this.assets.soldier, this.quality === 'low' ? 6 : 14, M.rng(7))
    this.markers = new Markers(this.scene)
    this.effects = new Effects(this.scene)
    this.input = new Input()
    this.audio = new GameAudio()
    this.ui = new UI(this)
    this.missions = new Missions(missionDefs, this.markers, this.ui, this.audio, this.save)
    this.rig = new CameraRig(this.camera)
    for (const t of tokens) if (!this.save.data.tokens.includes(t.id)) this.markers.add('t:' + t.id, { x: t.x, z: t.z, kind: 'token', radius: 2.5, height: 3 })
    this.post = createPostfx(this.renderer, this.scene, this.camera, this.quality)

    this.night = 0; this.nightTarget = 0
    this.applyNight(0, true)
    this.ui.refreshHud(); this.ui.refreshMenu()
    if (!this.save.data.sound) { this.audio.enabled = false; $('#btn-mute').classList.add('off') }

    addEventListener('resize', () => this.resize())
    $('#btn-start').addEventListener('click', () => this.start())
    $('#btn-start').disabled = false; $('#btn-start').textContent = 'Start game'
    $('#loading').classList.add('hidden')
    this.clock = new THREE.Clock()
    this.setupCinematic()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  pickQuality() {
    const gl = document.createElement('canvas').getContext('webgl2')
    const coarse = matchMedia('(pointer: coarse)').matches
    if (!gl || coarse) return 'low'
    return innerWidth * devicePixelRatio > 3000 ? 'medium' : 'high'
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(innerWidth, innerHeight); this.post.resize(innerWidth, innerHeight); this.effects.resize()
  }

  // adaptive resolution: if frames are slow, lower the pixel ratio in steps (and raise it back when there is headroom)
  adapt(dt) {
    this.ft = (this.ft || []); this.ft.push(dt); if (this.ft.length < 90) return
    const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length; this.ft = []
    const minDpr = 0.7, maxDpr = Math.min(devicePixelRatio, this.quality === 'high' ? 1.5 : 1.25)
    if (avg > 1 / 45 && this.dpr > minDpr) { this.dpr = Math.max(minDpr, this.dpr - 0.15); this.resize() }
    else if (avg < 1 / 58 && this.dpr < maxDpr) { this.dpr = Math.min(maxDpr, this.dpr + 0.1); this.resize() }
  }

  // ------------------------------------------------------------ day / night (HDRI day, graded night)
  applyNight(n, force) {
    if (!force && Math.abs(n - this.night) < 0.002) return
    this.night = n
    this.scene.environmentIntensity = 0.6 - n * 0.55
    if (this.skyUniforms) this.skyUniforms.uNight.value = n
    this.sunLight.intensity = 2.6 * (1 - n) + 0.4 * n
    this.sunLight.color.setHex(n > 0.5 ? 0x8fa8ff : 0xffdcb0)
    this.hemi.intensity = 1.25 * (1 - n) + 0.3 * n
    this.scene.fog.color.set(P.sky.horizon).lerp(new THREE.Color(0x07080f), n)
    this.scene.fog.density = 0.0010 + n * 0.0016
    this.renderer.toneMappingExposure = 1.0 - n * 0.2
    this.city.setNight(n); this.vehicle.setNight(n); this.traffic.setNight(n)
    if (this.post.bloom) { this.post.bloom.strength = 0.18 + n * 0.25; this.post.bloom.threshold = 0.9 + n * 0.06 }
  }

  // ------------------------------------------------------------ cinematic intro
  setupCinematic() {
    this.cine = { t: 0, dur: 12, on: true }
    this.rig.mode = 'cinematic'
    const title = document.createElement('div'); title.className = 'intro-title'; title.id = 'intro-title'
    title.innerHTML = `${profile.name.toUpperCase()}<small>AKSHAT CITY · ${new Date().getFullYear()}</small>`
    document.body.appendChild(title)
  }
  cinematicFrame(dt) {
    const c = this.cine; c.t += dt
    const k = Math.min(1, c.t / c.dur), e = k * k * (3 - 2 * k)
    const dt0 = M.districtCenter(M.districts[2])
    if (!this.started) {
      // idle orbit behind the title screen
      const a = c.t * 0.045 + 2.4
      this.camera.position.set(dt0.x + Math.cos(a) * 230, 70 + Math.sin(c.t * 0.3) * 4, dt0.z + Math.sin(a) * 230)
      this.camera.lookAt(dt0.x, 22, dt0.z)
      this.cineFrom = this.camera.position.clone()
      return
    }
    const from = this.cineFrom || new THREE.Vector3(dt0.x - 190, 95, dt0.z + 260)
    const mid = new THREE.Vector3(dt0.x + 60, 45, dt0.z + 90)
    const to = new THREE.Vector3(this.player.pos.x + 7, 2.6, this.player.pos.z + 9)
    const p = new THREE.Vector3().copy(from).lerp(mid, e).lerp(to, e * e)
    const look = new THREE.Vector3(dt0.x, 25, dt0.z).lerp(this.player.pos.clone().setY(1.4), e * e)
    this.camera.position.copy(p); this.camera.lookAt(look)
    const title = $('#intro-title')
    if (title) title.classList.toggle('show', this.started && c.t > 1.5 && c.t < c.dur - 1.2)
    if (this.started && k >= 1) this.endCinematic()
  }
  endCinematic() {
    this.cine.on = false
    this.rig.mode = 'third'
    this.rig.snapTo(this.target())
    $('#intro-title')?.remove(); $('#intro-skip')?.remove()
    this.ui.district(M.districtAt(this.player.pos.x, this.player.pos.z))
    this.ui.hint('Walk to the yellow marker, or press E next to the car to drive.')
  }

  start() {
    this.started = true
    this.audio.start()
    $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden')
    if (this.save.data.intro) { this.endCinematic(); return }
    this.save.data.intro = true; this.save.write()
    const skip = document.createElement('button'); skip.className = 'btn btn-ghost intro-skip'; skip.id = 'intro-skip'; skip.textContent = 'Skip intro'
    skip.addEventListener('click', () => this.endCinematic()); document.body.appendChild(skip)
    this.cine.t = 0
  }

  // ------------------------------------------------------------ helpers
  target() {
    const v = this.vehicle, p = this.player
    return p.inVehicle ? { pos: v.pos, heading: v.heading, isCar: true, speed: v.speed } : { pos: p.pos, heading: p.heading, isCar: false, speed: p.speed }
  }

  teleportTo(missionId) {
    const d = missionDefs.find(m => m.id === missionId); if (!d) return
    const x = d.marker.x, z = d.marker.z - 8
    if (this.player.inVehicle) this.vehicle.reset(x, z, 0); else this.player.teleport(x, z, 0)
    this.rig.snapTo(this.target()); this.ui.hint('Taxi dropped you off.')
  }

  respawn() {
    const t = this.target()
    const d = M.districtAt(t.pos.x, t.pos.z) || M.districts[0]
    const c = M.districtCenter(d)
    const snap = (v) => { let best = M.roadCoord(0); for (let i = 0; i <= M.N; i++) if (Math.abs(M.roadCoord(i) - v) < Math.abs(best - v)) best = M.roadCoord(i); return best }
    if (this.player.inVehicle) this.vehicle.reset(snap(c.x), c.z, 0); else this.player.teleport(snap(c.x), c.z)
    this.rig.snapTo(this.target())
  }

  enterExit() {
    const p = this.player, v = this.vehicle
    if (p.inVehicle) {
      if (Math.abs(v.speed) > 5) { this.ui.hint('Slow down before getting out.'); return }
      p.inVehicle = null; v.occupied = false
      const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading)).multiplyScalar(2.4)
      const at = v.pos.clone().add(side)
      p.setActive(true); p.teleport(at.x, at.z, v.heading)
      this.audio.ui()
    } else if (p.pos.distanceTo(v.pos) < 4.5) {
      p.inVehicle = v; v.occupied = true; p.setActive(false)
      this.audio.ui()
    }
    this.rig.yaw = 0
  }

  explodeBarrel(prop) {
    const t = prop.body.translation()
    this.physics.removeProp(prop)
    this.effects.explosion(t.x, t.y, t.z)
    this.physics.explode(t.x, t.y, t.z, 12, 45)
    // kick the player's car too
    const d = this.vehicle.pos.clone().sub(new THREE.Vector3(t.x, t.y, t.z)); const dist = d.length()
    if (dist < 12) { d.normalize().multiplyScalar((1 - dist / 12) * 9000); d.y += 4000 * (1 - dist / 12); this.vehicle.body.applyImpulse(d, true) }
    this.rig.shake = Math.max(this.rig.shake, 1.2)
    this.audio.explosion()
    // chain reaction
    for (const o of this.physics.props) if (o.alive && o.kind === 'barrel') { const ot = o.body.translation(); if (Math.hypot(ot.x - t.x, ot.z - t.z) < 6) o.fuse = 0.25 + Math.random() * 0.3 }
  }

  // ------------------------------------------------------------ main loop
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta())
    const input = this.input
    input.enabled = this.started && !this.ui.blocking && !this.cine.on
    input.update()
    if (input.justPressed('n')) this.nightTarget = this.nightTarget > 0.5 ? 0 : 1
    this.applyNight(this.night + (this.nightTarget - this.night) * Math.min(1, dt * 1.5))

    if (this.cine.on) {
      this.cinematicFrame(dt)
      this.vehicle.update(dt, input); this.physics.step(dt); this.vehicle.sync()
      this.traffic.update(dt, this.player.pos); this.peds.update(dt, this.player.pos, false)
    } else {
      if (input.justPressed('v', 'camera')) this.rig.toggle()
      if (input.justPressed('e', 'enter', 'interact')) this.onInteract()
      if (input.justPressed('r')) this.respawn()

      const t = this.target()
      if (this.player.inVehicle) {
        this.vehicle.update(dt, input)
      } else {
        const camYaw = this.rig.mode === 'first' ? this.player.heading + this.rig.yaw : Math.atan2(this.camera.position.x - this.player.pos.x, this.camera.position.z - this.player.pos.z) + Math.PI
        const fwd = new THREE.Vector2(Math.sin(camYaw), Math.cos(camYaw)), right = new THREE.Vector2(fwd.y, -fwd.x)
        const dir = fwd.multiplyScalar(input.axis.y).add(right.multiplyScalar(input.axis.x))
        if (this.rig.mode === 'first') { this.player.heading += this.rig.yaw; this.rig.yaw = 0 }
        this.player.update(dt, dir, input.sprint)
        this.vehicle.update(dt, input)
      }
      this.traffic.update(dt, t.pos)
      this.physics.step(dt)
      this.vehicle.sync(); if (!this.player.inVehicle) this.player.sync(); else this.player.pos.copy(this.vehicle.pos)
      this.peds.update(dt, t.pos, t.isCar && Math.abs(t.speed) > 7)

      // crash & drift feedback
      if (this.vehicle.lastHit > 5) {
        const f = this.vehicle.pos.clone().add(new THREE.Vector3(Math.sin(this.vehicle.heading), 0.5, Math.cos(this.vehicle.heading)).multiplyScalar(2.2))
        this.effects.impact(f.x, f.y, f.z, this.vehicle.lastHit); this.audio.crash(this.vehicle.lastHit); this.rig.shake = Math.min(1, this.vehicle.lastHit * 0.06)
      }
      if (this.vehicle.drifting && this.player.inVehicle) {
        for (const i of [2, 3]) { const w = this.vehicle.wheels[i]; const wp = w.getWorldPosition(new THREE.Vector3()); this.effects.tyreSmoke(wp.x, 0.15, wp.z, 2) }
      }
      // barrels
      for (const p of this.physics.props) {
        if (!p.alive || p.kind !== 'barrel') continue
        if (p.fuse != null) { p.fuse -= dt; if (p.fuse <= 0) { this.explodeBarrel(p); continue } }
        const bt = p.body.translation(), lv = p.body.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z)
        const near = this.vehicle.pos.distanceTo(new THREE.Vector3(bt.x, bt.y, bt.z))
        if ((near < 3.2 && Math.abs(this.vehicle.speed) > 9) || sp > 9) this.explodeBarrel(p)
      }

      this.rig.update(dt, this.target(), input, Math.abs(t.speed) > 0.5)

      // markers / missions / tokens
      const pos = this.target().pos
      const hit = this.markers.hit(pos, this.player.inVehicle ? 1.5 : 0)
      let hold = null
      if (hit && hit.startsWith('m:') && !this.missions.active && !this.missions.pending) hold = `Press E to start "${missionDefs.find(m => 'm:' + m.id === hit).title}"`
      if (hit && hit.startsWith('t:')) {
        const id = hit.slice(2); this.markers.remove(hit)
        if (!this.save.data.tokens.includes(id)) { this.save.data.tokens.push(id); this.save.write() }
        this.audio.pickup(); this.ui.refreshHud(); this.ui.hint(`Respect token ${this.save.data.tokens.length}/${tokens.length}`)
      }
      this.missions.update(dt, hit, !!this.player.inVehicle)
      if (!hold && !this.player.inVehicle && this.player.pos.distanceTo(this.vehicle.pos) < 4.5) hold = 'Press E to get in the car'
      if (hold !== this.lastHold && !this.ui.blocking) { this.ui.hintHold(hold); this.lastHold = hold }
      this.ui.district(M.districtAt(pos.x, pos.z))
      this.ui.speed(this.player.inVehicle ? this.vehicle.speed : this.player.speed)
      this.ui.drawRadar(pos, this.target().heading)
      this.audio.engine(this.vehicle.speed, input.axis.y, !!this.player.inVehicle)
    }

    this.markers.update(dt, this.night)
    this.effects.update(dt)
    this.city.update(dt)
    const pp = this.target().pos
    this.sunLight.target.position.set(pp.x, 0, pp.z)
    this.sunLight.position.copy(this.sunDir).multiplyScalar(260).add(this.sunLight.target.position)
    this.post.render(dt, this.night)
    if (this.started) this.adapt(dt)
    input.flush()
  }

  onInteract() {
    const hit = this.markers.hit(this.target().pos, this.player.inVehicle ? 1.5 : 0)
    if (hit && hit.startsWith('m:') && !this.missions.active) { this.missions.offer(hit.slice(2)); return }
    this.enterExit()
  }
}

window.game = new Game()
window.game.boot().catch((e) => { console.error(e); $('#loading').innerHTML = 'Failed to load: ' + e.message })
