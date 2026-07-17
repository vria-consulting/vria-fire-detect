// RÉTROSPECTIVE — le programme de QA s'audite lui-même après chaque passage :
//   1. régressions / réparations par rapport au run précédent ;
//   2. tests instables (verdict qui oscille sans changement de code) ;
//   3. tests aveugles (SKIP permanent, ou PASS sans rien avoir couvert) ;
//   4. trous de couverture (surfaces de l'app sans aucune vérification) ;
//   5. si OPENAI_API_KEY est présente : un analyste IA lit le bilan et propose
//      des tests à ajouter et les risques applicatifs prioritaires.
// Le tout est imprimé ET archivé dans scripts/qa/history/retro.md pour que
// chaque amélioration reste tracée d'un passage à l'autre.

import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, QaOptions } from "./util";
import { appendRun, loadRuns, stableName } from "./history";

// Cartographie des surfaces de l'application : chaque surface doit être
// touchée par au moins une vérification (rapprochement par sous-chaîne).
const SURFACES: { surface: string; match: RegExp }[] = [
  { surface: "route /api/events", match: /api\/events|events\?hours|Foyer|Monotonie/ },
  { surface: "route /api/signals", match: /signals|veille sociale|Signalement/i },
  { surface: "route /api/wind", match: /vent/i },
  { surface: "route /api/social (recherche témoins)", match: /api\/social|témoins/i },
  { surface: "route /api/subscribe (alertes push)", match: /subscribe/i },
  { surface: "route /api/cron/check", match: /cron/i },
  { surface: "route /api/ingest/telegram", match: /ingestion/i },
  { surface: "pages / et /a-propos", match: /Page/ },
  { surface: "PWA (manifest, icônes, service worker)", match: /Manifest/i },
  { surface: "lib geoparse (gazetteer)", match: /Géoparsing|lieu-dans-texte/i },
  { surface: "lib cluster", match: /Clustering/i },
  { surface: "lib eventscache (couverture FIRMS)", match: /daysNeeded|Fraîcheur des foyers/i },
  { surface: "lib triage (juge IA)", match: /OpenAI|luna|Relecteur/i },
  { surface: "connecteur FIRMS", match: /FIRMS/ },
  { surface: "connecteur MTG", match: /MTG/ },
  { surface: "connecteur Bluesky", match: /Bluesky/ },
  { surface: "connecteur GDELT", match: /GDELT/ },
  { surface: "connecteur Telegram", match: /Telegram/ },
  { surface: "cron primaire + fraîcheur", match: /Cron|Fraîcheur/i },
  { surface: "corroboration foyers ↔ signalements", match: /corroboration/i },
];

function key(r: CheckResult): string {
  return `${r.level}|${stableName(r.name)}`;
}

// Agrège les familles dynamiques : la pire issue l'emporte.
function aggregate(results: CheckResult[]): Map<string, CheckResult> {
  const rank = { FAIL: 3, WARN: 2, PASS: 1, SKIP: 0 } as const;
  const out = new Map<string, CheckResult>();
  for (const r of results) {
    const k = key(r);
    const prev = out.get(k);
    if (!prev || rank[r.verdict] > rank[prev.verdict]) {
      out.set(k, { ...r, name: stableName(r.name) });
    }
  }
  return out;
}

