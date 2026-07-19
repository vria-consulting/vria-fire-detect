// Niveau 3 — CONTRE-VÉRIFICATION « COMME UN HUMAIN » : pour un échantillon de
// foyers affichés, on retourne à la source (CSV FIRMS brut autour du foyer) et
// on vérifie que la position, le premier et le dernier signal correspondent à
// de vraies détections satellite. On vérifie aussi la distance des
// corroborations citoyennes et la fraîcheur des données (cron).

import { check, fetchT, hoursAgo, type QaOptions, type QaEvent } from "./util";
import { getEvents, getSignals } from "./endpoints";
import { haversineKm } from "../../src/lib/socialscan";

const L = "3-croisement";

type RawDetection = { lat: number; lon: number; acq: number; frp: number };

async function fetchRawAround(
  firmsKey: string,
  ev: QaEvent,
  windowH: number
): Promise<RawDetection[]> {
  const [lon, lat] = ev.centroid;
  const bbox = `${(lon - 0.3).toFixed(2)},${(lat - 0.3).toFixed(2)},${(lon + 0.3).toFixed(2)},${(lat + 0.3).toFixed(2)}`;
  const elapsedTodayH = (Date.now() % 86_400_000) / 3_600_000;
  const days = Math.min(10, Math.max(1, Math.ceil((windowH - elapsedTodayH) / 24) + 1));
  const sources: string[] = [];
  if (ev.viirsCount > 0) sources.push("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT");
  if (ev.goesCount > 0) sources.push("GOES_NRT");
  const out: RawDetection[] = [];
  for (const src of sources) {
    const res = await fetchT(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/${src}/${bbox}/${days}`,
      60_000
    );
    const text = await res.text();
    if (!res.ok || text.startsWith("Invalid")) continue;
    const lines = text.trim().split("\n");
    const header = lines[0].split(",");
    const iLat = header.indexOf("latitude");
    const iLon = header.indexOf("longitude");
    const iDate = header.indexOf("acq_date");
    const iTime = header.indexOf("acq_time");
    const iFrp = header.indexOf("frp");
    for (let k = 1; k < lines.length; k++) {
      const f = lines[k].split(",");
      const hhmm = (f[iTime] ?? "0").padStart(4, "0");
      out.push({
        lat: parseFloat(f[iLat]),
        lon: parseFloat(f[iLon]),
        acq: Date.parse(`${f[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`),
        frp: parseFloat(f[iFrp]) || 0,
      });
    }
  }
  return out;
}

export async function runCrosscheck(opts: QaOptions): Promise<void> {
  const firmsKey = process.env.FIRMS_MAP_KEY;
  const t = opts.target;

  // ---- Fraîcheur des données = le cron tourne --------------------------------
  await check(L, "Fraîcheur des foyers (cron réchauffe les caches)", async () => {
    const data = await getEvents(t, 24);
    const ageMin = (Date.now() - Date.parse(data.meta.fetchedAt)) / 60_000;
    if (ageMin > 30) return { verdict: "FAIL", detail: `données FIRMS vieilles de ${Math.round(ageMin)} min` };
    if (ageMin > 10) return { verdict: "WARN", detail: `fetchedAt il y a ${Math.round(ageMin)} min` };
    return { verdict: "PASS", detail: `données rafraîchies il y a ${Math.round(ageMin)} min` };
  });

  await check(L, "Fraîcheur de la veille sociale", async () => {
    const data = await getSignals(t);
    const ageMin = (Date.now() - Date.parse(data.meta.fetchedAt)) / 60_000;
    if (ageMin > 30) return { verdict: "FAIL", detail: `scan social vieux de ${Math.round(ageMin)} min` };
    if (ageMin > 15) return { verdict: "WARN", detail: `scan il y a ${Math.round(ageMin)} min` };
    return { verdict: "PASS", detail: `scan social il y a ${Math.round(ageMin)} min` };
  });

  // ---- Retour à la source : chaque foyer échantillonné existe dans le CSV brut
  if (!firmsKey) {
    await check(L, "Foyers vs CSV FIRMS brut", async () => ({
      verdict: "SKIP",
      detail: "FIRMS_MAP_KEY absente",
    }));
  } else {
    const data = await getEvents(t, 24);
    // Échantillon : les corroborés et les plus récents d'abord, puis les plus gros.
    const sample = [...data.events]
      .sort((a, b) => {
        const ca = (a.confidence === "corrobore" ? -1e9 : 0) - b.count;
        const cb = (b.confidence === "corrobore" ? -1e9 : 0) - a.count;
        return ca - cb;
      })
      .filter((ev) => ev.viirsCount + ev.goesCount > 0) // MTG seul : produit non re-téléchargeable simplement
      .slice(0, opts.eventSample);

    for (const ev of sample) {
      await check(
        L,
        `Foyer ${ev.id} (${ev.centroid[1].toFixed(2)}, ${ev.centroid[0].toFixed(2)})`,
        async () => {
          const windowH = hoursAgo(ev.firstSeen) + 1;
          const raw = await fetchRawAround(firmsKey, ev, windowH);
          const tolMs = 30 * 60_000;
          const near = raw.filter(
            (d) => haversineKm(d.lat, d.lon, ev.centroid[1], ev.centroid[0]) <= 20
          );
          const inWindow = near.filter(
            (d) =>
              d.acq >= Date.parse(ev.firstSeen) - tolMs && d.acq <= Date.parse(ev.lastSeen) + tolMs
          );
          if (inWindow.length === 0) {
            return {
              verdict: "FAIL",
              detail: `aucune détection brute à ≤ 20 km dans la fenêtre (brut proche : ${near.length})`,
            };
          }
          const notes: string[] = [];
          const firstWitness = inWindow.some((d) => Math.abs(d.acq - Date.parse(ev.firstSeen)) <= tolMs);
          const lastWitness = inWindow.some((d) => Math.abs(d.acq - Date.parse(ev.lastSeen)) <= tolMs);
          if (!firstWitness) notes.push("1er signal sans témoin brut à ±30 min");
          if (!lastWitness) notes.push("dernier signal sans témoin brut à ±30 min");
          // Le FRP affiché n'est comparable au brut FIRMS que si le foyer ne
          // contient AUCUNE détection MTG : le flux EUMETSAT direct porte ses
          // propres FRP, absents des CSV FIRMS (faux-positif détecté par la
          // rétrospective du 2026-07-19 : maxFrp 70,9 « > brut 32,9 » — le
          // 70,9 venait d'un pixel Meteosat).
          if (ev.mtgCount === 0) {
            const maxRawFrp = Math.max(...inWindow.map((d) => d.frp), 0);
            if (ev.maxFrp > maxRawFrp * 1.2 + 5) {
              notes.push(`maxFrp affiché ${ev.maxFrp} > brut ${maxRawFrp.toFixed(1)}`);
            }
          }
          if (notes.length > 0) return { verdict: "WARN", detail: notes.join(" ; ") };
          return {
            verdict: "PASS",
            detail: `${inWindow.length} détections brutes confirment position + horaires`,
          };
        }
      );
    }
  }

  // ---- Corroborations : lieu cité ≤ 30 km ET distance affichée cohérente -------
  // Rayon réduit de 50 à 30 km avec le correctif « plus proche témoin »
  // (cas Montereau/Fontainebleau) ; la distanceKm exposée par l'API doit
  // correspondre au recalcul indépendant.
  await check(L, "Distance des corroborations citoyennes", async () => {
    const [events, signals] = [await getEvents(t, 24), await getSignals(t)];
    const corroborated = events.events.filter((ev) => ev.social);
    if (corroborated.length === 0) return { verdict: "SKIP", detail: "aucun foyer corroboré actuellement" };
    const problems: string[] = [];
    let checked = 0;
    for (const ev of corroborated) {
      const sig = signals.signals.find((s) => s.place === ev.social!.place);
      if (!sig) continue; // le signal a pu expirer de la fenêtre 12 h
      checked++;
      const km = haversineKm(ev.centroid[1], ev.centroid[0], sig.lat, sig.lon);
      if (km > 30.5) problems.push(`${ev.social!.place} à ${km.toFixed(0)} km du foyer ${ev.id}`);
      const shown = (ev.social as { distanceKm?: number }).distanceKm;
      if (shown !== undefined && Math.abs(shown - km) > 1.5) {
        problems.push(`${ev.id} : distanceKm affichée ${shown} ≠ recalcul ${km.toFixed(1)}`);
      }
    }
    if (problems.length > 0) return { verdict: "FAIL", detail: problems.join(" ; ") };
    return {
      verdict: "PASS",
      detail: `${checked}/${corroborated.length} corroborations vérifiées (≤ 30 km, distance affichée cohérente)`,
    };
  });
}
