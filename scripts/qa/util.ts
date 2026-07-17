// Socle du programme de QA Kanari : registre de résultats, rapport console,
// helpers réseau. Chaque vérification produit PASS / FAIL / WARN / SKIP —
// le processus sort en code 1 dès qu'un FAIL existe (utilisable en pre-commit).

export type Verdict = "PASS" | "FAIL" | "WARN" | "SKIP";

export type CheckResult = {
  level: string; // "1-connecteurs" | "2-api" | "3-croisement" | "4-ia"
  name: string;
  verdict: Verdict;
  detail: string;
};

const results: CheckResult[] = [];

export function getResults(): CheckResult[] {
  return results;
}

export function record(level: string, name: string, verdict: Verdict, detail = ""): void {
  results.push({ level, name, verdict, detail });
  const icon =
    verdict === "PASS" ? "✅" : verdict === "FAIL" ? "❌" : verdict === "WARN" ? "⚠️ " : "⏭️ ";
  console.log(`${icon} [${level}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// Enveloppe une vérification : une exception imprévue = FAIL, jamais un crash
// du programme de QA entier.
export async function check(
  level: string,
  name: string,
  fn: () => Promise<{ verdict: Verdict; detail?: string }>
): Promise<void> {
  try {
    const { verdict, detail } = await fn();
    record(level, name, verdict, detail ?? "");
  } catch (e) {
    record(level, name, "FAIL", `exception : ${(e as Error).message}`);
  }
}

export function summary(): number {
  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  const fails = results.filter((r) => r.verdict === "FAIL");
  console.log("\n──────────────────────────────────────────────");
  console.log(
    `Bilan QA : ${count("PASS")} PASS · ${count("FAIL")} FAIL · ${count("WARN")} WARN · ${count("SKIP")} SKIP (${results.length} vérifications)`
  );
  if (fails.length > 0) {
    console.log("\nÉchecs à corriger avant commit :");
    for (const f of fails) console.log(`  ❌ [${f.level}] ${f.name} — ${f.detail}`);
  }
  console.log("──────────────────────────────────────────────");
  return fails.length > 0 ? 1 : 0;
}

// fetch avec délai maximal + un retry sur erreur réseau : la QA doit juger
// l'application, pas les aléas de la connexion locale.
export async function fetchT(url: string, ms: number, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ctl.signal });
    } catch (e) {
      if (attempt >= 1) throw e;
      await new Promise((r) => setTimeout(r, 2_000));
    } finally {
      clearTimeout(t);
    }
  }
}

export function hoursAgo(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 3_600_000;
}

export type QaOptions = {
  target: string; // URL de l'app à auditer (prod par défaut)
  aiSample: number; // plafond de posts jugés par IA (coût)
  skipAi: boolean;
  eventSample: number; // foyers contre-vérifiés vs API brutes
};

export function parseOptions(): QaOptions {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const target = args.includes("--local")
    ? "http://localhost:3100"
    : (get("target") ?? process.env.QA_TARGET ?? "https://vria-fire-detect.vercel.app");
  return {
    target: target.replace(/\/$/, ""),
    aiSample: parseInt(get("ai-sample") ?? "24", 10),
    skipAi: args.includes("--skip-ai"),
    eventSample: parseInt(get("event-sample") ?? "8", 10),
  };
}

// Types partagés (miroir minimal des réponses API).
export type QaEvent = {
  id: string;
  centroid: [number, number];
  count: number;
  viirsCount: number;
  goesCount: number;
  mtgCount: number;
  firstSeen: string;
  lastSeen: string;
  maxFrp: number;
  confidence?: "possible" | "probable" | "corrobore";
  social?: { place: string; postCount: number; posts: QaPost[]; firstPress?: string };
};

export type QaPost = {
  text: string;
  handle: string;
  createdAt: string;
  url: string;
  source: "bluesky" | "presse" | "telegram";
};

export type QaSignal = {
  place: string;
  countryCode: string;
  lat: number;
  lon: number;
  postCount: number;
  firstPost: string;
  lastPost: string;
  posts: QaPost[];
  newFire?: boolean;
};

export type EventsPayload = {
  events: QaEvent[];
  meta: { hours: number; fetchedAt: string; totalDetections: number };
};
export type SignalsPayload = {
  signals: QaSignal[];
  meta: { fetchedAt: string; scannedPosts: number; statuses: number[] };
};
