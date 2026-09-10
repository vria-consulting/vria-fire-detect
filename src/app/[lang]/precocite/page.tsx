import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, withXDefault } from "@/lib/i18n";
import { measuredEarliness, type EarlinessCase } from "@/lib/precocity";

// Page « Précocité mesurée » : la réponse rigoureuse aux questions « plus
// rapide qu'un appel au 18 ? » et « sur quelle base affirmez-vous être en
// avance ? » posées par des experts sur le post de lancement. Aucune
// promesse : uniquement des horodatages mesurés sur les dernières 72 h —
// premier signal satellite kanari vs premier article de presse détecté.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  return {
    title: l === "fr" ? "Précocité mesurée — kanari" : "Measured earliness — kanari",
    description:
      l === "fr"
        ? "Combien de temps d'avance kanari a-t-il réellement ? Méthodologie et mesures horodatées : premier signal satellite vs premier article de presse, sur les 72 dernières heures."
        : "How early is kanari really? Methodology and timestamped measurements: first satellite signal vs first press article, over the last 72 hours.",
    alternates: {
      canonical: `/${l}/precocite`,
      languages: withXDefault({ fr: "/fr/precocite", en: "/en/precocite" }),
    },
  };
}

type Case = EarlinessCase;

function fmtDelta(min: number, l: Lang): string {
  if (min < 0) return `−${fmtDelta(-min, l)}`;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return l === "fr" ? `${h} h${m ? ` ${m.toString().padStart(2, "0")}` : ""}` : `${h}h${m ? ` ${m}m` : ""}`;
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="pt-4" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
    {children}
  </h2>
);

