// Filtre de pertinence par IA (OpenAI) : pour chaque post/article candidat,
// juge (1) s'il signale un feu de végétation EN COURS MAINTENANT — pas un
// bilan d'hier, pas de la recherche, pas une métaphore — et (2) lequel des
// lieux candidats est réellement le lieu du feu (élimine les pièges type
// « The Globe and Mail » -> Globe, Arizona).
//
// Chaque post n'est jugé qu'une fois : les verdicts sont persistés 48 h sur
// Blob (partagé entre instances). Sans OPENAI_API_KEY, le module renvoie
// null et l'appelant garde le comportement mots-clés seul.

import { readJson, writeJson } from "./store";

export type TriageVerdict = { fire: boolean; place: number | null };

export type TriageCandidate = {
  url: string; // identifiant unique du post/article
  text: string;
  places: string[]; // noms des lieux candidats trouvés par le gazetteer
};

const CACHE_PATH = "triage-cache.json";
const RETENTION_MS = 48 * 60 * 60 * 1000;
const BATCH_SIZE = 25;
const MAX_NEW_PER_SCAN = 50; // garde-fou de coût et de durée par rafraîchissement

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// gpt-5.6-luna : le petit modèle OpenAI le plus récent (1 $/6 $ par M tokens).
// Surchargable via TRIAGE_MODEL (ex. gpt-5.4-mini, gpt-5.4-nano).
const MODEL = process.env.TRIAGE_MODEL ?? "gpt-5.6-luna";

const SYSTEM = `Tu es le filtre de pertinence de VigiFire, un service d'alerte ultra-précoce des feux de forêt. Tu reçois une liste d'items : texte d'un post de réseau social ou titre d'article de presse, avec une liste de lieux candidats extraits automatiquement.

Pour chaque item, réponds :
- "fire" : true UNIQUEMENT si le texte signale un incendie de végétation (ou une urgence incendie) EN COURS EN CE MOMENT : témoignage direct, alerte officielle, ordre d'évacuation, breaking news. Un témoignage d'habitant même sous forme de question ou d'incertitude (« Incendio en Madrid? », « ça sent la fumée vers X, quelqu'un sait ? », « gros panache au-dessus de Y ») EST un signal valide — c'est même le plus précieux car le plus précoce. Mets false pour tout le reste : feu passé ou éteint (bilan, reconstruction, procès, enquête, commémoration), article rétrospectif, recherche scientifique ou technologie de détection, prévention, promotion ou marketing, politique, statistiques de saison, métaphore ("on fire", "incendiaire"), fiction, feu domestique sans enjeu de propagation.
- "place" : l'indice (base 0) du lieu candidat qui est le LIEU DU FEU lui-même. Mets null si aucun candidat n'est le lieu du feu — par exemple un nom de média (The Globe and Mail, Le Monde), le siège d'une organisation, un lieu cité pour comparaison, ou un lieu trop ambigu pour être fiable.

Sois strict : en cas de doute sur l'un ou l'autre, réponds false / null. Mieux vaut manquer un signal ambigu que noyer les secours sous de fausses alertes.`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "fire", "place"],
        properties: {
          i: { type: "integer" },
          fire: { type: "boolean" },
          place: { type: ["integer", "null"] },
        },
      },
    },
  },
} as const;

async function judgeBatch(
  apiKey: string,
  batch: TriageCandidate[]
): Promise<Map<string, TriageVerdict>> {
  const out = new Map<string, TriageVerdict>();
  const payload = batch.map((c, i) => ({
    i,
    texte: c.text.slice(0, 500),
    lieux: c.places,
  }));
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "triage", strict: true, schema: OUTPUT_SCHEMA },
      },
    }),
  });
  if (!res.ok) {
    console.error("triage OpenAI HTTP", res.status, (await res.text()).slice(0, 300));
    return out;
  }
  const j = await res.json();
  const msg = j.choices?.[0]?.message;
  if (!msg?.content || msg.refusal) return out;
  const parsed = JSON.parse(msg.content) as {
    verdicts: { i: number; fire: boolean; place: number | null }[];
  };
  for (const v of parsed.verdicts ?? []) {
    const cand = batch[v.i];
    if (!cand) continue;
    const place =
      v.place != null && v.place >= 0 && v.place < cand.places.length ? v.place : null;
    out.set(cand.url, { fire: v.fire, place });
  }
  return out;
}

// Renvoie null si le tri IA n'est pas configuré (pas de clé API).
// Sinon : Map url -> verdict pour les candidats jugés (cache + jugements
// frais ; les non jugés — dépassement de quota, échec API — sont absents de
// la Map et l'appelant applique son repli).
export async function triageCandidates(
  candidates: TriageCandidate[]
): Promise<Map<string, TriageVerdict> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (candidates.length === 0) return new Map();

  type CacheEntry = { f: boolean; p: number | null; at: number };
  let cache: Record<string, CacheEntry> = {};
  try {
    cache = await readJson<Record<string, CacheEntry>>(CACHE_PATH, {});
  } catch {
    /* Blob indisponible : on jugera sans cache persistant */
  }

  const verdicts = new Map<string, TriageVerdict>();
  const fresh: TriageCandidate[] = [];
  for (const c of candidates) {
    const hit = cache[c.url];
    if (hit) verdicts.set(c.url, { fire: hit.f, place: hit.p });
    else if (fresh.length < MAX_NEW_PER_SCAN) fresh.push(c);
  }

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE);
    try {
      const judged = await judgeBatch(apiKey, batch);
      const now = Date.now();
      for (const [url, v] of judged) {
        verdicts.set(url, v);
        cache[url] = { f: v.fire, p: v.place, at: now };
      }
      for (const k of Object.keys(cache)) {
        if (now - cache[k].at > RETENTION_MS) delete cache[k];
      }
      // Persisté après CHAQUE lot : si la fonction serverless est tuée en
      // route (durée max), les verdicts déjà payés survivent au prochain appel.
      try {
        await writeJson(CACHE_PATH, cache);
      } catch {
        /* cache mémoire seulement */
      }
    } catch (e) {
      console.error("triage batch failed:", e);
      // batch non jugé : absent de la Map, l'appelant applique le repli
    }
  }
  return verdicts;
}
