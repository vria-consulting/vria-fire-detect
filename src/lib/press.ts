// Veille presse mondiale via GDELT DOC 2.0 (gratuit, licence ouverte,
// rafraîchi toutes les 15 min, 65 langues). Un article local titrant sur un
// départ de feu est un excellent signal de corroboration — et GDELT géolocalise
// mal, donc on géoparse les titres nous-mêmes avec le gazetteer.
// Rate limit GDELT : 1 requête / 5 s par IP -> une seule requête par
// rafraîchissement + réutilisation du dernier résultat en cas de 429.

export type PressArticle = {
  title: string;
  url: string;
  domain: string;
  createdAt: string; // ISO
};

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

// Termes forts multilingues (mêmes langues que la veille Bluesky).
const QUERY =
  '(wildfire OR "forest fire" OR "brush fire" OR bushfire OR "feu de forêt" OR ' +
  '"incendio forestal" OR "incêndio florestal" OR Waldbrand OR "incendio boschivo" OR ' +
  '"orman yangını")';

let lastGood: { at: number; articles: PressArticle[] } = { at: 0, articles: [] };

const PRESS_CACHE_PATH = "press-cache.json";
// Le rate limit GDELT (1 req/5 s PAR IP) frappe fort depuis les IP partagées
// de Vercel : le dernier résultat réussi est donc persisté sur Blob pour que
// toutes les instances puissent le resservir.
async function fallbackFromBlob(): Promise<PressArticle[]> {
  if (lastGood.articles.length > 0) return lastGood.articles;
  try {
    const { readJson } = await import("./store");
    const cached = await readJson<{ at: number; articles: PressArticle[] }>(
      PRESS_CACHE_PATH,
      { at: 0, articles: [] }
    );
    // On ne ressert pas des articles de plus de 6 h.
    if (Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.articles;
  } catch {
    /* pas de Blob en local sans token : tant pis */
  }
  return [];
}

export async function fetchPressArticles(sinceHours = 3): Promise<PressArticle[]> {
  try {
    const params = new URLSearchParams({
      query: QUERY,
      mode: "artlist",
      format: "json",
      timespan: `${sinceHours}h`,
      maxrecords: "250",
      sort: "datedesc",
    });
    const url = `${GDELT_URL}?${params}`;
    const headers = {
      "User-Agent": "VigiFire/0.1 (https://vria-fire-detect.vercel.app)",
    };
    let res = await fetch(url, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 6500));
      res = await fetch(url, { headers });
    }
    if (!res.ok) {
      return fallbackFromBlob();
    }
    const j = await res.json();
    type Art = { title?: string; url?: string; domain?: string; seendate?: string };
    const seen = new Set<string>();
    const articles: PressArticle[] = [];
    for (const a of (j.articles ?? []) as Art[]) {
      if (!a.title || !a.url || !a.seendate || seen.has(a.url)) continue;
      seen.add(a.url);
      // seendate format : 20260716T093000Z
      const s = a.seendate;
      const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
      articles.push({ title: a.title, url: a.url, domain: a.domain ?? "presse", createdAt: iso });
    }
    lastGood = { at: Date.now(), articles };
    try {
      const { writeJson } = await import("./store");
      await writeJson(PRESS_CACHE_PATH, lastGood);
    } catch {
      /* Blob indisponible : le cache mémoire suffit */
    }
    return articles;
  } catch (e) {
    console.error("GDELT fetch failed:", e);
    return fallbackFromBlob();
  }
}
