// All portfolio content lives here. Edit this file to update what the city
// shows — missions, panels and billboards read from it.

export const profile = {
  name: 'Akshat Baranwal',
  tagline: 'CS undergrad · Full-stack & ML developer · GSoC 2025',
  city: 'Akshat City',
  email: 'kysuakshat23@gmail.com',
  about: [
    'I’m a Computer Science undergrad at Polaris School of Technology, Bangalore (B.Tech CSE in AI-ML, 2024–2028, CGPA 8.0).',
    'I work across the stack: React frontends, Node.js / Express backends, and ML pipelines (XGBoost, time-series, LangChain).',
    'Selected for Google Summer of Code 2025 with CHAOSS / Augur, and a Summer of Bitcoin 2025 Round 2 Developer Fellow.',
  ],
}

export const experience = [
  {
    id: 'sob',
    org: 'Summer of Bitcoin',
    role: 'Round 2 Developer Fellow',
    period: 'Mar 2025 – May 2025',
    short: 'SoB 2025',
    points: [
      'Selected as a Round 2 Developer Fellow in the global Bitcoin open-source programme.',
      'Worked through Bitcoin protocol fundamentals and contributed to open-source tooling.',
    ],
  },
  {
    id: 'gsoc',
    org: 'Google Summer of Code · CHAOSS / Augur',
    role: 'Open Source Developer',
    period: 'Apr 2025 – Sep 2025',
    short: 'GSoC 2025',
    points: [
      'Built contributor-metrics APIs and data pipelines for repository activity.',
      'Shipped interactive visualisations on top of the Augur metrics platform.',
      'Selected at a ~4% acceptance rate.',
    ],
  },
  {
    id: 'autometa',
    org: 'Autometa.ai',
    role: 'SDE Intern',
    period: 'Aug 2025 – Jan 2026',
    short: 'Autometa.ai',
    points: [
      'Built React frontend features and backend data pipelines.',
      'Integrated ML inference into production services.',
      'Shipped the Resume Parser SaaS module end to end.',
    ],
  },
  {
    id: 'apartmenthub',
    org: 'ApartmentHub',
    role: 'Full Stack Developer (freelance → intern)',
    period: 'Nov 2025 – Apr 2026',
    short: 'ApartmentHub',
    points: [
      'React platform for apartment discovery with backend filtering APIs.',
      'Designed multi-agent infrastructure for listing workflows.',
      'Client collaboration led to a ~13k traffic increase in 2 months.',
    ],
  },
]

export const projects = [
  {
    id: 'insightedge',
    title: 'InsightEdge',
    role: 'Full stack developer',
    stack: 'MERN stack, Chart.js',
    url: 'https://github.com/Manishym956/IgniteEdge',
    verified: false,   // repository owner / correctness not confirmed: the link is not shown anywhere until verified
    image: '/images/insightedge-1.png',
    blurb: 'Analytics dashboard built on the MERN stack with Chart.js visualisations.',
  },
  {
    id: 'apartmenthub',
    title: 'ApartmentHub',
    role: 'Full stack developer',
    stack: 'Client project · React, Node.js',
    url: 'https://apartmenthubs.com',
    image: '/images/apartmenthub-1.png',
    blurb: 'Apartment discovery platform. React frontend, Node backend, filtering APIs and multi-agent infrastructure.',
  },
  {
    id: 'resume-parser',
    title: 'Resume Parser',
    role: 'SDE Intern at Autometa.ai',
    stack: 'React, Node.js, ML inference',
    url: 'https://github.com/Akshatb2006/Resume-Parser',
    image: '/images/resume-parser-1.png',
    blurb: 'SaaS module that parses résumés and feeds structured data into Autometa’s pipeline.',
  },
]

export const lab = [
  { id: 'actitrace', title: 'ActiTrace', url: 'https://github.com/Akshatb2006/ActiTrace', image: '/images/actitrace.png', blurb: 'Activity tracking experiment.' },
  { id: 'life-drift', title: 'Life Drift', url: 'https://github.com/Akshatb2006/Life_Drift', image: '/images/life-drift.png', blurb: 'Simulation / generative experiment.' },
  { id: 'robot-paint', title: 'Robot Paint Optimizer', url: 'https://github.com/Akshatb2006/Paint_Robot', image: '/images/robot-paint.png', blurb: 'Path optimisation for a painting robot.' },
  { id: 'secure-tx', title: 'Secure Transaction Storage', url: 'https://github.com/Akshatb2006/Secure-Transactions-Mini-App', image: '/images/secure-tx.png', blurb: 'Mini app for encrypted transaction records.' },
  { id: 'veridict', title: 'VERIDICT', url: 'https://github.com/Akshatb2006/VERIDICT', image: '/images/veridict.png', blurb: 'Verification / decision tooling prototype.' },
]

export const skills = [
  { id: 'languages', label: 'Languages', items: ['Python', 'Java', 'JavaScript', 'Kotlin', 'SQL'] },
  { id: 'frontend', label: 'Frontend', items: ['React', 'HTML', 'CSS', 'Chart.js', 'Plotly', 'D3.js'] },
  { id: 'backend', label: 'Backend', items: ['Node.js', 'Express', 'REST APIs', 'Async workflows'] },
  { id: 'databases', label: 'Databases', items: ['PostgreSQL', 'MongoDB', 'Firebase'] },
  { id: 'ml', label: 'ML & AI', items: ['XGBoost', 'scikit-learn', 'Time-series modelling', 'RL concepts', 'LangChain', 'LLM agents'] },
  { id: 'mobile', label: 'Mobile', items: ['Android SDK', 'CameraX'] },
]

export const achievements = [
  { id: 'gsoc', title: 'Google Summer of Code 2025', detail: 'Selected for CHAOSS / Augur (~4% acceptance rate).' },
  { id: 'sob', title: 'Summer of Bitcoin 2025', detail: 'Round 2 Developer Fellow.' },
  { id: 'media', title: 'President, Media Club', detail: 'Led a team of 15+ members.' },
]

export const socials = [
  { id: 'github', name: 'GitHub', url: 'https://github.com/Akshatb2006', handle: '@Akshatb2006' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/in/akshat-baranwal-936797313/', handle: 'akshat-baranwal' },
  { id: 'mail', name: 'Mail', url: 'mailto:kysuakshat23@gmail.com', handle: 'kysuakshat23@gmail.com' },
  { id: 'x', name: 'X', url: 'https://x.com/Akshat_B23', handle: '@Akshat_B23' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/akshatb_23', handle: '@akshatb_23' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/users/akshatbaranwal_99532', handle: 'akshatbaranwal_99532', verified: false },   // unpublished until a working profile or invite is supplied
]
// only verified profiles are shown in the game
export const verifiedSocials = socials.filter(s => s.verified !== false)
