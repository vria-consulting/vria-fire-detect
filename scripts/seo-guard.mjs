#!/usr/bin/env node
// Garde SEO : vérifie sur un serveur (préview locale en CI, ou prod) que les
// pages vitales servent leurs balises de référencement. Une noindex qui
// fuite, un canonical cassé ou un JSON-LD disparu coûte des semaines de
// rankings en silence — ce script fait échouer la CI avant.
//
// Usage : node scripts/seo-guard.mjs http://localhost:3111

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");

// Contrats par page : tout est structurel (présence de balises), jamais des
// valeurs de données live — le serveur CI tourne sans Supabase et les pages
// doivent se dégrader proprement.
const PAGES = [
  {
    path: "/fr",
    title: /kanari/i,
    noindexForbidden: true,
  },
  {
    path: "/es",
    title: /Mapa de incendios forestales/i,
  },
  {
    path: "/pt",
    title: /incêndios florestais/i,
  },
  {
    path: "/fr/statistiques",
    title: /Statistiques des feux/i,
    canonical: "/fr/statistiques",
    hreflang: ["fr", "en"],
    jsonld: ["FAQPage", "Dataset"],
  },
  {
    path: "/en/statistiques",
    title: /Wildfire statistics/i,
    canonical: "/en/statistiques",
    hreflang: ["fr", "en"],
    jsonld: ["FAQPage", "Dataset"],
  },
  {
    path: "/fr/canadair",
    title: /Canadair/i,
    canonical: "/fr/canadair",
    hreflang: ["fr", "en"],
    jsonld: ["FAQPage"],
  },
  {
    path: "/en/canadair",
    title: /water bomber/i,
    canonical: "/en/canadair",
    jsonld: ["FAQPage"],
  },
  {
    path: "/fr/comparatif",
    title: /Quelle carte des feux/i,
    canonical: "/fr/comparatif",
    hreflang: ["fr", "en"],
    jsonld: ["FAQPage"],
    contains: ["Watch Duty"],
  },
  {
    path: "/en/comparatif",
    title: /Best wildfire map/i,
    canonical: "/en/comparatif",
    jsonld: ["FAQPage"],
  },
  {
    path: "/fr/guide",
    title: /Guides feux de forêt/i,
    canonical: "/fr/guide",
    hreflang: ["fr", "en"],
  },
  {
    path: "/en/guide",
    title: /Wildfire guides/i,
    canonical: "/en/guide",
  },
  {
    path: "/fr/guide/odeur-de-fumee-que-faire",
    title: /Odeur de fumée/i,
    canonical: "/fr/guide/odeur-de-fumee-que-faire",
    hreflang: ["fr", "en"],
    jsonld: ["Article", "FAQPage"],
    contains: ["og:image"],
  },
  {
    path: "/en/guide/detection-feux-satellite",
    title: /Wildfire detection from space/i,
    canonical: "/en/guide/detection-feux-satellite",
    jsonld: ["Article", "FAQPage"],
  },
  {
    path: "/fr/feux-en-cours",
    title: /Incendies en cours/i,
    jsonld: ["FAQPage"],
  },
  {
    path: "/fr/confidentialite",
    title: /Confidentialité/i,
  },
];

const STATIC_CHECKS = [
  { path: "/ads.txt", contains: ["pub-9521453937448688"] },
  { path: "/robots.txt", contains: ["Sitemap"], forbidden: [/^Disallow:\s*\/\s*$/m] },
  {
    path: "/sitemap.xml",
    contains: ["/fr/statistiques", "/en/guide/", "/fr/comparatif", "/fr/canadair"],
  },
];

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const ko = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures.push(msg);
};

async function get(path) {
  const res = await fetch(BASE + path, {
    redirect: "follow",
    headers: { "user-agent": "kanari-seo-guard" },
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  return { status: res.status, body };
}

function jsonldTypes(html) {
  const types = new Set();
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const doc = JSON.parse(m[1]);
      const collect = (node) => {
        if (!node || typeof node !== "object") return;
        if (typeof node["@type"] === "string") types.add(node["@type"]);
        for (const v of Object.values(node)) {
          if (Array.isArray(v)) v.forEach(collect);
          else if (typeof v === "object") collect(v);
        }
      };
      collect(doc);
    } catch {
      types.add("__INVALID_JSON__");
    }
  }
  return types;
}

for (const p of PAGES) {
  console.log(`\n${p.path}`);
  let r;
  try {
    r = await get(p.path);
  } catch (e) {
    ko(`inaccessible: ${e.message}`);
    continue;
  }
  if (r.status !== 200) {
    ko(`HTTP ${r.status} (attendu 200)`);
    continue;
  }
  ok("HTTP 200");

  const titleMatch = r.body.match(/<title>([^<]*)<\/title>/);
  if (p.title) {
    if (titleMatch && p.title.test(titleMatch[1])) ok(`title « ${titleMatch[1].slice(0, 60)} »`);
    else ko(`title absent ou inattendu (${titleMatch ? titleMatch[1].slice(0, 80) : "aucun"})`);
  }

  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(r.body) || /<meta[^>]+noindex[^>]+name="robots"/i.test(r.body)) {
    ko("balise noindex détectée !");
  } else ok("pas de noindex");

  if (p.canonical) {
    const re = new RegExp(`<link rel="canonical" href="[^"]*${p.canonical.replace(/\//g, "\\/")}"`);
    if (re.test(r.body)) ok(`canonical ${p.canonical}`);
    else ko(`canonical ${p.canonical} manquant`);
  }

  for (const hl of p.hreflang ?? []) {
    const re = new RegExp(`hrefLang="${hl}"`, "i");
    if (re.test(r.body)) ok(`hreflang ${hl}`);
    else ko(`hreflang ${hl} manquant`);
  }

  if (p.jsonld) {
    const types = jsonldTypes(r.body);
    if (types.has("__INVALID_JSON__")) ko("un bloc JSON-LD ne parse pas");
    for (const t of p.jsonld) {
      if (types.has(t)) ok(`JSON-LD ${t}`);
      else ko(`JSON-LD ${t} manquant (présents : ${[...types].join(", ") || "aucun"})`);
    }
  }

  for (const s of p.contains ?? []) {
    if (r.body.includes(s)) ok(`contient « ${s} »`);
    else ko(`« ${s} » manquant`);
  }
}

for (const c of STATIC_CHECKS) {
  console.log(`\n${c.path}`);
  let r;
  try {
    r = await get(c.path);
  } catch (e) {
    ko(`inaccessible: ${e.message}`);
    continue;
  }
  if (r.status !== 200) {
    ko(`HTTP ${r.status}`);
    continue;
  }
  ok("HTTP 200");
  for (const s of c.contains ?? []) {
    if (r.body.includes(s)) ok(`contient « ${s} »`);
    else ko(`« ${s} » manquant`);
  }
  for (const re of c.forbidden ?? []) {
    if (re.test(r.body)) ko(`motif interdit trouvé : ${re}`);
    else ok(`pas de ${re}`);
  }
}

console.log(
  failures.length === 0
    ? `\n✅ Garde SEO : ${PAGES.length + STATIC_CHECKS.length} cibles vérifiées, aucun problème.`
    : `\n❌ Garde SEO : ${failures.length} problème(s).`
);
process.exit(failures.length === 0 ? 0 : 1);
