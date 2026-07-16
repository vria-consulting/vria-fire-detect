import Link from "next/link";

export const metadata = { title: "À propos — VigiFire" };

export default function About() {
  return (
    <div className="mx-auto max-w-2xl overflow-y-auto px-6 py-10 text-zinc-300">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">À propos de VigiFire</h1>

      <section className="space-y-4 text-sm leading-relaxed">
        <p>
          VigiFire est un service d&apos;information indépendant qui cartographie en temps quasi
          réel les départs de feu détectés par satellite, partout dans le monde. Notre mission :
          rendre visible chaque départ de feu le plus tôt possible, pour que citoyens, médias et
          services de secours disposent de la même information au même moment.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-zinc-100">D&apos;où viennent les données ?</h2>
        <p>
          Les détections proviennent de la NASA (programme{" "}
          <a
            href="https://firms.modaps.eosdis.nasa.gov/"
            className="text-orange-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            FIRMS
          </a>
          ) : les instruments VIIRS embarqués sur trois satellites en orbite polaire (Suomi-NPP,
          NOAA-20, NOAA-21) balayent chaque point du globe plusieurs fois par jour et repèrent les
          anomalies thermiques avec une résolution de 375 m. Un feu intense de quelques mètres
          carrés est détectable de nuit. Les données sont rafraîchies environ toutes les dix
          minutes.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-zinc-100">Limites à connaître</h2>
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
        <p>
          Les prochaines versions fusionneront d&apos;autres sources (satellites géostationnaires,
          caméras au sol, signalements citoyens) pour réduire ces angles morts et qualifier chaque
          alerte par un score de confiance.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-zinc-100">Avertissement</h2>
        <p className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-red-200">
          VigiFire n&apos;est pas un service d&apos;alerte officiel et ne remplace en aucun cas les
          canaux d&apos;urgence. Si vous êtes témoin d&apos;un départ de feu, appelez immédiatement
          le <strong>112</strong> (Europe) ou le <strong>18</strong> (France).
        </p>

        <h2 className="pt-4 text-lg font-semibold text-zinc-100">Qui sommes-nous ?</h2>
        <p>
          VigiFire est développé comme un projet à mission : l&apos;objectif est l&apos;intérêt
          général, pas la monétisation des données. Le code est ouvert et les sources de données
          sont publiques.
        </p>
      </section>

      <Link href="/" className="mt-8 inline-block text-sm text-orange-400 underline">
        ← Retour à la carte
      </Link>
    </div>
  );
}
