// Géoparsing par gazetteer : n-grammes capitalisés (1 à 3 mots) cherchés dans
// le dictionnaire GeoNames embarqué (villes 5000+ hab., licence CC-BY).
// Module pur (aucune dépendance réseau) — testable isolément.

import cities from "../data/cities.json";

// [lat, lon, countryCode, displayName]
export type GazetteerEntry = [number, number, string, string];

// Chaque nom pointe vers jusqu'à 4 homonymes (pays distincts d'abord) : c'est
// le juge IA qui choisit le bon d'après le contexte du texte — indispensable
// pour Guadalajara (MX vs ES), Gisborne (NZ vs AU), etc.
const GAZETTEER = cities as unknown as Record<string, GazetteerEntry[]>;

export function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrait les lieux mentionnés : n-grammes (1 à 3 mots) commençant par une
// majuscule dans le texte original, cherchés dans le gazetteer.
// Nombre de NOMS de lieux distincts trouvés (pour le garde-fou « revue de
// presse » : 4+ noms différents = récapitulatif, pas un signalement).
export function countPlaceNames(text: string): number {
  return new Set(rawMatches(text).map((m) => m.key)).size;
}

function rawMatches(text: string): { key: string; entry: GazetteerEntry }[] {
  const tokens = text.split(/[^\p{L}''-]+/u).filter(Boolean);
  const found = new Map<string, GazetteerEntry[]>();
  for (let i = 0; i < tokens.length; i++) {
    // Un nom de lieu commence par une majuscule.
    if (!/\p{Lu}/u.test(tokens[i][0])) continue;
    for (let n = 3; n >= 1; n--) {
      if (i + n > tokens.length) break;
      const gram = tokens.slice(i, i + n).join(" ");
      const key = normalizePlace(gram);
      const entries = GAZETTEER[key];
      if (entries) {
        found.set(key, entries);
        break; // le n-gramme le plus long gagne
      }
    }
  }
  const flat: { key: string; entry: GazetteerEntry }[] = [];
  for (const [key, entries] of found) {
    for (const entry of entries) flat.push({ key, entry });
  }
  return flat;
}

// Tous les candidats (homonymes inclus), plafonnés pour garder le prompt du
// juge compact. Le juge choisit l'entrée cohérente avec le texte, ou aucune.
export function extractPlaces(
  text: string,
  maxCandidates = 8
): { key: string; entry: GazetteerEntry }[] {
  return rawMatches(text).slice(0, maxCandidates);
}
