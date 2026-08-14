import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { GUIDES } from "@/lib/guides";
import { GUIDES_EN } from "@/lib/guides-en";

const T = {
  fr: {
    metaTitle: "Guides feux de forêt : réflexes, Canadair, satellites, risque météo | kanari",
    metaDesc:
      "Les guides kanari pour tout comprendre des feux de forêt : bons réflexes en cas de départ de feu, fonctionnement des Canadair, détection satellite, météo des forêts.",
    h1: "Guides feux de forêt",
    intro:
      "Comprendre les feux de forêt pour mieux s'en protéger : les réflexes qui sauvent, les coulisses de la lutte aérienne et de la détection satellite.",
    backMap: "← Carte des feux en direct",
    faq: "FAQ",
  },
  en: {
    metaTitle: "Wildfire guides: reflexes, water bombers, satellites, fire weather | kanari",
    metaDesc:
      "kanari's guides to understand wildfires: the right reflexes during an ignition, how Canadair water bombers work, satellite detection, fire weather.",
    h1: "Wildfire guides",
    intro:
      "Understanding wildfires to better protect yourself: the reflexes that save lives, and the inner workings of aerial firefighting and satellite detection.",
    backMap: "← Live wildfire map",
    faq: "FAQ",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "fr";
  const t = T[l];
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/guide`,
      languages: { fr: "/fr/guide", en: "/en/guide" },
    },
  };
}

export default async function GuideHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = T[lang];
  const guides = lang === "fr" ? GUIDES : GUIDES_EN;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1}
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro}
        </p>
        <div className="flex flex-col gap-3">
          {guides.map((g) => (
            <Link
              key={g.slug}
              href={`/${lang}/guide/${g.slug}`}
              className="rounded-[18px] p-5"
              style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
            >
              <h2 className="mb-1 text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                {g.title}
              </h2>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {g.metaDesc}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-[14px]">
          <Link href={`/${lang}`} style={{ color: "var(--link)" }}>{t.backMap}</Link>
          {" · "}
          <Link href={`/${lang}/faq`} style={{ color: "var(--link)" }}>{t.faq}</Link>
        </p>
      </div>
    </div>
  );
}
