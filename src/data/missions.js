// Mission definitions + world landmarks. Positions are derived from the city
// grid so they always land on roads / open ground.
import * as M from '../game/CityMap.js'
import { projects, experience, lab, skills, verifiedSocials as socials, achievements } from './content.js'

const { blockStart, blockCenter, roadCoord, BLOCK, ROAD, WATER } = M
const pierX = blockCenter(3)

// ---- landmarks (billboards, signs) ------------------------------------------
export const landmarks = [
  // Downtown project billboards (north edges of blocks face road row 1 / 3)
  { kind: 'billboard', id: 'insightedge', x: blockCenter(3), z: blockStart(1) + 1.5, rot: Math.PI, image: projects[0].image, caption: 'INSIGHTEDGE · MERN + CHART.JS' },
  { kind: 'billboard', id: 'apartmenthub', x: blockCenter(5), z: blockStart(1) + 1.5, rot: Math.PI, image: projects[1].image, caption: 'APARTMENTHUB · REACT + NODE' },
  { kind: 'billboard', id: 'resume-parser', x: blockCenter(4), z: blockStart(2) + BLOCK - 1.5, rot: 0, image: projects[2].image, caption: 'RESUME PARSER · AUTOMETA.AI' },
  { kind: 'sign', lines: ['DOWNTOWN'], x: blockCenter(4), z: blockStart(0) + 1.5, rot: Math.PI, opts: { sub: 'SHIPPED PROJECTS', y: 9 } },
  // Career billboards
  { kind: 'billboard', id: 'sob', x: blockCenter(6), z: blockStart(0) + BLOCK - 1.5, rot: 0, lines: ['SUMMER OF', 'BITCOIN 2025'], sub: 'ROUND 2 DEVELOPER FELLOW', bg: '#3a2a08', caption: '2025 · SUMMER OF BITCOIN' },
  { kind: 'billboard', id: 'gsoc', x: blockCenter(7), z: blockStart(0) + BLOCK - 1.5, rot: 0, lines: ['GOOGLE SUMMER', 'OF CODE 2025'], sub: 'CHAOSS / AUGUR · OPEN SOURCE DEV', bg: '#0a2a3a', caption: '2025 · GSOC' },
  { kind: 'billboard', id: 'autometa', x: blockCenter(7), z: blockStart(2) + 1.5, rot: Math.PI, lines: ['AUTOMETA.AI'], sub: 'SDE INTERN · AUG 2025 – JAN 2026', bg: '#1a0a2a', caption: '2025–26 · AUTOMETA.AI' },
  { kind: 'billboard', id: 'apartmenthub-x', x: blockCenter(6), z: blockStart(2) + 1.5, rot: Math.PI, lines: ['APARTMENTHUB'], sub: 'FULL STACK DEV · NOV 2025 – APR 2026', bg: '#0a2a1a', caption: '2025–26 · APARTMENTHUB' },
  { kind: 'sign', lines: ['CAREER HEIGHTS'], x: blockCenter(6) + 25, z: blockStart(0) + 1.5, rot: Math.PI, opts: { sub: 'EXPERIENCE', y: 9, w: 20 } },
  // Lab
  { kind: 'sign', lines: ['RESEARCH PARK'], x: blockCenter(1), z: blockStart(0) + 1.5, rot: Math.PI, opts: { sub: 'LAB · EXPERIMENTS', y: 9, w: 20, bg: '#0a2a2a', fg: '#7fe0d0' } },
  // Home
  { kind: 'sign', lines: ['GROVE STREET'], x: blockCenter(1) - 1, z: blockStart(3) + 1.5, rot: Math.PI, opts: { sub: 'HOME · ABOUT ME', y: 7, w: 16, h: 5, bg: '#1a2a10', fg: '#b6f07a' } },
  { kind: 'sign', lines: ['CENTRAL PARK'], x: blockCenter(2) + 20, z: blockStart(3) + 1.5, rot: Math.PI, opts: { sub: 'FREE ROAM · TOKENS', y: 7, w: 16, h: 5, bg: '#102a10' } },
  // Pier signposts
  ...socials.map((s, i) => ({ kind: 'signpost', id: s.id, x: pierX + (i % 2 ? 3 : -3), z: WATER.z0 + 1 + Math.floor(i / 2) * 6, rot: i % 2 ? -Math.PI / 2 : Math.PI / 2, lines: [s.name], sub: s.handle })),
]

