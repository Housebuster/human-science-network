export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  // Serve Decap's static files as-is (do not run them through Nunjucks).
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
  // "12 Feb 2027"
  eleventyConfig.addFilter("date", (iso) => {
    if (!iso) return "";
    const { y, m, d } = parts(iso);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  });
  // "11–13 Feb 2027", "30 Jun – 4 Jul 2026"
  eleventyConfig.addFilter("dateRange", (s, e) => {
    if (!s) return "Dates TBC";
    const a = parts(s), b = parts(e || s);
    if (s === e || !e) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
    if (a.y !== b.y) return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
    if (a.m !== b.m) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
    return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
  });
  eleventyConfig.addFilter("dayNum", (iso) => String(parts(iso).d));
  eleventyConfig.addFilter("monYear", (iso) => { const { y, m } = parts(iso); return `${MONTHS[m - 1]} ${y}`; });
  eleventyConfig.addFilter("daysUntil", (iso, today) => Math.round((Date.parse(iso) - Date.parse(today)) / 864e5));
  // ICS date (all-day) and exclusive end date
  eleventyConfig.addFilter("icsDate", (iso, addDays = 0) => {
    const t = new Date(Date.parse(iso) + addDays * 864e5);
    return t.toISOString().slice(0, 10).replace(/-/g, "");
  });
  eleventyConfig.addFilter("icsText", (s = "") =>
    String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"));
  eleventyConfig.addFilter("rfc822", (iso) => new Date(iso + "T00:00:00Z").toUTCString());
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  // iCalendar requires CRLF line endings.
  eleventyConfig.addTransform("ics-crlf", function (content) {
    if ((this.page.outputPath || "").endsWith(".ics")) return content.trim().split(/\r?\n/).filter((x) => x.trim()).join("\r\n") + "\r\n";
    return content;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
