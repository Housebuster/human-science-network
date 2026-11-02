// Homepage hero map: picks up to 30 upcoming open-call listings as network nodes, deterministically.
// Must match the static dot map in src/assets/hero-map.svg (viewBox 1440x470, Miller projection, lon -128..158, lat 76..-45).
import fs from "node:fs";
import catalog from "./catalog.js";
const geo = JSON.parse(fs.readFileSync(new URL("./geo.json", import.meta.url)));

const W = 1440, H = 470, XR = 1430, TOP = 76, BOT = -45, Y0 = 18, Y1 = 452, L0 = -128, L1 = 158;
const mill = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * (lat * Math.PI) / 180));
const K = (Y1 - Y0) / (mill(TOP) - mill(BOT));
const MW = K * ((L1 - L0) * Math.PI) / 180, X0 = XR - MW;
const project = (lat, lon) => [X0 + ((lon - L0) / (L1 - L0)) * MW, Y0 + (mill(TOP) - mill(lat)) * K];

const MAX_NODES = 30, MIN_DIST = 22, MAX_ORANGE = 6;
const ORIENT = { "research-oriented": 3, balanced: 2, "practice-oriented": 1 };
const continent = (l) => (["north-america", "latin-america"].includes(l.region) ? "americas" : l.region || "other");

const candidates = catalog.all
  .filter((l) => l.status === "upcoming" && l.deadline_open && l.format !== "online")
  .map((l) => {
    const c = geo[`${l.location.city}|${l.location.country_code}`];
    return c ? { l, xy: project(c[0], c[1]), key: `${l.location.city}|${l.location.country_code}` } : null;
  })
  .filter(Boolean);

const base = (c) => (ORIENT[c.l.orientation] ?? 1.5) + (c.l.major ? 3 : 0);
const picked = [], skipped = [];
const pool = [...candidates];
while (pool.length && picked.length < MAX_NODES) {
  const score = (c) => {
    const f = c.l.fields[0];
    return base(c)
      - 1.5 * picked.filter((p) => p.l.fields[0] === f).length
      - 0.6 * picked.filter((p) => continent(p.l) === continent(c.l)).length;
  };
  pool.sort((a, b) => score(b) - score(a) || a.l.id.localeCompare(b.l.id));
  const c = pool.shift();
  const near = picked.find((p) => p.key === c.key || Math.hypot(p.xy[0] - c.xy[0], p.xy[1] - c.xy[1]) < MIN_DIST);
  if (near) { skipped.push({ id: c.l.id, near: near.l.id }); continue; }
  picked.push(c);
}

// Orange: major listings, psy-general first, spread across continents.
const majors = picked.filter((p) => p.l.major)
  .sort((a, b) => (b.l.fields.includes("psy-general") - a.l.fields.includes("psy-general")) || base(b) - base(a) || a.l.id.localeCompare(b.l.id));
const orange = [];
for (const pass of [0, 1]) for (const m of majors) {
  if (orange.length >= MAX_ORANGE || orange.includes(m)) continue;
  if (pass === 0 && orange.some((o) => continent(o.l) === continent(m.l))) continue;
  orange.push(m);
}

// Arcs: minimum spanning tree + each node's nearest neighbour (deduped).
const d = (a, b) => Math.hypot(a.xy[0] - b.xy[0], a.xy[1] - b.xy[1]);
const edges = new Set();
const add = (i, j) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
if (picked.length > 1) {
  const inTree = new Set([0]);
  while (inTree.size < picked.length) {
    let best = null;
    for (const i of inTree) picked.forEach((p, j) => { if (!inTree.has(j) && (!best || d(picked[i], p) < best[2])) best = [i, j, d(picked[i], p)]; });
    add(best[0], best[1]); inTree.add(best[1]);
  }
  picked.forEach((p, i) => {
    const j = picked.map((q, k) => [k, d(p, q)]).filter(([k]) => k !== i).sort((a, b) => a[1] - b[1])[0][0];
    add(i, j);
  });
}
const r = (n) => Math.round(n * 10) / 10;
const arcs = [...edges].sort().map((e) => {
  const [a, b] = e.split("-").map((i) => picked[+i].xy);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return `M${r(a[0])} ${r(a[1])}Q${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2 - len * 0.25)} ${r(b[0])} ${r(b[1])}`;
});

const nodes = picked.map((p) => ({
  id: p.l.id, label: p.l.short_name || p.l.name, place: p.l.place,
  x: r(p.xy[0]), y: r(p.xy[1]), orange: orange.includes(p),
}));
const missingGeo = catalog.all.filter((l) => l.location.city && !geo[`${l.location.city}|${l.location.country_code}`]).map((l) => l.id);
if (process.env.HERO_MAP_DEBUG) console.log(JSON.stringify({ nodes, skipped, missingGeo }, null, 1));
export default { W, H, nodes, arcs, skipped };
