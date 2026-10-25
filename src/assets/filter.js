// Client-side search and filtering. Without JS, every listing is still shown
// (except past/TBC on the home page, hidden until their boxes are checked).
(() => {
  const $ = (id) => document.getElementById(id);
  const q = $("q"), region = $("f-region"), dl = $("f-deadline"), sort = $("f-sort"),
        showTbc = $("f-tbc"), showPast = $("f-past"),
        list = $("upcoming-list"), tbc = $("tbc-list"), past = $("past-list"),
        nextBlock = $("next-block"), pastBlock = $("past-block");
  if (!list) return;
  const cards = [...list.children], tbcCards = tbc ? [...tbc.children] : [];
  let pastCards = past ? [...past.children] : [];
  // Facet options from cards currently on the page (past cards added after lazy-load).
  const catalogCards = () => [...cards, ...tbcCards, ...pastCards];
  const params = new URLSearchParams(location.search);
    let pastLoad = null; // Promise while fetching / pending null when idle/done

  // Multi-select facets: OR within each facet. URL: repeated keys (?format=hybrid&format=online).
  const multis = [
    { id: "f-field", param: "field", empty: "All fields", attr: "fields",
      match: (d, vals) => vals.some((v) => d.fields.split(" ").includes(v)) },
    { id: "f-format", param: "format", empty: "Any format", attr: "format",
      match: (d, vals) => vals.includes(d.format) },
    { id: "f-orientation", param: "orientation", empty: "Any focus", attr: "orientation",
      match: (d, vals) => vals.includes(d.orientation) },
  ].map((m) => ({ ...m, root: $(m.id) })).filter((m) => m.root);

  // Hide Field / Format options that match zero conferences in the current catalog
  // (cards on this page), based on live data-* attributes. Focus (orientation) options
  // always show, even with zero matches.
  const usedByAttr = {
    fields: new Set(),
    format: new Set(),
  };
  const refreshFacetOptions = () => {
    usedByAttr.fields.clear();
    usedByAttr.format.clear();
    for (const c of catalogCards()) {
      const d = c.dataset;
      for (const id of (d.fields || "").split(/\s+/).filter(Boolean)) usedByAttr.fields.add(id);
      if (d.format) usedByAttr.format.add(d.format);
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
  };
  refreshFacetOptions();

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
  // Home scope: upcoming always shown; Past and Unscheduled (TBC) off unless URL says so.
  if (showTbc) showTbc.checked = params.get("tbc") === "1";
  if (showPast) {
    if (params.has("past")) showPast.checked = params.get("past") === "1";
    else showPast.checked = false;
  }

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

  const ensurePastLoaded = () => {
    if (!pastBlock || !past || pastCards.length) return Promise.resolve();
    if (pastLoad) return pastLoad;
    const src = pastBlock.dataset.pastSrc || "/past/";
    const loading = $("past-loading");
    if (loading) loading.hidden = false;
    pastLoad = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error("past fetch failed");
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const srcList = doc.getElementById("upcoming-list");
        if (!srcList) throw new Error("past list missing");
        past.replaceChildren(...[...srcList.children].map((c) => document.importNode(c, true)));
        pastCards = [...past.children];
        refreshFacetOptions();
        syncAllPsy();
      })
      .catch(() => {
        // Fallback: keep the browse link; clear failed promise so retry is possible.
        pastLoad = null;
      })
      .finally(() => {
        if (loading) loading.hidden = true;
      });
    return pastLoad;
  };

  const paintPast = () => {
    let pastN = 0;
    if (showPast?.checked && !dl?.checked) {
      for (const c of pastCards) {
        const ok = matches(c);
        c.hidden = !ok;
        if (ok) pastN++;
      }
      if (pastBlock) {
        // Keep block visible while loading (0 cards) or when matches exist.
        const loading = !pastCards.length && !!pastLoad;
        pastBlock.hidden = pastCards.length > 0 && pastN === 0 && !loading;
      }
    } else {
      for (const c of pastCards) c.hidden = true;
    }
    if ($("count-past")) {
      const total = pastBlock?.dataset.pastCount;
      const labelN = pastCards.length ? pastN : (total || 0);
      $("count-past").textContent = `${labelN} event${Number(labelN) === 1 ? "" : "s"}`;
    }
    return pastN;
  };

  function apply() {
    const openOnly = !!dl?.checked;
    const nextOn = true;
    const tbcOn = showTbc ? !!showTbc.checked : true;
    const pastOn = showPast ? !!showPast.checked : false;

    if (nextBlock) nextBlock.hidden = !nextOn;
    if (pastBlock) {
      // Past only when Past is checked; also hide when Open calls only (past has no open calls).
      pastBlock.hidden = !pastOn || openOnly;
    }
    if (pastOn && !openOnly) {
      const neededLoad = pastCards.length === 0;
      ensurePastLoaded().then(() => {
        if (neededLoad && pastCards.length && showPast?.checked && !dl?.checked) apply();
      });
    }

    let n = 0;
    if (nextOn) {
      for (const c of cards) { const ok = matches(c); c.hidden = !ok; if (ok) n++; }
    } else {
      for (const c of cards) c.hidden = true;
    }

    let m = 0;
    if (tbcOn) {
      for (const c of tbcCards) { const ok = !openOnly && matches(c); c.hidden = !ok; if (ok) m++; }
    } else {
      for (const c of tbcCards) c.hidden = true;
    }
    const tbcBlock = $("tbc-block");
    if (tbcBlock) tbcBlock.hidden = !tbcOn || (tbcCards.length > 0 && m === 0 && openOnly);

    paintPast();

    if (sort && nextOn) {
      const key = sort.value === "deadline" ? (c) => c.dataset.deadline || "9999" : (c) => c.dataset.start;
      [...cards].sort((a, b) => key(a).localeCompare(key(b)) || a.dataset.start.localeCompare(b.dataset.start)).forEach((c) => list.appendChild(c));
    }
    if ($("count")) $("count").textContent = `${n} event${n === 1 ? "" : "s"}`;
    if ($("count-tbc")) $("count-tbc").textContent = `${m} recurring event${m === 1 ? "" : "s"}`;
    // Empty state is for upcoming only when Next is on.
    if ($("empty")) $("empty").hidden = !nextOn || n > 0;
    const p = new URLSearchParams();
    if (q?.value.trim()) p.set("q", q.value.trim());
    for (const facet of multis) {
      updateSummary(facet);
      for (const v of checked(facet.root)) p.append(facet.param, v);
    }
    if (region?.value) p.set("region", region.value);
    if (sort?.value && sort.value !== "start") p.set("sort", sort.value);
    if (dl?.checked) p.set("open", "1");
    if (showTbc && showTbc.checked) p.set("tbc", "1");
    if (showPast && showPast.checked) p.set("past", "1");
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

  [q, region, dl, sort, showTbc, showPast].forEach((el) => el && el.addEventListener("input", apply));
  const resetAll = () => {
    if (q) q.value = "";
    for (const facet of multis) {
      for (const cb of facet.root.querySelectorAll("input[type=checkbox]")) cb.checked = false;
      facet.root.open = false;
    }
    if (allPsy) { allPsy.checked = false; allPsy.indeterminate = false; }
    if (region) region.value = "";
    if (dl) dl.checked = false;
    if (sort) sort.value = "start";
    if (showTbc) showTbc.checked = false;
    if (showPast) showPast.checked = false;
    apply();
    q?.focus();
  };
  $("reset")?.addEventListener("click", resetAll);
  apply();
})();
