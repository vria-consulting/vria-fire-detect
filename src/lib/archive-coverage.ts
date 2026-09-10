import { unstable_cache } from "next/cache";
import { archivePages, archiveConfigured } from "./archive-reader";

// Compact shared manifest. Failure throws, so ISR retains the previous sitemap.
export const archiveCoverage = unstable_cache(async () => {
  if (!archiveConfigured()) return null;
  const months: Record<string, { total: number; countries: Record<string, number> }> = {};
  for await (const rows of archivePages<{ slug: string; first_seen: string; country: string | null }>("select=slug,first_seen,country")) {
    for (const r of rows) {
      const m = r.first_seen.slice(0, 7);
      const entry = months[m] ??= { total: 0, countries: {} };
      entry.total++;
      if (r.country) entry.countries[r.country] = (entry.countries[r.country] ?? 0) + 1;
    }
  }
  return months;
}, ["archive-coverage-v1"], { revalidate: 1800 });
