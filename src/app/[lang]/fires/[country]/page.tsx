import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { COUNTRY_BY_SLUG, countryName } from "@/lib/countries";
import { STATE_BY_SLUG, US_STATES, stateOf, type UsState } from "@/lib/us-states";
import { listFiresByCountry, type ArchivedFire } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";

// English local pages: "wildfires in [country] today" — the same play as the
// French department pages, worldwide market. The same segment also serves the
// 50 US states + DC ("california fire map" beats any country query in volume):
// a slug is resolved as a country first, then as a US state.
export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

// Portugais : la préposition « em » se contracte selon le genre du pays
// (« no Brasil », « na Argentina », « nos Estados Unidos ») — table des pays
// à feux, repli « em X » pour le reste.
const PT_IN: Record<string, string> = {
  BR: "no Brasil", PT: "em Portugal", US: "nos Estados Unidos", CA: "no Canadá",
  MX: "no México", CL: "no Chile", AR: "na Argentina", BO: "na Bolívia",
  PY: "no Paraguai", UY: "no Uruguai", PE: "no Peru", EC: "no Equador",
  CO: "na Colômbia", VE: "na Venezuela", ES: "na Espanha", FR: "na França",
  IT: "na Itália", GR: "na Grécia", HR: "na Croácia", TR: "na Turquia",
  AU: "na Austrália", ID: "na Indonésia", RU: "na Rússia", ZA: "na África do Sul",
  AO: "em Angola", MZ: "em Moçambique",
};

