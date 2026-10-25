// Builds derived views of listings at build time: status by date, sorting, field/region lookups.
import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const { listings } = read("./listings.json");
const taxonomy = read("./taxonomy.json");

// BUILD_DATE=YYYY-MM-DD can override "today" (useful for testing).
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

const fieldLabel = {};
for (const g of taxonomy.groups) for (const f of g.fields) fieldLabel[f.id] = f.label;
const regionList = Array.isArray(taxonomy.regions)
  ? taxonomy.regions
  : Object.entries(taxonomy.regions).map(([id, r]) => ({ id, ...r }));
const regionById = Object.fromEntries(regionList.map((r) => [r.id, r]));
const regionOf = (cc) => {
  for (const r of regionList) if (r.countries.includes(cc)) return r.id;
  return "";
};
const fmtLabel = Object.fromEntries(taxonomy.formats.map((f) => [f.id, f.label]));
const orientLabel = Object.fromEntries((taxonomy.orientations || []).map((o) => [o.id, o.label]));

function effectiveStatus(l) {
  const end = l.end_date || l.start_date;
  if (!l.start_date && !l.end_date) return "tbc";
  return end < today ? "past" : "upcoming";
}

const all = listings.map((l) => {
  const status = effectiveStatus(l);
  const region = l.format === "online" ? "online" : regionOf(l.location.country_code);
  return {
    ...l,
    status,
    stored_status: l.status,
    region,
    region_label: region === "online" ? "Online" : regionById[region]?.label || "",
    format_label: fmtLabel[l.format] || l.format,
    orientation: l.orientation || "",
    orientation_label: orientLabel[l.orientation] || "",
    field_labels: l.fields.map((f) => fieldLabel[f] || f),
    deadline_open: !!l.abstract_deadline && l.abstract_deadline >= today,
    deadline_early_open: !!l.deadline_early && l.deadline_early >= today,
    deadline_late_open: !!l.deadline_late && l.deadline_late >= today,
    place: [l.location.city, l.location.country].filter(Boolean).join(", "),
  };
});

const byStart = (a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999");
const upcoming = all.filter((l) => l.status === "upcoming").sort(byStart);
const tbc = all.filter((l) => l.status === "tbc").sort((a, b) => a.name.localeCompare(b.name));
const past = all.filter((l) => l.status === "past").sort((a, b) => byStart(b, a));
const deadlines = all
  .filter((l) => l.deadline_open)
  .sort((a, b) => a.abstract_deadline.localeCompare(b.abstract_deadline));

// Fields actually in use (for filter menus), grouped like the taxonomy.
const used = new Set(all.flatMap((l) => l.fields));
const fieldGroups = taxonomy.groups
  .map((g) => ({ ...g, fields: g.fields.filter((f) => used.has(f.id)) }))
  .filter((g) => g.fields.length);
const fieldsCovered = fieldGroups.reduce((n, g) => n + g.fields.length, 0);
// psy-* ids currently shown in the Field filter (used listings only).
const psychologyFieldIds = fieldGroups
  .flatMap((g) => g.fields.map((f) => f.id))
  .filter((id) => id.startsWith("psy-"));
const regionsUsed = [...new Set([...upcoming, ...tbc].map((l) => l.region).filter(Boolean))].map((id) => ({
  id,
  label: id === "online" ? "Online" : regionById[id].label,
}));

export default { today, all, upcoming, tbc, past, deadlines, fieldGroups, fieldsCovered, psychologyFieldIds, regionsUsed, fieldLabel };
