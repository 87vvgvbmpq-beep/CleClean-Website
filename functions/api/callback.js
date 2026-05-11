const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

const readCookie = (request, name) => {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

const htmlResponse = (body, status = 200) => {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": "decap_oauth_state=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    }
  });
};

const renderOAuthMessage = (status, content) => {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>GitHub authorization</title>
  </head>
  <body>
    <p>Completing GitHub authorization...</p>
    <script>
      (function () {
        const message = ${JSON.stringify(message)};
        const receiveMessage = function (event) {
          window.opener.postMessage(message, event.origin);
          window.removeEventListener("message", receiveMessage, false);
        };

        if (window.opener) {
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        } else {
          document.body.textContent = "Authorization complete. You can close this window.";
        }
      }());
    </script>
  </body>
</html>`;
};

const exchangeCodeForToken = async ({ code, clientId, clientSecret }) => {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "cleclean-decap-cms"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    })
  });

  return response.json();
};

export const onRequest = async ({ request, env }) => {
  if (request.method !== "GET") {
    return htmlResponse(renderOAuthMessage("error", { error: "Method not allowed." }), 405);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return htmlResponse(renderOAuthMessage("error", {
      error: "GitHub OAuth is not configured."
    }), 500);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = readCookie(request, "decap_oauth_state");

  if (!code) {
    return htmlResponse(renderOAuthMessage("error", { error: "Missing GitHub authorization code." }), 400);
  }

  if (!state || !storedState || state !== storedState) {
    return htmlResponse(renderOAuthMessage("error", { error: "Invalid OAuth state." }), 400);
  }

  try {
    const result = await exchangeCodeForToken({
      code,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    });

    if (result.error || !result.access_token) {
      return htmlResponse(renderOAuthMessage("error", result), 401);
    }

    return htmlResponse(renderOAuthMessage("success", {
      token: result.access_token,
      provider: "github"
    }));
  } catch (error) {
    console.error(error);
    return htmlResponse(renderOAuthMessage("error", {
      error: "GitHub authorization failed."
    }), 500);
  }
};