const CT = {
  en: {
    metaTitle: (n: string) => `Wildfires in ${n} today: live fire map | kanari`,
    metaDesc: (n: string) => `Is there a wildfire in ${n} right now? Live map of fire ignitions detected by satellite (NASA FIRMS, GOES, MTG) and verified witness reports. Free, no account.`,
    crumb: "Wildfires by country",
    h1: (n: string) => `Wildfires in ${n}: the live situation`,
    asOf: (d: string) => `As of ${d} UTC — significant fires archived by kanari from satellite detections (NASA FIRMS, GOES, Meteosat MTG) and AI-verified witness reports. Continuously updated.`,
    tracked: (n: number) => (n === 1 ? "fire currently tracked" : "fires currently tracked"),
    cta: (n: string) => `Open the live map of ${n} →`,
    latest: "Latest significant fires",
    det: (n: number) => `${n} detection${n > 1 ? "s" : ""}`,
    aircraft: (n: number) => `${n} aircraft observed`,
    sat: "Satellite detection",
    how: (n: string) => `How do I know if there is a fire near me in ${n}?`,
    how1:
      "kanari continuously fuses thermal detections from satellites (VIIRS at 375 m resolution, geostationary GOES and Meteosat MTG re-scanning every 10 minutes) with witness reports published on social networks, each verified twice by AI before being shown. A new ignition can appear on the map within minutes of its first signals — often before the press.",
    how2a: "You can also ",
    how2link: "track water bombers live",
    how2b: " while they operate. If you witness a fire starting, call your local emergency number first (112 in Europe, 911 in North America).",
    byState: "Wildfires by state",
    note: "kanari is a free, independent information service — not an official alert channel. Open data:",
    noteLink: "full fire archive (CSV, CC BY 4.0)",
  },
  es: {
    metaTitle: (n: string) => `Incendios en ${n} hoy: mapa en vivo | kanari`,
    metaDesc: (n: string) => `¿Hay un incendio en ${n} ahora mismo? Mapa en vivo de los focos detectados por satélite (NASA FIRMS, GOES, MTG) y reportes de testigos verificados. Gratis, sin cuenta.`,
    crumb: "Incendios por país",
    h1: (n: string) => `Incendios en ${n}: la situación en vivo`,
    asOf: (d: string) => `Al ${d} UTC — incendios significativos archivados por kanari a partir de detecciones satelitales (NASA FIRMS, GOES, Meteosat MTG) y reportes de testigos verificados por IA. Actualización continua.`,
    tracked: (n: number) => (n === 1 ? "incendio seguido ahora" : "incendios seguidos ahora"),
    cta: (n: string) => `Abrir el mapa en vivo de ${n} →`,
    latest: "Últimos incendios significativos",
    det: (n: number) => `${n} detección${n > 1 ? "es" : ""}`,
    aircraft: (n: number) => `${n} aeronave${n > 1 ? "s" : ""} observada${n > 1 ? "s" : ""}`,
    sat: "Detección satelital",
    how: (n: string) => `¿Cómo sé si hay un incendio cerca de mí en ${n}?`,
    how1:
      "kanari fusiona de forma continua las detecciones térmicas de los satélites (VIIRS a 375 m de resolución, los geoestacionarios GOES y Meteosat MTG que reescanean cada 10 minutos) con reportes de testigos publicados en redes sociales, verificados dos veces por IA antes de mostrarse. Un foco nuevo puede aparecer en el mapa a los pocos minutos de sus primeras señales, a menudo antes que la prensa.",
    how2a: "También puedes ",
    how2link: "seguir los aviones cisterna en vivo",
    how2b: " mientras operan. Si eres testigo de un foco, llama primero a tu número de emergencias local (911 en América, 112 en Europa).",
    byState: "Incendios por estado",
    note: "kanari es un servicio de información independiente y gratuito, no un canal de alerta oficial. Datos abiertos:",
    noteLink: "archivo completo de incendios (CSV, CC BY 4.0)",
  },
  pt: {
    metaTitle: (n: string) => `Incêndios ${n} hoje: mapa ao vivo | kanari`,
    metaDesc: (n: string) => `Há um incêndio ${n} agora? Mapa ao vivo dos focos detectados por satélite (NASA FIRMS, GOES, MTG) e relatos de testemunhas verificados. Grátis, sem conta.`,
    crumb: "Incêndios por país",
    h1: (n: string) => `Incêndios ${n}: a situação ao vivo`,
    asOf: (d: string) => `Em ${d} UTC — incêndios significativos arquivados pelo kanari a partir de detecções por satélite (NASA FIRMS, GOES, Meteosat MTG) e relatos de testemunhas verificados por IA. Atualização contínua.`,
    tracked: (n: number) => (n === 1 ? "incêndio acompanhado agora" : "incêndios acompanhados agora"),
    cta: (n: string) => `Abrir o mapa ao vivo · ${n} →`,
    latest: "Últimos incêndios significativos",
    det: (n: number) => `${n} detecção${n > 1 ? "ões" : ""}`.replace("çãoões", "ções"),
    aircraft: (n: number) => `${n} aeronave${n > 1 ? "s" : ""} observada${n > 1 ? "s" : ""}`,
    sat: "Detecção por satélite",
    how: (n: string) => `Como sei se há um incêndio perto de mim ${n}?`,
    how1:
      "O kanari funde continuamente as detecções térmicas dos satélites (VIIRS a 375 m de resolução, os geoestacionários GOES e Meteosat MTG que revarrem a cada 10 minutos) com relatos de testemunhas publicados nas redes sociais, verificados duas vezes por IA antes de aparecerem. Um foco novo pode surgir no mapa poucos minutos após os primeiros sinais, muitas vezes antes da imprensa.",
    how2a: "Você também pode ",
    how2link: "acompanhar os aviões-tanque ao vivo",
    how2b: " enquanto operam. Se presenciar um foco, ligue primeiro para o número de emergência local (193 no Brasil, 112 em Portugal).",
    byState: "Incêndios por estado",
    note: "O kanari é um serviço de informação independente e gratuito, não um canal de alerta oficial. Dados abertos:",
    noteLink: "arquivo completo de incêndios (CSV, CC BY 4.0)",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}): Promise<Metadata> {
  const { lang, country } = await params;
  const c = COUNTRY_BY_SLUG.get(country);
  if (c) {
    const l = lang === "es" || lang === "pt" ? lang : "en";
    const t = CT[l];
    const plain = l === "en" ? c.name : countryName(c.cc, l, c.name);
    const name = l === "pt" ? (PT_IN[c.cc] ?? `em ${plain}`) : plain;
    return {
      title: t.metaTitle(name),
      description: t.metaDesc(name),
      alternates: {
        canonical: `/${l}/fires/${c.slug}`,
        languages: {
          en: `/en/fires/${c.slug}`,
          es: `/es/fires/${c.slug}`,
          pt: `/pt/fires/${c.slug}`,
        },
      },
    };
  }
  const s = STATE_BY_SLUG.get(country);
  if (!s) return {};
  return {
    title: `${s.name} wildfires today: live fire map | kanari`,
    description: `Is there a fire in ${s.name} right now? Live map of wildfire ignitions detected by satellite, NIFC perimeters and water bombers in flight. Free, no account.`,
    alternates: { canonical: `/en/fires/${s.slug}` },
  };
}

