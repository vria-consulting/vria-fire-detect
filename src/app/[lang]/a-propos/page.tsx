import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  return {
    title: l === "fr" ? "À propos — kanari" : "About — kanari",
    description:
      l === "fr"
        ? "Comment kanari détecte les départs de feu de forêt : satellites NASA FIRMS et Meteosat MTG, veille citoyenne vérifiée par IA, limites et avertissements."
        : "How kanari detects wildfire ignitions: NASA FIRMS and Meteosat MTG satellites, AI-verified citizen reports, limits and disclaimers.",
    alternates: {
      canonical: `/${l}/a-propos`,
      languages: { fr: "/fr/a-propos", en: "/en/a-propos" },
    },
  };
}

// FAQ balisée schema.org : la matière première des réponses des moteurs ET
// des assistants IA (« quelle app pour suivre les feux de forêt ? »).
function faqJsonLd(l: Lang) {
  const qa =
    l === "fr"
      ? [
          ["Qu'est-ce que kanari ?", "kanari est une carte mondiale gratuite des feux de forêt en temps quasi réel. Elle combine les détections satellite (NASA FIRMS/VIIRS, GOES, Meteosat MTG) et les témoignages citoyens vérifiés par IA pour repérer les départs de feu le plus tôt possible, souvent avant les médias."],
          ["D'où viennent les données de kanari ?", "Des instruments satellite VIIRS (résolution 375 m, NASA FIRMS), des satellites géostationnaires GOES (Amériques) et Meteosat MTG (Europe/Afrique, rafraîchi toutes les 10 minutes), et d'une veille des réseaux sociaux (Bluesky, presse, Telegram) dont chaque signalement est jugé deux fois par IA avant affichage."],
          ["kanari est-il gratuit ?", "Oui. kanari est un projet à mission : la carte, les alertes par zone et toutes les fonctionnalités sont gratuites."],
          ["kanari remplace-t-il les secours ?", "Non. kanari est un service d'information indépendant, pas un canal d'alerte officiel. En cas d'urgence, appelez le 112 (Europe) ou le 18 (France)."],
        ]
      : [
          ["What is kanari?", "kanari is a free near real-time world map of wildfires. It combines satellite detections (NASA FIRMS/VIIRS, GOES, Meteosat MTG) with AI-verified citizen reports to spot fire starts as early as possible, often before the media."],
          ["Where does kanari's data come from?", "From VIIRS satellite instruments (375 m resolution, NASA FIRMS), the GOES (Americas) and Meteosat MTG (Europe/Africa, refreshed every 10 minutes) geostationary satellites, and social media monitoring (Bluesky, press, Telegram) where every report is judged twice by AI before being displayed."],
          ["Is kanari free?", "Yes. kanari is a mission-driven project: the map, area alerts and all features are free."],
          ["Does kanari replace emergency services?", "No. kanari is an independent information service, not an official alert channel. In an emergency, call 112 (Europe) or your local emergency number."],
        ];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

const H2 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <h2 id={id} className="scroll-mt-20 pt-4" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
    {children}
  </h2>
);

