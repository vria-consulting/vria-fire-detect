import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, localize } from "@/lib/i18n";
import { GUIDES } from "@/lib/guides";
import { GUIDES_EN } from "@/lib/guides-en";
import { GUIDES_ES } from "@/lib/guides-es";
import { GUIDES_PT } from "@/lib/guides-pt";

const T = {
  fr: {
    metaTitle: "Guides feux de forêt : réflexes, Canadair, satellites | kanari",
    metaDesc:
      "Les guides kanari pour tout comprendre des feux de forêt : bons réflexes en cas de départ de feu, fonctionnement des Canadair, détection satellite, météo des forêts.",
    h1: "Guides feux de forêt",
    intro:
      "Comprendre les feux de forêt pour mieux s'en protéger : les réflexes qui sauvent, les coulisses de la lutte aérienne et de la détection satellite.",
    backMap: "← Carte des feux en direct",
    faq: "FAQ",
  },
  en: {
    metaTitle: "Wildfire guides: reflexes, water bombers, satellites | kanari",
    metaDesc:
      "kanari's guides to understand wildfires: the right reflexes during an ignition, how Canadair water bombers work, satellite detection, fire weather.",
    h1: "Wildfire guides",
    intro:
      "Understanding wildfires to better protect yourself: the reflexes that save lives, and the inner workings of aerial firefighting and satellite detection.",
    backMap: "← Live wildfire map",
    faq: "FAQ",
  },
  es: {
    metaTitle: "Guías sobre incendios forestales: reflejos, satélites, humo | kanari",
    metaDesc:
      "Las guías de kanari para entender los incendios forestales: los reflejos correctos ante un foco, la detección satelital y qué hacer cuando huele a humo.",
    h1: "Guías sobre incendios forestales",
    intro:
      "Entender los incendios forestales para protegerse mejor: los reflejos que salvan vidas, la detección satelital por dentro y qué hacer cuando huele a humo.",
    backMap: "← Mapa de incendios en vivo",
    faq: "Preguntas frecuentes",
  },
  pt: {
    metaTitle: "Guias sobre incêndios florestais: reflexos, satélites, fumaça | kanari",
    metaDesc:
      "Os guias do kanari para entender os incêndios florestais: os reflexos certos diante de um foco, a detecção por satélite e o que fazer quando há cheiro de fumaça.",
    h1: "Guias sobre incêndios florestais",
    intro:
      "Entender os incêndios florestais para se proteger melhor: os reflexos que salvam vidas, os bastidores da detecção por satélite e o que fazer quando há cheiro de fumaça.",
    backMap: "← Mapa de incêndios ao vivo",
    faq: "Perguntas frequentes",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "fr";
  const t = localize(T, l);
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/guide`,
      languages: { fr: "/fr/guide", en: "/en/guide", es: "/es/guide", pt: "/pt/guide" },
    },
  };
}

export default async function GuideHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = localize(T, lang);
  // es/pt : seuls les guides traduits sont listés (les autres restent
  // accessibles via la version anglaise du hub).
  const guides =
    lang === "fr" ? GUIDES : lang === "es" ? GUIDES_ES : lang === "pt" ? GUIDES_PT : GUIDES_EN;

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
