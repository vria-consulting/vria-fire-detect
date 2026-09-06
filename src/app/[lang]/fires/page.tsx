import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang, withXDefault } from "@/lib/i18n";
import { COUNTRIES, COUNTRY_BY_CC, countryName } from "@/lib/countries";
import { US_STATES } from "@/lib/us-states";
import { listFiresBetween } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";

// English hub: wildfires by country, with live counts from the archive.
export const dynamic = "force-dynamic";

const T = {
  en: {
    metaTitle: "Wildfires today by country: live world fire map | kanari",
    metaDesc:
      "Where are the wildfires right now? Live country-by-country view of fire ignitions detected by satellite and verified witnesses: United States, Canada, Greece, Spain, Australia and more.",
    h1: "Wildfires today, country by country",
    intro:
      "Significant fires detected over the last 7 days by satellites (NASA FIRMS, GOES, Meteosat MTG) and AI-verified witnesses, archived continuously by kanari.",
    cta: "Open the live world map →",
    hot: "Most affected this week",
    fires: (n: number) => `${n} fire${n > 1 ? "s" : ""}`,
    all: "All countries",
    states: "United States, state by state",
    note: "kanari is a free, independent information service — not an official alert channel. See also:",
    canadair: "water bombers live",
    faq: "FAQ",
    openData: "open data (CSV)",
  },
  es: {
    metaTitle: "Incendios forestales hoy por país: mapa mundial en vivo | kanari",
    metaDesc:
      "¿Dónde hay incendios forestales ahora mismo? Vista en vivo país por país de los focos detectados por satélite y testigos verificados: Chile, Argentina, España, México, Bolivia y más.",
    h1: "Incendios forestales hoy, país por país",
    intro:
      "Focos significativos detectados en los últimos 7 días por satélites (NASA FIRMS, GOES, Meteosat MTG) y testigos verificados por IA, archivados de forma continua por kanari.",
    cta: "Abrir el mapa mundial en vivo →",
    hot: "Los más afectados esta semana",
    fires: (n: number) => `${n} incendio${n > 1 ? "s" : ""}`,
    all: "Todos los países",
    states: "Estados Unidos, estado por estado",
    note: "kanari es un servicio de información independiente y gratuito, no un canal de alerta oficial. Ver también:",
    canadair: "aviones cisterna en vivo",
    faq: "preguntas frecuentes",
    openData: "datos abiertos (CSV)",
  },
  pt: {
    metaTitle: "Incêndios florestais hoje por país: mapa mundial ao vivo | kanari",
    metaDesc:
      "Onde há incêndios florestais agora? Visão ao vivo país por país dos focos detectados por satélite e testemunhas verificadas: Brasil, Portugal, Chile, Argentina, Bolívia e mais.",
    h1: "Incêndios florestais hoje, país por país",
    intro:
      "Focos significativos detectados nos últimos 7 dias por satélites (NASA FIRMS, GOES, Meteosat MTG) e testemunhas verificadas por IA, arquivados continuamente pelo kanari.",
    cta: "Abrir o mapa mundial ao vivo →",
    hot: "Os mais afetados nesta semana",
    fires: (n: number) => `${n} incêndio${n > 1 ? "s" : ""}`,
    all: "Todos os países",
    states: "Estados Unidos, estado por estado",
    note: "O kanari é um serviço de informação independente e gratuito, não um canal de alerta oficial. Ver também:",
    canadair: "aviões-tanque ao vivo",
    faq: "perguntas frequentes",
    openData: "dados abertos (CSV)",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l = lang === "es" || lang === "pt" ? lang : "en";
  const t = T[l];
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/fires`,
      languages: withXDefault({ en: "/en/fires", es: "/es/fires", pt: "/pt/fires" }),
    },
  };
}

function flag(cc: string): string {
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default async function FiresHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang === "fr") redirect("/en/fires");
  const t = T[lang as "en" | "es" | "pt"];

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const fires = await listFiresBetween(weekAgo, new Date().toISOString(), 5000);
  const byCc = new Map<string, number>();
  for (const f of fires) if (f.country) byCc.set(f.country, (byCc.get(f.country) ?? 0) + 1);
  const hot = [...byCc.entries()]
    .filter(([cc]) => COUNTRY_BY_CC.has(cc))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro}
        </p>
        <Link
          href={`/${lang}`}
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          {t.cta}
        </Link>

        {hot.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {t.hot}
            </h2>
            <div className="flex flex-col gap-2">
              {hot.map(([cc, n]) => {
                const c = COUNTRY_BY_CC.get(cc)!;
                return (
                  <Link
                    key={cc}
                    href={`/${lang}/fires/${c.slug}`}
                    className="flex items-center justify-between rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                      {flag(cc)} {countryName(cc, lang, c.name)}
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: "#D64545" }}>
                      {t.fires(n)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.all}
          </h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
            {COUNTRIES.map((c) => (
              <Link key={c.slug} href={`/${lang}/fires/${c.slug}`} style={{ color: "var(--link)" }}>
                {countryName(c.cc, lang, c.name)}
              </Link>
            ))}
          </p>
        </section>

        {/* Le maillage 50 États : le marché de recherche feu n°1 au monde
            ("california fire map"…) — chaque État a sa page locale live. */}
        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.states}
          </h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
            {US_STATES.map((s) => (
              <Link key={s.slug} href={`/en/fires/${s.slug}`} style={{ color: "var(--link)" }}>
                {s.name}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {t.note} <Link href={`/${lang}/canadair`} style={{ color: "var(--link)" }}>{t.canadair}</Link> ·{" "}
          <Link href={`/${lang}/faq`} style={{ color: "var(--link)" }}>{t.faq}</Link> ·{" "}
          <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>{t.openData}</a>.
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
