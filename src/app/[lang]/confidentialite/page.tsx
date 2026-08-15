import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, localize } from "@/lib/i18n";
import { SiteFooter } from "@/components/SiteFooter";

// Politique de confidentialité : obligatoire pour AdSense (cookies tiers) et
// saine de toute façon. Bilingue sur le même segment (modèle /canadair).
export const revalidate = 86400;

const T = {
  fr: {
    metaTitle: "Confidentialité et cookies | kanari",
    metaDesc:
      "Ce que kanari collecte (très peu), ce que nous ne collectons pas, les cookies publicitaires et vos droits.",
    h1: "Confidentialité et cookies",
    updated: "Dernière mise à jour : 14 août 2026.",
    sections: [
      {
        h2: "Ce que kanari collecte",
        paras: [
          "kanari fonctionne sans compte et sans inscription. Nous mesurons l'audience du site de façon minimale : pages vues, pays d'origine (déduit de l'adresse IP, jamais stockée en clair), type d'appareil et site référent. Ces mesures reposent sur un identifiant technique anonymisé qui ne permet pas de vous identifier.",
          "Si vous signalez un feu, nous enregistrons la position que vous indiquez, l'heure, votre message éventuel et, si vous en joignez une, votre photo (analysée automatiquement avant publication). Ces signalements servent uniquement à l'information du public.",
          "Si vous activez les alertes sur une zone, l'abonnement de notification est stocké par votre navigateur et chez notre hébergeur le temps de l'abonnement.",
        ],
      },
      {
        h2: "Publicité et cookies tiers",
        paras: [
          "Certaines pages de contenu (guides, statistiques, comparatif) affichent des annonces Google AdSense. Google et ses partenaires peuvent utiliser des cookies publicitaires pour personnaliser les annonces en fonction de vos visites sur ce site et d'autres sites. Vous pouvez désactiver la personnalisation des annonces sur adssettings.google.com, et en savoir plus sur l'utilisation des données par Google sur policies.google.com/technologies/partner-sites.",
          "La carte en direct, les alertes et les pages consultées en situation d'urgence n'affichent aucune publicité.",
          "Certains guides contiennent des liens d'affiliation Amazon : en tant que Partenaire Amazon, kanari réalise un bénéfice sur les achats remplissant les conditions requises. Ces liens n'utilisent pas de cookie déposé par kanari.",
        ],
      },
      {
        h2: "Vos droits",
        paras: [
          "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant (par exemple un signalement que vous avez envoyé). Écrivez-nous : contact@kanari.io.",
          "Les données de kanari sont hébergées dans l'Union européenne et aux États-Unis chez nos prestataires techniques (hébergement et base de données).",
        ],
      },
    ],
    back: "← Retour à la carte",
  },
  en: {
    metaTitle: "Privacy and cookies | kanari",
    metaDesc:
      "What kanari collects (very little), what we do not collect, advertising cookies and your rights.",
    h1: "Privacy and cookies",
    updated: "Last updated: August 14, 2026.",
    sections: [
      {
        h2: "What kanari collects",
        paras: [
          "kanari works without accounts or signup. We measure the site's audience minimally: page views, country of origin (derived from the IP address, never stored in clear), device type and referring site. These measurements rely on an anonymized technical identifier that cannot identify you.",
          "If you report a fire, we store the position you indicate, the time, your optional message and, if you attach one, your photo (automatically analyzed before publication). Reports are used solely to inform the public.",
          "If you enable alerts on an area, the notification subscription is stored by your browser and by our hosting provider for the duration of the subscription.",
        ],
      },
      {
        h2: "Advertising and third-party cookies",
        paras: [
          "Some content pages (guides, statistics, comparison) display Google AdSense ads. Google and its partners may use advertising cookies to personalize ads based on your visits to this and other sites. You can disable ad personalization at adssettings.google.com and learn more about how Google uses data at policies.google.com/technologies/partner-sites.",
          "The live map, alerts and pages used in emergency situations display no advertising.",
          "Some guides contain Amazon affiliate links: as an Amazon Associate, kanari earns from qualifying purchases. These links do not use cookies set by kanari.",
        ],
      },
      {
        h2: "Your rights",
        paras: [
          "Under the GDPR you have the right to access, rectify and delete data about you (for example a report you submitted). Write to us: contact@kanari.io.",
          "kanari's data is hosted in the European Union and the United States by our technical providers (hosting and database).",
        ],
      },
    ],
    back: "← Back to the map",
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
      canonical: `/${l === "fr" ? "fr" : "en"}/confidentialite`,
      languages: { fr: "/fr/confidentialite", en: "/en/confidentialite" },
    },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = localize(T, lang);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1}
        </h1>
        <p className="mb-7 text-[13px]" style={{ color: "var(--ink-3)" }}>{t.updated}</p>
        {t.sections.map((s) => (
          <section key={s.h2} className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {s.h2}
            </h2>
            {s.paras.map((p, i) => (
              <p key={i} className="mb-3">{p}</p>
            ))}
          </section>
        ))}
        <p className="mt-8 text-[14px]">
          <Link href={`/${lang}`} style={{ color: "var(--link)" }}>{t.back}</Link>
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
