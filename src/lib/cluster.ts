// Regroupement des détections thermiques en "foyers" (événements).
// Grille spatiale + composantes connexes (8-voisinage) : deux détections dans
// des cellules adjacentes appartiennent au même foyer. Sans état : recalculé
// à chaque rafraîchissement du cache, aucun stockage requis.

import type { FireFeature } from "./firms";
import type { SocialPost } from "./social";

// possible = signal satellite isolé ; probable = signaux satellites multiples
// ou confiance haute ; corroboré = satellite + témoignages humains proches.
export type Confidence = "possible" | "probable" | "corrobore";

export type FireEvent = {
  id: string;
  centroid: [number, number]; // [lon, lat]
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  count: number;
  viirsCount: number;
  goesCount: number;
  mtgCount: number;
  firstSeen: string; // ISO — première détection = proxy de l'heure d'ignition
  lastSeen: string;
  maxFrp: number;
  maxConf: "l" | "n" | "h";
  confidence?: Confidence;
  social?: {
    place: string;
    postCount: number;
    posts: SocialPost[];
    firstPress?: string; // 1er article de presse — pour mesurer notre avance
    // Distance centroïde du foyer -> lieu cité (km) : affichée quand elle est
    // significative — un témoignage « près de Montereau » attaché à un feu de
    // Fontainebleau (30 km) sans le dire minait la confiance (retour terrain).
    distanceKm?: number;
  };
};

// ~4,4 km à l'équateur : assez large pour absorber l'imprécision GOES (2 km),
// assez fin pour séparer deux feux distincts.
const CELL = 0.04;

const CONF_RANK = { l: 0, n: 1, h: 2 } as const;

export function clusterFires(features: FireFeature[]): FireEvent[] {
  const cells = new Map<string, FireFeature[]>();
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;
    const arr = cells.get(key);
    if (arr) arr.push(f);
    else cells.set(key, [f]);
  }

  const visited = new Set<string>();
  const events: FireEvent[] = [];

  for (const startKey of cells.keys()) {
    if (visited.has(startKey)) continue;
    // BFS sur les cellules occupées voisines
    const queue = [startKey];
    visited.add(startKey);
    const members: FireFeature[] = [];
    while (queue.length) {
      const key = queue.pop()!;
      members.push(...cells.get(key)!);
      const [cx, cy] = key.split(":").map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const nk = `${cx + dx}:${cy + dy}`;
          if (cells.has(nk) && !visited.has(nk)) {
            visited.add(nk);
            queue.push(nk);
          }
        }
      }
    }

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    let sumLon = 0, sumLat = 0, maxFrp = 0;
    let viirsCount = 0, goesCount = 0, mtgCount = 0;
    let firstSeen = "9999", lastSeen = "0000";
    let maxConf: FireEvent["maxConf"] = "l";
    for (const m of members) {
      const [lon, lat] = m.geometry.coordinates;
      sumLon += lon;
      sumLat += lat;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
      if (m.properties.frp > maxFrp) maxFrp = m.properties.frp;
      if (m.properties.src === "goes") goesCount++;
      else if (m.properties.src === "mtg") mtgCount++;
      else viirsCount++;
      if (m.properties.acq < firstSeen) firstSeen = m.properties.acq;
      if (m.properties.acq > lastSeen) lastSeen = m.properties.acq;
      if (CONF_RANK[m.properties.conf] > CONF_RANK[maxConf]) maxConf = m.properties.conf;
    }
    const centroid: [number, number] = [sumLon / members.length, sumLat / members.length];
    events.push({
      id: `${firstSeen.slice(0, 13)}_${centroid[0].toFixed(2)}_${centroid[1].toFixed(2)}`,
      centroid,
      bbox: [minLon, minLat, maxLon, maxLat],
      count: members.length,
      viirsCount,
      goesCount,
      mtgCount,
      firstSeen,
      lastSeen,
      maxFrp: Math.round(maxFrp * 10) / 10,
      maxConf,
    });
  }

  // Les foyers les plus récents d'abord : la précocité est le produit.
  events.sort((a, b) => (a.firstSeen < b.firstSeen ? 1 : -1));
  return events;
}
