// Meteosat MTG (MTI1/FCI) — produit "Active Fire Monitoring (CAP)" :
// EO:EUM:DAT:0801, un fichier CAP (XML) toutes les 10 min, publié ~5-8 min
// après la fin de la fenêtre d'observation. Couverture : disque terrestre à
// 0° (Europe, Afrique, Moyen-Orient, est de l'Amérique du Sud).
// C'est le pendant de GOES pour l'Europe : la précocité géostationnaire.

import { unzipSync } from "fflate";
import type { FireFeature } from "./firms";

const TOKEN_URL = "https://api.eumetsat.int/token";
const SEARCH_URL = "https://api.eumetsat.int/data/search-products/1.0.0/os";
const DOWNLOAD_BASE = "https://api.eumetsat.int/data/download/1.0.0/collections";
const COLLECTION = "EO:EUM:DAT:0801";

// Fenêtre glissante ingérée : suffisant pour la précocité (l'historique long
// est couvert par VIIRS), assez large pour éviter qu'un feu MTG déjà suivi
// paraisse "nouveau" à chaque produit.
const WINDOW_MS = 2 * 60 * 60 * 1000;

let token: { value: string; at: number } | null = null;

async function getToken(force = false): Promise<string | null> {
  const key = process.env.EUMETSAT_CONSUMER_KEY;
  const secret = process.env.EUMETSAT_CONSUMER_SECRET;
  if (!key || !secret) return null;
  if (!force && token && Date.now() - token.at < 50 * 60 * 1000) return token.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("EUMETSAT token failed", res.status);
    return null;
  }
  const j = await res.json();
  token = { value: j.access_token, at: Date.now() };
  return token.value;
}

// Cache par produit : un fichier CAP est immuable, on ne le télécharge qu'une fois.
const productCache = new Map<string, FireFeature[]>();

function parseCap(xml: string): FireFeature[] {
  const effective = /<effective>([^<]+)<\/effective>/.exec(xml)?.[1];
  const acq = effective
    ? new Date(effective).toISOString().slice(0, 19) + "Z"
    : new Date().toISOString().slice(0, 19) + "Z";
  const features: FireFeature[] = [];
  const re = /<circle>\s*(-?[\d.]+),(-?[\d.]+)\s+[\d.]+\s*<\/circle>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        frp: 0, // le produit CAP ne fournit pas la puissance
        conf: "n", // certainty "Likely"
        sat: "MTI1",
        acq,
        dn: "D",
        src: "mtg",
      },
    });
  }
  return features;
}

async function fetchProduct(tok: string, id: string): Promise<FireFeature[]> {
  const hit = productCache.get(id);
  if (hit) return hit;
  const url = `${DOWNLOAD_BASE}/${encodeURIComponent(COLLECTION)}/products/${encodeURIComponent(id)}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
  if (res.status === 401) {
    // Token révoqué entre-temps (une seule session active par application
    // côté gateway EUMETSAT : chaque instance serverless qui en forge un
    // révoque celui des autres) — on re-forge et on réessaie une fois.
    const fresh = await getToken(true);
    if (fresh) res = await fetch(url, { headers: { Authorization: `Bearer ${fresh}` } });
  }
  if (!res.ok) {
    console.error("MTG download failed", res.status, id.slice(0, 60));
    return [];
  }
  const zip = new Uint8Array(await res.arrayBuffer());
  let fires: FireFeature[] = [];
  try {
    const entries = unzipSync(zip);
    for (const [name, data] of Object.entries(entries)) {
      if (name.includes("CAP") && name.endsWith(".xml")) {
        fires = parseCap(new TextDecoder().decode(data));
        break;
      }
    }
  } catch (e) {
    console.error("MTG unzip failed:", e);
  }
  productCache.set(id, fires);
  // Purge du cache produit (les IDs contiennent l'horodatage, on borne la taille)
  if (productCache.size > 60) {
    const keys = [...productCache.keys()].slice(0, productCache.size - 40);
    for (const k of keys) productCache.delete(k);
  }
  return fires;
}

export async function fetchMtgFires(): Promise<FireFeature[]> {
  try {
    let tok = await getToken();
    if (!tok) return [];
    const searchUrl = `${SEARCH_URL}?format=json&pi=${encodeURIComponent(COLLECTION)}&c=20`;
    let res = await fetch(searchUrl, { headers: { Authorization: `Bearer ${tok}` } });
    if (res.status === 401) {
      // Token en cache révoqué par une autre instance : re-forge + retry.
      tok = await getToken(true);
      if (!tok) return [];
      res = await fetch(searchUrl, { headers: { Authorization: `Bearer ${tok}` } });
    }
    if (!res.ok) {
      console.error("MTG search failed", res.status);
      return [];
    }
    const j = await res.json();
    type Feat = { id: string; properties?: { date?: string } };
    const cutoff = Date.now() - WINDOW_MS;
    const products = ((j.features ?? []) as Feat[])
      .map((f) => ({
        id: f.id,
        start: new Date((f.properties?.date ?? "").split("/")[0] || 0).getTime(),
      }))
      .filter((p) => p.id && p.start > cutoff)
      .sort((a, b) => b.start - a.start)
      .slice(0, 12);
    const all = await Promise.all(products.map((p) => fetchProduct(tok, p.id)));
    return all.flat();
  } catch (e) {
    // MTG ne doit jamais faire tomber le pipeline principal.
    console.error("MTG fetch failed:", e);
    return [];
  }
}
