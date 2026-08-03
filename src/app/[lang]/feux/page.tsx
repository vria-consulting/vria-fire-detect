import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { DEPARTEMENTS, DEPT_RADIUS_KM, distKm } from "@/lib/departements";
import { getEvents, staleEvents, staleBlobEvents } from "@/lib/eventscache";
import type { FireEvent } from "@/lib/cluster";

// Hub des pages locales : « feux de forêt en France aujourd'hui ».
export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Feux de forêt en France aujourd'hui : carte en temps réel par département | kanari",
    description:
      "Où sont les feux de forêt en France en ce moment ? Carte des départs de feu en temps réel, département par département : détections satellites, témoins vérifiés, Canadair en direct.",
    alternates: { canonical: "/fr/feux" },
  };
}

function franceEvents(events: FireEvent[]): FireEvent[] {
  // Métropole + Corse (les DOM sont couverts par leurs pages dédiées).
  return events.filter((ev) => {
    const [lon, lat] = ev.centroid;
    return lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 10;
  });
}

export default async function FeuxHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/feux");

  let events: FireEvent[] | null = null;
  try {
    events = (await getEvents(24)).events;
  } catch {
    const stale = staleEvents(24) ?? (await staleBlobEvents(24));
    events = stale?.events ?? null;
  }
  const fr = events ? franceEvents(events) : null;

  // Foyers par département (distance au centre) — une passe suffit.
  const counts = new Map<string, number>();
  if (fr) {
    for (const ev of fr) {
      for (const d of DEPARTEMENTS) {
        if (distKm(d.lat, d.lon, ev.centroid[1], ev.centroid[0]) <= DEPT_RADIUS_KM) {
          counts.set(d.slug, (counts.get(d.slug) ?? 0) + 1);
        }
      }
    }
  }
  const now = new Date().toLocaleString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
  const hot = DEPARTEMENTS
    .map((d) => ({ d, n: counts.get(d.slug) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Feux de forêt en France : la situation en temps réel
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Situation au {now} (heure de Paris) : {fr === null ? "données en cours de chargement" : (
            <><strong style={{ color: "var(--ink)" }}>{fr.length}</strong> foyer{fr.length > 1 ? "s" : ""} détecté{fr.length > 1 ? "s" : ""} en
            métropole sur les dernières 24 h</>
          )} — satellites NASA FIRMS, GOES et Meteosat MTG, complétés par des témoignages citoyens
          vérifiés. Choisissez votre département pour la situation locale.
        </p>
        <Link
          href="/fr"
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Ouvrir la carte de France en direct →
        </Link>

        {hot.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Départements avec des foyers détectés (24 h)
            </h2>
            <div className="flex flex-col gap-2">
              {hot.map(({ d, n }) => (
                <Link
                  key={d.slug}
                  href={`/fr/feux/${d.slug}`}
                  className="flex items-center justify-between rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {d.name} ({d.code})
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "#D64545" }}>
                    {n} foyer{n > 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Tous les départements
          </h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
            {DEPARTEMENTS.map((d) => (
              <Link key={d.slug} href={`/fr/feux/${d.slug}`} style={{ color: "var(--link)" }}>
                {d.name}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari est un service d'information indépendant et gratuit, pas un canal d'alerte
          officiel. En cas d'urgence : 18 ou 112. Voir aussi : <Link href="/fr/feu" style={{ color: "var(--link)" }}>historique des feux</Link> · <Link href="/fr/canadair" style={{ color: "var(--link)" }}>Canadair en direct</Link> · <Link href="/fr/faq" style={{ color: "var(--link)" }}>FAQ</Link>.
        </p>
      </div>
    </div>
  );
}