export default async function Precocite({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const { cases, fetchedAt, matched, satelliteFirst, pressFirst, simultaneous, medianMin: median } = await measuredEarliness();

  const fr = lang === "fr";
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12" style={{ color: "var(--ink-2)" }}>
        <h1 className="mb-6" style={{ fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {fr ? "Précocité mesurée" : "Measured earliness"}
        </h1>
        <section className="space-y-4 text-[15px] leading-relaxed">
          <p>
            {fr
              ? "« Plus rapide que la presse, vraiment ? » Bonne question — la seule réponse honnête est une mesure. Cette page compare, pour chaque foyer corroboré des 72 dernières heures, deux horodatages publics et vérifiables :"
              : "“Faster than the press, really?” Fair question — the only honest answer is a measurement. For every corroborated fire of the last 72 hours, this page compares two public, verifiable timestamps:"}
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              {fr ? (
                <>
                  <strong>Premier signal satellite</strong> : l&apos;heure du premier passage satellite
                  ayant vu le foyer (VIIRS, GOES ou Meteosat, heure UTC fournie par la NASA et
                  EUMETSAT — pas par nous) ;
                </>
              ) : (
                <>
                  <strong>First satellite signal</strong>: the time of the first satellite pass that saw
                  the fire (VIIRS, GOES or Meteosat — UTC time supplied by NASA and EUMETSAT, not by
                  us);
                </>
              )}
            </li>
            <li>
              {fr ? (
                <>
                  <strong>Premier article de presse</strong> : l&apos;heure de publication du premier
                  article détecté par notre veille (GDELT) mentionnant ce feu.
                </>
              ) : (
                <>
                  <strong>First press article</strong>: the publication time of the first article
                  detected by our monitoring (GDELT) mentioning this fire.
                </>
              )}
            </li>
          </ul>
          <p>
            {fr
              ? "L'écart compare deux sources : un nombre positif signifie que le satellite précède l'article trouvé, un nombre négatif que la presse le précède. Ce n'est pas le délai de publication d'une alerte kanari : cet horodatage historique n'est pas disponible. L'appariement géographique avec la presse est automatique, peut concerner plusieurs foyers proches et reste à vérifier. Aucune avance sur les secours n'est démontrée."
              : "The gap compares two sources: positive means the satellite predates the matched article, negative means the press came first. It does not measure when kanari published an alert: historical publication timestamps are unavailable. Geographic press matching is automatic, can involve several nearby clusters, and requires verification. No lead over emergency services is established."}
          </p>

          <H2>{fr ? `Cas mesurés (72 h glissantes)` : `Measured cases (rolling 72 h)`}</H2>
          <p>{fr ? `${matched} appariements : satellite avant presse ${satelliteFirst}, presse avant satellite ${pressFirst}, même minute ${simultaneous}.` : `${matched} matches: satellite first ${satelliteFirst}, press first ${pressFirst}, same minute ${simultaneous}.`}</p>
          {cases.length === 0 ? (
            <p>
              {fr
                ? "Aucun cas mesurable en ce moment : aucun foyer des 72 dernières heures n'a encore à la fois une détection satellite et un article de presse daté. Repassez pendant un épisode actif."
                : "No measurable case right now: no fire of the last 72 hours has both a satellite detection and a dated press article yet. Come back during an active episode."}
            </p>
          ) : (
            <>
              <p>
                {fr ? (
                  <>
                    <strong>{cases.length}</strong> foyer{cases.length > 1 ? "s" : ""} avec presse
                    datée affichés · écart médian sur tous les appariements : <strong>{fmtDelta(median!, lang)}</strong>
                  </>
                ) : (
                  <>
                    <strong>{cases.length}</strong> fire{cases.length > 1 ? "s" : ""} with dated
                    press shown · median gap across all matches: <strong>{fmtDelta(median!, lang)}</strong>
                  </>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left" style={{ color: "var(--ink-3)" }}>
                      <th className="py-1.5 pr-3 font-medium">{fr ? "Lieu" : "Place"}</th>
                      <th className="py-1.5 pr-3 font-medium">
                        {fr ? "1er signal satellite (UTC)" : "1st satellite signal (UTC)"}
                      </th>
                      <th className="py-1.5 pr-3 font-medium">
                        {fr ? "1er article (UTC)" : "1st article (UTC)"}
                      </th>
                      <th className="py-1.5 font-medium">{fr ? "Avance" : "Lead"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr
                        key={`${c.place}:${c.firstSeen}`}
                        className="border-t"
                        style={{ borderColor: "var(--line)" }}
                      >
                        <td className="py-1.5 pr-3">
                          <Link
                            href={`/${lang}?lat=${c.lat.toFixed(3)}&lon=${c.lon.toFixed(3)}&z=9`}
                            style={{ color: "var(--link)" }}
                          >
                            {c.place}
                          </Link>
                          {c.articleUrl && <a className="ml-2 underline" href={c.articleUrl} rel="noopener noreferrer">{fr ? "Article source" : "Source article"}</a>}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-[12px]">
                          {c.firstSeen.slice(5, 16).replace("T", " ")}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-[12px]">
                          {c.firstPress.slice(5, 16).replace("T", " ")}
                        </td>
                        <td className="py-1.5 font-medium" style={{ color: "#22684A" }}>
                          {fmtDelta(c.deltaMin, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fetchedAt && (
                <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                  {fr
                    ? `Recalculé en continu — données au ${fetchedAt.slice(0, 16).replace("T", " ")} UTC. Tous les écarts valides sont inclus dans la médiane, y compris quand la presse précède le satellite. Les lignes affichées sont les appariements les plus récents, pas des feux physiques distincts garantis.`
                    : `Continuously recomputed — data as of ${fetchedAt.slice(0, 16).replace("T", " ")} UTC. All valid gaps contribute to the median, including cases where the press came first. Rows show the most recent matches, not guaranteed distinct physical fires.`}
                </p>
              )}
            </>
          )}

          <H2>{fr ? "Étude de cas : le feu du Diois (Drôme), 3 août 2026" : "Case study: the Diois fire (Drôme, France), August 3, 2026"}</H2>
          <p>
            {fr ? (
              <>
                Le 3 août 2026 à <strong>18 h 00 heure de Paris</strong> (16:00 UTC), le satellite
                géostationnaire Meteosat MTG capte un point chaud dans le sud-est de la Drôme, en
                zone du Diois (foyer rattaché à Serres, la ville la plus proche de notre
                gazetteer). En <strong>2 h 30</strong>, kanari cumule{" "}
                <strong>174 détections satellite</strong> sur ce foyer, avec une intensité maximale
                mesurée de <strong>1 193 MW</strong> — le foyer français le plus puissant enregistré
                par notre archive depuis son ouverture. Chaque détection est horodatée par EUMETSAT
                (une image toutes les 10 minutes), pas par nous.
              </>
            ) : (
              <>
                On August 3, 2026 at <strong>16:00 UTC</strong>, the Meteosat MTG geostationary
                satellite picked up a hotspot in the south-east of the Drôme department (Diois
                area, anchored to Serres, the nearest town in our gazetteer). Within{" "}
                <strong>2.5 hours</strong>, kanari accumulated{" "}
                <strong>174 satellite detections</strong> on this fire, with a peak measured
                intensity of <strong>1,193 MW</strong> — the most powerful French fire recorded in
                our archive since it opened. Every detection is timestamped by EUMETSAT (one image
                every 10 minutes), not by us.
              </>
            )}
          </p>
          <blockquote
            className="border-l-4 py-1 pl-4 text-[14px]"
            style={{ borderColor: "var(--canary)", color: "var(--ink)" }}
          >
            {fr
              ? "Le 3 août 2026, kanari a mesuré en Drôme un foyer de 1 193 MW : 174 détections satellite en 2 h 30, la première à 18 h 00 (heure de Paris). Source : kanari.io, données Meteosat MTG (EUMETSAT), licence CC BY 4.0."
              : "On August 3, 2026, kanari measured a 1,193 MW fire in the Drôme (France): 174 satellite detections in 2.5 hours, the first at 16:00 UTC. Source: kanari.io, Meteosat MTG data (EUMETSAT), CC BY 4.0."}
          </blockquote>
          <p>
            {fr ? (
              <>
                Ce cas illustre la densité de mesure du suivi géostationnaire, pas une avance sur
                l&apos;alerte : nous n&apos;avons pas d&apos;horodatage presse fiable pour ce foyer.
                La chronologie complète est publique :{" "}
                <Link href="/fr/feu/serres-2026-08-03-1ei8" style={{ color: "var(--link)" }}>
                  page permanente du feu
                </Link>{" "}
                ·{" "}
                <Link href="/fr/feux/drome" style={{ color: "var(--link)" }}>
                  situation en Drôme
                </Link>
                .
              </>
            ) : (
              <>
                This case shows the measurement density of geostationary monitoring, not a lead
                over official alerts: we have no reliable press timestamp for this fire. The full
                chronology is public:{" "}
                <Link href="/fr/feu/serres-2026-08-03-1ei8" style={{ color: "var(--link)" }}>
                  permanent fire page
                </Link>
                .
              </>
            )}
          </p>

          <H2>{fr ? "Limites" : "Limits"}</H2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              {fr
                ? "La veille presse (GDELT) ne voit pas tout : un feu peut être traité par un média local sans apparaître ici."
                : "Press monitoring (GDELT) does not see everything: a fire may be covered by a local outlet without appearing here."}
            </li>
            <li>
              {fr
                ? "Le « premier signal » est le premier passage satellite : l'ignition réelle est antérieure."
                : "The “first signal” is the first satellite pass: actual ignition happens earlier."}
            </li>
            <li>
              {fr
                ? "L'échantillon est court (72 h) et varie avec l'actualité : c'est un instrument de mesure, pas un argumentaire."
                : "The sample is short (72 h) and varies with the news cycle: this is a measuring instrument, not a sales pitch."}
            </li>
          </ul>
        </section>
        <Link
          href={`/${lang}`}
          className="mt-10 inline-flex h-[42px] items-center rounded-full px-6 text-sm font-medium"
          style={{ background: "var(--charcoal)", color: "var(--paper)" }}
        >
          {fr ? "Voir la carte" : "View the map"}
        </Link>
      </div>
    </div>
  );
}
