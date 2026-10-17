// Progressive enhancement for forms that post to a configurable endpoint (see src/_data/site.json).
(() => {
  const params = new URLSearchParams(location.search);
  const topic = document.getElementById("c-topic"), listing = document.getElementById("c-listing");
  if (topic && params.get("topic")) topic.value = params.get("topic");
  if (listing && params.get("listing")) listing.value = params.get("listing");

  for (const form of document.querySelectorAll("form.js-form")) {
    const status = form.querySelector(".form-status");
    const show = (msg, err) => { status.hidden = false; status.textContent = msg; status.classList.toggle("error", !!err); status.focus?.(); };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const group = form.dataset.requiredGroup;
      if (group) {
        const fs = form.querySelector(`input[name="${group}"]`)?.closest("fieldset");
        const any = form.querySelector(`input[name="${group}"]:checked`);
        fs?.classList.toggle("invalid", !any);
        if (!any) { show("Please choose at least one field.", true); fs?.scrollIntoView({ block: "center" }); return; }
      }
      const s = form.querySelector('[name="start_date"]'), en = form.querySelector('[name="end_date"]');
      if (s && en && s.value && en.value && en.value < s.value) { show("The end date is before the start date.", true); en.focus(); return; }
      if (form.querySelector('[name="_gotcha"]')?.value) return;
      if (!form.action || /YOUR_[A-Z_]+_ID/.test(form.action)) {
        show("Thanks! This form isn't connected yet (the site is in preview), so nothing was sent.", true);
        return;
      }
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(res.status);
        form.reset(); show("Thank you. We've received your message and will be in touch.");
      } catch {
        show("Sorry, something went wrong. Please try again later.", true);
      } finally { btn.disabled = false; }
    });
  }
})();
