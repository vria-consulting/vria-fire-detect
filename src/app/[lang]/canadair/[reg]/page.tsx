import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { FRENCH_FLEET, getWaterBombers } from "@/lib/aircraft";
import { listFiresByAircraft, type ArchivedFire } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";

// Page individuelle d'un appareil de la Sécurité Civile : suivi live +
// historique des feux sur lesquels kanari l'a observé.
export const dynamic = "force-dynamic";

// immat slug (f-zbeg) -> { hex, reg, model }
const BY_REG = new Map(
  Object.entries(FRENCH_FLEET).map(([hex, v]) => [v.reg.toLowerCase(), { hex, ...v }])
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; reg: string }>;
}): Promise<Metadata> {
  const { reg } = await params;
  const a = BY_REG.get(reg.toLowerCase());
  if (!a) return {};
  return {
    title: `${a.reg} — ${a.model} de la Sécurité Civile : suivi en direct et missions | kanari`,
    description: `Où est le ${a.model} ${a.reg} en ce moment ? Position en direct quand il vole, et historique des feux sur lesquels kanari l'a observé.`,
    alternates: { canonical: `/fr/canadair/${a.reg.toLowerCase()}` },
  };
}

function frDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

export default async function AircraftPage({
  params,
}: {
  params: Promise<{ lang: string; reg: string }>;
}) {
  const { lang, reg } = await params;
  if (!isValidLang(lang)) notFound();
  const a = BY_REG.get(reg.toLowerCase());
  if (!a) notFound();
  if (lang !== "fr") redirect(`/fr/canadair/${a.reg.toLowerCase()}`);

  const [planes, missions] = await Promise.all([
    getWaterBombers().catch(() => []),
    listFiresByAircraft(a.hex, 30),
  ]);
  const live = planes.find((p) => p.id.toLowerCase() === a.hex.toLowerCase()) ?? null;
  const others = Object.values(FRENCH_FLEET).filter((x) => x.reg !== a.reg).slice(0, 30);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/canadair" style={{ color: "var(--link)" }}>Canadair en direct</Link> · flotte Sécurité Civile
        </p>
        <h1 className="mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          🇫🇷 {a.reg} — {a.model}
        </h1>

        {live ? (
          <div className="mb-6 rounded-[18px] p-5" style={{ background: "var(--danger-soft)" }}>
            <p className="text-[15px] font-semibold" style={{ color: "#9C2B2B" }}>
              ✈️ En vol en ce moment — {live.speed} kn{live.alt != null ? ` · ${live.alt.toLocaleString("fr-FR")} ft` : ""}
            </p>
            <Link
              href={`/fr?lat=${live.lat.toFixed(3)}&lon=${live.lon.toFixed(3)}&z=9`}
              className="mt-3 flex h-[46px] items-center justify-center rounded-full text-[14.5px] font-semibold"
              style={{ background: "var(--canary)", color: "var(--charcoal)" }}
            >
              Le suivre sur la carte →
            </Link>
          </div>
        ) : (
          <p className="mb-6 rounded-[14px] px-4 py-3 text-[13.5px]" style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}>
            Au sol actuellement (ou transpondeur coupé). Les appareils de la flotte apparaissent
            sur la carte dès qu'ils décollent — généralement de jour, en période de feux.
          </p>
        )}

        <section className="mb-7">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Feux sur lesquels kanari l'a observé
          </h2>
          {missions.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--ink-3)" }}>
              Aucune mission enregistrée depuis le début de l'archive (3 août 2026). L'historique
              se remplit automatiquement à chaque feu survolé.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {missions.map((f: ArchivedFire) => {
                const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
                return (
                  <Link
                    key={f.slug}
                    href={`/fr/feu/${f.slug}`}
                    className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {f.place ?? "Détection satellite"}{deptName ? ` — ${deptName}` : ""}
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {frDateTime(f.first_seen)} · {f.detections} détection{f.detections > 1 ? "s" : ""} · {Math.round(f.max_frp)} MW
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Le reste de la flotte</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13.5px]">
            {others.map((o) => (
              <Link key={o.reg} href={`/fr/canadair/${o.reg.toLowerCase()}`} style={{ color: "var(--link)" }}>
                {o.reg}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          Suivi ADS-B (airplanes.live) — « observé » signifie détecté à moins de 40 km d'un foyer
          archivé pendant son activité. kanari est un service indépendant. Urgence : 18 ou 112.
        </p>
      </div>
    </div>
  );
}
