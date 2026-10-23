import * as C from '../data/content.js'
import * as M from './CityMap.js'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export class UI {
  constructor(game) {
    this.game = game
    this.modal = null          // which overlay is open
    this.queue = []
    this.radar = $('#radar').getContext('2d')
    this.bigmap = $('#bigmap').getContext('2d')
    this.districtTimer = 0
    this.lastDistrict = null
    this.bind()
  }

  // ------------------------------------------------------------ wiring
  bind() {
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close(b.dataset.close)))
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => this.tab(t.dataset.tab)))
    $('#btn-menu').addEventListener('click', () => this.toggleMenu())
    $('#btn-mute').addEventListener('click', () => { const on = this.game.audio.toggle(); $('#btn-mute').classList.toggle('off', !on); this.game.save.data.sound = on; this.game.save.write() })
    $('#btn-reset').addEventListener('click', () => { if (confirm('Reset all mission progress?')) { this.game.save.reset(); location.reload() } })
    $('#btn-resume').addEventListener('click', () => this.showResume())
    $('#btn-back').addEventListener('click', () => { $('#resume').classList.add('hidden'); if (!this.game.started) $('#title').classList.remove('hidden') })
    $('#dialogue-next').addEventListener('click', () => this.dialogueNext())
    $('#dialogue-skip').addEventListener('click', () => this.dialogueEnd(true))
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase()
      if (this.modal === 'dialogue' && (k === 'enter' || k === 'e')) this.dialogueNext()
      else if (this.modal === 'card' && (k === 'enter' || k === 'e' || k === 'escape')) this.close('card')
      else if (this.modal === 'menu' && (k === 'escape' || k === 'm')) this.close('menu')
      else if (!this.modal && this.game.started && (k === 'm' || k === 'escape')) this.toggleMenu()
    })
  }

  get blocking() { return !!this.modal }

  open(name) { this.modal = name; $('#' + name).classList.remove('hidden'); this.game.input.keys.clear() }
  close(name) {
    $('#' + name).classList.add('hidden')
    if (this.modal === name) this.modal = null
    const cb = this['_after_' + name]; this['_after_' + name] = null
    if (cb) cb()
  }

  // ------------------------------------------------------------ dialogue (mission briefing)
  dialogue(lines, onAccept, onCancel) {
    this.dlg = { lines, i: 0, onAccept, onCancel }
    $('#dialogue-speaker').textContent = C.profile.name.split(' ')[0]
    this.open('dialogue')
    this.dialogueShow()
  }
  dialogueShow() {
    const d = this.dlg
    const text = d.lines[d.i]
    const el = $('#dialogue-text'); el.textContent = ''
    // typewriter
    let n = 0; clearInterval(this.typer)
    this.typer = setInterval(() => { n += 2; el.textContent = text.slice(0, n); if (n >= text.length) clearInterval(this.typer) }, 16)
    $('#dialogue-next').textContent = d.i === d.lines.length - 1 ? 'Start mission' : 'Continue'
  }
  dialogueNext() {
    const d = this.dlg; if (!d) return
    if ($('#dialogue-text').textContent.length < d.lines[d.i].length) { clearInterval(this.typer); $('#dialogue-text').textContent = d.lines[d.i]; return }
    if (d.i < d.lines.length - 1) { d.i++; this.dialogueShow(); this.game.audio.ui() } else this.dialogueEnd(false)
  }
  dialogueEnd(cancel) {
    clearInterval(this.typer)
    const d = this.dlg; this.dlg = null
    this.close('dialogue')
    if (cancel) d.onCancel && d.onCancel(); else d.onAccept && d.onAccept()
  }

  // ------------------------------------------------------------ HUD
  objective(html) { const el = $('#objective'); if (!html) el.classList.add('hidden'); else { el.innerHTML = html; el.classList.remove('hidden') } }
  timer(t) {
    const wrap = $('.hud-time')
    if (t == null) return wrap.classList.add('hidden')
    wrap.classList.remove('hidden')
    const s = Math.max(0, t); $('#hud-timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    $('#hud-timer').style.color = s < 10 ? '#ff4a3d' : '#fff'
  }
  hint(text) { const el = $('#hint'); el.textContent = text; el.classList.remove('hidden'); clearTimeout(this.hintT); this.hintT = setTimeout(() => el.classList.add('hidden'), 2200) }
  hintHold(text) { const el = $('#hint'); if (!text) return el.classList.add('hidden'); el.textContent = text; el.classList.remove('hidden'); clearTimeout(this.hintT) }
  district(d) {
    if (!d || d === this.lastDistrict) return
    this.lastDistrict = d
    const el = $('#district-name'); el.textContent = d.name; el.classList.add('show')
    clearTimeout(this.districtT); this.districtT = setTimeout(() => el.classList.remove('show'), 3200)
  }
  banner(title, sub, fail) {
    const el = $('#banner'); $('#banner-title').textContent = title; $('#banner-sub').textContent = sub
    el.classList.toggle('fail', !!fail); el.classList.remove('hidden')
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => el.classList.add('hidden'), 3800)
  }
  refreshHud() {
    const g = this.game
    const m = g.missions.doneCount, t = g.save.data.tokens.length
    $('#hud-missions').textContent = `${m} / ${g.missions.defs.length}`
    $('#hud-tokens').textContent = `${t} / ${g.tokenDefs.length}`
    const respect = Math.round((m * 10 + t * 3) / (g.missions.defs.length * 10 + g.tokenDefs.length * 3) * 100)
    $('#respect-fill').style.width = respect + '%'
    this.respect = respect
  }
  speed(v) { $('#hud-speed').textContent = Math.round(Math.abs(v) * 3.2) }

  // ------------------------------------------------------------ cards
  card(ref, after) {
    this['_after_card'] = after
    $('#card-content').innerHTML = this.cardHtml(ref)
    this.open('card')
  }
  cardHtml(ref) {
    const link = (url, label = 'Open ↗') => `<a class="card-link" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`
    if (ref.type === 'about') return `<h2>${esc(C.profile.name)}</h2><div class="card-meta">${esc(C.profile.tagline)}</div>${C.profile.about.map(p => `<p>${esc(p)}</p>`).join('')}`
    if (ref.type === 'project') { const p = C.projects.find(p => p.id === ref.id); return `<h2>${esc(p.title)}</h2><div class="card-meta">${esc(p.role)} · ${esc(p.stack)}</div><img src="${p.image}" alt="${esc(p.title)}"><p>${esc(p.blurb)}</p>${link(p.url)}` }
    if (ref.type === 'lab') { const p = C.lab.find(p => p.id === ref.id); return `<h2>${esc(p.title)}</h2><div class="card-meta">Lab · experiment</div><img src="${p.image}" alt="${esc(p.title)}"><p>${esc(p.blurb)}</p>${link(p.url, 'View on GitHub ↗')}` }
    if (ref.type === 'experience') { const e = C.experience.find(e => e.id === ref.id); return `<h2>${esc(e.org)}</h2><div class="card-meta">${esc(e.role)} · ${esc(e.period)}</div><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` }
    if (ref.type === 'skill') { const s = C.skills.find(s => s.id === ref.id); return `<h2>${esc(s.label)}</h2><div class="card-meta">Skill crate</div><div class="tags">${s.items.map(i => `<span class="tag">${esc(i)}</span>`).join('')}</div>` }
    if (ref.type === 'social') { const s = C.socials.find(s => s.id === ref.id); return `<h2>${esc(s.name)}</h2><div class="card-meta">${esc(s.handle)}</div>${link(s.url, `Open ${esc(s.name)} ↗`)}` }
    if (ref.type === 'achievements') return `<h2>Trophy cabinet</h2><ul>${C.achievements.map(a => `<li><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`).join('')}</ul>`
    return ''
  }

  // ------------------------------------------------------------ menu
  toggleMenu() { if (this.modal === 'menu') this.close('menu'); else if (!this.modal) { this.refreshMenu(); this.open('menu'); this.drawBigMap() } }
  tab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name))
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name))
    if (name === 'map') this.drawBigMap()
  }
  refreshMenu() {
    const g = this.game
    $('#missions-list').innerHTML = g.missions.defs.map(d => {
      const done = g.missions.isDone(d.id), active = g.missions.active?.def.id === d.id
      const dist = M.districts.find(x => x.id === d.district)
      return `<div class="mission-row"><span class="status ${done ? 'done' : active ? 'active' : 'todo'}"></span><div><h4>${esc(d.title)}</h4><p>${esc(dist.name)} · ${done ? 'Passed' : active ? 'In progress' : 'Available'}</p></div><span class="spacer"></span>${active ? '<button class="btn btn-ghost" data-abort>Abandon</button>' : `<button class="btn btn-ghost" data-goto="${d.id}">Go there</button>`}</div>`
    }).join('')
    $('#missions-list').querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => { g.teleportTo(b.dataset.goto); this.close('menu') }))
    $('#missions-list').querySelectorAll('[data-abort]').forEach(b => b.addEventListener('click', () => { g.missions.abort(); this.close('menu') }))
    const unlocked = (k) => g.missions.defs.some(d => d.unlocks === k && g.missions.isDone(d.id))
    const sec = (key, title, body, missionTitle) => `<div class="info-section ${unlocked(key) ? '' : 'locked'}"><h3>${title}</h3>${unlocked(key) ? body : `<p class="lock">Locked. Complete <strong>${esc(missionTitle)}</strong> to unlock, or use Résumé mode on the title screen.</p>`}</div>`
    const mt = (k) => g.missions.defs.find(d => d.unlocks === k)?.title
    $('#info-list').innerHTML =
      sec('about', 'About', C.profile.about.map(p => `<p>${esc(p)}</p>`).join(''), mt('about')) +
      sec('experience', 'Experience', `<ul>${C.experience.map(e => `<li><strong>${esc(e.role)}</strong> — ${esc(e.org)} (${esc(e.period)})</li>`).join('')}</ul>`, mt('experience')) +
      sec('projects', 'Projects', `<ul>${C.projects.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> — ${esc(p.blurb)}</li>`).join('')}</ul>`, mt('projects')) +
      sec('lab', 'Lab', `<ul>${C.lab.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></li>`).join('')}</ul>`, mt('lab')) +
      sec('skills', 'Skills', C.skills.map(s => `<strong>${esc(s.label)}</strong><div class="tags">${s.items.map(i => `<span class="tag">${esc(i)}</span>`).join('')}</div>`).join(''), mt('skills')) +
      sec('achievements', 'Achievements', `<ul>${C.achievements.map(a => `<li><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`).join('')}</ul>`, mt('achievements')) +
      sec('socials', 'Socials', `<ul>${C.socials.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.handle)}</li>`).join('')}</ul>`, mt('socials'))
  }

  // ------------------------------------------------------------ résumé mode
  showResume() {
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`
    $('#resume-content').innerHTML = `
      <h1>${esc(C.profile.name)}</h1><div class="tagline">${esc(C.profile.tagline)}</div>
      <h2>About</h2>${C.profile.about.map(p => `<p>${esc(p)}</p>`).join('')}
      <h2>Experience</h2>${C.experience.map(e => `<div class="entry"><h4>${esc(e.role)} · ${esc(e.org)}</h4><div class="meta">${esc(e.period)}</div><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('')}
      <h2>Projects</h2><div class="grid">${C.projects.map(p => `<div class="pcard"><img src="${p.image}" alt=""><div><h4>${esc(p.title)}</h4><p>${esc(p.blurb)}</p>${link(p.url, 'Open ↗')}</div></div>`).join('')}</div>
      <h2>Lab</h2><div class="grid">${C.lab.map(p => `<div class="pcard"><img src="${p.image}" alt=""><div><h4>${esc(p.title)}</h4><p>${esc(p.blurb)}</p>${link(p.url, 'GitHub ↗')}</div></div>`).join('')}</div>
      <h2>Skills</h2>${C.skills.map(s => `<p><strong>${esc(s.label)}:</strong> ${s.items.map(esc).join(', ')}</p>`).join('')}
      <h2>Achievements</h2><ul>${C.achievements.map(a => `<li><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`).join('')}</ul>
      <h2>Contact</h2><div class="links">${C.socials.map(s => link(s.url, s.name + ' · ' + s.handle)).join('')}</div>`
    $('#title').classList.add('hidden'); $('#resume').classList.remove('hidden')
  }

  // ------------------------------------------------------------ maps
  drawBigMap() {
    const g = this.bigmap, W = 640
    const s = W / M.SIZE, u = (v) => (v - M.ORIGIN) * s
    g.drawImage(this.game.city.groundCanvas, 0, 0, W, W)
    g.font = 'bold 15px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3
    for (const d of M.districts) { const c = M.districtCenter(d); g.strokeText(d.name.toUpperCase(), u(c.x), u(c.z)); g.fillText(d.name.toUpperCase(), u(c.x), u(c.z)) }
    this.drawBlips(g, (x, z) => [u(x), u(z)], 6)
  }
  drawBlips(g, map, r) {
    const game = this.game
    const dot = (x, z, color, rad = r) => { const [px, py] = map(x, z); g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke() }
    for (const d of game.missions.defs) if (game.missions.active?.def.id !== d.id) dot(d.marker.x, d.marker.z, game.missions.isDone(d.id) ? '#5ad36a' : '#f6c543')
    for (const t of game.tokenDefs) if (!game.save.data.tokens.includes(t.id)) dot(t.x, t.z, '#4fb6ff', r * 0.7)
    const tg = game.missions.target()
    if (tg) for (const p of Array.isArray(tg) ? tg : [tg]) dot(p.x, p.z, '#ff4a3d')
    if (game.vehicle && !game.vehicle.occupied) dot(game.vehicle.pos.x, game.vehicle.pos.z, '#ff9f43', r * 0.8)
  }
  drawRadar(pos, heading) {
    const g = this.radar, S = 200, R = S / 2
    const zoom = 1.9 // px per unit
    g.save(); g.clearRect(0, 0, S, S)
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip()
    g.translate(R, R); g.rotate(heading); g.scale(zoom, zoom); g.translate(-pos.x, -pos.z)
    const src = this.game.city.groundCanvas
    g.drawImage(src, M.ORIGIN, M.ORIGIN, M.SIZE, M.SIZE)
    g.restore()
    g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip()
    const map = (x, z) => {
      let dx = x - pos.x, dz = z - pos.z
      const c = Math.cos(heading), s = Math.sin(heading)
      let px = dx * c - dz * s, pz = dx * s + dz * c
      px *= zoom; pz *= zoom
      const d = Math.hypot(px, pz); if (d > R - 10) { px *= (R - 10) / d; pz *= (R - 10) / d }
      return [R + px, R + pz]
    }
    this.drawBlips(g, map, 6)
    // player arrow
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2
    g.beginPath(); g.moveTo(R, R - 9); g.lineTo(R + 6, R + 7); g.lineTo(R, R + 3); g.lineTo(R - 6, R + 7); g.closePath(); g.fill(); g.stroke()
    g.restore()
    // north marker
    const nx = R + Math.sin(heading) * (R - 12) * -1, ny = R - Math.cos(heading) * (R - 12)
    g.fillStyle = '#f6c543'; g.font = 'bold 13px Anton, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny)
  }
}
