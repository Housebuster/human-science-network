// Zero-dependency schema check for src/_data/listings.json. Run: npm run validate
import fs from "node:fs";
const { listings } = JSON.parse(fs.readFileSync("src/_data/listings.json"));
const tax = JSON.parse(fs.readFileSync("src/_data/taxonomy.json"));
const fieldIds = new Set(tax.groups.flatMap((g) => g.fields.map((f) => f.id)));
const formats = new Set(tax.formats.map((f) => f.id));
const orientations = new Set((tax.orientations || []).map((o) => o.id));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const errors = [], warnings = [];
const ids = new Set();
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
for (const l of listings) {
  const e = (m) => errors.push(`${l.id || "(no id)"}: ${m}`);
  const w = (m) => warnings.push(`${l.id}: ${m}`);
  for (const k of ["id", "name", "organizer", "organizer_type", "url", "format", "fields", "status", "last_verified", "verified_source_url"])
    if (!l[k] || (Array.isArray(l[k]) && !l[k].length)) e(`missing ${k}`);
  if (!/^[a-z0-9-]+$/.test(l.id || "")) e("id must be lowercase-kebab-case");
  if (ids.has(l.id)) e("duplicate id"); ids.add(l.id);
  for (const k of ["start_date", "end_date", "abstract_deadline", "last_verified"])
    if (l[k] && !ISO.test(l[k])) e(`${k} must be YYYY-MM-DD`);
  if (l.start_date && l.end_date && l.end_date < l.start_date) e("end_date before start_date");
  if (!!l.start_date !== !!l.end_date) e("give both start_date and end_date, or neither");
  if (!formats.has(l.format)) e(`unknown format ${l.format}`);
  if (l.orientation && !orientations.has(l.orientation)) e(`unknown orientation ${l.orientation}`);
  if (!tax.organizer_types.includes(l.organizer_type)) e(`unknown organizer_type ${l.organizer_type}`);
  for (const f of l.fields || []) if (!fieldIds.has(f)) e(`unknown field ${f}`);
  if (!["upcoming", "past", "tbc"].includes(l.status)) e(`bad status ${l.status}`);
  if (!l.location) e("missing location object");
  const eff = !l.start_date ? "tbc" : (l.end_date < today ? "past" : "upcoming");
  if (eff !== l.status) w(`stored status "${l.status}" but dates say "${eff}" (site uses dates; update the file)`);
  const age = (Date.parse(today) - Date.parse(l.last_verified)) / 864e5;
  if (age > 180) w(`last_verified ${l.last_verified} is over 6 months old`);
  if (l.review?.needs_review) w(`flagged for editorial review: ${l.review.reason}`);
}
warnings.forEach((m) => console.warn("warn:", m));
if (errors.length) { errors.forEach((m) => console.error("ERROR:", m)); process.exit(1); }
console.log(`listings.json OK: ${listings.length} listings, ${warnings.length} warnings`);
