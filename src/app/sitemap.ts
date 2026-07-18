import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kanari.io";
  const langs = { fr: `${base}/fr`, en: `${base}/en` };
  return [
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
  ];
}
