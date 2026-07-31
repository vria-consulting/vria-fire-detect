// Session admin du dashboard de veille.
// Cookie httpOnly signé (HMAC-SHA256) + expiration glissante 20 min d'inactivité.
// Aucune dépendance : la signature repose sur SESSION_SECRET.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ADMIN_EMAIL, supabaseCreds } from "@/lib/analytics";

export const SESSION_COOKIE = "kanari_veille";
export const SESSION_TTL_MS = 20 * 60 * 1000; // 20 min d'inactivité

function secret(): string {
  return process.env.SESSION_SECRET || "";
}

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// token = base64url(JSON{exp}) . base64url(hmac)
export function signSession(expMs: number): string {
  const data = b64url(Buffer.from(JSON.stringify({ exp: expMs })));
  const sig = b64url(createHmac("sha256", secret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifySession(token: string | undefined): { valid: boolean; exp: number } {
  if (!token || !secret()) return { valid: false, exp: 0 };
  const [data, sig] = token.split(".");
  if (!data || !sig) return { valid: false, exp: 0 };
  const expected = b64url(createHmac("sha256", secret()).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, exp: 0 };
  try {
    const { exp } = JSON.parse(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (typeof exp !== "number" || exp < Date.now()) return { valid: false, exp: 0 };
    return { valid: true, exp };
  } catch {
    return { valid: false, exp: 0 };
  }
}

// Options communes du cookie de session.
function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/veille",
    maxAge: maxAgeSec,
  };
}

// Pose (ou rafraîchit) le cookie de session — expiration glissante.
export async function setSession(): Promise<void> {
  const exp = Date.now() + SESSION_TTL_MS;
  (await cookies()).set(SESSION_COOKIE, signSession(exp), cookieOptions(Math.floor(SESSION_TTL_MS / 1000)));
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", cookieOptions(0));
}

// Lit le cookie courant et indique si la session est valide.
export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token).valid;
}

// ---- Magic link Supabase -------------------------------------------------
// Envoi : GoTrue /otp envoie l'e-mail (template « Magic Link » par défaut).
// Le lien renvoie vers /veille/confirm avec le token dans le fragment (#),
// lu côté client puis validé côté serveur via /auth/v1/user.
export async function sendMagicLink(redirectTo: string): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseCreds();
  if (!sb) return { ok: false, error: "no_supabase" };
  try {
    // create_user: true -> Supabase crée l'utilisateur admin au 1er envoi
    // (inutile de le pré-créer à la main). Sans risque : le destinataire est
    // codé en dur et /veille/confirm revérifie l'adresse avant d'ouvrir la session.
    const res = await fetch(`${sb.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, create_user: true }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: (await res.text()).slice(0, 200) };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

// Validation : on interroge Supabase avec l'access_token reçu pour confirmer
// que c'est bien l'admin. Le token Supabase est ensuite jeté — on ne garde
// que NOTRE cookie de session.
export async function verifyAccessToken(accessToken: string): Promise<boolean> {
  const sb = supabaseCreds();
  if (!sb || !accessToken) return false;
  try {
    const res = await fetch(`${sb.url}/auth/v1/user`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return typeof user?.email === "string" && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}

// Appel de l'agrégateur Postgres (une requête -> tout le JSON du dashboard).
export async function fetchVeilleStats(): Promise<unknown | null> {
  const sb = supabaseCreds();
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}/rest/v1/rpc/veille_stats`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
