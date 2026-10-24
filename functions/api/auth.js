/**
 * Decap CMS GitHub OAuth proxy as a Cloudflare Pages Function.
 * Single endpoint (Broadsheet style):
 *   GET /api/auth          → redirect the popup to GitHub authorize
 *   GET /api/auth?code=…   → exchange code for token, postMessage to Decap
 *
 * Pages env vars (Settings → Environment variables → Production + Preview):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *
 * GitHub OAuth App Authorization callback URL must be:
 *   https://human-science-network.pages.dev/api/auth
 * (add the custom-domain equivalent later if you use one)
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return page(
      `document.body.textContent = "OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Pages → Settings → Environment variables, then redeploy.";`
    );
  }

  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  // --- Callback: GitHub redirected back with ?code= (or ?error=) ---
  if (code || oauthError) {
    if (oauthError) {
      const detail = url.searchParams.get("error_description") || oauthError;
      const msg = JSON.stringify("authorization:github:error:" + detail);
      return page(`sendMsg(${msg});`);
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "human-science-network-decap-auth",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/auth`,
      }),
    });
    const data = await tokenRes.json();

    if (!data.access_token) {
      const detail = data.error_description || data.error || "token exchange failed";
      const msg = JSON.stringify("authorization:github:error:" + detail);
      return page(`sendMsg(${msg});`);
    }

    const payload = JSON.stringify({ token: data.access_token, provider: "github" });
    const msg = JSON.stringify("authorization:github:success:" + payload);
    return page(`sendMsg(${msg});`);
  }

  // --- Authorize: Decap opened this popup; send the user to GitHub ---
  const redirectUri = `${url.origin}/api/auth`;
  const scope = url.searchParams.get("scope") || "repo,user";
  const state = url.searchParams.get("state") || crypto.randomUUID();
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return page(`window.location.href = ${JSON.stringify(authUrl.toString())};`);
}

/** HTML shell that talks to the Decap opener via postMessage. */
function page(script) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<p>Completing sign-in…</p>
<script>
function sendMsg(msg) {
  var done = false;
  function deliver(targetOrigin) {
    if (done || !window.opener) return;
    done = true;
    window.opener.postMessage(msg, targetOrigin || "*");
    setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
  }
  window.addEventListener("message", function (e) {
    if (typeof e.data === "string" && e.data.indexOf("authorizing:github") === 0) {
      deliver(e.origin);
    }
  });
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
  // Fallback if Decap's handshake message never arrives
  setTimeout(function () { deliver("*"); }, 1000);
}
${script}
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
