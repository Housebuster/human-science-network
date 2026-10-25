// Client-side search and filtering. Without JS, every listing is still shown.
(() => {
  const $ = (id) => document.getElementById(id);
  const q = $("q"), region = $("f-region"), dl = $("f-deadline"), sort = $("f-sort"),
        list = $("upcoming-list"), tbc = $("tbc-list");
  if (!list) return;
  const cards = [...list.children], tbcCards = tbc ? [...tbc.children] : [];
  const params = new URLSearchParams(location.search);

  // Multi-select facets: OR within each facet. URL: repeated keys (?format=hybrid&format=online).
  const multis = [
    { id: "f-field", param: "field", empty: "All fields", match: (d, vals) => vals.some((v) => d.fields.split(" ").includes(v)) },
    { id: "f-format", param: "format", empty: "Any format", match: (d, vals) => vals.includes(d.format) },
    { id: "f-orientation", param: "orientation", empty: "Any focus", match: (d, vals) => vals.includes(d.orientation) },
  ].map((m) => ({ ...m, root: $(m.id) })).filter((m) => m.root);

  const checked = (root) => [...root.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.value);

  const paramValues = (key) => {
    const raw = params.getAll(key);
    if (!raw.length) return [];
    // Accept repeated keys and a single comma-separated value.
    return raw.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  };

  for (const m of multis) {
    const vals = new Set(paramValues(m.param));
    for (const cb of m.root.querySelectorAll("input[type=checkbox]")) cb.checked = vals.has(cb.value);
  }
  if (q && params.get("q")) q.value = params.get("q");
  if (region && params.get("region")) region.value = params.get("region");
  if (sort && params.get("sort")) sort.value = params.get("sort");
  if (dl && params.get("open") === "1") dl.checked = true;

  const updateSummary = (m) => {
    const summary = m.root.querySelector("summary");
    if (!summary) return;
    const vals = checked(m.root);
    if (!vals.length) {
      summary.textContent = m.empty;
      return;
    }
    const labels = vals.map((v) => {
      const input = m.root.querySelector(`input[type=checkbox][value="${CSS.escape(v)}"]`);
      const span = input?.closest("label")?.querySelector(".f-drop-text");
      return (span?.textContent || v).trim();
    });
    summary.textContent = labels.length <= 2 ? labels.join(", ") : `${labels.length} selected`;
  };

  const matches = (c) => {
    const d = c.dataset, text = (q?.value || "").trim().toLowerCase();
    if (text && !text.split(/\s+/).every((t) => d.search.includes(t))) return false;
    for (const m of multis) {
      const vals = checked(m.root);
      if (vals.length && !m.match(d, vals)) return false;
    }
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
    if (q?.value.trim()) p.set("q", q.value.trim());
    for (const facet of multis) {
      updateSummary(facet);
      for (const v of checked(facet.root)) p.append(facet.param, v);
    }
    if (region?.value) p.set("region", region.value);
    if (sort?.value && sort.value !== "start") p.set("sort", sort.value);
    if (dl?.checked) p.set("open", "1");
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
  }

  // One open dropdown at a time; close on outside click / Escape.
  for (const facet of multis) {
    facet.root.addEventListener("toggle", () => {
      if (!facet.root.open) return;
      for (const other of multis) if (other !== facet) other.root.open = false;
    });
    facet.root.addEventListener("change", apply);
  }
  document.addEventListener("click", (e) => {
    for (const facet of multis) {
      if (facet.root.open && !facet.root.contains(e.target)) facet.root.open = false;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const facet of multis) facet.root.open = false;
  });

  [q, region, dl, sort].forEach((el) => el && el.addEventListener("input", apply));
  $("reset")?.addEventListener("click", () => {
    if (q) q.value = "";
    for (const facet of multis) {
      for (const cb of facet.root.querySelectorAll("input[type=checkbox]")) cb.checked = false;
      facet.root.open = false;
    }
    if (region) region.value = "";
    if (dl) dl.checked = false;
    if (sort) sort.value = "start";
    apply();
    q?.focus();
  });
  apply();
})();
