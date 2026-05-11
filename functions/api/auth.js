const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";

const randomState = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const textResponse = (message, status = 200, headers = {}) => {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...headers
    }
  });
};

export const onRequest = async ({ request, env }) => {
  if (request.method !== "GET") {
    return textResponse("Method not allowed.", 405);
  }

  if (!env.GITHUB_CLIENT_ID) {
    return textResponse("GitHub OAuth is not configured.", 500);
  }

  const requestUrl = new URL(request.url);
  const state = randomState();
  const authUrl = new URL(GITHUB_AUTH_URL);

  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${requestUrl.origin}/api/callback`);
  authUrl.searchParams.set("scope", "repo user");
  authUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": authUrl.toString(),
      "Set-Cookie": `decap_oauth_state=${state}; Path=/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
    }
  });
};
