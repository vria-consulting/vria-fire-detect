import type { MetadataRoute } from "next";
import { DEPARTEMENTS } from "@/lib/departements";
import { GUIDES } from "@/lib/guides";
import { GUIDE_ES_BY_SLUG } from "@/lib/guides-es";
import { GUIDE_PT_BY_SLUG } from "@/lib/guides-pt";
import { COUNTRIES } from "@/lib/countries";
import { US_STATES } from "@/lib/us-states";
import { FRENCH_FLEET } from "@/lib/aircraft";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kanari.io";
  const langs = { fr: `${base}/fr`, en: `${base}/en`, es: `${base}/es`, pt: `${base}/pt` };
  // Pages locales « feux par département » (contenu FR, URL canonique unique).
  const deptPages: MetadataRoute.Sitemap = DEPARTEMENTS.map((d) => ({
    url: `${base}/fr/feux/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));
  const guidePages: MetadataRoute.Sitemap = GUIDES.flatMap((g) => {
    // es/pt : uniquement les guides réellement traduits (les autres slugs
    // servent l'anglais avec canonical /en — pas leur place dans le sitemap).
    const languages: Record<string, string> = {
      fr: `${base}/fr/guide/${g.slug}`,
      en: `${base}/en/guide/${g.slug}`,
    };
    if (GUIDE_ES_BY_SLUG.has(g.slug)) languages.es = `${base}/es/guide/${g.slug}`;
    if (GUIDE_PT_BY_SLUG.has(g.slug)) languages.pt = `${base}/pt/guide/${g.slug}`;
    const alternates = { languages };
    return [
      {
        url: `${base}/fr/guide/${g.slug}`,
        lastModified: new Date(g.updated),
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates,
      },
      {
        url: `${base}/en/guide/${g.slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates,
      },
      ...(languages.es
        ? [{
            url: languages.es,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.6,
            alternates,
          }]
        : []),
      ...(languages.pt
        ? [{
            url: languages.pt,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.6,
            alternates,
          }]
        : []),
    ];
  });
  // Pages pays en 3 langues (en/es/pt) avec hreflang croisé.
  const countryPages: MetadataRoute.Sitemap = COUNTRIES.flatMap((c) => {
    const alternates = {
      languages: {
        en: `${base}/en/fires/${c.slug}`,
        es: `${base}/es/fires/${c.slug}`,
        pt: `${base}/pt/fires/${c.slug}`,
      },
    };
    return (["en", "es", "pt"] as const).map((l) => ({
      url: `${base}/${l}/fires/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: l === "en" ? 0.7 : 0.65,
      alternates,
    }));
  });
  const firesHubAlt = {
    languages: { en: `${base}/en/fires`, es: `${base}/es/fires`, pt: `${base}/pt/fires` },
  };
  // 50 US states + DC : le plus gros marché de recherche feux au monde.
  const statePages: MetadataRoute.Sitemap = US_STATES.map((s) => ({
    url: `${base}/en/fires/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.75,
  }));
  const aircraftPages: MetadataRoute.Sitemap = Object.values(FRENCH_FLEET).map((a) => ({
    url: `${base}/fr/canadair/${a.reg.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
  return [
    {
      url: `${base}/en/fires`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: firesHubAlt,
    },
    {
      url: `${base}/es/fires`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.85,
      alternates: firesHubAlt,
    },
    {
      url: `${base}/pt/fires`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.85,
      alternates: firesHubAlt,
    },
    ...countryPages,
    ...statePages,
    ...aircraftPages,
    {
      url: `${base}/fr/widget`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/widget`, en: `${base}/en/widget`, es: `${base}/es/widget`, pt: `${base}/pt/widget` } },
    },
    {
      url: `${base}/en/widget`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/widget`, en: `${base}/en/widget`, es: `${base}/es/widget`, pt: `${base}/pt/widget` } },
    },
    {
      url: `${base}/es/widget`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/widget`, en: `${base}/en/widget`, es: `${base}/es/widget`, pt: `${base}/pt/widget` } },
    },
    {
      url: `${base}/pt/widget`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/widget`, en: `${base}/en/widget`, es: `${base}/es/widget`, pt: `${base}/pt/widget` } },
    },
    {
      url: `${base}/fr/bilan`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/fr/statistiques`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/statistiques`, en: `${base}/en/statistiques`, es: `${base}/es/statistiques`, pt: `${base}/pt/statistiques` } },
    },
    {
      url: `${base}/en/statistiques`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/statistiques`, en: `${base}/en/statistiques`, es: `${base}/es/statistiques`, pt: `${base}/pt/statistiques` } },
    },
    {
      url: `${base}/es/statistiques`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/statistiques`, en: `${base}/en/statistiques`, es: `${base}/es/statistiques`, pt: `${base}/pt/statistiques` } },
    },
    {
      url: `${base}/pt/statistiques`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/statistiques`, en: `${base}/en/statistiques`, es: `${base}/es/statistiques`, pt: `${base}/pt/statistiques` } },
    },
    {
      url: `${base}/fr/comparatif`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/comparatif`, en: `${base}/en/comparatif` } },
    },
    {
      url: `${base}/fr/confidentialite`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
      alternates: { languages: { fr: `${base}/fr/confidentialite`, en: `${base}/en/confidentialite` } },
    },
    {
      url: `${base}/en/comparatif`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/comparatif`, en: `${base}/en/comparatif` } },
    },
    {
      url: `${base}/fr/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/guide`, en: `${base}/en/guide`, es: `${base}/es/guide`, pt: `${base}/pt/guide` } },
    },
    {
      url: `${base}/en/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/guide`, en: `${base}/en/guide`, es: `${base}/es/guide`, pt: `${base}/pt/guide` } },
    },
    {
      url: `${base}/es/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/guide`, en: `${base}/en/guide`, es: `${base}/es/guide`, pt: `${base}/pt/guide` } },
    },
    {
      url: `${base}/pt/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/guide`, en: `${base}/en/guide`, es: `${base}/es/guide`, pt: `${base}/pt/guide` } },
    },
    ...guidePages,
    {
      url: `${base}/fr/feux`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/fr/feux-en-cours`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/fr/api`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/api`, en: `${base}/en/api` } },
    },
    {
      url: `${base}/fr/sdis`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...deptPages,
    {
      url: `${base}/fr/canadair`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair`, es: `${base}/es/canadair`, pt: `${base}/pt/canadair` } },
    },
    {
      url: `${base}/en/canadair`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair`, es: `${base}/es/canadair`, pt: `${base}/pt/canadair` } },
    },
    {
      url: `${base}/es/canadair`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair`, es: `${base}/es/canadair`, pt: `${base}/pt/canadair` } },
    },
    {
      url: `${base}/pt/canadair`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair`, es: `${base}/es/canadair`, pt: `${base}/pt/canadair` } },
    },
    {
      url: `${base}/fr`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
      alternates: { languages: langs },
    },
    {
      url: `${base}/en`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
      alternates: { languages: langs },
    },
    {
      url: `${base}/es`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: { languages: langs },
    },
    {
      url: `${base}/pt`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: { languages: langs },
    },
    {
      url: `${base}/fr/a-propos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/a-propos`, en: `${base}/en/a-propos` } },
    },
    {
      url: `${base}/en/a-propos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: { fr: `${base}/fr/a-propos`, en: `${base}/en/a-propos` } },
    },
    {
      url: `${base}/fr/precocite`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/precocite`, en: `${base}/en/precocite` } },
    },
    {
      url: `${base}/en/precocite`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/precocite`, en: `${base}/en/precocite` } },
    },
    {
      url: `${base}/fr/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq`, es: `${base}/es/faq`, pt: `${base}/pt/faq` } },
    },
    {
      url: `${base}/en/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq`, es: `${base}/es/faq`, pt: `${base}/pt/faq` } },
    },
    {
      url: `${base}/es/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq`, es: `${base}/es/faq`, pt: `${base}/pt/faq` } },
    },
    {
      url: `${base}/pt/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq`, es: `${base}/es/faq`, pt: `${base}/pt/faq` } },
    },
    {
      url: `${base}/fr/contribuer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/contribuer`, en: `${base}/en/contribuer` } },
    },
    {
      url: `${base}/en/contribuer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: { fr: `${base}/fr/contribuer`, en: `${base}/en/contribuer` } },
    },
  ];
}
