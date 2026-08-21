import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { DEPT_BY_SLUG, distKm } from "@/lib/departements";
import { getEvents, staleEvents, staleBlobEvents } from "@/lib/eventscache";
import type { FireEvent } from "@/lib/cluster";
import { listActiveFires, nearestCity, nearestDept, type ArchivedFire } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";

// « Incendies en cours en France aujourd'hui » : la liste nominative live,
// foyer par foyer — la réponse directe aux recherches « incendie en cours »,
// « feu de forêt aujourd'hui », « feu autour de moi ». Le hub /fr/feux reste
// l'annuaire par département ; ici, c'est le fil national.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IN_PROGRESS_H = 6; // dernier signal < 6 h = « en cours » (même seuil que le badge des pages feu)

function hoursAgo(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}
function ageLabel(h: number): string {
  if (h < 1) return `il y a ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `il y a ${Math.round(h)} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
function parisTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

async function loadFranceEvents(): Promise<FireEvent[] | null> {
  const inFr = (ev: FireEvent) => {
    const [lon, lat] = ev.centroid;
    return lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 10;
  };
  try {
    return (await getEvents(24)).events.filter(inFr);
  } catch {
    const stale = staleEvents(24) ?? (await staleBlobEvents(24));
    return stale ? stale.events.filter(inFr) : null;
  }
}

type Row = {
  ev: FireEvent;
  place: string | null;
  dept: { code: string; slug: string; name: string } | null;
  href: string;
  inProgress: boolean;
};

function buildRows(events: FireEvent[], archived: ArchivedFire[]): Row[] {
  return events
    .filter((ev) => nearestDept(ev.centroid[1], ev.centroid[0]) !== null) // métropole réelle (≤ 60 km d'un chef-lieu)
    .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen))
    .map((ev) => {
      const [lon, lat] = ev.centroid;
      const nd = nearestDept(lat, lon);
      const d = nd ? DEPT_BY_SLUG.get(nd.slug) : null;
      const place = ev.social?.place ?? nearestCity(lat, lon).place;
      // Page permanente si le foyer est déjà archivé (même zone, < 12 km).
      const arch = archived.find((a) => distKm(lat, lon, a.lat, a.lon) <= 12);
      const href = arch
        ? `/fr/feu/${arch.slug}`
        : `/fr?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&z=10&ev=${encodeURIComponent(ev.id)}`;
      return {
        ev,
        place,
        dept: d ? { code: d.code, slug: d.slug, name: d.name } : null,
        href,
        inProgress: hoursAgo(ev.lastSeen) < IN_PROGRESS_H,
      };
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  let count: number | null = null;
  try {
    const events = await loadFranceEvents();
    if (events) count = events.filter((ev) => hoursAgo(ev.lastSeen) < IN_PROGRESS_H && nearestDept(ev.centroid[1], ev.centroid[0]) !== null).length;
  } catch {
    /* title générique */
  }
  const lead =
    count === null
      ? "Incendies en cours en France aujourd'hui : liste en direct"
      : count === 0
        ? "Incendies en cours en France aujourd'hui : aucun foyer actif"
        : `Incendies en cours en France aujourd'hui : ${count} foyer${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""}`;
  return {
    title: `${lead} | kanari`,
    description:
      "La liste des feux de forêt en cours en France, mise à jour en continu : lieu, département, heure de première détection satellite, dernier signal. Détections NASA FIRMS, GOES et Meteosat MTG, témoignages vérifiés.",
    alternates: { canonical: "/fr/feux-en-cours" },
  };
}

export default async function FeuxEnCours({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/feux-en-cours");

  const [events, archived] = await Promise.all([loadFranceEvents(), listActiveFires("FR", 100)]);
  const rows = events ? buildRows(events, archived) : null;
  const inProgress = rows?.filter((r) => r.inProgress) ?? [];
  const deptsHit = rows
    ? [...new Map(rows.filter((r) => r.dept).map((r) => [r.dept!.slug, r.dept!])).values()]
    : [];
  const now = new Date().toLocaleString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: "https://kanari.io/fr" },
      { "@type": "ListItem", position: 2, name: "Feux en France", item: "https://kanari.io/fr/feux" },
      { "@type": "ListItem", position: 3, name: "Incendies en cours", item: "https://kanari.io/fr/feux-en-cours" },
    ],
  };
  // FAQ (reflète mot pour mot la section méthodologie visible plus bas).
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Comment cette liste des incendies en cours est-elle établie ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Chaque foyer provient d'une détection thermique satellite (VIIRS ~375 m, GOES et Meteosat MTG toutes les 10 minutes) ou d'un témoignage public vérifié deux fois par IA. Les heures affichées sont celles des passages satellites, fournies par la NASA et EUMETSAT. Source : kanari.io.",
        },
      },
      {
        "@type": "Question",
        name: "Un feu « en cours » est-il forcément encore actif ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Un feu « en cours » est un foyer dont le dernier signal satellite date de moins de ${IN_PROGRESS_H} heures : un feu réellement éteint peut donc rester listé quelques heures, et un feu masqué par les nuages peut manquer temporairement. En cas d'urgence, appelez le 18 ou le 112.`,
        },
      },
    ],
  };
  const listLd = rows && rows.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Incendies en cours en France",
        numberOfItems: rows.length,
        itemListElement: rows.slice(0, 25).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${r.place ? `Feu près de ${r.place}` : "Détection satellite"}${r.dept ? ` (${r.dept.name})` : ""}`,
          url: `https://kanari.io${r.href}`,
        })),
      }
    : null;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {listLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />
      )}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/feux" style={{ color: "var(--link)" }}>Feux en France</Link> · Incendies en cours
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Incendies en cours en France : la liste en temps réel
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Situation au {now} (heure de Paris) : {rows === null ? (
            "données momentanément indisponibles — la carte reste accessible ci-dessous"
          ) : (
            <>
              <strong style={{ color: rows.length > 0 ? "#D64545" : "#22684A" }}>{inProgress.length}</strong> foyer{inProgress.length > 1 ? "s" : ""} avec un signal
              de moins de {IN_PROGRESS_H} h, <strong>{rows.length}</strong> détecté{rows.length > 1 ? "s" : ""} sur
              les dernières 24 h dans <strong>{deptsHit.length}</strong> département{deptsHit.length > 1 ? "s" : ""}
            </>
          )}. Détections satellites (NASA FIRMS, GOES, Meteosat MTG toutes les 10 min) croisées avec des
          témoignages citoyens vérifiés deux fois par IA. Mise à jour continue.
        </p>

        <Link
          href="/fr"
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Voir ces feux sur la carte en direct →
        </Link>

        {rows !== null && rows.length === 0 && (
          <section className="mb-8 rounded-[18px] px-5 py-5" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <p className="text-[15px]" style={{ color: "var(--ink)" }}>
              <strong style={{ color: "#22684A" }}>Aucun foyer détecté en métropole sur les dernières 24 h.</strong>
            </p>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
              Un départ de feu très récent ou masqué par les nuages peut encore échapper aux satellites :
              si vous êtes témoin, appelez le 18 ou le 112.
            </p>
          </section>
        )}

        {rows !== null && rows.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Foyer par foyer (24 dernières heures)
            </h2>
            <div className="flex flex-col gap-2.5">
              {rows.slice(0, 30).map((r) => {
                const lastH = hoursAgo(r.ev.lastSeen);
                return (
                  <Link
                    key={r.ev.id}
                    href={r.href}
                    className="flex items-start gap-3 rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: lastH < 3 ? "#D64545" : lastH < 12 ? "#E8622C" : "#F0B400" }} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {r.place ? `Près de ${r.place}` : "Détection satellite"}
                        {r.dept ? ` — ${r.dept.name} (${r.dept.code})` : ""}
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        1re détection à {parisTime(r.ev.firstSeen)} · dernier signal {ageLabel(lastH)} · {r.ev.count} détection{r.ev.count > 1 ? "s" : ""}
                        {r.ev.maxFrp >= 20 ? ` · ${Math.round(r.ev.maxFrp)} MW` : ""}
                      </span>
                    </span>
                    {r.inProgress && (
                      <span className="mt-[2px] flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold" style={{ background: "var(--danger-soft)", color: "#9C2B2B" }}>
                        EN COURS
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {deptsHit.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Situation détaillée par département touché
            </h2>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
              {deptsHit.map((d) => (
                <Link key={d.slug} href={`/fr/feux/${d.slug}`} style={{ color: "var(--link)" }}>
                  Incendies en {d.name}
                </Link>
              ))}
            </p>
          </section>
        )}

        <section className="mb-8 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Comment cette liste est-elle établie ?
          </h2>
          <p className="mb-3">
            Chaque foyer provient d&apos;une détection thermique satellite (VIIRS ~375 m, GOES et
            Meteosat MTG toutes les 10 min) ou d&apos;un témoignage public vérifié. Les heures
            affichées sont celles des passages satellites, fournies par la NASA et EUMETSAT. Un feu
            « en cours » est un foyer dont le dernier signal date de moins de {IN_PROGRESS_H} h — un feu
            réellement éteint peut donc rester listé quelques heures.
          </p>
          <p>
            Cette liste est un service d&apos;information indépendant et gratuit, pas un canal
            d&apos;alerte officiel. Si vous êtes témoin d&apos;un départ de feu, appelez
            le <strong>18</strong> ou le <strong>112</strong> avant tout.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Voir aussi</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
            <Link href={`/fr/bilan/${today}`} style={{ color: "var(--link)" }}>Bilan du jour</Link>
            <Link href={`/fr/bilan/${yesterday}`} style={{ color: "var(--link)" }}>Bilan d&apos;hier</Link>
            <Link href="/fr/feux" style={{ color: "var(--link)" }}>Feux par département</Link>
            <Link href="/fr/canadair" style={{ color: "var(--link)" }}>Canadair en direct</Link>
            <Link href="/fr/precocite" style={{ color: "var(--link)" }}>Précocité mesurée</Link>
          </p>
        </section>

        <SiteFooter lang="fr" />
      </div>
    </div>
  );
}
