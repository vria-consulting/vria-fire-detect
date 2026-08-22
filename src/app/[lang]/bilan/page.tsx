import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { listFiresBetween } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";
import { archiveMonths } from "@/lib/observatory";
import { monthLabel } from "@/lib/observatory-i18n";

// Hub des bilans quotidiens (30 derniers jours).
export const dynamic = "force-dynamic";

const ARCHIVE_START = "2026-08-03";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Bilans quotidiens des feux de forêt en France | kanari",
    description:
      "Jour par jour, le bilan automatique des feux de forêt détectés dans le monde et en France : nombre de départs, foyers les plus puissants, moyens aériens engagés.",
    alternates: { canonical: "/fr/bilan" },
  };
}

export default async function BilanHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/bilan");

  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const fires = await listFiresBetween(`${from}T00:00:00Z`, `${today}T23:59:59Z`, 2000);
  const byDay = new Map<string, { total: number; fr: number }>();
  for (const f of fires) {
    const day = f.first_seen.slice(0, 10);
    const cur = byDay.get(day) ?? { total: 0, fr: 0 };
    cur.total++;
    if (f.country === "FR") cur.fr++;
    byDay.set(day, cur);
  }
  // Tous les jours depuis le début de l'archive (même vides), du plus récent.
  const days: string[] = [];
  for (let d = today; d >= ARCHIVE_START && days.length < 31; ) {
    days.push(d);
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - 1);
    d = t.toISOString().slice(0, 10);
  }

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Bilans quotidiens des feux de forêt
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Chaque jour, kanari archive les départs de feu significatifs détectés dans le monde.
          Le bilan est généré automatiquement, en continu.
        </p>
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const s = byDay.get(d) ?? { total: 0, fr: 0 };
            return (
              <Link
                key={d}
                href={`/fr/bilan/${d}`}
                className="flex items-center justify-between rounded-[14px] px-4 py-3"
                style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
              >
                <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                  {new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {d === today ? " (en cours)" : ""}
                </span>
                <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                  <strong style={{ color: "var(--ink)" }}>{s.total}</strong> départ{s.total > 1 ? "s" : ""}
                  {s.fr > 0 ? <> · <strong style={{ color: "#D64545" }}>{s.fr}</strong> 🇫🇷</> : ""}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Bilans mensuels : les permaliens de l'observatoire (monde, France),
            chiffres uniques et citables, mois par mois. */}
        <section className="mt-10">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Bilans mensuels
          </h2>
          <div className="flex flex-col gap-2">
            {archiveMonths().map((m) => (
              <div key={m} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
                <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>{monthLabel(m, "fr")}</span>
                <span className="text-[13.5px]">
                  <Link href={`/fr/statistiques/world/${m}`} style={{ color: "var(--link)" }}>Monde</Link>
                  {" · "}
                  <Link href={`/fr/statistiques/france/${m}`} style={{ color: "var(--link)" }}>France</Link>
                  {" · "}
                  <Link href={`/fr/statistiques`} style={{ color: "var(--link)" }}>tous les pays</Link>
                </span>
              </div>
            ))}
          </div>
        </section>
        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          Archive démarrée le 3 août 2026. Voir aussi :{" "}
          <Link href="/fr/statistiques" style={{ color: "var(--link)" }}>l'observatoire des feux</Link> ·{" "}
          <Link href="/fr/feu" style={{ color: "var(--link)" }}>l'historique feu par feu</Link>.
        </p>
        <SiteFooter lang="fr" />
      </div>
    </div>
  );
}
