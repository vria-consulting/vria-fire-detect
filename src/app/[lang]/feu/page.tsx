import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { listRecentFires } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";
import { SiteFooter } from "@/components/SiteFooter";

// Historique des feux : index des pages événement (mémoire publique kanari).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Historique des feux de forêt : chaque incendie détecté | kanari",
    description:
      "La mémoire publique des feux de forêt : chaque incendie significatif détecté par kanari a sa page permanente — chronologie, détections satellites, moyens aériens engagés.",
    alternates: { canonical: "/fr/feu" },
  };
}

function flag(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default async function FireIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/feu");

  const fires = await listRecentFires(80);
  let lastDay = "";

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Historique des feux de forêt
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Chaque feu significatif détecté par kanari (satellites + témoins vérifiés) a sa page
          permanente : chronologie, puissance, moyens aériens observés. L'archive s'enrichit
          automatiquement, feu après feu.
        </p>

        {fires.length === 0 ? (
          <p className="rounded-[14px] px-4 py-3 text-[13.5px]" style={{ background: "var(--canary-tint)", color: "var(--ink-2)" }}>
            L'archive démarre : les premiers feux apparaîtront ici dans les prochaines minutes.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {fires.map((f) => {
              const day = f.last_seen.slice(0, 10);
              const header =
                day !== lastDay ? (
                  <h2
                    key={`h-${day}`}
                    className="mb-1 mt-4 text-[12px] font-bold uppercase"
                    style={{ letterSpacing: "1.2px", color: "var(--ink-3)" }}
                  >
                    {new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </h2>
                ) : null;
              lastDay = day;
              const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
              return (
                <div key={f.slug} className="flex flex-col">
                  {header}
                  <Link
                    href={`/fr/feu/${f.slug}`}
                    className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-full"
                      style={{ background: f.status === "active" ? "#D64545" : "#8A8880" }}
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {flag(f.country)} {f.place ?? "Détection satellite"}
                        {deptName ? ` — ${deptName}` : f.admin ? ` — ${f.admin}` : ""}
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {f.detections} détection{f.detections > 1 ? "s" : ""} · {Math.round(f.max_frp)} MW max
                        {f.aircraft.length > 0 ? ` · ${f.aircraft.length} moyen(s) aérien(s)` : ""}
                        {f.confidence === "corrobore" ? " · corroboré" : ""}
                      </span>
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          Voir aussi : <Link href="/fr/bilan" style={{ color: "var(--link)" }}>bilans quotidiens</Link> ·{" "}
          <Link href="/fr/statistiques" style={{ color: "var(--link)" }}>observatoire</Link> ·{" "}
          <Link href="/fr/feux" style={{ color: "var(--link)" }}>feux par département</Link> ·{" "}
          <Link href="/fr/canadair" style={{ color: "var(--link)" }}>Canadair en direct</Link> ·{" "}
          <Link href="/fr/guide" style={{ color: "var(--link)" }}>guides</Link>. En cas d'urgence : 18 ou 112.
        </p>
        <SiteFooter lang="fr" />
      </div>
    </div>
  );
}
