import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { COUNTRY_BY_SLUG } from "@/lib/countries";
import { listFiresByCountry, type ArchivedFire } from "@/lib/firearchive";
import { SiteFooter } from "@/components/SiteFooter";

// English local pages: "wildfires in [country] today" — the same play as the
// French department pages, worldwide market.
export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}): Promise<Metadata> {
  const { country } = await params;
  const c = COUNTRY_BY_SLUG.get(country);
  if (!c) return {};
  return {
    title: `Wildfires in ${c.name} today: live fire map and latest ignitions | kanari`,
    description: `Is there a wildfire in ${c.name} right now? Live map of fire ignitions detected by satellite (NASA FIRMS, GOES, MTG) and verified witness reports, plus the latest significant fires. Free, no account.`,
    alternates: { canonical: `/en/fires/${c.slug}` },
  };
}

export default async function CountryFires({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}) {
  const { lang, country } = await params;
  if (!isValidLang(lang)) notFound();
  const c = COUNTRY_BY_SLUG.get(country);
  if (!c) notFound();
  if (lang !== "en") redirect(`/en/fires/${c.slug}`);

  const fires = await listFiresByCountry(c.cc, 25);
  const active = fires.filter((f) => f.status === "active");
  const now = new Date().toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const mapHref = `/en?lat=${c.lat}&lon=${c.lon}&z=${c.zoom}`;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/en/fires" style={{ color: "var(--link)" }}>Wildfires by country</Link>
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Wildfires in {c.name}: the live situation
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          As of {now} UTC — significant fires archived by kanari from satellite detections
          (NASA FIRMS, GOES, Meteosat MTG) and AI-verified witness reports. Continuously updated.
        </p>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: active.length > 0 ? "#D64545" : "#22684A" }}>
              {active.length}
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {active.length === 1 ? "fire currently tracked" : "fires currently tracked"}
            </div>
          </div>
        </div>

        <Link
          href={mapHref}
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Open the live map of {c.name} →
        </Link>

        {fires.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Latest significant fires
            </h2>
            <div className="flex flex-col gap-2">
              {fires.map((f: ArchivedFire) => (
                <Link
                  key={f.slug}
                  href={`/fr/feu/${f.slug}`}
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: f.status === "active" ? "#D64545" : "#8A8880" }} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                      {f.place ?? "Satellite detection"}{f.admin ? ` — ${f.admin}` : ""}
                    </strong>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                      {f.detections} detection{f.detections > 1 ? "s" : ""} · {Math.round(f.max_frp)} MW max
                      {f.aircraft.length > 0 ? ` · ${f.aircraft.length} aircraft observed` : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--ink-3)" }}>{ago(f.last_seen)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            How do I know if there is a fire near me in {c.name}?
          </h2>
          <p className="mb-3">
            kanari continuously fuses thermal detections from satellites (VIIRS at 375 m
            resolution, geostationary GOES and Meteosat MTG re-scanning every 10 minutes) with
            witness reports published on social networks, each verified twice by AI before being
            shown. A new ignition can appear on the map within minutes of its first signals —
            often before the press.
          </p>
          <p>
            You can also <Link href="/en/canadair" style={{ color: "var(--link)" }}>track water
            bombers live</Link> while they operate. If you witness a fire starting, call your
            local emergency number first (112 in Europe, 911 in North America).
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari is a free, independent information service — not an official alert channel.
          Open data: <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>full fire archive (CSV, CC BY 4.0)</a>.
        </p>
        <SiteFooter lang="en" />
      </div>
    </div>
  );
}
