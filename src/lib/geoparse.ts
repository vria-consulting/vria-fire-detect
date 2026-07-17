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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019\u02bc]/g, "'"); // apostrophes typographiques \u2192 droite (cl\u00e9s du gazetteer)
}

// Extrait les lieux mentionnés : n-grammes (1 à 3 mots) commençant par une
// majuscule dans le texte original, cherchés dans le gazetteer.
// Nombre de NOMS de lieux distincts trouvés (pour le garde-fou « revue de
// presse » : 4+ noms différents = récapitulatif, pas un signalement).
export function countPlaceNames(text: string): number {
  return new Set(rawMatches(text).map((m) => m.key)).size;
}

function rawMatches(text: string): { key: string; entry: GazetteerEntry }[] {
  // L'élision française collée par apostrophe typographique (« d'Épouville »,
  // « l'Aquila ») masquait la majuscule du nom : on la détache du token.
  const tokens = text
    .split(/[^\p{L}''ʼ-]+/u)
    .filter(Boolean)
    .map((t) => (/^\p{Ll}[''ʼ]\p{Lu}/u.test(t) ? t.slice(2) : t));
  const found = new Map<string, GazetteerEntry[]>();
  for (let i = 0; i < tokens.length; i++) {
    // Un nom de lieu commence par une majuscule.
    if (!/\p{Lu}/u.test(tokens[i][0])) continue;
    // Le n-gramme le plus long gagne — borné par la fin du texte : un lieu en
    // dernier mot doit être trouvé (l'ancien « break » sautait ce cas et
    // manquait tout signalement du type « Incendio forestal en Guadalajara »).
    for (let n = Math.min(3, tokens.length - i); n >= 1; n--) {
      const gram = tokens.slice(i, i + n).join(" ");
      const key = normalizePlace(gram);
      const entries = GAZETTEER[key];
      if (entries) {
        found.set(key, entries);
        break;
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
