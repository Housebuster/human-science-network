# Human Science Network: static site

A curated directory of legitimate scholarly conferences across the human sciences. It is built with **[Eleventy 3](https://www.11ty.dev/)**, which is the only dependency. The output is plain HTML, CSS and a little vanilla JS. There's no backend, no tracking, and no third-party fonts or scripts.

```
site/
├─ src/
│  ├─ _data/
│  │  ├─ listings.json    ← THE listings data file (edit this)
│  │  ├─ excluded.json    ← removed/archived events with reasons (never rendered)
│  │  ├─ taxonomy.json    ← fields, formats, organizer types, regions
│  │  ├─ site.json        ← site URL + form endpoints
│  │  └─ catalog.js       ← build-time logic: upcoming/past/tbc by date, sorting
│  ├─ _includes/          ← layout + components (Nunjucks)
│  ├─ assets/             ← style.css, filter.js, forms.js
│  ├─ index.njk           ← home: search + filters (field, format, region, open calls)
│  ├─ past.njk  listing.njk (one page per listing at /events/<id>/)
│  ├─ about.md  submit.njk  contact.njk  digest.njk
│  ├─ deadlines.ics.njk   ← iCalendar feed of deadlines + upcoming events
│  ├─ deadlines.xml.njk   ← RSS feed of open calls
│  └─ _headers            ← Cloudflare Pages security headers
├─ scripts/validate.js    ← schema check, runs before every build
└─ eleventy.config.js
```


## Decap CMS (visual editor)

Editors can change listings, the About page, site settings and the field taxonomy in the browser — no local checkout required once OAuth is set up. Decap is free and open source; it commits straight to the GitHub repo, and Cloudflare Pages rebuilds the site.

### Open the admin

- Production: `https://human-science-network.pages.dev/admin/` (or `https://humansciencenetwork.com/admin/` after the domain is connected)
- Local: `http://localhost:8080/admin/` (with `npx decap-server` running — see below)

### What you can edit

| Collection | File | Notes |
|---|---|---|
| **Site settings** | `src/_data/site.json` | Title, tagline, contact email, form endpoints |
| **About & vetting** | `src/about.md` | Public About page body |
| **Conference listings** | `src/_data/listings.json` | The full list of events (add / edit / remove) |
| **Field taxonomy** | `src/_data/taxonomy.json` | Field tags, formats, regions (edit carefully — field ids are used by listings) |

Excluded / archived events stay in `src/_data/excluded.json` and are **not** in the CMS (edit that file in git if needed).

### Sign in with GitHub (Cloudflare Pages)

Decap’s GitHub backend needs a tiny OAuth proxy. Netlify provides one automatically; **Cloudflare Pages does not**, so this repo includes a Worker under `workers/decap-oauth/`.

**Status today:** the `/admin/` UI is deployed, but login will fail until you finish the one-time Worker + GitHub OAuth App setup (about 10 minutes, free). Full steps: [`workers/decap-oauth/README.md`](workers/decap-oauth/README.md).

Short version:

1. Create a GitHub OAuth App.
2. `cd workers/decap-oauth && npm i && npx wrangler secret put GITHUB_CLIENT_ID && npx wrangler secret put GITHUB_CLIENT_SECRET && npx wrangler deploy`
3. Set the OAuth App callback to `https://hsn-decap-oauth.<account>.workers.dev/callback`
4. Put that Worker URL in `src/admin/config.yml` → `backend.base_url`, commit and push.

After that, open `/admin/` → **Login with GitHub**. You need push access to `Housebuster/human-science-network`.

### Local editing (no OAuth)

```bash
npm start                 # site on :8080
npx decap-server          # another terminal — local Git proxy
# open http://localhost:8080/admin/
```

Saves write into your working tree; commit and push as usual.

### WordPress later?

You do **not** need WordPress for editing. Decap already gives a browser UI. If you ever wanted WordPress again, you’d either reverse-proxy a WP install or rebuild around its REST API — a large step backwards for a static directory. Prefer staying on Decap + git.

## Build and run locally

Requires Node 18+ (Node 20 recommended; see `.nvmrc`).

```bash
npm install
npm run build      # validates listings.json, then writes the site to _site/
npm start          # dev server with live reload at http://localhost:8080
npm run validate   # check the data only
```

Upcoming and Past are worked out **at build time from the dates**, using the build day as "today". To preview how the site will look on another date, run `BUILD_DATE=2027-03-01 npm run build`. Because the split depends on the date, **rebuild the site regularly**. A Cloudflare Pages deploy hook triggered daily works well (see below).

## Adding or editing a listing

Edit `src/_data/listings.json` (an array under `"listings"`), then run `npm run build`. The validator reports any schema errors.

### Listing schema

| key | required | notes |
|---|---|---|
| `id` | yes | Unique, lowercase-kebab, e.g. `spsp-2027`. Used in the URL `/events/<id>/`. Keep it stable. |
| `name` | yes | Full name including edition/year. |
| `short_name` | | e.g. `SPSP 2027`. |
| `organizer` | yes | The exact name of the owning body. |
| `organizer_type` | yes | `society`, `university`, `research-network`, `government`, `commercial` or `other`. |
| `url` | yes | Official page for **this edition** (not an old year's page). |
| `cfp_url` | | Call for papers/abstracts page. |
| `start_date`, `end_date` | | ISO `YYYY-MM-DD`. Give both or neither. **Leave both blank if they aren't verified.** The listing then shows as "to be confirmed". |
| `abstract_deadline` | | ISO date. Shown as an "open call" until it passes, and included in the ICS/RSS feeds. |
| `location` | yes | `{ "venue": "", "city": "", "country": "", "country_code": "US" }`. The ISO country code drives the Region filter (mapping in `taxonomy.json`). |
| `format` | yes | `in-person`, `hybrid` or `online`. |
| `fields` | yes | One or more field ids from `taxonomy.json`. There is no default; choose deliberately. |
| `status` | yes | `upcoming`, `past` or `tbc`. **The site recomputes this from the dates.** The validator warns if the stored value is out of date, so update it when you see the warning. |
| `last_verified` | yes | Date you last checked the official source. Warns after 6 months. |
| `verified_source_url` | yes | The page you checked. |
| `date_confidence` | | `verified` (default), `medium` or `low`. Anything other than `verified` shows a "final confirmation pending" hint. |
| `public_note` | | A short note shown publicly on the listing. |
| `notes` | | **Internal** editor notes. Never shown on the site. |
| `review` | | **Internal** flag, e.g. `{ "needs_review": true, "reason": "…" }`. Never shown; the validator prints it on each build. |

To add a field, add it to `taxonomy.json` under the right group. It then appears automatically in the filter menu (once at least one listing uses it) and in the Submit and Digest forms.

**Rolling an event forward.** When the next edition is announced, edit the existing entry in place: update the name/year, dates, url, deadline, `last_verified` and `verified_source_url`. Optionally change the `id`, but note this changes the URL. To keep a record of the old edition, add it as a separate entry first.

**Removing an event.** Move it from `listings.json` to `excluded.json` with a `decision` (`excluded`/`archived`) and a `reason`.

Inclusion rules are in `../vetting-criteria.md`. The public version is `src/about.md`.

## Forms (submit, contact/advertise, digest)

The site is static, so the forms post to an external endpoint set in `src/_data/site.json`:

```json
"forms": {
  "submit":  "https://formspree.io/f/YOUR_SUBMIT_FORM_ID",
  "contact": "https://formspree.io/f/YOUR_CONTACT_FORM_ID",
  "digest":  "https://formspree.io/f/YOUR_DIGEST_FORM_ID"
}
```

While the placeholders (`YOUR_…_ID`) are in place, the forms validate input but **send nothing**, and show a "not connected yet" message. To connect them, pick one option:

- **Formspree** (simplest): create three forms at formspree.io and paste their endpoint URLs. The forms already include a `_gotcha` honeypot and `_subject`.
- **Cloudflare Worker / Pages Function**: add `functions/api/submit.js` (etc.) that accepts `POST` FormData and forwards it by email (e.g. MailChannels/Resend) or stores it in D1/KV. Then set the endpoints to `/api/submit` etc. JS submits with `fetch` and `Accept: application/json`, so return any 2xx.
- For the **digest**, a mailing tool (Buttondown, Listmonk or Mailchimp) can receive signups. Map `email` and `digest_fields` (multi-value) to tags/segments.

Multi-select fields arrive as repeated keys (`fields=psy-social&fields=anthropology`).

## Deploy to Cloudflare Pages

1. **Put the code in a git repo.** This folder is already a git repo. Create an empty GitHub (or GitLab) repo, then run:
   ```bash
   git remote add origin git@github.com:<you>/human-science-network.git
   git push -u origin main
   ```
2. In the **Cloudflare dashboard**, go to **Workers & Pages → Create → Pages → Connect to Git** and select the repo.
3. Use these build settings:
   - Framework preset: **None** (or Eleventy)
   - Build command: `npm run build`
   - Build output directory: `_site`
   - Root directory: `/` (or the subfolder, if the site lives inside a larger repo)
   - Environment variable: `NODE_VERSION` = `20`
4. Click **Save and Deploy**. You'll get a `*.pages.dev` preview URL. Every push to `main` redeploys, and other branches get preview URLs.
5. **Daily rebuild** (so events move to Past on time): go to Pages project → **Settings → Builds & deployments → Deploy hooks**, create a hook, and call it once a day. For example, use a Cloudflare Worker Cron Trigger that `fetch`es the hook URL with `POST`, or a scheduled GitHub Action that runs `curl -X POST <hook>`.

## Connect the Hostinger domain (humansciencenetwork.com)

The domain's nameservers are currently Hostinger's parking defaults (`ns1.dns-parking.com`, `ns2.dns-parking.com`). The cleanest setup is to let Cloudflare run DNS.

1. **Before you switch, note the existing DNS records** in Hostinger (hPanel → Domains → DNS / Nameservers), especially any **MX/TXT records for email**. You'll recreate them in Cloudflare. The live WordPress site stays up until the nameserver change takes effect.
2. In Cloudflare, go to **Add a site** → enter `humansciencenetwork.com` → choose the **Free** plan. Cloudflare scans the existing records; check them against your notes and add anything missing (MX, SPF/DKIM TXT, etc.).
3. Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`). In **Hostinger hPanel**, go to **Domains → humansciencenetwork.com → DNS / Nameservers → Change nameservers → "Use custom nameservers"**. Replace `ns1/ns2.dns-parking.com` with the two Cloudflare nameservers and save. If DNSSEC is enabled at Hostinger, disable it first.
4. Wait for Cloudflare to show the zone as **Active**. This usually takes minutes to a few hours, and can take up to 24–48 hours.
5. In your **Pages project → Custom domains → Set up a custom domain**, add `humansciencenetwork.com`, then add `www.humansciencenetwork.com` as well. Cloudflare creates the CNAME records and the TLS certificate automatically.
6. Optional: add a redirect from `www` to the apex (Rules → Redirect Rules), or the other way round, so there's one canonical host. `site.json` → `url` uses the apex.
7. Once the new site is verified, cancel or turn off the old WordPress hosting. **Don't delete it until you've exported anything you need.**

*Alternative without moving DNS:* keep Hostinger DNS and, in Hostinger's DNS editor, point `www` with a CNAME to `<project>.pages.dev`, then add the custom domain in Pages. Apex domains need CNAME flattening, which Hostinger doesn't offer, so moving nameservers to Cloudflare is recommended.

## Future-proofing (not built yet)

- **Email digest:** `catalog.deadlines` already exposes upcoming deadlines sorted by date, and each listing has machine-readable `fields`. A scheduled Worker can read the built `/deadlines.xml`, or a JSON export, and send per-field digests.
- **Accounts / researcher matchmaking:** keep `listings.json` as the source of truth, or move it to a headless DB (Cloudflare D1) behind the same schema. Static pages can stay static, with dynamic features added as Pages Functions under `/api/*`. Listing `id`s are stable keys for saved events and follows.
