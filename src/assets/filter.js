// Client-side search and filtering. Without JS, every listing is still shown.
(() => {
  const $ = (id) => document.getElementById(id);
  const q = $("q"), region = $("f-region"), dl = $("f-deadline"), sort = $("f-sort"),
        list = $("upcoming-list"), tbc = $("tbc-list"), past = $("past-list"),
        pastBlock = $("past-block");
  if (!list) return;
  const cards = [...list.children], tbcCards = tbc ? [...tbc.children] : [],
        pastCards = past ? [...past.children] : [];
  // Include past so Field/Format/Focus options stay available when only past events use them.
  const catalogCards = [...cards, ...tbcCards, ...pastCards];
  const params = new URLSearchParams(location.search);

  // Multi-select facets: OR within each facet. URL: repeated keys (?format=hybrid&format=online).
  const multis = [
    { id: "f-field", param: "field", empty: "All fields", attr: "fields",
      match: (d, vals) => vals.some((v) => d.fields.split(" ").includes(v)) },
    { id: "f-format", param: "format", empty: "Any format", attr: "format",
      match: (d, vals) => vals.includes(d.format) },
    { id: "f-orientation", param: "orientation", empty: "Any focus", attr: "orientation",
      match: (d, vals) => vals.includes(d.orientation) },
  ].map((m) => ({ ...m, root: $(m.id) })).filter((m) => m.root);

  // Hide Field / Format / Focus options that match zero conferences in the current catalog
  // (cards on this page), based on live data-* attributes.
  const usedByAttr = {
    fields: new Set(),
    format: new Set(),
    orientation: new Set(),
  };
  for (const c of catalogCards) {
    const d = c.dataset;
    for (const id of (d.fields || "").split(/\s+/).filter(Boolean)) usedByAttr.fields.add(id);
    if (d.format) usedByAttr.format.add(d.format);
    if (d.orientation) usedByAttr.orientation.add(d.orientation);
  }
  for (const m of multis) {
    const used = usedByAttr[m.attr];
    if (!used) continue;
    for (const label of m.root.querySelectorAll("label.f-drop-opt")) {
      const input = label.querySelector("input[type=checkbox]");
      if (!input || !input.value) continue; // keep All psychology toggle
      const show = used.has(input.value);
      label.hidden = !show;
      if (!show) input.checked = false;
    }
    for (const group of m.root.querySelectorAll(".f-drop-group")) {
      let next = group.nextElementSibling;
      let any = false;
      while (next && !next.classList.contains("f-drop-group")) {
        if (next.matches("label.f-drop-opt") && !next.hidden && next.querySelector("input[value]"))
          any = true;
        next = next.nextElementSibling;
      }
      group.hidden = !any;
    }
  }

  const fieldRoot = multis.find((m) => m.id === "f-field")?.root;
  const allPsy = fieldRoot?.querySelector("input[data-all-psy]");
  const psyIds = (fieldRoot?.querySelector(".f-drop-panel")?.dataset.psyIds || "")
    .split(/\s+/).filter(Boolean);
  const psyBoxes = () => fieldRoot
    ? [...fieldRoot.querySelectorAll("input[type=checkbox]")].filter((i) =>
        i.value && psyIds.includes(i.value) && !i.closest("label")?.hidden)
    : [];

  const syncAllPsy = () => {
    if (!allPsy) return;
    const boxes = psyBoxes();
    if (!boxes.length) { allPsy.checked = false; allPsy.indeterminate = false; return; }
    const n = boxes.filter((b) => b.checked).length;
    allPsy.checked = n === boxes.length;
    allPsy.indeterminate = n > 0 && n < boxes.length;
  };

  // Field values only (skip the All psychology toggle, which has an empty value).
  const checked = (root) => [...root.querySelectorAll("input[type=checkbox]:checked")]
    .map((i) => i.value).filter(Boolean);

  const paramValues = (key) => {
    const raw = params.getAll(key);
    if (!raw.length) return [];
    return raw.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  };

  for (const m of multis) {
    const vals = new Set(paramValues(m.param));
    for (const cb of m.root.querySelectorAll("input[type=checkbox]")) {
      if (!cb.value) continue;
      if (cb.closest("label")?.hidden) { cb.checked = false; continue; }
      cb.checked = vals.has(cb.value);
    }
  }
  syncAllPsy();
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
    const boxes = psyBoxes();
    if (m.id === "f-field" && boxes.length && boxes.every((b) => b.checked)
        && vals.every((v) => psyIds.includes(v))) {
      summary.textContent = "All psychology";
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
    const openOnly = !!dl?.checked;
    let n = 0;
    for (const c of cards) { const ok = matches(c); c.hidden = !ok; if (ok) n++; }
    let m = 0;
    for (const c of tbcCards) { const ok = !openOnly && matches(c); c.hidden = !ok; if (ok) m++; }
    // Past stays visible unless Open calls only is on (then hide whole past block).
    let pastN = 0;
    for (const c of pastCards) {
      const ok = !openOnly && matches(c);
      c.hidden = !ok;
      if (ok) pastN++;
    }
    if (pastBlock) pastBlock.hidden = openOnly || (pastCards.length > 0 && pastN === 0);
    if (sort) {
      const key = sort.value === "deadline" ? (c) => c.dataset.deadline || "9999" : (c) => c.dataset.start;
      [...cards].sort((a, b) => key(a).localeCompare(key(b)) || a.dataset.start.localeCompare(b.dataset.start)).forEach((c) => list.appendChild(c));
    }
    $("count").textContent = `${n} event${n === 1 ? "" : "s"}`;
    if ($("count-tbc")) $("count-tbc").textContent = `${m} recurring event${m === 1 ? "" : "s"}`;
    if ($("count-past")) $("count-past").textContent = `${pastN} event${pastN === 1 ? "" : "s"}`;
    // Empty state is for upcoming only; past may still show below when open calls is off.
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

  const closeOtherDrops = (keep) => {
    for (const facet of multis) if (facet.root !== keep) facet.root.open = false;
  };
  for (const facet of multis) {
    facet.root.addEventListener("toggle", () => {
      if (facet.root.open) closeOtherDrops(facet.root);
    });
    facet.root.addEventListener("change", (e) => {
      if (facet.id === "f-field" && e.target === allPsy) {
        const on = allPsy.checked;
        for (const cb of psyBoxes()) cb.checked = on;
        allPsy.indeterminate = false;
      } else if (facet.id === "f-field" && e.target.matches?.("input[type=checkbox]")) {
        syncAllPsy();
      }
      apply();
    });
  }
  document.addEventListener("click", (e) => {
    const keep = e.target.closest?.("details.f-drop");
    const ours = keep && multis.some((m) => m.root === keep) ? keep : null;
    closeOtherDrops(ours);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeOtherDrops(null);
  });

  [q, region, dl, sort].forEach((el) => el && el.addEventListener("input", apply));
  $("reset")?.addEventListener("click", () => {
    if (q) q.value = "";
    for (const facet of multis) {
      for (const cb of facet.root.querySelectorAll("input[type=checkbox]")) cb.checked = false;
      facet.root.open = false;
    }
    if (allPsy) { allPsy.checked = false; allPsy.indeterminate = false; }
    if (region) region.value = "";
    if (dl) dl.checked = false;
    if (sort) sort.value = "start";
    apply();
    q?.focus();
  });
  apply();
})();