export async function runRetro(opts: QaOptions, results: CheckResult[]): Promise<void> {
  console.log("\n── Rétrospective (le programme s'audite) ──────");
  const previous = loadRuns(opts.target, 6);
  appendRun(opts.target, results);

  const lines: string[] = [];
  const say = (s: string) => {
    console.log(s);
    lines.push(s);
  };

  const current = aggregate(results);

  // 1. Comparaison avec le run précédent -------------------------------------
  const prevRun = previous[previous.length - 1];
  if (!prevRun) {
    say("• Premier run archivé pour cette cible — les comparaisons commencent au prochain passage.");
  } else {
    const prev = aggregate(prevRun.results);
    const regressions = [...current.values()].filter(
      (r) => r.verdict === "FAIL" && prev.get(key(r)) && prev.get(key(r))!.verdict !== "FAIL"
    );
    const fixed = [...prev.values()].filter(
      (r) => r.verdict === "FAIL" && current.get(key(r)) && current.get(key(r))!.verdict !== "FAIL"
    );
    const news = [...current.keys()].filter((k) => !prev.has(k));
    if (regressions.length > 0) {
      say(`• 🔴 RÉGRESSIONS depuis le run précédent (${prevRun.at.slice(0, 16)}) :`);
      for (const r of regressions) say(`    - ${r.name} — ${r.detail}`);
    } else {
      say("• Aucune régression par rapport au run précédent.");
    }
    for (const r of fixed) say(`• 🟢 Réparé depuis le run précédent : ${r.name}`);
    if (news.length > 0) say(`• ${news.length} vérification(s) nouvelle(s) : ${news.map((k) => k.split("|")[1]).join(" · ")}`);
  }

  // 2. Tests instables (flaky) -------------------------------------------------
  if (previous.length >= 2) {
    const flaky: string[] = [];
    for (const k of current.keys()) {
      const verdicts = new Set(
        [...previous, { at: "", target: "", results }].map(
          (run) => aggregate(run.results).get(k)?.verdict ?? "—"
        )
      );
      verdicts.delete("—");
      if (verdicts.has("PASS") && verdicts.has("FAIL")) flaky.push(k.split("|")[1]);
    }
    if (flaky.length > 0) {
      say(`• ⚠️ Verdicts variables sur les ${previous.length + 1} derniers runs (bug corrigé entre-temps, ou test à fiabiliser/isoler du réseau) : ${flaky.join(" · ")}`);
    } else {
      say("• Aucun test instable détecté sur l'historique.");
    }
  }

  // 3. Tests aveugles -----------------------------------------------------------
  const chronicSkips = [...current.values()].filter((r) => {
    if (r.verdict !== "SKIP") return false;
    const always = previous.every((run) => aggregate(run.results).get(key(r))?.verdict === "SKIP");
    return previous.length >= 2 && always;
  });
  for (const r of chronicSkips) {
    say(`• 👁️ Test aveugle (SKIP à chaque run) : « ${r.name} » — ${r.detail}. Fournir la clé/condition ou le remplacer.`);
  }
  const vacuous = [...current.values()].filter(
    (r) => (r.verdict === "PASS" || r.verdict === "SKIP") && /aucun|0 signalement|0 post|vide/i.test(r.detail)
  );
  for (const r of vacuous) {
    say(`• 👁️ Couverture vide ce run : « ${r.name} » (${r.detail}) — le test n'a rien pu vérifier, à re-exécuter à un moment plus actif.`);
  }

  // 4. Trous de couverture ------------------------------------------------------
  const names = [...current.values()].map((r) => `${r.name} ${r.detail}`).join("\n");
  const holes = SURFACES.filter((s) => !s.match.test(names));
  if (holes.length > 0) {
    say(`• 🕳️ Surfaces sans vérification ce run : ${holes.map((h) => h.surface).join(" · ")}`);
  } else {
    say("• Toutes les surfaces cartographiées sont couvertes par au moins un test.");
  }

  // 5. Analyste IA (optionnel) --------------------------------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !opts.skipAi) {
    try {
      const digest = [...current.values()]
        .map((r) => `${r.verdict} [${r.level}] ${r.name} — ${r.detail}`)
        .join("\n");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.TRIAGE_VERIFY_MODEL ?? "gpt-5.6-terra",
          max_completion_tokens: 16000,
          messages: [
            {
              role: "system",
              content:
                "Tu es l'architecte QA de Kanari (détection précoce de feux : satellites FIRMS/MTG, veille sociale Bluesky/Telegram/GDELT triée par IA, alertes push, carte Next.js). On te donne le bilan d'un run de QA. Réponds en JSON strict : {\"risques_app\": [3 risques applicatifs les plus importants au vu du bilan], \"tests_a_ajouter\": [3 tests concrets qui manquent], \"tests_a_ameliorer\": [jusqu'à 3 tests existants peu discriminants et comment les durcir]}. Sois spécifique et actionnable, en français.",
            },
            { role: "user", content: digest },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices: { message: { content: string } }[] };
        const advice = JSON.parse(j.choices[0].message.content) as Record<string, string[]>;
        say("• 🤖 Analyste IA :");
        for (const [k, arr] of Object.entries(advice)) {
          for (const a of arr ?? []) say(`    [${k}] ${a}`);
        }
      } else {
        say(`• Analyste IA indisponible (HTTP ${res.status}).`);
      }
    } catch (e) {
      say(`• Analyste IA indisponible (${(e as Error).message}).`);
    }
  } else {
    say("• Analyste IA : SKIP (OPENAI_API_KEY absente) — les heuristiques ci-dessus restent actives.");
  }

  // Archivage de la rétrospective ------------------------------------------------
  const dir = join(process.cwd(), "scripts", "qa", "history");
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    join(dir, "retro.md"),
    `\n## ${new Date().toISOString()} — ${opts.target}\n\n${lines.map((l) => l.replace(/^•/, "-")).join("\n")}\n`
  );
}
