// Client Bluesky minimal. L'API publique (public.api.bsky.app) refuse les IP
// de datacenter (403) : on s'authentifie donc sur bsky.social avec un compte
// gratuit + app password (BSKY_IDENTIFIER / BSKY_APP_PASSWORD).

const PUBLIC_SEARCH = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const AUTH_BASE = "https://bsky.social/xrpc";
const UA = "Kanari/0.1 (https://vria-fire-detect.vercel.app)";

let session: { jwt: string; at: number } | null = null;
let authInflight: Promise<string | null> | null = null;

// Une seule createSession à la fois : N recherches parallèles partagent la
// même authentification (créer 16 sessions d'un coup déclenche le rate limit).
async function bskyAuth(): Promise<string | null> {
  const id = process.env.BSKY_IDENTIFIER;
  const pw = process.env.BSKY_APP_PASSWORD;
  if (!id || !pw) return null;
  if (session && Date.now() - session.at < 45 * 60 * 1000) return session.jwt;
  if (authInflight) return authInflight;
  authInflight = (async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: id, password: pw }),
      });
      if (!res.ok) {
        console.error("bsky auth failed", res.status);
        return null;
      }
      const j = await res.json();
      session = { jwt: j.accessJwt, at: Date.now() };
      return session.jwt;
    } finally {
      authInflight = null;
    }
  })();
  return authInflight;
}

export type BskyPost = {
  uri: string;
  author: { handle: string; displayName?: string };
  record: { text?: string; createdAt?: string };
};

export function postUrl(p: BskyPost): string {
  return `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`;
}

export async function searchPosts(
  q: string,
  limit = 20,
  opts?: { until?: string; since?: string }
): Promise<{ posts: BskyPost[]; status: number }> {
  let params = `?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
  if (opts?.until) params += `&until=${encodeURIComponent(opts.until)}`;
  if (opts?.since) params += `&since=${encodeURIComponent(opts.since)}`;
  // 1. Endpoint public (sans authentification)
  let res = await fetch(PUBLIC_SEARCH + params, { headers: { "User-Agent": UA } });
  // 2. Repli authentifié
  if (!res.ok) {
    const publicStatus = res.status;
    const jwt = await bskyAuth();
    if (!jwt) return { posts: [], status: publicStatus };
    res = await fetch(`${AUTH_BASE}/app.bsky.feed.searchPosts${params}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return { posts: [], status: res.status };
  }
  const j = await res.json();
  return { posts: j.posts ?? [], status: res.status };
}
