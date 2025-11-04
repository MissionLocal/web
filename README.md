web/
├─ docs/                 ← built files GitHub Pages serves (don’t edit by hand)
│  └─ ml-web/            ← output of `npm run build`
└─ ml-web/               ← your source (you edit here)
   ├─ public/            ← static assets copied verbatim to /docs/ml-web/
   │  └─ data/network.json       ← your graph data (edit/replace)
   ├─ src/
   │  ├─ lib/NetworkWeb.svelte   ← the network chart component (edit styles/behavior)
   │  ├─ App.svelte              ← page shell that uses the component (edit layout/theme)
   │  ├─ main.js                 ← Svelte app bootstrap (rarely touched)
   │  └─ app.css                 ← global base styles (fonts/layout, optional)
   ├─ index.html                 ← HTML shell; can load Pym here
   ├─ vite.config.js             ← build config (paths/output)
   └─ package.json               ← deps and scripts
