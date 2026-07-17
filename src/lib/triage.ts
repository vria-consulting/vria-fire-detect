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
  createdAt: string; // les plus récents sont jugés en premier
};

// v9 : règle d'ancrage durcie (voisin lointain, nom administratif de feu) —
// détectée par la batterie QA IA (Ladybank/Tentsmuir, Fort Frances 14 Fire).
const CACHE_PATH = "triage-cache-v9.json";
const RETENTION_MS = 48 * 60 * 60 * 1000;
const BATCH_SIZE = 25;
const MAX_NEW_PER_SCAN = 50; // garde-fou de coût et de durée par rafraîchissement

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Double jugement : le petit modèle filtre tout le flux (rejette ~85 %), puis
// le modèle de vérification contre-examine UNIQUEMENT les posts approuvés —
// la précision d'un grand modèle pour ~15 % de son coût.
const MODEL = process.env.TRIAGE_MODEL ?? "gpt-5.6-luna";
const VERIFY_MODEL = process.env.TRIAGE_VERIFY_MODEL ?? "gpt-5.6-terra";

const SYSTEM = `Tu es le filtre de pertinence de Kanari, un service d'alerte ultra-précoce des feux de forêt destiné aux secours. Chaque faux positif décrédibilise le service. Tu reçois une liste d'items : texte d'un post de réseau social ou titre d'article de presse, avec des lieux candidats.

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
- CHRONIQUES, newsletters, lettres d'opinion, récits de voyage ou billets d'humeur qui mentionnent des feux EN PASSANT (« Letter from Scotland : de retour de vacances à vélo, pas une goutte de pluie de la semaine… et des feux ont éclaté » = false : le sujet est la météo, pas un signalement) ;
- discussions sur la sécheresse, la canicule ou le RISQUE d'incendie sans feu précis actif signalé à l'instant ;
- feu de bâtiment isolé sans enjeu de propagation à la végétation.

Test décisif : le texte a-t-il pour OBJET de signaler un feu précis actif, tel qu'un pompier voudrait en être informé MAINTENANT ? Une mention incidente dans un texte qui parle d'autre chose = false, même si le mot « wildfire » apparaît.

Pièges de lieu à déjouer :
- un NOM DE PERSONNE qui ressemble à une ville (« Juanma Moreno » n'est pas Moreno en Argentine) ;
- un ADJECTIF homonyme d'une ville (« vasto incendio » = « vaste incendie » en italien, pas la ville de Vasto — vérifie que le mot est bien utilisé comme lieu dans la phrase) ;
- un aéroport, un stade ou un bâtiment homonyme d'une ville d'un autre pays.

"place" = l'indice (base 0) du candidat qui localise le feu. Les candidats portent leur code pays, et un même nom peut apparaître plusieurs fois avec des pays différents (homonymes) : choisis celui qui est cohérent avec le texte — « incendio en Guadalajara » dans un texte espagnol qui cite Castilla-La Mancha = « Guadalajara (ES) », pas (MX).
- Choisis en priorité le lieu exact du feu. À défaut, un candidat ENGLOBANT ou VOISIN cité dans le texte pour situer le feu est valide : la province pour un village absent des candidats (« incendio en Lozoyuela, Madrid » → « Madrid (ES) »), la ville dont le feu coupe la ligne de train (« trains Vigo-Ourense suspendus par le feu de Crecente » → « Ourense (ES) »).
- MAIS un voisin n'est valide que s'il situe réellement le feu : si le texte nomme précisément le lieu du feu et que ce lieu n'est PAS parmi les candidats, ne rabats PAS le feu sur la ville de l'AUTEUR ni sur un lieu que le texte présente comme distinct (« There's a wildfire at Tentsmuir, which isn't exactly local » posté depuis Ladybank → null : le texte dit lui-même que ce n'est pas local).
- Un NOM DE CODE administratif de feu contenant une ville (« Fort Frances 14 Fire », « Red Lake 007 ») désigne le district de gestion, pas l'emplacement : si le texte situe le feu près d'autres lieux, choisis ces lieux — sinon null, jamais la ville du nom de code.
- Réponds null si AUCUN candidat n'est cohérent : là où la fumée dérive, là où l'on en parle, un nom de média, un siège d'organisation, ou un homonyme du mauvais pays.

Règle d'or : au moindre doute sur l'un ou l'autre, réponds false / null. Manquer un signal ambigu coûte moins cher qu'une fausse alerte envoyée aux secours.`;

