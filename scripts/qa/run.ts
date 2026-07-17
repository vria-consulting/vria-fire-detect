// Programme de QA Kanari — à lancer avant chaque commit :
//   npm run qa            (audite la production)
//   npm run qa:local      (audite le serveur de dev sur :3100)
//   npx tsx --env-file=.env.local scripts/qa/run.ts --target=<url> --ai-sample=30
//
// 4 niveaux :
//   1. Connecteurs   — chaque API source testée directement (FIRMS, MTG,
//                      Bluesky, GDELT, Telegram, OpenAI, Open-Meteo, cron).
//   2. API           — chaque endpoint + invariants champ par champ.
//   3. Croisement    — retour au CSV FIRMS brut pour un échantillon de foyers
//                      (position, 1er/dernier signal, FRP), distance des
//                      corroborations, fraîcheur (le cron tourne).
//   4. Pertinence IA — chaque post affiché est re-jugé par le pipeline
//                      (luna + terra) puis par un relecteur IA indépendant
//                      (feu actuel ? bon lieu ? dates cohérentes ?).
//
// Sortie : code 1 si au moins un FAIL — utilisable en hook pre-commit.

import { parseOptions, summary, getResults } from "./util";
import { runUnit } from "./unit";
import { runConnectors } from "./connectors";
import { runEndpoints } from "./endpoints";
import { runCrosscheck } from "./crosscheck";
import { runAi } from "./ai";
import { runRetro } from "./retro";

async function main() {
  const opts = parseOptions();
  console.log(`\n🐤 QA Kanari — cible : ${opts.target}`);
  console.log(`   échantillons : ${opts.eventSample} foyers vs FIRMS brut · ${opts.aiSample} posts max en IA\n`);

  console.log("── Niveau 0 · Tests unitaires (bugs passés) ───");
  await runUnit();

  console.log("\n── Niveau 1 · Connecteurs ─────────────────────");
  await runConnectors(opts);

  console.log("\n── Niveau 2 · API & invariants ────────────────");
  await runEndpoints(opts);

  console.log("\n── Niveau 3 · Croisement avec les sources ─────");
  await runCrosscheck(opts);

  console.log("\n── Niveau 4 · Pertinence IA ───────────────────");
  await runAi(opts);

  const code = summary();
  // La rétrospective n'influence pas le code de sortie : elle nourrit
  // l'amélioration continue du programme lui-même.
  await runRetro(opts, getResults());
  process.exit(code);
}

main().catch((e) => {
  console.error("QA interrompue :", e);
  process.exit(1);
});