// ---- helpers ----------------------------------------------------------------
const road = (i, j) => ({ x: roadCoord(i), z: roadCoord(j) })                 // intersection
const segH = (row, bx, t = 0.5) => ({ x: blockStart(bx) + BLOCK * t, z: roadCoord(row) }) // on horizontal road row above block bx
const segV = (col, bz, t = 0.5) => ({ x: roadCoord(col), z: blockStart(bz) + BLOCK * t }) // on vertical road col left of block bz

// ---- missions ----------------------------------------------------------------
export const missions = [
  {
    id: 'home', title: 'Home Sweet Home', district: 'home', unlocks: 'about',
    marker: segV(1, 5, 0.3),
    briefing: [
      'Welcome to Akshat City. I’m Akshat, and this is my block: Grove Street.',
      'I’m a CS undergrad at Polaris School of Technology in Bangalore, studying AI-ML, and I build things across the full stack.',
      'Let’s warm up. Hit the checkpoints around the neighbourhood. Take the car if you want, it’s the one parked right here.',
    ],
    objective: 'Drive or run through the <strong>checkpoints</strong> around Grove Street.',
    type: 'route',
    points: [
      { ...segH(4, 1), label: 'Checkpoint 1' },
      { ...segV(2, 6), label: 'Checkpoint 2' },
      { ...segH(7, 0), label: 'Checkpoint 3' },
      { ...segV(0, 4, 0.5), label: 'Back home', card: { type: 'about' } },
    ],
    passedText: 'ABOUT ME UNLOCKED',
  },
  {
    id: 'projects', title: 'Shipped It', district: 'downtown', unlocks: 'projects',
    marker: segH(1, 4, 0.5),
    briefing: [
      'Downtown is where the shipped work lives. Three billboards, three projects that made it to production.',
      'Each billboard has a checkpoint in front of it. Drive up, and I’ll tell you what went into it.',
    ],
    objective: 'Visit the <strong>3 project billboards</strong> in Downtown.',
    type: 'route',
    points: [
      { ...segH(1, 3), label: 'InsightEdge', card: { type: 'project', id: 'insightedge' } },
      { ...segH(1, 5), label: 'ApartmentHub', card: { type: 'project', id: 'apartmenthub' } },
      { ...segH(3, 4), label: 'Resume Parser', card: { type: 'project', id: 'resume-parser' } },
    ],
    passedText: 'PROJECTS UNLOCKED',
  },
  {
    id: 'career', title: 'Career Heights', district: 'career', unlocks: 'experience',
    marker: segV(6, 1, 0.5),
    briefing: [
      'Career Heights. Four billboards, in order: where I’ve worked and what I shipped there.',
      'Follow the route. It starts with Summer of Bitcoin and ends at ApartmentHub.',
    ],
    objective: 'Follow the <strong>career route</strong> in order.',
    type: 'route',
    points: [
      { ...segH(1, 6), label: 'Summer of Bitcoin', card: { type: 'experience', id: 'sob' } },
      { ...segH(1, 7), label: 'GSoC 2025', card: { type: 'experience', id: 'gsoc' } },
      { ...segH(2, 7), label: 'Autometa.ai', card: { type: 'experience', id: 'autometa' } },
      { ...segH(2, 6), label: 'ApartmentHub', card: { type: 'experience', id: 'apartmenthub' } },
    ],
    passedText: 'EXPERIENCE UNLOCKED',
  },
  {
    id: 'lab', title: 'Mad Scientist', district: 'lab', unlocks: 'lab',
    marker: road(1, 1),
    briefing: [
      'Research Park. This is where the side projects and experiments live.',
      'Five prototypes got scattered around the district. Collect them all, in any order.',
    ],
    objective: 'Collect the <strong>5 prototypes</strong> in Research Park.',
    type: 'collect',
    points: [
      { ...segH(0, 0, 0.5), label: 'ActiTrace', card: { type: 'lab', id: 'actitrace' } },
      { ...segV(3, 0, 0.5), label: 'Life Drift', card: { type: 'lab', id: 'life-drift' } },
      { ...segH(2, 2, 0.5), label: 'Robot Paint Optimizer', card: { type: 'lab', id: 'robot-paint' } },
      { ...segV(0, 2, 0.5), label: 'Secure Transaction Storage', card: { type: 'lab', id: 'secure-tx' } },
      { ...segH(3, 1, 0.5), label: 'VERIDICT', card: { type: 'lab', id: 'veridict' } },
    ],
    passedText: 'LAB UNLOCKED',
  },
  {
    id: 'skills', title: 'Mod Garage', district: 'skills', unlocks: 'skills',
    marker: segV(6, 4, 0.5),
    briefing: [
      'The Mod Garage. Every tool I use is in a crate somewhere around here.',
      'Six crates, six categories. Grab them all and the full skill list is yours.',
    ],
    objective: 'Collect the <strong>6 skill crates</strong> around the Mod Garage.',
    type: 'collect',
    points: [
      { x: blockStart(6) + 8, z: blockStart(3) + 8, label: 'Languages', card: { type: 'skill', id: 'languages' } },
      { x: blockStart(6) + 8, z: blockStart(4) + 26, label: 'Frontend', card: { type: 'skill', id: 'frontend' } },
      { x: blockStart(7) + 8, z: blockStart(3) + 26, label: 'Backend', card: { type: 'skill', id: 'backend' } },
      { x: blockStart(7) + 8, z: blockStart(4) + 8, label: 'Databases', card: { type: 'skill', id: 'databases' } },
      { ...segH(4, 7), label: 'ML & AI', card: { type: 'skill', id: 'ml' } },
      { ...segV(8, 3), label: 'Mobile', card: { type: 'skill', id: 'mobile' } },
    ],
    passedText: 'SKILLS UNLOCKED',
  },
  {
    id: 'social', title: 'Stay Connected', district: 'social', unlocks: 'socials',
    marker: { x: pierX, z: WATER.z0 - 9 },
    briefing: [
      'Sunset Pier. Cars can’t get past the bollards, so leave it here and walk.',
      'Every signpost on the pier is a place you can find me online. Read them all.',
    ],
    objective: `Walk the pier and read all <strong>${socials.length} signposts</strong>. (Press E near the car to get out.)`,
    type: 'collect', onFoot: true,
    points: socials.map((s, i) => ({ x: pierX + (i % 2 ? 1.6 : -1.6), z: WATER.z0 + 1 + Math.floor(i / 2) * 6, label: s.name, radius: 1.6, card: { type: 'social', id: s.id } })),
    passedText: 'SOCIALS UNLOCKED',
  },
  {
    id: 'achievements', title: 'Trophy Run', district: 'achievements', unlocks: 'achievements',
    marker: segV(6, 5, 0.5),
    briefing: [
      'Trophy Stadium. One lap around the stadium block, against the clock.',
      'You’ve got 40 seconds. Four corners, then back here. Beat it and the trophy cabinet opens.',
    ],
    objective: 'Lap the stadium: hit the <strong>4 corners</strong> and return in time.',
    type: 'route', timeLimit: 40, needsVehicle: true,
    points: [
      { ...road(6, 6), label: 'Corner 1' },
      { ...road(7, 6), label: 'Corner 2' },
      { ...road(7, 7), label: 'Corner 3' },
      { ...road(6, 7), label: 'Corner 4' },
      { ...segV(6, 5, 0.5), label: 'Finish', card: { type: 'achievements' } },
    ],
    passedText: 'ACHIEVEMENTS UNLOCKED',
  },
]

// ---- respect tokens (free-roam collectibles) ---------------------------------
const parkC = M.districtCenter(M.districts.find(d => d.id === 'park'))
export const tokens = [
  { id: 't1', x: parkC.x - 30, z: parkC.z },
  { id: 't2', x: parkC.x + 30, z: parkC.z },
  { id: 't3', x: parkC.x, z: parkC.z - 25 },
  { id: 't4', ...segH(6, 0) },
  { id: 't5', ...road(4, 0) },
  { id: 't6', ...road(2, 2) },
  { id: 't7', ...road(8, 0) },
  { id: 't8', ...road(8, 4) },
  { id: 't9', x: blockStart(2) + 6, z: blockStart(6) + 6 },
  { id: 't10', ...road(8, 8) },
]

export const spawn = { car: { x: roadCoord(1) + 4.5, z: blockStart(5) + BLOCK * 0.3 + 8, heading: Math.PI }, player: { x: roadCoord(1) + 8.5, z: blockStart(5) + BLOCK * 0.3 + 8 } }
