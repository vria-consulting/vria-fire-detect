// Niveau 1 — CONNECTEURS : chaque source de données de Kanari est testée
// directement (comme un opérateur qui vérifie ses instruments un par un).
//   FIRMS (VIIRS N20/N21 + GOES), EUMETSAT MTG, Bluesky, GDELT, Telegram
//   (worker GitHub Actions + endpoint d'ingestion), OpenAI, Open-Meteo.

import { execFileSync } from "node:child_process";
import { check, fetchT, type QaOptions } from "./util";
import { getEvents, getSignals } from "./endpoints";

const L = "1-connecteurs";

export async function runConnectors(opts: QaOptions): Promise<void> {
  const firmsKey = process.env.FIRMS_MAP_KEY;

  // ---- NASA FIRMS : disponibilité des données par source -------------------
  await check(L, "FIRMS disponibilité des sources", async () => {
    if (!firmsKey) return { verdict: "SKIP", detail: "FIRMS_MAP_KEY absente de l'env" };
    const res = await fetchT(
      `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${firmsKey}/ALL`,
      20_000
    );
    const text = await res.text();
    if (!res.ok || text.startsWith("Invalid")) {
      return { verdict: "FAIL", detail: `réponse FIRMS : ${text.slice(0, 80)}` };
    }
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const problems: string[] = [];
    for (const src of ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "GOES_NRT"]) {
      const line = text.split("\n").find((l) => l.startsWith(src));
      if (!line) {
        problems.push(`${src} absent`);
        continue;
      }
      const maxDate = line.trim().split(",")[2];
      if (maxDate < yesterday) problems.push(`${src} arrêté depuis ${maxDate}`);
      else if (maxDate < today) problems.push(`${src} en retard (max ${maxDate})`);
    }
    if (problems.some((p) => p.includes("arrêté") || p.includes("absent"))) {
      return { verdict: "FAIL", detail: problems.join(" ; ") };
    }
    if (problems.length > 0) {
      return {
        verdict: "WARN",
        detail: `${problems.join(" ; ")} — retard de publication NASA (couvert par le fetch J-1)`,
      };
    }
    return { verdict: "PASS", detail: "VIIRS N20/N21 + GOES publient pour aujourd'hui" };
  });

  // ---- FIRMS : volume réel de détections -----------------------------------
  await check(L, "FIRMS volume mondial (2 jours)", async () => {
    if (!firmsKey) return { verdict: "SKIP", detail: "FIRMS_MAP_KEY absente" };
    const res = await fetchT(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/VIIRS_NOAA20_NRT/world/2`,
      90_000
    );
    const text = await res.text();
    const rows = text.trim().split("\n").length - 1;
    if (!res.ok || text.startsWith("Invalid")) return { verdict: "FAIL", detail: text.slice(0, 80) };
    if (rows < 1_000) {
      return { verdict: "FAIL", detail: `${rows} lignes VIIRS N20 sur 2 jours (attendu : dizaines de milliers)` };
    }
    return { verdict: "PASS", detail: `${rows.toLocaleString("fr-FR")} détections VIIRS N20 / 2 j` };
  });

  // ---- EUMETSAT MTG ---------------------------------------------------------
  await check(L, "Meteosat MTG (EUMETSAT)", async () => {
    const ck = process.env.EUMETSAT_CONSUMER_KEY;
    const cs = process.env.EUMETSAT_CONSUMER_SECRET;
    if (ck && cs) {
      const tok = await fetchT("https://api.eumetsat.int/token", 20_000, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${ck}:${cs}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (!tok.ok) return { verdict: "FAIL", detail: `token EUMETSAT HTTP ${tok.status}` };
      const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
      const search = await fetchT(
        `https://api.eumetsat.int/data/search-products/1.0.0/os?format=json&pi=EO%3AEUM%3ADAT%3A0801&dtstart=${encodeURIComponent(since)}&c=5`,
        20_000
      );
      const j = (await search.json()) as { totalResults?: number };
      if (!search.ok || !j.totalResults) {
        return { verdict: "FAIL", detail: `recherche MTG : ${search.status}, ${j.totalResults ?? 0} produit` };
      }
      return { verdict: "PASS", detail: `${j.totalResults} produits CAP publiés sur 2 h` };
    }
    // Sans clés locales : on infère depuis l'app auditée.
    const data = await getEvents(opts.target, 6);
    const mtg = data.events.reduce((s, e) => s + (e.mtgCount ?? 0), 0);
    if (mtg === 0) {
      return { verdict: "FAIL", detail: "0 détection MTG sur 6 h (le géostationnaire Europe/Afrique doit produire en continu)" };
    }
    return { verdict: "PASS", detail: `${mtg} détections MTG sur 6 h (via l'app)` };
  });

  // ---- Bluesky ---------------------------------------------------------------
  await check(L, "Bluesky recherche", async () => {
    if (!process.env.BSKY_IDENTIFIER || !process.env.BSKY_APP_PASSWORD) {
      // Sans identifiants : vérifier via les statuts exposés par l'app.
      const j = await getSignals(opts.target);
      const bad = j.meta.statuses.filter((s) => s >= 400 || s === 0);
      if (bad.length > 0) return { verdict: "FAIL", detail: `${bad.length}/16 requêtes en échec (${bad.join(",")})` };
      return { verdict: "PASS", detail: "16/16 requêtes de veille en 200 (via l'app)" };
    }
    const { searchPosts } = await import("../../src/lib/bsky");
    const { posts, status } = await searchPosts('"incendie"', 5);
    if (status !== 200) return { verdict: "FAIL", detail: `HTTP ${status}` };
    if (posts.length === 0) return { verdict: "WARN", detail: "0 post pour « incendie » (rare)" };
    return { verdict: "PASS", detail: `${posts.length} posts récents trouvés` };
  });

  // ---- GDELT (presse) --------------------------------------------------------
  await check(L, "GDELT presse", async () => {
    let res: Response;
    try {
      res = await fetchT(
        "https://api.gdeltproject.org/api/v2/doc/doc?query=wildfire&mode=artlist&maxrecords=5&format=json&timespan=6h",
        20_000,
        { headers: { "User-Agent": "kanari-qa/1.0" } }
      );
    } catch (e) {
      // GDELT limite à 1 req/5 s PAR IP et coupe brutalement : un échec réseau
      // du poste de QA n'est pas une panne de l'app (retry + cache Blob côté
      // serveur) — on avertit sans bloquer le commit.
      return { verdict: "WARN", detail: `GDELT injoignable depuis ce poste (${(e as Error).message})` };
    }
    const text = await res.text();
    if (text.includes("limit requests")) {
      return { verdict: "WARN", detail: "rate limit GDELT (1 req/5 s par IP) — l'app a un retry + cache Blob" };
    }
    try {
      const j = JSON.parse(text) as { articles?: unknown[] };
      if ((j.articles?.length ?? 0) === 0) return { verdict: "WARN", detail: "0 article wildfire sur 6 h" };
      return { verdict: "PASS", detail: `${j.articles!.length} articles récents` };
    } catch {
      return { verdict: "FAIL", detail: `réponse GDELT illisible : ${text.slice(0, 60)}` };
    }
  });

  // ---- Telegram : worker GitHub Actions + endpoint d'ingestion ---------------
  await check(L, "Telegram worker (GitHub Actions)", async () => {
    try {
      const out = execFileSync(
        "gh",
        ["run", "list", "--workflow=telegram-scan.yml", "--limit", "3", "--json", "status,conclusion,updatedAt"],
        { encoding: "utf8", timeout: 30_000 }
      );
      const runs = JSON.parse(out) as { status: string; conclusion: string; updatedAt: string }[];
      // Un run peut être EN COURS au moment de la QA : on juge le dernier
      // run TERMINÉ (bug détecté par l'analyste IA de la rétrospective).
      const r = runs.find((x) => x.status === "completed");
      if (!r) return { verdict: "WARN", detail: "aucun run terminé (exécution en cours)" };
      const ageH = (Date.now() - Date.parse(r.updatedAt)) / 3_600_000;
      if (r.conclusion !== "success") return { verdict: "FAIL", detail: `dernier run terminé : ${r.conclusion}` };
      if (ageH > 3) return { verdict: "FAIL", detail: `dernier run il y a ${ageH.toFixed(1)} h` };
      if (ageH > 0.5) {
        return { verdict: "WARN", detail: `dernier run il y a ${Math.round(ageH * 60)} min (planning GitHub qui dérive, fenêtre de scan 2 h = couvert)` };
      }
      return { verdict: "PASS", detail: `dernier run success il y a ${Math.round(ageH * 60)} min` };
    } catch {
      return { verdict: "SKIP", detail: "CLI gh indisponible" };
    }
  });

  await check(L, "Telegram endpoint d'ingestion protégé", async () => {
    const res = await fetchT(`${opts.target}/api/ingest/telegram`, 20_000, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (res.status === 403) return { verdict: "PASS", detail: "refus sans secret (403)" };
    return { verdict: "FAIL", detail: `attendu 403 sans secret, reçu ${res.status}` };
  });

  // ---- OpenAI (juge de pertinence) -------------------------------------------
  await check(L, "OpenAI triage (clé + jugement témoin)", async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return {
        verdict: "SKIP",
        detail: "OPENAI_API_KEY absente de .env.local — ajoutez-la pour activer la batterie IA",
      };
    }
    const { judgeForQA } = await import("../../src/lib/triage");
    const witness = [
      {
        url: "qa://temoin-faux",
        text: "J'adore ce film, la scène finale est on fire ! Quel jeu d'acteur.",
        places: ["Paris (FR)"],
        createdAt: new Date().toISOString(),
      },
    ];
    const verdicts = await judgeForQA(witness);
    const v = verdicts.get("qa://temoin-faux");
    if (!v?.first) return { verdict: "FAIL", detail: "aucun verdict retourné (clé invalide ?)" };
    if (v.final?.fire) return { verdict: "FAIL", detail: "le juge a validé une métaphore évidente" };
    return { verdict: "PASS", detail: "jugement témoin correct (métaphore rejetée)" };
  });

  // ---- Open-Meteo (vent) -------------------------------------------------------
  await check(L, "Open-Meteo vent (via l'app)", async () => {
    const res = await fetchT(`${opts.target}/api/wind?lat=43.3&lon=5.4`, 20_000);
    if (!res.ok) return { verdict: "FAIL", detail: `HTTP ${res.status}` };
    const j = (await res.json()) as { speed?: number };
    if (typeof j.speed !== "number") return { verdict: "FAIL", detail: "réponse sans vitesse de vent" };
    return { verdict: "PASS", detail: `vent Marseille : ${j.speed} km/h` };
  });

  // ---- cron-job.org (cron primaire, toutes les 3 min) --------------------------
  await check(L, "Cron primaire (cron-job.org)", async () => {
    const key = process.env.CRONJOB_API_KEY;
    if (!key) return { verdict: "SKIP", detail: "CRONJOB_API_KEY absente — vérification du cron via la fraîcheur des données (niveau 3)" };
    const res = await fetchT("https://api.cron-job.org/jobs/8104751/history", 20_000, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { verdict: "FAIL", detail: `API cron-job.org HTTP ${res.status}` };
    const j = (await res.json()) as { history?: { date: string | number; httpStatus: number }[] };
    const hist = j.history ?? [];
    if (hist.length === 0) return { verdict: "FAIL", detail: "aucune exécution dans l'historique" };
    // L'API renvoie un timestamp unix (secondes), pas une chaîne ISO — un
    // Date.parse produisait « NaN min » et laissait passer un cron mort
    // (bug détecté par l'analyste IA de la rétrospective). On juge sur les
    // dernières exécutions : un HTTP 0 isolé arrive pendant un déploiement
    // (démarrage à froid > 30 s = timeout cron-job.org) et s'auto-répare.
    const toMs = (d: string | number) => (typeof d === "number" ? d * 1000 : Date.parse(d));
    const recent = hist.slice(0, 5).map((h) => ({ ts: toMs(h.date), status: h.httpStatus }));
    if (recent.some((r) => !isFinite(r.ts))) {
      return { verdict: "FAIL", detail: "horodatages illisibles dans l'historique" };
    }
    const okRecent = recent.find((r) => r.status === 200 && Date.now() - r.ts < 10 * 60_000);
    const failures = recent.filter((r) => r.status !== 200).length;
    if (!okRecent) {
      return { verdict: "FAIL", detail: `aucune exécution 200 sur les 10 dernières minutes (statuts : ${recent.map((r) => r.status).join(",")})` };
    }
    if (recent[0].status !== 200 || failures > 0) {
      return {
        verdict: "WARN",
        detail: `succès il y a ${Math.round((Date.now() - okRecent.ts) / 60_000)} min mais ${failures}/5 exécutions en échec (déploiement ou lenteur à froid probable)`,
      };
    }
    return { verdict: "PASS", detail: `5/5 exécutions récentes en 200, dernière il y a ${Math.round((Date.now() - recent[0].ts) / 60_000)} min` };
  });
}
