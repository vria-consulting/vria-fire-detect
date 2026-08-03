import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";

// FAQ SEO/AEO : répond mot pour mot aux questions réellement tapées dans
// Google et posées aux assistants IA. Balisage schema.org FAQPage : éligible
// aux résultats enrichis et massivement repris par les LLM.

type QA = { q: string; a: string };

const FAQ: Record<Lang, { title: string; intro: string; items: QA[] }> = {
  fr: {
    title: "Questions fréquentes",
    intro:
      "Tout ce qu'il faut savoir sur kanari, la carte gratuite des départs de feu en temps réel.",
    items: [
      {
        q: "Comment savoir s'il y a un feu de forêt près de chez moi en ce moment ?",
        a: "Ouvrez kanari.io : la carte se centre automatiquement sur votre région et affiche les départs de feu détectés par satellite au cours des dernières heures, ainsi que les signalements citoyens vérifiés. Utilisez la recherche de ville ou le bouton « Ma position » pour vérifier une zone précise. Chaque flamme est colorée selon l'âge du dernier signal : rouge pour un feu actif il y a moins de 3 heures.",
      },
      {
        q: "La carte des feux de kanari est-elle vraiment en temps réel ?",
        a: "La carte se rafraîchit environ toutes les 2 à 3 minutes. Les détections proviennent des satellites NASA FIRMS (VIIRS, résolution 375 m), GOES pour les Amériques et Meteosat MTG pour l'Europe et l'Afrique (rafraîchi toutes les 10 minutes), complétées par des témoignages citoyens publiés sur les réseaux sociaux. Un feu peut donc apparaître quelques minutes à quelques dizaines de minutes après son départ réel.",
      },
      {
        q: "D'où viennent les données de kanari ?",
        a: "Des sources publiques et vérifiables : NASA FIRMS (satellites VIIRS NOAA-20/21), NOAA GOES, EUMETSAT Meteosat MTG (détection active des feux), la presse via GDELT, Bluesky et Telegram pour les témoignages. Chaque signalement citoyen est trié par une IA (deux jugements indépendants) avant d'être affiché, pour éliminer les faux positifs.",
      },
      {
        q: "Peut-on suivre les Canadair et bombardiers d'eau en direct sur kanari ?",
        a: "Oui. kanari affiche en quasi temps réel la position des moyens aériens de lutte anti-incendie qui émettent en ADS-B : Canadair CL-415 et CL-215, Dash 8 « Milan » et Canadair « Pélican » de la Sécurité Civile française, Air Tractor Fire Boss, DC-10 Air Tanker, hélicoptères bombardiers d'eau (S-64 Air Crane, Chinook, Firehawk). Cliquez sur un appareil pour voir son modèle, sa nationalité, sa vitesse et son altitude. Les appareils ne volant que de jour, la carte en montre peu la nuit.",
      },
      {
        q: "Que faire si je suis témoin d'un départ de feu ?",
        a: "Appelez d'abord les secours : 112 partout en Europe, 18 en France. C'est le seul canal d'alerte officiel. Ensuite, vous pouvez utiliser le bouton « Signaler un feu » de kanari pour marquer votre position et aider les autres à voir le départ de feu au plus tôt.",
      },
      {
        q: "kanari est-il gratuit ?",
        a: "Oui, entièrement gratuit et sans création de compte. kanari est un projet à mission : aider les citoyens, les secours, les élus et les médias à voir les départs de feu le plus tôt possible. La carte mondiale restera gratuite.",
      },
      {
        q: "kanari remplace-t-il les alertes officielles ?",
        a: "Non. kanari est un service d'information indépendant, pas un canal d'urgence officiel. Les décisions d'évacuation et d'intervention relèvent des autorités (préfectures, pompiers, sécurité civile). En cas d'urgence, appelez le 112 ou le 18.",
      },
      {
        q: "Pourquoi un feu que je vois n'apparaît-il pas sur la carte ?",
        a: "Plusieurs raisons possibles : le feu est trop petit ou trop récent pour avoir été survolé par un satellite (VIIRS passe environ toutes les 12 heures aux latitudes moyennes, GOES et MTG voient plus souvent mais moins finement), les nuages ou la fumée masquent la détection, ou aucun témoignage géolocalisable n'a encore été publié. C'est exactement pour cela que le signalement citoyen compte : votre signalement peut être le premier signal.",
      },
      {
        q: "Comment contribuer ou proposer une amélioration ?",
        a: "Via la page Contribuer : idée, donnée à intégrer, bug, partenariat — tout retour est bienvenu et étudié. Les contributions pertinentes sont intégrées en continu à l'application.",
      },
      {
        q: "Qui est derrière kanari ?",
        a: "kanari est développé en France par VRIA, en indépendant, avec une communauté croissante de contributeurs (pompiers, élus, développeurs, citoyens). Le nom vient du canari dans la mine : celui qui chante avant que le danger ne soit visible.",
      },
    ],
  },
  en: {
    title: "Frequently asked questions",
    intro: "Everything about kanari, the free real-time wildfire ignition map.",
    items: [
      {
        q: "How do I know if there is a wildfire near me right now?",
        a: "Open kanari.io: the map centers on your region and shows satellite-detected fire starts from the last hours, plus verified citizen reports. Use city search or “My position” to check a specific area. Each flame is colored by the age of the last signal: red means active within the last 3 hours.",
      },
      {
        q: "Is the kanari fire map really real-time?",
        a: "The map refreshes about every 2–3 minutes. Detections come from NASA FIRMS (VIIRS, 375 m resolution), GOES for the Americas and Meteosat MTG for Europe and Africa (10-minute refresh), plus citizen reports from social networks. A fire can appear within minutes to a few dozen minutes of its actual start.",
      },
      {
        q: "Where does kanari data come from?",
        a: "Public, verifiable sources: NASA FIRMS (VIIRS NOAA-20/21), NOAA GOES, EUMETSAT Meteosat MTG active fire detection, press via GDELT, Bluesky and Telegram for witness reports. Every citizen report is AI-triaged (two independent judgments) before display, to eliminate false positives.",
      },
      {
        q: "Can I track Canadair water bombers live on kanari?",
        a: "Yes. kanari shows near real-time positions of firefighting aircraft broadcasting ADS-B: Canadair CL-415/CL-215, the French Sécurité Civile “Pélican” and Dash 8 “Milan” fleet, Air Tractor Fire Boss, DC-10 Air Tankers, and firefighting helicopters (S-64 Air Crane, Chinook, Firehawk). Click an aircraft to see its model, nationality, speed and altitude. They fly in daylight only, so the map shows few at night.",
      },
      {
        q: "What should I do if I witness a fire starting?",
        a: "Call emergency services first: 112 in Europe, 911 in North America. That is the only official alert channel. Then you can use kanari's “Report a fire” button to mark your position and help others see the ignition as early as possible.",
      },
      {
        q: "Is kanari free?",
        a: "Yes, completely free, no account needed. kanari is a mission-driven project: helping citizens, responders, officials and media see fire starts as early as possible. The world map will stay free.",
      },
      {
        q: "Does kanari replace official alerts?",
        a: "No. kanari is an independent information service, not an official emergency channel. Evacuation and response decisions belong to the authorities. In an emergency, call 112 or your local emergency number.",
      },
      {
        q: "Why doesn't a fire I can see appear on the map?",
        a: "Several possible reasons: the fire is too small or too recent for a satellite pass (VIIRS overflies roughly every 12 hours at mid-latitudes; GOES and MTG watch more often but less finely), clouds or smoke mask the detection, or no geolocatable witness report has been published yet. That is exactly why citizen reporting matters: your report can be the very first signal.",
      },
      {
        q: "How can I contribute or suggest an improvement?",
        a: "Via the Contribute page: ideas, data sources, bugs, partnerships — every input is welcome and reviewed. Relevant improvements are shipped continuously.",
      },
      {
        q: "Who is behind kanari?",
        a: "kanari is built in France by VRIA, independently, with a growing community of contributors (firefighters, officials, developers, citizens). The name comes from the canary in the coal mine: the one that sings before danger becomes visible.",
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  return {
    title:
      l === "fr"
        ? "FAQ — carte des feux en temps réel, Canadair en direct | kanari"
        : "FAQ — live wildfire map, water bomber tracking | kanari",
    description:
      l === "fr"
        ? "Comment savoir s'il y a un feu près de chez vous, suivre les Canadair en direct, comprendre les données satellites : les réponses aux questions les plus fréquentes sur kanari."
        : "How to know if there is a fire near you, track water bombers live, understand satellite data: answers to the most asked questions about kanari.",
    alternates: {
      canonical: `/${l}/faq`,
      languages: { fr: "/fr/faq", en: "/en/faq" },
    },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = FAQ[lang];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1
          className="mb-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}
        >
          {t.title}
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro}
        </p>
        <div className="flex flex-col gap-6">
          {t.items.map((it) => (
            <section
              key={it.q}
              className="rounded-[18px] p-5"
              style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
            >
              <h2
                className="mb-2 text-[17px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                {it.q}
              </h2>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {it.a}
              </p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-center text-[14px]" style={{ color: "var(--ink-2)" }}>
          <Link href={`/${lang}`} style={{ color: "var(--link)" }}>
            {lang === "fr" ? "← Retour à la carte des feux en direct" : "← Back to the live fire map"}
          </Link>
          {" · "}
          <Link href={`/${lang}/contribuer`} style={{ color: "var(--link)" }}>
            {lang === "fr" ? "Contribuer au projet" : "Contribute to the project"}
          </Link>
        </p>
      </div>
    </div>
  );
}
