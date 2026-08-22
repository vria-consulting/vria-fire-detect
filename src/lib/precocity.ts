// Précocité mesurée : pour chaque foyer corroboré des 72 dernières heures,
// l'écart entre le premier passage satellite (horodatage NASA/EUMETSAT) et le
// premier article de presse détecté (GDELT). Partagé entre la page
// /[lang]/precocite et le serveur MCP — même calcul, mêmes chiffres.

import { readJson } from "@/lib/store";
import type { EventsPayload } from "@/lib/eventscache";

export type EarlinessCase = {
  place: string;
  firstSeen: string;
  firstPress: string;
  deltaMin: number;
  lat: number;
  lon: number;
};

export type EarlinessReport = {
  cases: EarlinessCase[];
  total: number;
  fetchedAt: string | null;
  medianMin: number | null;
};

export async function measuredEarliness(limit = 20): Promise<EarlinessReport> {
  const payload = await readJson<EventsPayload | null>("events-72h.json", null);
  if (!payload) return { cases: [], total: 0, fetchedAt: null, medianMin: null };
  const cases: EarlinessCase[] = [];
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
  const sortedDeltas = cases.map((c) => c.deltaMin).sort((a, b) => a - b);
  const medianMin = sortedDeltas.length > 0 ? sortedDeltas[Math.floor(sortedDeltas.length / 2)] : null;
  return { cases: cases.slice(0, limit), total: payload.events.length, fetchedAt: payload.meta.fetchedAt, medianMin };
}
