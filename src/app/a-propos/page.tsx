import Link from "next/link";

export const metadata = { title: "À propos — kanari" };

export default function About() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12" style={{ color: "var(--ink-2)" }}>
        <h1 className="mb-6" style={{ fontSize: "var(--text-h2)" }}>
          À propos de kanari
        </h1>

        <section className="space-y-4 text-[15px] leading-relaxed">
          <p>
            kanari est un service d&apos;information indépendant qui cartographie en temps quasi
            réel les départs de feu détectés par satellite, partout dans le monde. Notre mission :
            rendre visible chaque départ de feu le plus tôt possible, pour que citoyens, médias et
            services de secours disposent de la même information au même moment.
          </p>

          <h2
            id="comment"
            className="scroll-mt-20 pt-4"
            style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}
          >
            Comment ça marche ?
          </h2>
          <p>
            Trois familles de satellites se complètent. Les instruments <strong>VIIRS</strong>{" "}
            (NASA{" "}
            <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">
              FIRMS
            </a>
            , satellites NOAA-20 et NOAA-21 en orbite polaire) repèrent les anomalies thermiques
            avec une résolution de 375 m — un feu intense de quelques mètres carrés est détectable
            de nuit — mais ne passent que quelques fois par jour. Les satellites géostationnaires{" "}
            <strong>GOES</strong> (NOAA, Amériques) et <strong>Meteosat MTG</strong> (EUMETSAT,
            Europe/Afrique) surveillent en continu et rafraîchissent toutes les 10 minutes : moins
            précis, mais décisifs pour la précocité. kanari y ajoute une veille des témoignages
            citoyens sur les réseaux sociaux, géolocalisés par nom de lieu et triés par IA — chaque
            signalement est jugé deux fois avant d&apos;être affiché.
          </p>

          <h2 className="pt-4" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
            Limites à connaître
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Une détection est une <strong>anomalie thermique</strong>, pas forcément un feu de
              forêt : torchères industrielles, brûlages agricoles et volcans apparaissent aussi.
            </li>
            <li>
              Les satellites polaires ne passent que quelques fois par jour : un feu peut démarrer
              entre deux passages et n&apos;apparaître que plusieurs heures après l&apos;ignition.
            </li>
            <li>Les nuages épais et la canopée dense peuvent masquer une détection.</li>
          </ul>

          <h2 className="pt-4" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
            Avertissement
          </h2>
          <p
            className="rounded-[14px] p-4"
            style={{ background: "var(--ember-soft)", color: "#8C3A16" }}
          >
            kanari n&apos;est pas un service d&apos;alerte officiel et ne remplace en aucun cas les
            canaux d&apos;urgence. Si tu es témoin d&apos;un départ de feu, appelle immédiatement
            le <strong>112</strong> (Europe) ou le <strong>18</strong> (France).
          </p>

          <h2 className="pt-4" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
            Qui sommes-nous ?
          </h2>
          <p>
            kanari est développé comme un projet à mission : l&apos;objectif est l&apos;intérêt
            général, pas la monétisation des données. Le code est ouvert et les sources de données
            sont publiques.
          </p>
        </section>

        <Link
          href="/"
          className="mt-10 inline-flex h-[42px] items-center rounded-full px-6 text-sm font-medium"
          style={{ background: "var(--charcoal)", color: "var(--paper)" }}
        >
          Voir la carte
        </Link>
      </div>
    </div>
  );
}