// Le vérificateur reçoit une consigne ADVERSARIALE : les items qu'il voit ont
// déjà été approuvés par le premier filtre, son travail est de trouver les
// erreurs — pas de confirmer poliment.
const VERIFY_SYSTEM = `${SYSTEM}

RÔLE PARTICULIER : tu es le SECOND examinateur. Tous les items que tu reçois ont déjà été approuvés par un premier filtre moins rigoureux — statistiquement, une partie sont des erreurs. Ton travail est de les trouver. Pour chaque item, cherche ACTIVEMENT une raison de rejeter : chronique ou mention incidente ? ironie ? fait passé ou daté ? hypothèse ou risque ? mauvais lieu ou homonyme ? Ne confirme fire=true avec un lieu QUE si le texte, à lui seul, justifierait de déranger des secours maintenant.`;

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
  model: string,
  system: string = SYSTEM
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
      max_completion_tokens: 16000,
      messages: [
        { role: "system", content: system },
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

// Pour la QA : jugement direct SANS cache Blob, avec exactement les mêmes
// modèles, prompt et double vérification que la production. Renvoie pour
// chaque candidat le verdict du trieur (luna) et le verdict final (vérifié).
export async function judgeForQA(
  candidates: TriageCandidate[]
): Promise<Map<string, { first: TriageVerdict | null; final: TriageVerdict | null }>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquante");
  const out = new Map<string, { first: TriageVerdict | null; final: TriageVerdict | null }>();
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const judged = await judgeBatch(apiKey, batch, MODEL);
    const approved = batch.filter((c) => judged.get(c.url)?.fire);
    let verified = new Map<string, TriageVerdict>();
    if (approved.length > 0 && VERIFY_MODEL !== MODEL) {
      verified = await judgeBatch(apiKey, approved, VERIFY_MODEL, VERIFY_SYSTEM);
    }
    for (const c of batch) {
      const first = judged.get(c.url) ?? null;
      const final = first?.fire
        ? (verified.get(c.url) ?? { fire: false, place: null })
        : first;
      out.set(c.url, { first, final });
    }
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
  const uncached: TriageCandidate[] = [];
  for (const c of candidates) {
    const hit = cache[c.url];
    if (hit) verdicts.set(c.url, { fire: hit.f, place: hit.p });
    else uncached.push(c);
  }
  // Les posts les plus récents d'abord : la précocité est le produit. Le
  // surplus au-delà du plafond attendra le scan suivant (jamais affiché sans
  // jugement — l'appelant écarte les posts absents de la Map).
  uncached.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const fresh = uncached.slice(0, MAX_NEW_PER_SCAN);

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE);
    try {
      const judged = await judgeBatch(apiKey, batch, MODEL);

      // Double jugement : les posts APPROUVÉS par le petit modèle sont
      // contre-vérifiés par le modèle puissant — son verdict est final.
      // Si la vérification échoue, on REJETTE ces posts pour ce scan sans
      // mettre le verdict en cache : ils seront rejugés au scan suivant
      // (jamais d'approbation non vérifiée gravée dans le cache).
      const noCache = new Set<string>();
      const approved = batch.filter((c) => judged.get(c.url)?.fire);
      if (approved.length > 0 && VERIFY_MODEL !== MODEL) {
        try {
          const verified = await judgeBatch(apiKey, approved, VERIFY_MODEL, VERIFY_SYSTEM);
          for (const c of approved) {
            const v = verified.get(c.url);
            if (v) {
              judged.set(c.url, v);
            } else {
              judged.set(c.url, { fire: false, place: null });
              noCache.add(c.url);
            }
          }
        } catch (e) {
          console.error("triage verify failed (posts rejetés, rejugés au prochain scan):", e);
          for (const c of approved) {
            judged.set(c.url, { fire: false, place: null });
            noCache.add(c.url);
          }
        }
      }

      const now = Date.now();
      for (const [url, v] of judged) {
        verdicts.set(url, v);
        if (!noCache.has(url)) cache[url] = { f: v.fire, p: v.place, at: now };
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
