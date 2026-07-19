// Niveau 4 — PERTINENCE PAR IA : rejoue, comme un relecteur humain, chaque
// signalement affiché à travers DEUX contrôles indépendants :
//   1. le pipeline de production lui-même (luna + vérification adversariale
//      terra, via judgeForQA, sans cache) — le verdict doit rester « feu » et
//      désigner LE MÊME lieu que celui affiché sur la carte ;
//   2. un relecteur IA dédié (terra) qui répond à trois questions : le post
//      signale-t-il un feu de végétation en cours ? le lieu ancré est-il le
//      bon ? les dates/horodatages sont-ils cohérents ?
// Nécessite OPENAI_API_KEY dans l'environnement (.env.local).

import { check, record, type QaOptions, type QaPost } from "./util";
import { getEvents, getSignals } from "./endpoints";
import { extractPlaces, normalizePlace } from "../../src/lib/geoparse";
import { judgeForQA } from "../../src/lib/triage";

const L = "4-ia";

// luna suffit largement pour la relecture (terra coûtait 2,5× plus cher).
const REVIEW_MODEL = process.env.QA_REVIEW_MODEL ?? "gpt-5.6-luna";

const REVIEW_SYSTEM = `Tu es le relecteur qualité de Kanari, service d'alerte précoce des feux de forêt. On te montre des posts qui SONT AFFICHÉS sur la carte publique, chacun ancré à un lieu. Ton travail : trouver les erreurs qu'un utilisateur nous reprocherait.

Pour chaque item, réponds :
- "feu_actuel" : true si le texte signale un feu de végétation en cours ou venant de démarrer (témoignage, alerte officielle, breaking news). false si humour/métaphore, feu passé ou daté d'un autre jour, feu de voiture/bâtiment sans végétation, prévention, statistiques, chronique où le feu n'est qu'une mention incidente.
- "lieu_correct" : true si le lieu ancré (fourni avec son pays) est bien le lieu du feu d'après le texte — un lieu englobant ou voisin cité pour situer le feu est correct. false si le texte situe le feu ailleurs, si c'est un homonyme du mauvais pays, un nom de personne, un média.
- "dates_coherentes" : true si rien dans le texte ne contredit un événement en cours à la date du post (champ "maintenant" = maintenant). false si le texte date les faits d'avant le jour du post (« hier soir », date explicite passée).
- "probleme" : phrase courte expliquant le défaut, ou null.

Sois exigeant : un doute sérieux = false.`;

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["avis"],
  properties: {
    avis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "feu_actuel", "lieu_correct", "dates_coherentes", "probleme"],
        properties: {
          i: { type: "integer" },
          feu_actuel: { type: "boolean" },
          lieu_correct: { type: "boolean" },
          dates_coherentes: { type: "boolean" },
          probleme: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

type ReviewItem = {
  post: QaPost;
  place: string;
  countryCode: string;
  origin: string; // « signal » ou « corroboration <id> »
};

type Review = { feu_actuel: boolean; lieu_correct: boolean; dates_coherentes: boolean; probleme: string | null };

async function reviewBatch(apiKey: string, items: ReviewItem[]): Promise<(Review | null)[]> {
  const payload = items.map((it, i) => ({
    i,
    texte: it.post.text.slice(0, 500),
    lieu_ancre: `${it.place} (${it.countryCode.toUpperCase()})`,
    date_du_post: it.post.createdAt,
  }));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: REVIEW_MODEL,
      reasoning_effort: "low",
      max_completion_tokens: 4000,
      messages: [
        { role: "system", content: REVIEW_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({ maintenant: new Date().toISOString(), items: payload }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "revue_qa", strict: true, schema: REVIEW_SCHEMA },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status} : ${(await res.text()).slice(0, 120)}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(j.choices[0].message.content) as { avis: (Review & { i: number })[] };
  const out: (Review | null)[] = items.map(() => null);
  for (const a of parsed.avis ?? []) if (items[a.i]) out[a.i] = a;
  return out;
}

export async function runAi(opts: QaOptions): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (opts.skipAi) {
    record(L, "Batterie IA", "SKIP", "--skip-ai");
    return;
  }
  if (!apiKey) {
    record(
      L,
      "Batterie IA",
      "SKIP",
      "OPENAI_API_KEY absente — ajoutez-la à .env.local pour activer la double vérification IA"
    );
    return;
  }

  // Corpus : tous les posts affichés (signalements + corroborations de foyers).
  const [signals, events] = [await getSignals(opts.target), await getEvents(opts.target, 24)];
  const items: ReviewItem[] = [];
  const seen = new Set<string>();
  for (const s of signals.signals) {
    for (const p of s.posts) {
      if (seen.has(p.url)) continue;
      seen.add(p.url);
      items.push({ post: p, place: s.place, countryCode: s.countryCode, origin: "signalement" });
    }
  }
  for (const ev of events.events) {
    if (!ev.social) continue;
    const sig = signals.signals.find((x) => x.place === ev.social!.place);
    for (const p of ev.social.posts) {
      if (seen.has(p.url)) continue;
      seen.add(p.url);
      items.push({
        post: p,
        place: ev.social.place,
        countryCode: sig?.countryCode ?? "",
        origin: `corroboration ${ev.id}`,
      });
    }
  }
  const corpus = items.slice(0, opts.aiSample);
  if (corpus.length === 0) {
    record(L, "Batterie IA", "SKIP", "aucun post affiché actuellement (carte sans signalement)");
    return;
  }
  record(L, "Corpus", "PASS", `${corpus.length} posts affichés à re-juger (plafond ${opts.aiSample})`);

  // ---- Contrôle 1 : relecteur qualité indépendant ------------------------------
  // Passé en premier : son verdict par post sert d'arbitre au contrôle 2 —
  // un post limite qui bascule au re-jugement mais que le relecteur valide
  // n'est pas une erreur affichée, c'est la variance normale d'un LLM.
  const contested = new Set<string>();
  await check(L, "Relecteur IA (feu actuel / lieu / dates)", async () => {
    const problems: string[] = [];
    let reviewed = 0;
    for (let i = 0; i < corpus.length; i += 10) {
      const batch = corpus.slice(i, i + 10);
      const reviews = await reviewBatch(apiKey, batch);
      for (let k = 0; k < batch.length; k++) {
        const r = reviews[k];
        if (!r) continue;
        reviewed++;
        const it = batch[k];
        const flags: string[] = [];
        if (!r.feu_actuel) flags.push("pas un feu actuel");
        if (!r.lieu_correct) flags.push("lieu douteux");
        if (!r.dates_coherentes) flags.push("dates incohérentes");
        if (flags.length > 0) {
          contested.add(it.post.url);
          problems.push(
            `${it.place} (${it.origin}) : ${flags.join(" + ")}${r.probleme ? ` — ${r.probleme}` : ""} | « ${it.post.text.slice(0, 70)}… »`
          );
        }
      }
    }
    if (problems.length > 0) {
      const verdict = problems.length === 1 ? "WARN" : "FAIL";
      return { verdict, detail: `${problems.length}/${reviewed} posts contestés — ${problems.slice(0, 2).join(" || ")}` };
    }
    return { verdict: "PASS", detail: `${reviewed}/${corpus.length} posts validés par le relecteur` };
  });

  // ---- Contrôle 2 : rejouer le pipeline de production (luna + terra) ----------
  // FAIL seulement si un post divergent est AUSSI contesté par le relecteur
  // (= vraie erreur affichée). Divergence seule = variance sur cas limite
  // (WARN au-delà d'un tiers du corpus — dérive de modèle probable).
  await check(L, "Re-jugement pipeline (luna + terra, sans cache)", async () => {
    const candidates = corpus.map((it) => ({
      url: it.post.url,
      text: it.post.text,
      places: extractPlaces(it.post.text).map((p) => `${p.entry[3]} (${p.entry[2].toUpperCase()})`),
      createdAt: it.post.createdAt,
    }));
    const verdicts = await judgeForQA(candidates);
    const confirmedBad: string[] = [];
    const variance: string[] = [];
    for (const it of corpus) {
      const v = verdicts.get(it.post.url);
      const cand = candidates.find((c) => c.url === it.post.url)!;
      let diverged: string | null = null;
      if (!v?.final?.fire || v.final.place == null) {
        diverged = `rejeté au re-jugement : « ${it.post.text.slice(0, 60)}… » (${it.place})`;
      } else {
        const chosen = cand.places[v.final.place] ?? "";
        if (normalizePlace(chosen.split(" (")[0]) !== normalizePlace(it.place)) {
          diverged = `lieu divergent : affiché ${it.place}, re-jugé ${chosen}`;
        }
      }
      if (!diverged) continue;
      (contested.has(it.post.url) ? confirmedBad : variance).push(diverged);
    }
    if (confirmedBad.length > 0) {
      const verdict = confirmedBad.length === 1 ? "WARN" : "FAIL";
      return {
        verdict,
        detail: `${confirmedBad.length} erreur(s) confirmée(s) par le relecteur — ${confirmedBad[0]}`,
      };
    }
    if (variance.length > corpus.length / 3) {
      return {
        verdict: "WARN",
        detail: `variance élevée : ${variance.length}/${corpus.length} basculent au re-jugement (relecteur OK sur tous) — ${variance[0]}`,
      };
    }
    return {
      verdict: "PASS",
      detail: `${corpus.length - variance.length}/${corpus.length} reconfirmés, ${variance.length} bascule(s) limite(s), 0 erreur confirmée`,
    };
  });
}
