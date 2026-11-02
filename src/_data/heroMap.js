// Homepage hero map: picks up to 30 upcoming open-call listings as network nodes, deterministically.
// Must match the static dot map in src/assets/hero-map.svg (Equal Earth strip, params in heroMapProj.json).
import fs from "node:fs";
import catalog from "./catalog.js";
const geo = JSON.parse(fs.readFileSync(new URL("./geo.json", import.meta.url)));

const proj = JSON.parse(fs.readFileSync(new URL("./heroMapProj.json", import.meta.url)));
const W = 1440, H = 470, WM = proj.wm;
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
// Equal Earth (Savric, Patterson & Jenny 2018), central meridian proj.lon0; x in 0..WM (one world strip).
const ee = (lon, lat) => {
  const l = ((((lon - proj.lon0 + 180) % 360) + 360) % 360 - 180) * Math.PI / 180, t = Math.asin(M * Math.sin(lat * Math.PI / 180));
  const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t ** 8 + 7 * A3 * t ** 6 + 3 * A2 * t ** 2 + A1));
  const y = A4 * t ** 9 + A3 * t ** 7 + A2 * t ** 3 + A1 * t;
  return [proj.xE + x * proj.k, proj.y0 + (proj.yTop - y) * proj.k];
};
const project = (lat, lon) => ee(lon, lat);
// Wrapped horizontal distance on the looping strip.
const wdx = (a, b) => { let d = b[0] - a[0]; if (d > WM / 2) d -= WM; if (d < -WM / 2) d += WM; return d; };
const wdist = (a, b) => Math.hypot(wdx(a, b), b[1] - a[1]);
// Pan stops: strip offset p such that the region's centre meridian sits at the focus point (clear area right of the title).
const FOCUS_X = 1120;
const REGIONS = [["americas", -92], ["europe", 15], ["asia", 118]];
const stops = REGIONS.map(([id, lon]) => ({ id, p: Math.round((((ee(lon, 0)[0] - FOCUS_X) % WM) + WM) % WM * 10) / 10 }));
const copies = [...Array(Math.ceil(W / WM) + 1).keys()];
const MAX_NODES = 30, MIN_DIST = 18, MAX_ORANGE = 6;
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
  const near = picked.find((p) => p.key === c.key || wdist(p.xy, c.xy) < MIN_DIST);
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
const d = (a, b) => wdist(a.xy, b.xy);
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
  const [a, b0] = e.split("-").map((i) => picked[+i].xy);
  const b = [a[0] + wdx(a, b0), b0[1]]; // may extend past the strip edge; neighbouring copy covers it
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return `M${r(a[0])} ${r(a[1])}Q${r((a[0] + b[0]) / 2)} ${r((a[1] + b[1]) / 2 - len * 0.25)} ${r(b[0])} ${r(b[1])}`;
});

const nodes = picked.map((p) => ({
  id: p.l.id, label: p.l.short_name || p.l.name, place: p.l.place,
  x: r(p.xy[0]), y: r(p.xy[1]), orange: orange.includes(p),
}));
const missingGeo = catalog.all.filter((l) => l.location.city && !geo[`${l.location.city}|${l.location.country_code}`]).map((l) => l.id);
if (process.env.HERO_MAP_DEBUG) console.log(JSON.stringify({ nodes, skipped, missingGeo }, null, 1));
export default { W, H, WM: Math.round(WM * 10) / 10, copies, stops, nodes, arcs, skipped };
