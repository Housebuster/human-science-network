// Client-side search and filtering. Without JS, every listing is still shown.
(() => {
  const $ = (id) => document.getElementById(id);
  const q = $("q"), field = $("f-field"), format = $("f-format"), orientation = $("f-orientation"),
        region = $("f-region"), dl = $("f-deadline"), sort = $("f-sort"),
        list = $("upcoming-list"), tbc = $("tbc-list");
  if (!list) return;
  const cards = [...list.children], tbcCards = tbc ? [...tbc.children] : [];
  const params = new URLSearchParams(location.search);
  const ctrls = { q, field, format, orientation, region, sort };
  for (const [k, el] of Object.entries(ctrls)) if (el && params.get(k)) el.value = params.get(k);
  if (dl && params.get("open") === "1") dl.checked = true;

  const matches = (c) => {
    const d = c.dataset, text = (q?.value || "").trim().toLowerCase();
    if (text && !text.split(/\s+/).every((t) => d.search.includes(t))) return false;
    if (field?.value && !d.fields.split(" ").includes(field.value)) return false;
    if (format?.value && d.format !== format.value) return false;
    // When an orientation filter is selected, only listings with that non-empty orientation match.
    if (orientation?.value && d.orientation !== orientation.value) return false;
    if (region?.value && d.region !== region.value) return false;
    if (dl?.checked && !d.deadline) return false;
    return true;
  };
  function apply() {
    let n = 0;
    for (const c of cards) { const ok = matches(c); c.hidden = !ok; if (ok) n++; }
    let m = 0;
    for (const c of tbcCards) { const ok = !dl?.checked && matches(c); c.hidden = !ok; if (ok) m++; }
    if (sort) {
      const key = sort.value === "deadline" ? (c) => c.dataset.deadline || "9999" : (c) => c.dataset.start;
      [...cards].sort((a, b) => key(a).localeCompare(key(b)) || a.dataset.start.localeCompare(b.dataset.start)).forEach((c) => list.appendChild(c));
    }
    $("count").textContent = `${n} event${n === 1 ? "" : "s"}`;
    if ($("count-tbc")) $("count-tbc").textContent = `${m} recurring event${m === 1 ? "" : "s"}`;
    $("empty").hidden = n > 0;
    const p = new URLSearchParams();
    for (const [k, el] of Object.entries(ctrls)) if (el?.value && !(k === "sort" && el.value === "start")) p.set(k, el.value);
    if (dl?.checked) p.set("open", "1");
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
  }
  [q, field, format, orientation, region, dl, sort].forEach((el) => el && el.addEventListener("input", apply));
  $("reset")?.addEventListener("click", () => {
    [q, field, format, orientation, region].forEach((el) => el && (el.value = ""));
    if (dl) dl.checked = false; if (sort) sort.value = "start"; apply(); q?.focus();
  });
  apply();
})();
