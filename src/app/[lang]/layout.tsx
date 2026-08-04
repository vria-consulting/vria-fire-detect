import type { Metadata } from "next";
import { Fredoka, DM_Sans } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DICT, LANGS, isValidLang, type Lang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { EmergencyButton } from "@/components/EmergencyButton";
import { Tracker } from "@/components/Tracker";
import "../globals.css";

// Charte Kanari : Fredoka (titres) + DM Sans (corps) — jamais d'autres familles.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const t = DICT[l];
  return {
    metadataBase: new URL("https://kanari.io"),
    title: t.metaTitle,
    description: t.metaDescription,
    keywords:
      l === "fr"
        ? ["feu de forêt", "incendie", "alerte incendie", "détection précoce", "carte des feux", "wildfire", "satellite", "NASA FIRMS"]
        : ["wildfire", "forest fire", "fire alert", "early detection", "fire map", "wildfire tracker", "satellite", "NASA FIRMS"],
    alternates: {
      canonical: `/${l}`,
      languages: { fr: "/fr", en: "/en", "x-default": "/" },
      types: { "application/rss+xml": "https://kanari.io/feed.xml" },
    },
    openGraph: {
      type: "website",
      url: `https://kanari.io/${l}`,
      siteName: "kanari",
      title: t.metaTitle,
      description: t.metaDescription,
      locale: l === "fr" ? "fr_FR" : "en_US",
      alternateLocale: l === "fr" ? "en_US" : "fr_FR",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "kanari" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      images: ["/og.png"],
    },
    robots: {
      index: true,
      follow: true,
      // Grandes vignettes autorisées : condition d'éligibilité Google
      // Discover (et aperçus riches dans la recherche).
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

// Données structurées : l'application et l'organisation, lisibles par les
// moteurs ET par les crawlers de LLM (référencement conversationnel).
function jsonLd(l: Lang) {
  const t = DICT[l];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "kanari",
        url: `https://kanari.io/${l}`,
        description: t.metaDescription,
        applicationCategory: "UtilityApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        inLanguage: ["fr", "en"],
        creator: { "@id": "https://kanari.io/#org" },
      },
      {
        "@type": "Organization",
        "@id": "https://kanari.io/#org",
        name: "kanari",
        url: "https://kanari.io",
        logo: "https://kanari.io/icon-512.png",
        slogan: l === "fr" ? "Le canari chante avant la sirène." : "The canary sings before the siren.",
      },
    ],
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = DICT[lang];
  return (
    <html lang={lang} className={`${fredoka.variable} ${dmSans.variable}`}>
      <body className="flex h-dvh flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(lang)) }}
        />
        <header
          className="z-40 flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6"
          style={{
            background: "rgba(251,249,244,.9)",
            backdropFilter: "blur(12px)",
            borderColor: "var(--line)",
          }}
        >
          <div className="flex items-baseline gap-3.5">
            <Link href={`/${lang}`} className="flex items-center gap-2">
              {/* Logo officiel de la charte — ne jamais redessiner. */}
              <Image src="/brand/logo-symbole.svg" width={34} height={34} alt="" priority />
              <span
                className="text-[23px] font-medium"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.5px",
                  color: "var(--ink)",
                }}
              >
                kanari
              </span>
            </Link>
            <span className="hidden text-[13px] md:inline" style={{ color: "var(--ink-3)" }}>
              {t.tagline}
            </span>
          </div>
          <nav className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href={`/${lang}/a-propos#comment`}
              className="hidden text-sm font-medium sm:inline"
              style={{ color: "var(--ink)" }}
            >
              {t.navHow}
            </Link>
            <Link
              href={`/${lang}/a-propos`}
              className="hidden text-sm font-medium sm:inline"
              style={{ color: "var(--ink)" }}
            >
              {t.navAbout}
            </Link>
            <Link
              href={`/${lang}/faq`}
              className="hidden text-sm font-medium md:inline"
              style={{ color: "var(--ink)" }}
            >
              {t.navFaq}
            </Link>
            {/* Menu « Explorer » : maillage SSR vers tout le hub de contenu.
                La home carte est plein écran (pas de footer possible) : c'est
                ici que visiteurs ET crawlers atteignent feux par département,
                mémoire des feux, observatoire… depuis chaque page. */}
            <details className="relative hidden sm:block">
              <summary
                className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden"
                style={{ color: "var(--ink)" }}
              >
                {lang === "fr" ? "Explorer" : "Explore"} ▾
              </summary>
              <nav
                className="absolute right-0 top-9 z-50 flex w-60 flex-col gap-2 rounded-[18px] p-4 text-[13.5px]"
                style={{ background: "var(--white)", boxShadow: "var(--shadow-m)" }}
              >
                {(lang === "fr"
                  ? [
                      ["/fr/feux", "Feux par département"],
                      ["/fr/canadair", "Canadair en direct"],
                      ["/fr/feu", "Mémoire des feux"],
                      ["/fr/bilan", "Bilans quotidiens"],
                      ["/fr/statistiques", "Observatoire et statistiques"],
                      ["/fr/guide", "Guides feux de forêt"],
                      ["/fr/widget", "Widget pour votre site"],
                      ["/opendata/feux.csv", "Open data (CSV)"],
                    ]
                  : [
                      ["/en/fires", "Wildfires by country"],
                      ["/en/canadair", "Water bombers live"],
                      ["/fr/statistiques", "Observatory (FR)"],
                      ["/fr/widget", "Embed widget"],
                      ["/opendata/feux.csv", "Open data (CSV)"],
                    ]
                ).map(([href, label]) => (
                  <Link key={href} href={href} style={{ color: "var(--ink)" }}>
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
            {/* Bouton Contribuer : jaune plein de la charte (ressort nettement,
                sans concurrencer le rouge d'urgence). Icône seule sur petit
                écran (le libellé apparaît dès 380 px), icône + texte au-delà. */}
            <Link
              href={`/${lang}/contribuer`}
              aria-label={t.navContribute}
              className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition-transform hover:scale-[1.04] min-[380px]:px-3.5"
              style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-s)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hidden min-[380px]:inline">{t.navContribute}</span>
            </Link>
            {/* FR/EN masqué sur mobile : la langue est déjà auto-détectée par
                géolocalisation, et le header mobile doit rester aéré. */}
            <div className="hidden sm:block">
              <LangSwitch current={lang} />
            </div>
            <EmergencyButton lang={lang} />
          </nav>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
        <Tracker />
      </body>
    </html>
  );
}
