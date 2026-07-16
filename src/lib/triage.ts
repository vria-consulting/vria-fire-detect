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

// v4 : bump du chemin = invalidation des verdicts rendus avant le double
// jugement (vérification des approbations par un modèle plus puissant).
const CACHE_PATH = "triage-cache-v4.json";
const RETENTION_MS = 48 * 60 * 60 * 1000;
const BATCH_SIZE = 25;
const MAX_NEW_PER_SCAN = 50; // garde-fou de coût et de durée par rafraîchissement

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Double jugement : le petit modèle filtre tout le flux (rejette ~85 %), puis
// le modèle de vérification contre-examine UNIQUEMENT les posts approuvés —
// la précision d'un grand modèle pour ~15 % de son coût.
const MODEL = process.env.TRIAGE_MODEL ?? "gpt-5.6-luna";
const VERIFY_MODEL = process.env.TRIAGE_VERIFY_MODEL ?? "gpt-5.6-terra";

const SYSTEM = `Tu es le filtre de pertinence de VigiFire, un service d'alerte ultra-précoce des feux de forêt destiné aux secours. Chaque faux positif décrédibilise le service. Tu reçois une liste d'items : texte d'un post de réseau social ou titre d'article de presse, avec des lieux candidats.

Pour chaque item :

"fire" = true UNIQUEMENT si le texte SIGNALE un incendie de végétation précis, localisé, en cours ou venant de démarrer :
- témoignage direct d'un habitant, même interrogatif ou incertain (« Incendio en Madrid? », « ça sent la fumée vers X ? », « gros panache au-dessus de Y ») ;
- alerte officielle, ordre d'évacuation, intervention de pompiers en cours ;
- breaking news sur un feu actif.

"fire" = false pour TOUT le reste, en particulier :
- humour, ironie, sarcasme, indignation politique ou militante (« burning the world down », « le pays brûle », critiques du capitalisme ou du gouvernement) ;
- commentaire général sur la fumée, la qualité de l'air, la canicule ou le climat SANS feu précis nouvellement signalé (« les commerces ferment à cause de la qualité de l'air » = false) ;
- feu passé, éteint, maîtrisé, bilans, reconstruction, procès, enquêtes, commémorations, statistiques de saison ;
- fait DATÉ du passé, même récent : le champ « maintenant » du message te donne la date et l'heure actuelles — un événement daté d'hier ou d'avant (« les faits ont eu lieu mercredi à 22 h 30 ») n'est PAS un feu en cours ;
- feu de voiture(s), de poubelle, d'appartement ou d'usine SANS risque explicite de propagation à la végétation ;
- recherche scientifique, technologie de détection, prévention, marketing, collectes de dons, offres d'emploi ;
- métaphores (« on fire »), fiction, films, musique, jeux vidéo ;
- scénarios HYPOTHÉTIQUES ou conditionnels (« si un grand incendie se produisait… », exercices, simulations, plans de prévention) ;
- revendications politiques ou associatives à propos de feux (demandes de démission, polémiques sur la gestion) sans signalement d'un feu précis en cours ;
- feu de bâtiment isolé sans enjeu de propagation à la végétation.

Pièges de lieu à déjouer :
- un NOM DE PERSONNE qui ressemble à une ville (« Juanma Moreno » n'est pas Moreno en Argentine) ;
- un ADJECTIF homonyme d'une ville (« vasto incendio » = « vaste incendie » en italien, pas la ville de Vasto — vérifie que le mot est bien utilisé comme lieu dans la phrase) ;
- un aéroport, un stade ou un bâtiment homonyme d'une ville d'un autre pays.

"place" = l'indice (base 0) du candidat qui est le lieu où le feu BRÛLE — pas là où la fumée dérive, pas là où l'on en parle, pas un nom de média ni un siège d'organisation. Les candidats portent leur code pays : rejette les homonymes incohérents avec le texte (feu en Colombie-Britannique + candidat « Boston (US) » = null).

Règle d'or : au moindre doute sur l'un ou l'autre, réponds false / null. Manquer un signal ambigu coûte moins cher qu'une fausse alerte envoyée aux secours.`;

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
  batch: TriageCandidate[],
  model: string
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
      model,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            maintenant: new Date().toISOString(),
            items: payload,
          }),
        },
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
      const judged = await judgeBatch(apiKey, batch, MODEL);

      // Double jugement : les posts APPROUVÉS par le petit modèle sont
      // contre-vérifiés par le modèle puissant — son verdict est final.
      const approved = batch.filter((c) => judged.get(c.url)?.fire);
      if (approved.length > 0 && VERIFY_MODEL !== MODEL) {
        try {
          const verified = await judgeBatch(apiKey, approved, VERIFY_MODEL);
          for (const c of approved) {
            judged.set(c.url, verified.get(c.url) ?? { fire: false, place: null });
          }
        } catch (e) {
          console.error("triage verify failed (verdicts luna conservés):", e);
        }
      }

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
