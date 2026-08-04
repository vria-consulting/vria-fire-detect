import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
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
    title: "Canadair en direct : suivre les bombardiers d'eau en temps réel",
    metaTitle: "Canadair en direct — suivre les bombardiers d'eau en temps réel | kanari",
    metaDesc:
      "Où sont les Canadair en ce moment ? Position en temps réel des bombardiers d'eau et hélicoptères anti-incendie du monde entier : CL-415, Pélican de la Sécurité Civile, Dash 8 Milan, Fire Boss, Air Crane. Gratuit.",
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
    how: "Comment kanari suit-il les Canadair ?",
    howText:
      "Chaque appareil diffuse sa position par ADS-B (le même signal que les avions de ligne). kanari agrège ces signaux via le réseau communautaire airplanes.live et filtre les moyens de lutte anti-incendie : Canadair CL-415 et CL-215, Air Tractor AT-802 Fire Boss, S-2T Turbo Tracker, DC-10 et BAe 146 Air Tankers, hélicoptères bombardiers d'eau (S-64 Air Crane, Chinook, Firehawk). Position rafraîchie environ toutes les 15 secondes, mouvement interpolé entre deux signaux.",
    fleet: "La flotte française : Pélican, Milan, Dragon",
    fleetText:
      "La Sécurité Civile française aligne 12 Canadair CL-415 (indicatif « Pélican »), 6 Dash 8-402MR (« Milan », gros porteurs polyvalents) et des hélicoptères EC145 (« Dragon », secours). Basés à Nîmes-Garons, ils sont suivis individuellement par kanari dès qu'ils décollent, grâce à leur identifiant unique — même quand leur type n'est pas diffusé. Un grand merci à Henri (canadair-tracker) pour la cartographie de la flotte.",
    why: "Pourquoi je ne vois aucun Canadair près d'un feu ?",
    whyText:
      "Trois explications possibles : il fait nuit (pas de largage de nuit), les moyens engagés sont des hélicoptères locaux ou militaires qui ne diffusent pas leur position publiquement, ou l'appareil a coupé son transpondeur. kanari affiche tout ce qui émet publiquement — c'est déjà l'essentiel des Canadair européens et des tankers nord-américains.",
    faq: [
      {
        q: "Où sont les Canadair en ce moment ?",
        a: "La carte kanari.io affiche en temps réel la position de tous les Canadair et bombardiers d'eau qui émettent en ADS-B dans le monde : Italie, France, Croatie, Grèce, Espagne, Amérique du Nord, Australie. Cliquez sur un appareil pour voir son modèle, sa nationalité, sa vitesse et son altitude.",
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
      "Every aircraft broadcasts its position via ADS-B (the same signal as airliners). kanari aggregates these signals through the airplanes.live community network and filters firefighting assets: Canadair CL-415/CL-215, Air Tractor Fire Boss, S-2T Turbo Tracker, DC-10 and BAe 146 air tankers, and firefighting helicopters (S-64 Air Crane, Chinook, Firehawk). Positions refresh about every 15 seconds, with interpolated movement in between.",
    fleet: "The French fleet: Pélican, Milan, Dragon",
    fleetText:
      "France's Sécurité Civile operates 12 Canadair CL-415s (callsign “Pélican”), 6 Dash 8-402MRs (“Milan”) and EC145 rescue helicopters (“Dragon”), based at Nîmes-Garons. kanari tracks each airframe individually as soon as it takes off, thanks to its unique transponder ID. Credits to Henri (canadair-tracker) for mapping the fleet.",
    why: "Why don't I see any aircraft near a fire?",
    whyText:
      "Three possible reasons: it's night (no night drops), the assets engaged are local or military helicopters that don't broadcast publicly, or the transponder is off. kanari shows everything publicly broadcasting — which covers most European Canadairs and North American tankers.",
    faq: [
      {
        q: "Where are the Canadairs right now?",
        a: "The kanari.io map shows the real-time position of every Canadair and water bomber broadcasting ADS-B worldwide: Italy, France, Croatia, Greece, Spain, North America, Australia. Click an aircraft for its model, nationality, speed and altitude.",
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
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const t = T[l];
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/canadair`,
      languages: { fr: "/fr/canadair", en: "/en/canadair" },
    },
  };
}

export default async function CanadairPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = T[lang];

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
            <>Voir aussi : <Link href="/fr/feux" style={{ color: "var(--link)" }}>Feux en France par département</Link> · <Link href="/fr/faq" style={{ color: "var(--link)" }}>FAQ</Link>. Données : ADS-B airplanes.live. En cas d'urgence : 18 ou 112.</>
          ) : (
            <>See also: <Link href="/en/faq" style={{ color: "var(--link)" }}>FAQ</Link>. Data: ADS-B via airplanes.live. In an emergency call 112 / 911.</>
          )}
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