export default async function CountryFires({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}) {
  const { lang, country } = await params;
  if (!isValidLang(lang)) notFound();
  const c = COUNTRY_BY_SLUG.get(country);
  if (!c) {
    const s = STATE_BY_SLUG.get(country);
    if (!s) notFound();
    if (lang !== "en") redirect(`/en/fires/${s.slug}`);
    return <StateFires state={s} />;
  }
  if (lang === "fr") redirect(`/en/fires/${c.slug}`);
  const t = CT[lang as "en" | "es" | "pt"];
  const plain = lang === "en" ? c.name : countryName(c.cc, lang, c.name);
  const name = lang === "pt" ? (PT_IN[c.cc] ?? `em ${plain}`) : plain;

  const fires = await listFiresByCountry(c.cc, 25);
  const active = fires.filter((f) => f.status === "active");
  const now = new Date().toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const mapHref = `/en?lat=${c.lat}&lon=${c.lon}&z=${c.zoom}`;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href={`/${lang}/fires`} style={{ color: "var(--link)" }}>{t.crumb}</Link>
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1(name)}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.asOf(now)}
        </p>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: active.length > 0 ? "#D64545" : "#22684A" }}>
              {active.length}
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {t.tracked(active.length)}
            </div>
          </div>
        </div>

        <Link
          href={mapHref}
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          {t.cta(lang === "pt" ? plain : name)}
        </Link>

        {fires.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {t.latest}
            </h2>
            <div className="flex flex-col gap-2">
              {fires.map((f: ArchivedFire) => (
                <Link
                  key={f.slug}
                  href={`/fr/feu/${f.slug}`}
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: f.status === "active" ? "#D64545" : "#8A8880" }} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                      {f.place ?? t.sat}{f.admin ? ` — ${f.admin}` : ""}
                    </strong>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                      {t.det(f.detections)} · {Math.round(f.max_frp)} MW max
                      {f.aircraft.length > 0 ? ` · ${t.aircraft(f.aircraft.length)}` : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--ink-3)" }}>{ago(f.last_seen)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.how(name)}
          </h2>
          <p className="mb-3">{t.how1}</p>
          <p>
            {t.how2a}<Link href={`/${lang}/canadair`} style={{ color: "var(--link)" }}>{t.how2link}</Link>{t.how2b}
          </p>
        </section>

        {c.cc === "US" && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {t.byState}
            </h2>
            <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
              {US_STATES.map((s) => (
                <Link key={s.slug} href={`/en/fires/${s.slug}`} style={{ color: "var(--link)" }}>
                  {s.name}
                </Link>
              ))}
            </p>
          </section>
        )}

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {t.note} <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>{t.noteLink}</a>.
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}

