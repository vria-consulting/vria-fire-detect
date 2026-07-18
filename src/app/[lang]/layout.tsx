import type { Metadata } from "next";
import { Fredoka, DM_Sans } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DICT, LANGS, isValidLang, type Lang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
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
    robots: { index: true, follow: true },
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
          <nav className="flex items-center gap-4">
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
            <LangSwitch current={lang} />
            <a
              href="tel:112"
              className="flex h-[38px] items-center rounded-full px-[18px] text-sm font-medium text-white transition-colors"
              style={{ background: "var(--ember)" }}
            >
              {t.emergency}
            </a>
          </nav>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
