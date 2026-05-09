// Shipped / client / production work. Research and personal projects live in
// `lab.js` instead.
//
// Image filenames are looked up in `static/projects/images/`. Both `.png` and
// `.ktx` are supported (`.png` is loaded directly by the texture loader — no
// ktx tooling required). Run `npm run compress` to also produce `.ktx`
// versions for production builds where VITE_COMPRESSED is set.
export default [
    {
        title: 'InsightEdge',
        titleSmall: [ 'Insight', 'Edge' ],
        url: 'https://github.com/your-github-handle/insightedge',
        attributes:
        {
            role: [ 'Full stack developer' ],
            with: 'MERN stack, Chart.js'
        },
        distinctions: [ ],
        images:
        [
            'insightedge-1.png',
        ]
    },
    {
        title: 'ApartmentHub',
        titleSmall: [ 'Apartment', 'Hub' ],
        url: 'https://apartmenthubs.com',
        attributes:
        {
            role: [ 'Full stack developer' ],
            with: 'Client project — React, Node.js'
        },
        distinctions: [ ],
        images:
        [
            'apartmenthub-1.png',
        ]
    },
    {
        title: 'Resume Parser',
        titleSmall: [ 'Resume', 'Parser' ],
        url: 'https://autometa.ai',
        attributes:
        {
            role: [ 'SDE Intern' ],
            at: 'Autometa.ai'
        },
        distinctions: [ ],
        images:
        [
            'resume-parser-1.png',
        ]
    },
]
