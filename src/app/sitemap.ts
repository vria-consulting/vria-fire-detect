import type { MetadataRoute } from "next";
import { DEPARTEMENTS } from "@/lib/departements";
import { GUIDES } from "@/lib/guides";
import { COUNTRIES } from "@/lib/countries";
import { FRENCH_FLEET } from "@/lib/aircraft";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kanari.io";
  const langs = { fr: `${base}/fr`, en: `${base}/en` };
  // Pages locales « feux par département » (contenu FR, URL canonique unique).
  const deptPages: MetadataRoute.Sitemap = DEPARTEMENTS.map((d) => ({
    url: `${base}/fr/feux/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));
  const guidePages: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${base}/fr/guide/${g.slug}`,
    lastModified: new Date(g.updated),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const countryPages: MetadataRoute.Sitemap = COUNTRIES.map((c) => ({
    url: `${base}/en/fires/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.7,
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
    },
    ...countryPages,
    ...aircraftPages,
    {
      url: `${base}/fr/widget`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
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
    },
    {
      url: `${base}/fr/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
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
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair` } },
    },
    {
      url: `${base}/en/canadair`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/canadair`, en: `${base}/en/canadair` } },
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
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq` } },
    },
    {
      url: `${base}/en/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { fr: `${base}/fr/faq`, en: `${base}/en/faq` } },
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
