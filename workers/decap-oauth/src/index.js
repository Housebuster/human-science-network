/**
 * GitHub OAuth proxy for Decap CMS (formerly Netlify CMS).
 *
 * Flow:
 *   1. Decap opens {base_url}/auth → we redirect to GitHub authorize.
 *   2. GitHub redirects to {base_url}/callback?code=…
 *   3. We exchange the code for a token and postMessage it to the opener window.
 *
 * Required Worker secrets (wrangler secret put …):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *
 * Optional:
 *   OAUTH_SCOPE  (default: "repo" — needed for private repos / write access)
 */
const SCOPE = "repo";

function html(body) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function bad(msg, status = 400) {
  return html(`<!doctype html><title>OAuth error</title><pre>${msg}</pre>`);
}

function cors(req, res) {
  const origin = req.headers.get("Origin") || "*";
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers });
}

/** Decap listens for this postMessage from the OAuth popup. */
function postMessageResponse(provider, status, content) {
  const payload = `authorization:${provider}:${status}:${JSON.stringify(content)}`;
  const safe = JSON.stringify(payload);
  return html(`<!doctype html>
<html><body>
<script>
(function () {
  function receive(msg) {
    try {
      if (msg.data === "authorizing:github" && window.opener) {
        window.opener.postMessage(${safe}, "*");
      }
    } catch (e) {}
  }
  window.addEventListener("message", receive, false);
  if (window.opener) {
    window.opener.postMessage("authorizing:github", "*");
    window.opener.postMessage(${safe}, "*");
  }
  document.write("<p>Login complete. You can close this window.</p>");
})();
</script>
</body></html>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return cors(request, new Response(null, { status: 204 }));
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return bad(
        "Worker misconfigured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET secrets.",
        500
      );
    }

    if (url.pathname === "/" || url.pathname === "") {
      return html(
        `<!doctype html><title>HSN Decap OAuth</title>
         <p>Decap CMS GitHub OAuth proxy for Human Science Network.</p>
         <p>Auth endpoint: <code>/auth</code></p>`
      );
    }

    if (url.pathname === "/auth") {
      const provider = url.searchParams.get("provider") || "github";
      if (provider !== "github") return bad("Unsupported provider: " + provider);

      const state = url.searchParams.get("state") || crypto.randomUUID();
      const redirectUri = `${url.origin}/callback`;
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", redirectUri);
      gh.searchParams.set("scope", env.OAUTH_SCOPE || SCOPE);
      gh.searchParams.set("state", state);
      return Response.redirect(gh.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error) {
        return postMessageResponse("github", "error", { message: error });
      }
      if (!code) return bad("Missing code");

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const data = await tokenRes.json();
      if (!data.access_token) {
        return postMessageResponse("github", "error", {
          message: data.error_description || data.error || "token exchange failed",
        });
      }
      return postMessageResponse("github", "success", {
        token: data.access_token,
        provider: "github",
      });
    }

    return bad("Not found", 404);
  },
};
