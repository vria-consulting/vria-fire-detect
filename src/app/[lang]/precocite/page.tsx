import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { readJson } from "@/lib/store";
import type { EventsPayload } from "@/lib/eventscache";

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
      languages: { fr: "/fr/precocite", en: "/en/precocite" },
    },
  };
}

type Case = {
  place: string;
  firstSeen: string;
  firstPress: string;
  deltaMin: number;
  lat: number;
  lon: number;
};

async function measuredCases(): Promise<{ cases: Case[]; total: number; fetchedAt: string | null }> {
  const payload = await readJson<EventsPayload | null>("events-72h.json", null);
  if (!payload) return { cases: [], total: 0, fetchedAt: null };
  const cases: Case[] = [];
  for (const ev of payload.events) {
    if (!ev.social?.firstPress || !ev.social.place) continue;
    const delta = Date.parse(ev.social.firstPress) - Date.parse(ev.firstSeen);
    if (delta <= 0) continue; // la presse a été plus rapide : pas un cas d'avance
    cases.push({
      place: ev.social.place,
      firstSeen: ev.firstSeen,
      firstPress: ev.social.firstPress,
      deltaMin: Math.round(delta / 60_000),
      lat: ev.centroid[1],
      lon: ev.centroid[0],
    });
  }
  cases.sort((a, b) => b.deltaMin - a.deltaMin);
  return { cases: cases.slice(0, 20), total: payload.events.length, fetchedAt: payload.meta.fetchedAt };
}

function fmtDelta(min: number, l: Lang): string {
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
  const { cases, fetchedAt } = await measuredCases();
  const median =
    cases.length > 0 ? cases.map((c) => c.deltaMin).sort((a, b) => a - b)[Math.floor(cases.length / 2)] : null;

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
                  <strong>Premier signal kanari</strong> : l&apos;heure du premier passage satellite
                  ayant vu le foyer (VIIRS, GOES ou Meteosat, heure UTC fournie par la NASA et
                  EUMETSAT — pas par nous) ;
                </>
              ) : (
                <>
                  <strong>First kanari signal</strong>: the time of the first satellite pass that saw
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
              ? "L'écart entre les deux est l'avance mesurée. Elle sous-estime probablement l'avance réelle sur l'information du grand public (un article publié n'est pas encore lu), et elle ne dit RIEN de l'avance sur les secours : les pompiers disposent de leurs propres canaux (appels au 18/112, vigies, caméras) souvent plus rapides que la presse."
              : "The gap between the two is the measured lead. It probably underestimates the real lead over public awareness (a published article is not yet read), and it says NOTHING about a lead over emergency services: firefighters have their own channels (emergency calls, watchtowers, cameras) that are often faster than the press."}
          </p>

          <H2>{fr ? `Cas mesurés (72 h glissantes)` : `Measured cases (rolling 72 h)`}</H2>
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
                    datée · avance médiane : <strong>{fmtDelta(median!, lang)}</strong>
                  </>
                ) : (
                  <>
                    <strong>{cases.length}</strong> fire{cases.length > 1 ? "s" : ""} with dated
                    press · median lead: <strong>{fmtDelta(median!, lang)}</strong>
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
                    ? `Recalculé en continu — données au ${fetchedAt.slice(0, 16).replace("T", " ")} UTC. Les cas où la presse a été plus rapide que le satellite sont exclus du tableau (ils existent : témoins au sol, feux urbains).`
                    : `Continuously recomputed — data as of ${fetchedAt.slice(0, 16).replace("T", " ")} UTC. Cases where the press beat the satellite are excluded from the table (they exist: ground witnesses, urban fires).`}
                </p>
              )}
            </>
          )}

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
