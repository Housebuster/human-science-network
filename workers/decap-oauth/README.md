# Decap CMS GitHub OAuth Worker

Free Cloudflare Worker that lets Decap CMS sign in with GitHub when the site is hosted on **Cloudflare Pages** (Pages has no built-in Netlify Identity / Git Gateway).

## One-time setup (about 10 minutes)

### 1. Create a GitHub OAuth App

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   (or under your org: Organization settings → Developer settings → OAuth Apps).
2. Fill in:
   - **Application name:** `Human Science Network CMS`
   - **Homepage URL:** `https://human-science-network.pages.dev` (or your custom domain later)
   - **Authorization callback URL:** leave a placeholder for now — you will set it in step 3  
     Example final value: `https://hsn-decap-oauth.<your-subdomain>.workers.dev/callback`
3. Click **Register**. Copy the **Client ID**. Create a **Client secret** and copy it too.

### 2. Deploy this Worker

```bash
cd workers/decap-oauth
npm install
npx wrangler login          # once per machine
npx wrangler secret put GITHUB_CLIENT_ID      # paste the Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET  # paste the Client secret
npx wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://hsn-decap-oauth.<account>.workers.dev`.

### 3. Point the OAuth App callback at the Worker

Back in the GitHub OAuth App settings, set:

**Authorization callback URL** = `https://hsn-decap-oauth.<account>.workers.dev/callback`

### 4. Point Decap at the Worker

Edit `src/admin/config.yml` and replace the placeholder:

```yaml
backend:
  base_url: https://hsn-decap-oauth.<account>.workers.dev
```

Commit and push. After Cloudflare Pages redeploys, open `/admin/` and click **Login with GitHub**.

Only GitHub users who can push to `Housebuster/human-science-network` can publish (Decap uses the GitHub Contents API with the user's token).

### Local editing without OAuth

```bash
# terminal 1 — from the site root
npm start
# terminal 2
npx decap-server
```

Then open http://localhost:8080/admin/ — `local_backend: true` in config.yml talks to the local proxy and writes to your working tree. No GitHub login needed.
