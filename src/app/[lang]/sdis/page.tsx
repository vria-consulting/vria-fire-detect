import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { SiteFooter } from "@/components/SiteFooter";

// Landing B2G : ce que kanari apporte aux services d'incendie, communes et
// gestionnaires forestiers — et ce qu'il n'est pas. Honnêteté d'abord : c'est
// un complément gratuit, pas un système opérationnel.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  await params;
  return {
    title: "kanari pour les SDIS, communes et gestionnaires forestiers : veille satellite gratuite | kanari",
    description:
      "Un complément gratuit à vos dispositifs : détections satellite mondiales (Meteosat 10 min, VIIRS, GOES), témoignages vérifiés par IA, suivi des moyens aériens, alertes par zone, open data et API. Sans déploiement, sans compte, sans coût.",
    alternates: { canonical: "/fr/sdis" },
  };
}

const CARDS: { title: string; body: string }[] = [
  {
    title: "Couverture satellite immédiate, sans déploiement",
    body: "Meteosat MTG rafraîchit l'Europe et l'Afrique toutes les 10 minutes, complété par VIIRS (375 m) et GOES. Aucune infrastructure à installer : la couverture existe déjà, partout, y compris hors des zones équipées en caméras ou vigies.",
  },
  {
    title: "Levée de doute documentaire par témoins vérifiés",
    body: "Les témoignages publics (réseaux sociaux, presse) sont vérifiés deux fois par IA puis croisés avec les détections satellite. Un foyer « corroboré » a été vu par un capteur ET par des humains.",
  },
  {
    title: "Moyens aériens en direct",
    body: "Canadair, Dash et hélicoptères bombardiers d'eau suivis en ADS-B, et rattachés automatiquement aux foyers qu'ils traitent (historique par appareil et par feu).",
  },
  {
    title: "Alertes gratuites sur votre zone",
    body: "Définissez une zone sur la carte et recevez une notification quand un nouveau foyer probable ou corroboré y apparaît. Fonctionne sur téléphone comme sur poste fixe, sans compte.",
  },
  {
    title: "Points stratégiques autour des feux actifs",
    body: "Pour chaque feu en cours, la fiche liste les points d'eau incendie, casernes et héli-surfaces recensés dans OpenStreetMap, avec distance et direction. Indicatif, en appui de vos référentiels DECI/DFCI.",
  },
  {
    title: "Mémoire, open data et API",
    body: "Chaque feu significatif garde une page permanente avec chronologie horodatée. L'archive complète est en open data (CC BY 4.0) et une API JSON publique et gratuite est documentée pour vos outils internes.",
  },
];

export default async function SdisPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/sdis");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: "https://kanari.io/fr" },
      { "@type": "ListItem", position: 2, name: "Pour les SDIS et collectivités", item: "https://kanari.io/fr/sdis" },
    ],
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14" style={{ color: "var(--ink-2)" }}>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          kanari pour les SDIS, communes et gestionnaires forestiers
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed">
          kanari est un service d&apos;information gratuit et indépendant qui croise les détections
          satellite mondiales avec des témoignages vérifiés par IA. Il ne remplace ni vos systèmes
          opérationnels, ni vos caméras, ni vos vigies : il ajoute une couche de veille qui
          fonctionne partout, tout de suite, sans déploiement et sans budget.
        </p>

        <Link
          href="/fr"
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Ouvrir la carte et définir une alerte sur votre zone →
        </Link>

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Ce que kanari vous apporte
          </h2>
          <div className="flex flex-col gap-3">
            {CARDS.map((c) => (
              <div key={c.title} className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
                <h3 className="mb-1 text-[15.5px] font-semibold" style={{ color: "var(--ink)" }}>{c.title}</h3>
                <p className="text-[14px] leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Ce que kanari n&apos;est pas
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong style={{ color: "var(--ink)" }}>Pas un canal d&apos;alerte officiel</strong> : les décisions
              opérationnelles relèvent de vos chaînes de commandement et de vos propres capteurs.
            </li>
            <li>
              <strong style={{ color: "var(--ink)" }}>Pas un système de détection locale</strong> : un satellite
              géostationnaire rafraîchit toutes les 10 minutes et voit des feux déjà établis ; une
              vigie, une caméra terrestre ou un appel au 18 peuvent être plus rapides sur un feu
              naissant. Nos mesures de précocité sont publiques, méthodologie comprise :{" "}
              <Link href="/fr/precocite" style={{ color: "var(--link)" }}>précocité mesurée</Link>.
            </li>
            <li>
              <strong style={{ color: "var(--ink)" }}>Pas une boîte noire</strong> : chaque donnée est sourcée
              (NASA, NOAA, EUMETSAT, témoignages publics horodatés) et l&apos;archive est ouverte.
            </li>
          </ul>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            L&apos;essayer en deux minutes
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Ouvrez <Link href="/fr" style={{ color: "var(--link)" }}>la carte</Link> et centrez-la sur votre
              territoire (recherche ou géolocalisation).
            </li>
            <li>Touchez « M&apos;alerter sur cette zone » : vous recevrez les nouveaux foyers significatifs.</li>
            <li>
              Consultez <Link href="/fr/feux-en-cours" style={{ color: "var(--link)" }}>les incendies en cours en France</Link>{" "}
              et la page de <Link href="/fr/feux" style={{ color: "var(--link)" }}>votre département</Link>.
            </li>
            <li>
              Branchez vos outils sur <Link href="/fr/api" style={{ color: "var(--link)" }}>l&apos;API publique et l&apos;open data</Link>,
              ou intégrez le <Link href="/fr/widget" style={{ color: "var(--link)" }}>widget carte</Link> sur votre site.
            </li>
          </ol>
          <p className="mt-3">
            Un besoin spécifique (périmètre, format, intégration) ? Écrivez-nous via{" "}
            <a href="https://github.com/vria-consulting/vria-fire-detect/issues" style={{ color: "var(--link)" }}>GitHub</a>{" "}
            ou la page <Link href="/fr/a-propos" style={{ color: "var(--link)" }}>À propos</Link> : les demandes des
            services d&apos;incendie et des collectivités sont prioritaires.
          </p>
        </section>

        <SiteFooter lang="fr" />
      </div>
    </div>
  );
}
