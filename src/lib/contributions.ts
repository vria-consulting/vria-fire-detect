// Contributions citoyennes : formulaire « Contribuer » -> stockage.
// Backend cible = Supabase (table `contributions` + bucket `contributions`),
// pilotée par SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Tant que ces variables
// ne sont pas définies, on RETOMBE proprement sur Vercel Blob (déjà configuré)
// pour que la page soit fonctionnelle et qu'aucune contribution ne soit perdue.
// La bascule vers Supabase se fait sans changement de code, juste les clés.

import { put } from "@vercel/blob";
import { createHash, randomUUID } from "crypto";

export type Attachment = { name: string; url: string; size: number; type: string };

export type Contribution = {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  message: string;
  attachments: Attachment[];
  lang?: string;
  userAgent?: string;
  ipHash?: string;
  // Provenance du visiteur (pour la veille : d'où viennent les contributeurs).
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  country?: string;
  device?: string;
};

// Garde-fous de sécurité (le corps de requête Vercel est plafonné ~4,5 Mo :
// on reste sous cette barre, largement suffisant pour des captures d'écran).
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo par fichier
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 Mo au total
export const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// On ne stocke jamais l'IP brute : un hash tronqué suffit pour l'anti-abus.
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}::kanari-contrib`).digest("hex").slice(0, 16);
}

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

// Stocke un fichier : Supabase Storage (bucket privé) si configuré, sinon Blob.
export async function storeFile(
  path: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const sb = supabaseCreds();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/storage/v1/object/contributions/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sb.key}`,
          apikey: sb.key,
          "content-type": contentType,
          "x-upsert": "true",
        },
        // fetch n'accepte pas un Buffer Node directement : on passe une vue Uint8Array.
        body: new Uint8Array(bytes),
      });
      if (res.ok) return `${sb.url}/storage/v1/object/contributions/${path}`;
      // Échec Supabase (incident, quota…) : on ne perd rien, on bascule sur Blob.
      console.error(`supabase storage ${res.status} — repli Blob:`, (await res.text()).slice(0, 160));
    } catch (e) {
      console.error("supabase storage indisponible — repli Blob:", e);
    }
  }
  // Repli Blob : store privé (comme le reste de l'app) — l'URL n'est
  // accessible qu'avec le token côté serveur, cohérent avec un bucket Supabase
  // privé. Chemin déjà unique.
  const blob = await put(`contributions/${path}`, bytes, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  return blob.url;
}

// Persiste une contribution : ligne dans la table Supabase si configurée,
// sinon append dans un document JSON Blob (contributions.json).
export async function saveContribution(
  c: Contribution
): Promise<{ backend: "supabase" | "blob"; id: string }> {
  const sb = supabaseCreds();
  const id = randomUUID();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/contributions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sb.key}`,
          apikey: sb.key,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id,
          name: c.name,
          email: c.email,
          phone: c.phone ?? null,
          role: c.role ?? null,
          message: c.message,
          attachments: c.attachments,
          lang: c.lang ?? null,
          user_agent: c.userAgent ?? null,
          ip_hash: c.ipHash ?? null,
          referrer_host: c.referrerHost ?? null,
          utm_source: c.utmSource ?? null,
          utm_medium: c.utmMedium ?? null,
          utm_campaign: c.utmCampaign ?? null,
          country: c.country ?? null,
          device: c.device ?? null,
        }),
      });
      if (res.ok) return { backend: "supabase", id };
      // Échec Supabase (incident, quota…) : on NE PERD PAS la contribution,
      // on la sauvegarde dans le repli Blob pour réconciliation ultérieure.
      console.error(`supabase insert ${res.status} — repli Blob:`, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error("supabase insert indisponible — repli Blob:", e);
    }
  }
  // Repli Blob : UN fichier JSON par contribution (pas de read-modify-write,
  // donc aucun risque d'écrasement entre demandes concurrentes). L'ensemble se
  // parcourt en listant le préfixe « contributions-inbox/ ».
  const createdAt = new Date().toISOString();
  await put(
    `contributions-inbox/${createdAt}-${id}.json`,
    JSON.stringify({ id, created_at: createdAt, status: "new", ...c }, null, 2),
    { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" }
  );
  return { backend: "blob", id };
}
