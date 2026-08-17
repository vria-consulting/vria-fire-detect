import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, localize } from "@/lib/i18n";
import { getWaterBombers, FRENCH_FLEET, type Plane } from "@/lib/aircraft";
import { SiteFooter } from "@/components/SiteFooter";

// Landing « Canadair en direct » : requête en forte croissance à chaque
// épisode de feu, quasi sans concurrence. Rendu ISR court (2 min) : la page
// arrive déjà remplie avec les appareils en vol (SEO + partage).
export const revalidate = 120;

function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const T = {
  fr: {
    // « suivi canadair direct » est la requête GSC qui monte le plus vite
    // (août 2026) : le mot « suivi » doit ouvrir le title et l'intro.
    title: "Suivi des Canadair en direct : où sont les bombardiers d'eau ?",
    metaTitle: "Suivi Canadair en direct — carte temps réel des bombardiers d'eau | kanari",
    metaDesc:
      "Suivi en direct des Canadair : position temps réel des bombardiers d'eau et hélicoptères anti-incendie du monde entier. CL-415, Pélican de la Sécurité Civile, Dash 8 Milan, Fire Boss, Air Crane. Gratuit, sans inscription.",
    updated: "Situation mise à jour en continu",
    inFlight: (n: number) =>
      n === 0
        ? "Aucun bombardier d'eau en vol détecté en ce moment"
        : `${n} moyen${n > 1 ? "s" : ""} aérien${n > 1 ? "s" : ""} anti-incendie en vol en ce moment`,
    nightNote:
      "Les bombardiers d'eau n'opèrent que de jour : il est normal d'en voir peu ou pas la nuit. Ils réapparaissent dès le lever du jour sur les zones d'incendie.",
    cta: "Voir les Canadair sur la carte en direct →",
    listTitle: "En vol en ce moment",
    kn: "kn",
    ft: "ft",
    how: "Comment fonctionne le suivi des Canadair ?",
    howText:
      "Chaque appareil diffuse sa position par ADS-B (le même signal que les avions de ligne). kanari agrège ces signaux via un réseau communautaire mondial et filtre les moyens de lutte anti-incendie : Canadair CL-415 et CL-215, Air Tractor AT-802 Fire Boss, S-2T Turbo Tracker, DC-10 et BAe 146 Air Tankers, hélicoptères bombardiers d'eau (S-64 Air Crane, Chinook, Firehawk). Le suivi est rafraîchi environ toutes les 15 secondes, avec un mouvement interpolé entre deux signaux.",
    fleet: "La flotte française : Pélican, Milan, Dragon",
    fleetText:
      "La Sécurité Civile française aligne 12 Canadair CL-415 (indicatif « Pélican »), 6 Dash 8-402MR (« Milan », gros porteurs polyvalents) et des hélicoptères EC145 (« Dragon », secours). Basés à Nîmes-Garons, ils sont suivis individuellement par kanari dès qu'ils décollent, grâce à leur identifiant unique — même quand leur type n'est pas diffusé. Un grand merci à Henri (canadair-tracker) pour la cartographie de la flotte.",
    why: "Pourquoi je ne vois aucun Canadair près d'un feu ?",
    whyText:
      "Trois explications possibles : il fait nuit (pas de largage de nuit), les moyens engagés sont des hélicoptères locaux ou militaires qui ne diffusent pas leur position publiquement, ou l'appareil a coupé son transpondeur. kanari affiche tout ce qui émet publiquement — c'est déjà l'essentiel des Canadair européens et des tankers nord-américains.",
    faq: [
      {
        q: "Comment suivre les Canadair en direct ?",
        a: "Ouvrez la carte kanari.io : les bombardiers d'eau en vol y apparaissent en temps réel, avec leur vitesse et leur altitude, aux côtés des feux détectés par satellite. Le suivi est gratuit, sans inscription, sur mobile comme sur ordinateur.",
      },
      {
        q: "Où sont les Canadair en ce moment ?",
        a: "La carte kanari.io affiche en temps réel la position de tous les Canadair et bombardiers d'eau qui émettent en ADS-B dans le monde : Italie, France, Croatie, Grèce, Espagne, Amérique du Nord, Australie. Cliquez sur un appareil pour voir son modèle, sa nationalité, sa vitesse et son altitude.",
      },
      {
        q: "Les Canadair sont-ils visibles sur Flightradar24 ?",
        a: "En partie : les trackers généralistes noient les Canadair parmi des milliers d'avions de ligne. kanari ne montre que les moyens anti-incendie, sur la même carte que les départs de feu, le vent et les points d'eau : on comprend la mission, pas seulement la position.",
      },
      {
        q: "Peut-on suivre les Canadair français (Pélican) en vol ?",
        a: "Oui : les 12 Canadair CL-415 « Pélican » et les 6 Dash 8 « Milan » de la Sécurité Civile sont suivis individuellement par kanari dès qu'ils décollent de Nîmes-Garons pour une mission feu.",
      },
      {
        q: "Combien d'eau largue un Canadair ?",
        a: "Un Canadair CL-415 écope environ 6 000 litres en 12 secondes sur un plan d'eau et peut enchaîner les rotations tant que le carburant le permet — jusqu'à plusieurs dizaines de largages par jour près d'un point d'écopage.",
      },
    ],
  },
  en: {
    title: "Water bombers live: track firefighting aircraft in real time",
    metaTitle: "Track Canadair water bombers live — real-time firefighting aircraft | kanari",
    metaDesc:
      "Where are the water bombers right now? Real-time positions of firefighting aircraft worldwide: Canadair CL-415, French Sécurité Civile fleet, Fire Boss, DC-10 tankers, Air Crane helicopters. Free.",
    updated: "Continuously updated",
    inFlight: (n: number) =>
      n === 0
        ? "No water bomber currently detected in flight"
        : `${n} firefighting aircraft in flight right now`,
    nightNote:
      "Water bombers only operate in daylight: seeing few or none at night is normal. They reappear over fire zones at sunrise.",
    cta: "See water bombers on the live map →",
    listTitle: "In flight right now",
    kn: "kn",
    ft: "ft",
    how: "How does kanari track water bombers?",
    howText:
      "Every aircraft broadcasts its position via ADS-B (the same signal as airliners). kanari aggregates these signals through community ADS-B networks and filters firefighting assets: Canadair CL-415/CL-215, Air Tractor Fire Boss, S-2T Turbo Tracker, DC-10 and BAe 146 air tankers, and firefighting helicopters (S-64 Air Crane, Chinook, Firehawk). Positions refresh about every 15 seconds, with interpolated movement in between.",
    fleet: "The French fleet: Pélican, Milan, Dragon",
    fleetText:
      "France's Sécurité Civile operates 12 Canadair CL-415s (callsign “Pélican”), 6 Dash 8-402MRs (“Milan”) and EC145 rescue helicopters (“Dragon”), based at Nîmes-Garons. kanari tracks each airframe individually as soon as it takes off, thanks to its unique transponder ID. Credits to Henri (canadair-tracker) for mapping the fleet.",
    why: "Why don't I see any aircraft near a fire?",
    whyText:
      "Three possible reasons: it's night (no night drops), the assets engaged are local or military helicopters that don't broadcast publicly, or the transponder is off. kanari shows everything publicly broadcasting — which covers most European Canadairs and North American tankers.",
    faq: [
      {
        q: "How can I track water bombers live?",
        a: "Open the kanari.io map: airborne water bombers appear in real time with their speed and altitude, next to satellite-detected fires. Tracking is free, no signup, on mobile and desktop.",
      },
      {
        q: "Where are the Canadairs right now?",
        a: "The kanari.io map shows the real-time position of every Canadair and water bomber broadcasting ADS-B worldwide: Italy, France, Croatia, Greece, Spain, North America, Australia. Click an aircraft for its model, nationality, speed and altitude.",
      },
      {
        q: "Are Canadairs visible on Flightradar24?",
        a: "Partially: generic flight trackers bury them among thousands of airliners. kanari shows only firefighting assets, on the same map as fire detections, wind and water points, so you understand the mission, not just the position.",
      },
      {
        q: "Can I track the French Pélican Canadairs in flight?",
        a: "Yes: the 12 CL-415 “Pélican” and 6 Dash 8 “Milan” of the French Sécurité Civile are tracked individually by kanari as soon as they take off from Nîmes-Garons.",
      },
      {
        q: "How much water does a Canadair drop?",
        a: "A CL-415 scoops about 6,000 litres in 12 seconds from a water body and can chain rotations for dozens of drops per day when a scooping point is close to the fire.",
      },
    ],
  },
  es: {
    title: "Aviones cisterna en vivo: sigue los medios aéreos contra incendios en tiempo real",
    metaTitle: "Aviones cisterna en vivo — posición en tiempo real de los medios aéreos | kanari",
    metaDesc:
      "¿Dónde están los aviones contra incendios ahora mismo? Posición en tiempo real de los medios aéreos del mundo entero: Canadair CL-415, Air Tractor Fire Boss, tanqueros DC-10, helicópteros Air Crane. Gratis, sin registro.",
    updated: "Situación actualizada de forma continua",
    inFlight: (n: number) =>
      n === 0
        ? "Ningún avión cisterna detectado en vuelo en este momento"
        : `${n} medio${n > 1 ? "s" : ""} aéreo${n > 1 ? "s" : ""} contra incendios en vuelo ahora mismo`,
    nightNote:
      "Los aviones cisterna solo operan de día: es normal ver pocos o ninguno de noche. Reaparecen sobre las zonas de incendio al amanecer.",
    cta: "Ver los aviones en el mapa en vivo →",
    listTitle: "En vuelo ahora mismo",
    kn: "kn",
    ft: "ft",
    how: "¿Cómo funciona el seguimiento de los aviones?",
    howText:
      "Cada aeronave emite su posición por ADS-B (la misma señal que los aviones de línea). kanari agrega esas señales a través de redes comunitarias mundiales y filtra los medios contra incendios: Canadair CL-415 y CL-215, Air Tractor AT-802 Fire Boss (muy usado en Chile, Argentina y España), S-2T Turbo Tracker, tanqueros DC-10 y BAe 146, helicópteros (S-64 Air Crane, Chinook, Firehawk). Las posiciones se refrescan cada 15 segundos aproximadamente, con movimiento interpolado.",
    fleet: "Las flotas: Europa, América y la Sécurité Civile francesa",
    fleetText:
      "Italia opera la mayor flota europea de Canadair, seguida por España, Grecia y Croacia; Francia alinea 12 CL-415 « Pélican » y 6 Dash 8 « Milan » con base en Nîmes-Garons, seguidos individualmente por kanari desde el despegue. En América, Chile y Argentina recurren a Fire Boss y helicópteros contratados, y Norteamérica a grandes tanqueros terrestres.",
    why: "¿Por qué no veo ningún avión cerca de un incendio?",
    whyText:
      "Tres explicaciones posibles: es de noche (no hay descargas nocturnas), los medios comprometidos son helicópteros locales o militares que no emiten públicamente, o la aeronave apagó su transpondedor. kanari muestra todo lo que emite públicamente, que ya cubre la mayoría de los Canadair europeos y los tanqueros norteamericanos.",
    faq: [
      {
        q: "¿Cómo seguir los aviones contra incendios en vivo?",
        a: "Abre el mapa kanari.io: los aviones cisterna en vuelo aparecen en tiempo real, con su velocidad y altitud, junto a los incendios detectados por satélite. El seguimiento es gratuito, sin registro, en celular y computadora.",
      },
      {
        q: "¿Dónde están los Canadair ahora mismo?",
        a: "El mapa kanari.io muestra en tiempo real la posición de todos los Canadair y aviones cisterna que emiten ADS-B en el mundo: Italia, Francia, Croacia, Grecia, España, Norteamérica, Australia. Haz clic en una aeronave para ver su modelo, nacionalidad, velocidad y altitud.",
      },
      {
        q: "¿Los aviones contra incendios aparecen en Flightradar24?",
        a: "En parte: los rastreadores generalistas los pierden entre miles de aviones de línea. kanari muestra solo los medios contra incendios, en el mismo mapa que los focos, el viento y los puntos de agua: se entiende la misión, no solo la posición.",
      },
      {
        q: "¿Qué aviones se usan contra los incendios en América Latina?",
        a: "Chile y Argentina emplean sobre todo Air Tractor AT-802 Fire Boss y helicópteros contratados; Brasil usa aviones agrícolas adaptados. Cuando emiten ADS-B, kanari los muestra en vivo sobre las zonas de fuego.",
      },
      {
        q: "¿Cuánta agua descarga un Canadair?",
        a: "Un CL-415 recoge unos 6.000 litros en 12 segundos sobre un plano de agua y puede encadenar rotaciones: hasta varias decenas de descargas al día cuando el punto de recogida está cerca del incendio.",
      },
    ],
  },
  pt: {
    title: "Aviões-tanque ao vivo: acompanhe os meios aéreos de combate em tempo real",
    metaTitle: "Aviões-tanque ao vivo — posição em tempo real dos meios aéreos | kanari",
    metaDesc:
      "Onde estão os aviões de combate a incêndios agora? Posição em tempo real dos meios aéreos do mundo inteiro: Canadair CL-415, Air Tractor Fire Boss, tanqueiros DC-10, helicópteros Air Crane. Grátis, sem cadastro.",
    updated: "Situação atualizada continuamente",
    inFlight: (n: number) =>
      n === 0
        ? "Nenhum avião-tanque detectado em voo neste momento"
        : `${n} meio${n > 1 ? "s" : ""} aéreo${n > 1 ? "s" : ""} de combate em voo agora`,
    nightNote:
      "Os aviões-tanque só operam de dia: é normal ver poucos ou nenhum à noite. Eles reaparecem sobre as zonas de incêndio ao amanhecer.",
    cta: "Ver os aviões no mapa ao vivo →",
    listTitle: "Em voo agora",
    kn: "kn",
    ft: "ft",
    how: "Como funciona o rastreamento dos aviões?",
    howText:
      "Cada aeronave transmite sua posição por ADS-B (o mesmo sinal dos aviões de linha). O kanari agrega esses sinais por redes comunitárias mundiais e filtra os meios de combate a incêndios: Canadair CL-415 e CL-215, Air Tractor AT-802 Fire Boss (muito usado no Brasil e no Chile), S-2T Turbo Tracker, tanqueiros DC-10 e BAe 146, helicópteros (S-64 Air Crane, Chinook, Firehawk). As posições se atualizam a cada 15 segundos, com movimento interpolado.",
    fleet: "As frotas: Europa, Américas e a Sécurité Civile francesa",
    fleetText:
      "A Itália opera a maior frota europeia de Canadair, seguida por Espanha, Grécia e Croácia; a França alinha 12 CL-415 « Pélican » e 6 Dash 8 « Milan » com base em Nîmes-Garons, acompanhados individualmente pelo kanari desde a decolagem. Nas Américas, o Brasil emprega sobretudo aviões agrícolas adaptados (Air Tractor) e helicópteros contratados contra as queimadas.",
    why: "Por que não vejo nenhum avião perto de um incêndio?",
    whyText:
      "Três explicações possíveis: é noite (não há lançamentos noturnos), os meios engajados são helicópteros locais ou militares que não transmitem publicamente, ou a aeronave desligou o transponder. O kanari mostra tudo o que emite publicamente, o que já cobre a maioria dos Canadair europeus e dos tanqueiros norte-americanos.",
    faq: [
      {
        q: "Como acompanhar os aviões de combate a incêndios ao vivo?",
        a: "Abra o mapa kanari.io: os aviões-tanque em voo aparecem em tempo real, com velocidade e altitude, ao lado dos incêndios detectados por satélite. O acompanhamento é gratuito, sem cadastro, no celular e no computador.",
      },
      {
        q: "Onde estão os Canadair agora?",
        a: "O mapa kanari.io mostra em tempo real a posição de todos os Canadair e aviões-tanque que emitem ADS-B no mundo: Itália, França, Croácia, Grécia, Espanha, América do Norte, Austrália. Clique numa aeronave para ver modelo, nacionalidade, velocidade e altitude.",
      },
      {
        q: "Os aviões de combate aparecem no Flightradar24?",
        a: "Em parte: os rastreadores genéricos os perdem entre milhares de aviões de linha. O kanari mostra só os meios de combate a incêndios, no mesmo mapa dos focos, do vento e dos pontos de água: entende-se a missão, não só a posição.",
      },
      {
        q: "Que aviões combatem as queimadas no Brasil?",
        a: "O Brasil emprega sobretudo aviões agrícolas adaptados como o Air Tractor AT-802, além de helicópteros contratados pelos estados e pelo Ibama. Quando emitem ADS-B, o kanari os mostra ao vivo sobre as zonas de fogo.",
      },
      {
        q: "Quanta água um Canadair lança?",
        a: "Um CL-415 recolhe cerca de 6.000 litros em 12 segundos num espelho d'água e pode encadear rotações: até várias dezenas de lançamentos por dia quando o ponto de coleta fica perto do incêndio.",
      },
    ],
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const t = localize(T, l);
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/canadair`,
      languages: {
        fr: "/fr/canadair",
        en: "/en/canadair",
        es: "/es/canadair",
        pt: "/pt/canadair",
      },
    },
  };
}

export default async function CanadairPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = localize(T, lang);

  let planes: Plane[] = [];
  try {
    planes = await getWaterBombers();
  } catch {
    /* section live vide : le contenu de fond reste servi */
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.title}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <span
            className="mr-2 inline-block h-[8px] w-[8px] rounded-full align-middle"
            style={{ background: "var(--canary-strong)" }}
          />
          {t.updated} · <strong style={{ color: "var(--ink)" }}>{t.inFlight(planes.length)}</strong>
        </p>

        <Link
          href={`/${lang}`}
          className="mb-6 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          {t.cta}
        </Link>

        {planes.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {t.listTitle}
            </h2>
            <div className="flex flex-col gap-2.5">
              {planes.map((p) => (
                <Link
                  key={p.id}
                  href={`/${lang}?lat=${p.lat.toFixed(2)}&lon=${p.lon.toFixed(2)}&z=8.5`}
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span aria-hidden="true" style={{ fontSize: 18 }}>
                    {p.kind === "helo" ? "🚁" : "🛩️"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                      {flag(p.country)} {p.model}
                    </strong>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                      {[p.callsign || p.reg, p.speed ? `${p.speed} ${t.kn}` : "", p.alt != null ? `${p.alt.toLocaleString()} ${t.ft}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <p className="mb-8 rounded-[14px] px-4 py-3 text-[13.5px]" style={{ background: "var(--canary-tint)", color: "var(--ink-2)" }}>
            {t.nightNote}
          </p>
        )}

        <section className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{t.how}</h2>
          <p>{t.howText}</p>
        </section>
        <section className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{t.fleet}</h2>
          <p>{t.fleetText}</p>
          {lang === "fr" && (
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13.5px]">
              {Object.values(FRENCH_FLEET).map((a) => (
                <Link key={a.reg} href={`/fr/canadair/${a.reg.toLowerCase()}`} style={{ color: "var(--link)" }}>
                  {a.reg}
                </Link>
              ))}
            </p>
          )}
        </section>
        <section className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{t.why}</h2>
          <p>{t.whyText}</p>
        </section>

        <section className="mb-4">
          {t.faq.map((it) => (
            <details key={it.q} className="mb-2 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <summary className="cursor-pointer text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{it.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{it.a}</p>
            </details>
          ))}
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {lang === "fr" ? (
            <>Voir aussi : <Link href="/fr/feux-en-cours" style={{ color: "var(--link)" }}>Incendies en cours en France</Link> · <Link href="/fr/feux" style={{ color: "var(--link)" }}>Feux par département</Link> · <Link href="/fr/faq" style={{ color: "var(--link)" }}>FAQ</Link>. Données : réseaux ADS-B communautaires. En cas d'urgence : 18 ou 112.</>
          ) : lang === "es" ? (
            <>Ver también: <Link href="/es/statistiques" style={{ color: "var(--link)" }}>estadísticas en vivo</Link> · <Link href="/es/faq" style={{ color: "var(--link)" }}>preguntas frecuentes</Link>. Datos: redes ADS-B comunitarias. En una emergencia llama al 911 o al 112.</>
          ) : lang === "pt" ? (
            <>Ver também: <Link href="/pt/statistiques" style={{ color: "var(--link)" }}>estatísticas ao vivo</Link> · <Link href="/pt/faq" style={{ color: "var(--link)" }}>perguntas frequentes</Link>. Dados: redes ADS-B comunitárias. Em emergência, ligue 193 (Brasil) ou 112 (Portugal).</>
          ) : (
            <>See also: <Link href="/en/faq" style={{ color: "var(--link)" }}>FAQ</Link>. Data: community ADS-B networks. In an emergency call 112 / 911.</>
          )}
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
