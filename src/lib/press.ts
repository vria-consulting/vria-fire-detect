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
    const res = await fetch(`${GDELT_URL}?${params}`, {
      headers: { "User-Agent": "VigiFire/0.1 (https://vria-fire-detect.vercel.app)" },
    });
    if (!res.ok) {
      // 429 fréquent (IP partagées) : on ressert le dernier résultat connu.
      return lastGood.articles;
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
    return articles;
  } catch (e) {
    console.error("GDELT fetch failed:", e);
    return lastGood.articles;
  }
}
