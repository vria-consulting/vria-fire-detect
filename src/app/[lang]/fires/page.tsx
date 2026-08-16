import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { COUNTRIES, COUNTRY_BY_CC } from "@/lib/countries";
import { US_STATES } from "@/lib/us-states";
import { listFiresBetween } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";

// English hub: wildfires by country, with live counts from the archive.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Wildfires today by country: live world fire map | kanari",
    description:
      "Where are the wildfires right now? Live country-by-country view of fire ignitions detected by satellite and verified witnesses: United States, Canada, Greece, Spain, Australia and more.",
    alternates: { canonical: "/en/fires" },
  };
}

function flag(cc: string): string {
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default async function FiresHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "en") redirect("/en/fires");

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const fires = await listFiresBetween(weekAgo, new Date().toISOString(), 5000);
  const byCc = new Map<string, number>();
  for (const f of fires) if (f.country) byCc.set(f.country, (byCc.get(f.country) ?? 0) + 1);
  const hot = [...byCc.entries()]
    .filter(([cc]) => COUNTRY_BY_CC.has(cc))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Wildfires today, country by country
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Significant fires detected over the last 7 days by satellites (NASA FIRMS, GOES,
          Meteosat MTG) and AI-verified witnesses, archived continuously by kanari.
        </p>
        <Link
          href="/en"
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Open the live world map →
        </Link>

        {hot.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Most affected this week
            </h2>
            <div className="flex flex-col gap-2">
              {hot.map(([cc, n]) => {
                const c = COUNTRY_BY_CC.get(cc)!;
                return (
                  <Link
                    key={cc}
                    href={`/en/fires/${c.slug}`}
                    className="flex items-center justify-between rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                      {flag(cc)} {c.name.replace(/^the /, "")}
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: "#D64545" }}>
                      {n} fire{n > 1 ? "s" : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            All countries
          </h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
            {COUNTRIES.map((c) => (
              <Link key={c.slug} href={`/en/fires/${c.slug}`} style={{ color: "var(--link)" }}>
                {c.name.replace(/^the /, "")}
              </Link>
            ))}
          </p>
        </section>

        {/* Le maillage 50 États : le marché de recherche feu n°1 au monde
            ("california fire map"…) — chaque État a sa page locale live. */}
        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            United States, state by state
          </h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed">
            {US_STATES.map((s) => (
              <Link key={s.slug} href={`/en/fires/${s.slug}`} style={{ color: "var(--link)" }}>
                {s.name}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari is a free, independent information service — not an official alert channel. See
          also: <Link href="/en/canadair" style={{ color: "var(--link)" }}>water bombers live</Link> ·{" "}
          <Link href="/en/faq" style={{ color: "var(--link)" }}>FAQ</Link> ·{" "}
          <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>open data (CSV)</a>.
        </p>
        <SiteFooter lang="en" />
      </div>
    </div>
  );
}