export default async function About({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  return (
    <div className="h-full overflow-y-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(lang)) }}
      />
      <div className="mx-auto max-w-2xl px-6 py-12" style={{ color: "var(--ink-2)" }}>
        {lang === "fr" ? (
          <>
            <h1 className="mb-6" style={{ fontSize: "var(--text-h2)", color: "var(--ink)" }}>
              À propos de kanari
            </h1>
            <section className="space-y-4 text-[15px] leading-relaxed">
              <p>
                kanari est un service d&apos;information indépendant qui cartographie en temps quasi
                réel les départs de feu de forêt détectés par satellite, partout dans le monde.
                Notre mission : rendre visible chaque départ de feu le plus tôt possible, pour que
                citoyens, médias et services de secours disposent de la même information au même
                moment.
              </p>
              <H2 id="comment">Comment ça marche ?</H2>
              <p>
                Trois familles de satellites se complètent. Les instruments <strong>VIIRS</strong>{" "}
                (NASA{" "}
                <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">
                  FIRMS
                </a>
                , satellites NOAA-20 et NOAA-21 en orbite polaire) repèrent les anomalies
                thermiques avec une résolution de 375 m — un feu intense de quelques mètres carrés
                est détectable de nuit — mais ne passent que quelques fois par jour. Les satellites
                géostationnaires <strong>GOES</strong> (NOAA, Amériques) et{" "}
                <strong>Meteosat MTG</strong> (EUMETSAT, Europe/Afrique) surveillent en continu et
                rafraîchissent toutes les 10 minutes : moins précis, mais décisifs pour la
                précocité. kanari y ajoute une veille des témoignages citoyens sur les réseaux
                sociaux, géolocalisés par nom de lieu et triés par IA — chaque signalement est jugé
                deux fois avant d&apos;être affiché.
              </p>
              <H2>Limites à connaître</H2>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Une détection est une <strong>anomalie thermique</strong>, pas forcément un feu de
                  forêt : torchères industrielles, brûlages agricoles et volcans apparaissent aussi.
                </li>
                <li>
                  Les satellites polaires ne passent que quelques fois par jour : un feu peut
                  démarrer entre deux passages et n&apos;apparaître que plusieurs heures après
                  l&apos;ignition.
                </li>
                <li>Les nuages épais et la canopée dense peuvent masquer une détection.</li>
              </ul>
              <H2>Avertissement</H2>
              <p className="rounded-[14px] p-4" style={{ background: "var(--ember-soft)", color: "#8C3A16" }}>
                kanari n&apos;est pas un service d&apos;alerte officiel et ne remplace en aucun cas
                les canaux d&apos;urgence. Si tu es témoin d&apos;un départ de feu, appelle
                immédiatement le <strong>112</strong> (Europe) ou le <strong>18</strong> (France).
              </p>
              <H2>Qui sommes-nous ?</H2>
              <p>
                kanari est développé comme un projet à mission : l&apos;objectif est l&apos;intérêt
                général, pas la monétisation des données. Le code est ouvert et les sources de
                données sont publiques.
              </p>
            </section>
            <Link
              href={`/${lang}`}
              className="mt-10 inline-flex h-[42px] items-center rounded-full px-6 text-sm font-medium"
              style={{ background: "var(--charcoal)", color: "var(--paper)" }}
            >
              Voir la carte
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-6" style={{ fontSize: "var(--text-h2)", color: "var(--ink)" }}>
              About kanari
            </h1>
            <section className="space-y-4 text-[15px] leading-relaxed">
              <p>
                kanari is an independent information service that maps wildfire ignitions detected
                by satellite in near real time, anywhere in the world. Our mission: make every fire
                start visible as early as possible, so citizens, media and emergency services get
                the same information at the same moment.
              </p>
              <H2 id="comment">How does it work?</H2>
              <p>
                Three families of satellites complement each other. The <strong>VIIRS</strong>{" "}
                instruments (NASA{" "}
                <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">
                  FIRMS
                </a>
                , NOAA-20 and NOAA-21 polar-orbiting satellites) spot thermal anomalies at 375 m
                resolution — an intense fire of a few square meters is detectable at night — but
                only pass a few times a day. The geostationary satellites <strong>GOES</strong>{" "}
                (NOAA, Americas) and <strong>Meteosat MTG</strong> (EUMETSAT, Europe/Africa) watch
                continuously and refresh every 10 minutes: less precise, but decisive for
                earliness. kanari adds social media monitoring of citizen reports, geolocated by
                place name and triaged by AI — every report is judged twice before being displayed.
              </p>
              <H2>Known limits</H2>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  A detection is a <strong>thermal anomaly</strong>, not necessarily a wildfire:
                  industrial flares, agricultural burns and volcanoes show up too.
                </li>
                <li>
                  Polar satellites only pass a few times a day: a fire can start between two passes
                  and only appear several hours after ignition.
                </li>
                <li>Thick clouds and dense canopy can hide a detection.</li>
              </ul>
              <H2>Disclaimer</H2>
              <p className="rounded-[14px] p-4" style={{ background: "var(--ember-soft)", color: "#8C3A16" }}>
                kanari is not an official alert service and never replaces emergency channels. If
                you witness a fire start, immediately call <strong>112</strong> (Europe) or your
                local emergency number.
              </p>
              <H2>Who are we?</H2>
              <p>
                kanari is built as a mission-driven project: the goal is public interest, not data
                monetization. The code is open and the data sources are public.
              </p>
            </section>
            <Link
              href={`/${lang}`}
              className="mt-10 inline-flex h-[42px] items-center rounded-full px-6 text-sm font-medium"
              style={{ background: "var(--charcoal)", color: "var(--paper)" }}
            >
              View the map
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
