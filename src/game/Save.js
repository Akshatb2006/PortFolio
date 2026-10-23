const KEY = 'akshat-city-save-v1'
export const save = {
  data: { missions: [], tokens: [], sound: true, intro: false },
  load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) Object.assign(this.data, d) } catch {} return this.data },
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)) } catch {} },
  reset() { this.data = { missions: [], tokens: [], sound: true, intro: false }; this.write() },
}