// US state page: live counts filtered by bounding box (the archive's admin
// field is empty for US fires), dated citable answer in the FAQ (the pattern
// AI answer engines quote most readily), NIFC perimeters called out.
async function StateFires({ state }: { state: UsState }) {
  const all = await listFiresByCountry("US", 1000);
  const fires = all.filter((f) => stateOf(f.lat, f.lon)?.code === state.code);
  const active = fires.filter((f) => f.status === "active");
  const weekAgo = Date.now() - 7 * 86400_000;
  const week = fires.filter((f) => new Date(f.first_seen).getTime() >= weekAgo);
  const now = new Date().toLocaleString("en-US", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Los_Angeles",
  });
  const mapHref = `/en?lat=${state.lat}&lon=${state.lon}&z=${state.zoom}`;

  // Cross-links: the busiest states right now (live), always including the
  // big fire states so the mesh stays stable off-season.
  const counts = new Map<string, number>();
  for (const f of all) {
    const s = stateOf(f.lat, f.lon);
    if (s && s.code !== state.code) counts.set(s.slug, (counts.get(s.slug) ?? 0) + 1);
  }
  const others = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([slug]) => STATE_BY_SLUG.get(slug))
    .filter((s): s is UsState => Boolean(s));

  const faq = [
    {
      q: `Are there wildfires in ${state.name} right now?`,
      a: `As of ${now} (Pacific time), kanari tracks ${active.length} active significant fire${active.length === 1 ? "" : "s"} in ${state.name}; ${week.length} significant ignition${week.length === 1 ? " was" : "s were"} detected over the last 7 days and ${fires.length} archived since August 3, 2026. These figures update continuously on the free live map at kanari.io.`,
    },
    {
      q: `How fast do new ${state.name} fires appear on the map?`,
      a: `kanari reads the NOAA GOES geostationary feed directly, so detections appear about 13 minutes after satellite scan (the satellite re-scans every 10 minutes), plus VIIRS polar passes at 375 m resolution. Witness reports, verified by AI, can surface an ignition even earlier.`,
    },
    {
      q: `Where do the official ${state.name} fire perimeters come from?`,
      a: `From NIFC (National Interagency Fire Center) incident data, displayed on the kanari map alongside satellite detections and firefighting aircraft tracked live via ADS-B. All of it is free, with no account.`,
    },
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/en/fires" style={{ color: "var(--link)" }}>Wildfires by country</Link>
          {" · "}
          <Link href="/en/fires/united-states" style={{ color: "var(--link)" }}>United States</Link>
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {state.name} wildfires: the live situation
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          As of {now} (Pacific time) — significant fires archived by kanari from satellite
          detections (NASA FIRMS, GOES) and AI-verified witness reports, with official NIFC
          perimeters on the map. Continuously updated.
        </p>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-[18px] px-4 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: active.length > 0 ? "#D64545" : "#22684A" }}>{active.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>active now</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{week.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>last 7 days</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{fires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>archived since Aug 3</div>
          </div>
        </div>

        <Link
          href={mapHref}
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Open the live {state.name} fire map →
        </Link>

        {fires.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Latest significant fires in {state.name}
            </h2>
            <div className="flex flex-col gap-2">
              {fires.slice(0, 20).map((f: ArchivedFire) => (
                <Link
                  key={f.slug}
                  href={`/fr/feu/${f.slug}`}
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: f.status === "active" ? "#D64545" : "#8A8880" }} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                      {f.place ?? "Satellite detection"}
                    </strong>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                      {f.detections} detection{f.detections > 1 ? "s" : ""} · {Math.round(f.max_frp)} MW max
                      {f.aircraft.length > 0 ? ` · ${f.aircraft.length} aircraft observed` : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--ink-3)" }}>{ago(f.last_seen)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Frequently asked questions
          </h2>
          {faq.map((it) => (
            <details key={it.q} className="mb-2 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <summary className="cursor-pointer text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{it.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{it.a}</p>
            </details>
          ))}
        </section>

        {others.length > 0 && (
          <p className="mb-4 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            Wildfires in other states:{" "}
            {others.map((s, i) => (
              <span key={s.slug}>
                {i > 0 && " · "}
                <Link href={`/en/fires/${s.slug}`} style={{ color: "var(--link)" }}>{s.name}</Link>
              </span>
            ))}
          </p>
        )}

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari is a free, independent information service — not an official alert channel.
          In an emergency call 911. Open data:{" "}
          <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>full fire archive (CSV, CC BY 4.0)</a>.
        </p>
        <SiteFooter lang="en" />
      </div>
    </div>
  );
}
