// Satellite timestamps versus matched press timestamps, NOT kanari publication latency.
import { readJson } from "@/lib/store";
import type { EventsPayload } from "@/lib/eventscache";

export type EarlinessCase = {
  place: string; firstSeen: string; firstPress: string; deltaMin: number;
  lat: number; lon: number; articleUrl: string | null;
};
export type EarlinessReport = {
  cases: EarlinessCase[]; total: number; matched: number;
  satelliteFirst: number; pressFirst: number; simultaneous: number;
  fetchedAt: string | null; medianMin: number | null;
};

export function summarizeEarliness(payload: EventsPayload | null, limit = 20): EarlinessReport {
  const cases: EarlinessCase[] = [];
  const seen = new Set<string>();
  for (const ev of payload?.events ?? []) {
    if (!ev.social?.firstPress || !ev.social.place) continue;
    const delta = Date.parse(ev.social.firstPress) - Date.parse(ev.firstSeen);
    if (!Number.isFinite(delta)) continue;
    const key = JSON.stringify([ev.centroid, ev.firstSeen, ev.social.firstPress]);
    if (seen.has(key)) continue;
    seen.add(key);
    const post = ev.social.posts.find((p) => p.source === "presse" && Date.parse(p.createdAt) === Date.parse(ev.social!.firstPress!));
    cases.push({
      place: ev.social.place, firstSeen: ev.firstSeen, firstPress: ev.social.firstPress,
      deltaMin: Math.round(delta / 60_000), lat: ev.centroid[1], lon: ev.centroid[0],
      articleUrl: post && /^https?:\/\//.test(post.url) ? post.url : null,
    });
  }
  const values = cases.map((c) => c.deltaMin).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const medianMin = values.length ? (values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2) : null;
  // Recent matched records, never a selection based on a favourable lead.
  cases.sort((a, b) => Date.parse(b.firstPress) - Date.parse(a.firstPress) || Date.parse(b.firstSeen) - Date.parse(a.firstSeen));
  return {
    cases: cases.slice(0, limit), total: payload?.events.length ?? 0, matched: cases.length,
    satelliteFirst: cases.filter((c) => c.deltaMin > 0).length,
    pressFirst: cases.filter((c) => c.deltaMin < 0).length,
    simultaneous: cases.filter((c) => c.deltaMin === 0).length,
    fetchedAt: payload?.meta.fetchedAt ?? null, medianMin,
  };
}
export async function measuredEarliness(limit = 20): Promise<EarlinessReport> {
  return summarizeEarliness(await readJson<EventsPayload | null>("events-72h.json", null), limit);
}
