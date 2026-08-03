// Référentiel des départements français pour les pages locales SEO
// (/fr/feux/[dept]). Centre approximatif (± quelques km : sert à centrer la
// carte et à filtrer les foyers dans un rayon), pas une géométrie officielle.

export type Departement = {
  code: string; // "33", "2A", "974"…
  slug: string; // "gironde"
  name: string; // "Gironde"
  lat: number;
  lon: number;
};

export const DEPARTEMENTS: Departement[] = [
  { code: "01", slug: "ain", name: "Ain", lat: 46.05, lon: 5.35 },
  { code: "02", slug: "aisne", name: "Aisne", lat: 49.45, lon: 3.6 },
  { code: "03", slug: "allier", name: "Allier", lat: 46.4, lon: 3.2 },
  { code: "04", slug: "alpes-de-haute-provence", name: "Alpes-de-Haute-Provence", lat: 44.1, lon: 6.25 },
  { code: "05", slug: "hautes-alpes", name: "Hautes-Alpes", lat: 44.65, lon: 6.3 },
  { code: "06", slug: "alpes-maritimes", name: "Alpes-Maritimes", lat: 43.85, lon: 7.15 },
  { code: "07", slug: "ardeche", name: "Ardèche", lat: 44.75, lon: 4.4 },
  { code: "08", slug: "ardennes", name: "Ardennes", lat: 49.65, lon: 4.65 },
  { code: "09", slug: "ariege", name: "Ariège", lat: 42.95, lon: 1.5 },
  { code: "10", slug: "aube", name: "Aube", lat: 48.3, lon: 4.1 },
  { code: "11", slug: "aude", name: "Aude", lat: 43.1, lon: 2.4 },
  { code: "12", slug: "aveyron", name: "Aveyron", lat: 44.3, lon: 2.7 },
  { code: "13", slug: "bouches-du-rhone", name: "Bouches-du-Rhône", lat: 43.45, lon: 5.15 },
  { code: "14", slug: "calvados", name: "Calvados", lat: 49.1, lon: -0.35 },
  { code: "15", slug: "cantal", name: "Cantal", lat: 45.0, lon: 2.65 },
  { code: "16", slug: "charente", name: "Charente", lat: 45.7, lon: 0.15 },
  { code: "17", slug: "charente-maritime", name: "Charente-Maritime", lat: 45.75, lon: -0.75 },
  { code: "18", slug: "cher", name: "Cher", lat: 47.05, lon: 2.5 },
  { code: "19", slug: "correze", name: "Corrèze", lat: 45.35, lon: 1.9 },
  { code: "2A", slug: "corse-du-sud", name: "Corse-du-Sud", lat: 41.85, lon: 8.95 },
  { code: "2B", slug: "haute-corse", name: "Haute-Corse", lat: 42.4, lon: 9.2 },
  { code: "21", slug: "cote-d-or", name: "Côte-d'Or", lat: 47.45, lon: 4.85 },
  { code: "22", slug: "cotes-d-armor", name: "Côtes-d'Armor", lat: 48.45, lon: -2.85 },
  { code: "23", slug: "creuse", name: "Creuse", lat: 46.05, lon: 2.0 },
  { code: "24", slug: "dordogne", name: "Dordogne", lat: 45.15, lon: 0.75 },
  { code: "25", slug: "doubs", name: "Doubs", lat: 47.15, lon: 6.35 },
  { code: "26", slug: "drome", name: "Drôme", lat: 44.7, lon: 5.15 },
  { code: "27", slug: "eure", name: "Eure", lat: 49.1, lon: 1.0 },
  { code: "28", slug: "eure-et-loir", name: "Eure-et-Loir", lat: 48.4, lon: 1.35 },
  { code: "29", slug: "finistere", name: "Finistère", lat: 48.25, lon: -4.05 },
  { code: "30", slug: "gard", name: "Gard", lat: 43.95, lon: 4.2 },
  { code: "31", slug: "haute-garonne", name: "Haute-Garonne", lat: 43.35, lon: 1.2 },
  { code: "32", slug: "gers", name: "Gers", lat: 43.65, lon: 0.45 },
  { code: "33", slug: "gironde", name: "Gironde", lat: 44.8, lon: -0.6 },
  { code: "34", slug: "herault", name: "Hérault", lat: 43.6, lon: 3.4 },
  { code: "35", slug: "ille-et-vilaine", name: "Ille-et-Vilaine", lat: 48.15, lon: -1.65 },
  { code: "36", slug: "indre", name: "Indre", lat: 46.8, lon: 1.6 },
  { code: "37", slug: "indre-et-loire", name: "Indre-et-Loire", lat: 47.25, lon: 0.7 },
  { code: "38", slug: "isere", name: "Isère", lat: 45.25, lon: 5.6 },
  { code: "39", slug: "jura", name: "Jura", lat: 46.75, lon: 5.7 },
  { code: "40", slug: "landes", name: "Landes", lat: 43.95, lon: -0.8 },
  { code: "41", slug: "loir-et-cher", name: "Loir-et-Cher", lat: 47.6, lon: 1.4 },
  { code: "42", slug: "loire", name: "Loire", lat: 45.6, lon: 4.2 },
  { code: "43", slug: "haute-loire", name: "Haute-Loire", lat: 45.1, lon: 3.8 },
  { code: "44", slug: "loire-atlantique", name: "Loire-Atlantique", lat: 47.35, lon: -1.7 },
  { code: "45", slug: "loiret", name: "Loiret", lat: 47.9, lon: 2.3 },
  { code: "46", slug: "lot", name: "Lot", lat: 44.6, lon: 1.6 },
  { code: "47", slug: "lot-et-garonne", name: "Lot-et-Garonne", lat: 44.35, lon: 0.45 },
  { code: "48", slug: "lozere", name: "Lozère", lat: 44.5, lon: 3.5 },
  { code: "49", slug: "maine-et-loire", name: "Maine-et-Loire", lat: 47.4, lon: -0.55 },
  { code: "50", slug: "manche", name: "Manche", lat: 49.1, lon: -1.3 },
  { code: "51", slug: "marne", name: "Marne", lat: 48.95, lon: 4.3 },
  { code: "52", slug: "haute-marne", name: "Haute-Marne", lat: 48.1, lon: 5.25 },
  { code: "53", slug: "mayenne", name: "Mayenne", lat: 48.15, lon: -0.65 },
  { code: "54", slug: "meurthe-et-moselle", name: "Meurthe-et-Moselle", lat: 48.8, lon: 6.15 },
  { code: "55", slug: "meuse", name: "Meuse", lat: 48.95, lon: 5.4 },
  { code: "56", slug: "morbihan", name: "Morbihan", lat: 47.85, lon: -2.85 },
  { code: "57", slug: "moselle", name: "Moselle", lat: 49.05, lon: 6.55 },
  { code: "58", slug: "nievre", name: "Nièvre", lat: 47.1, lon: 3.5 },
  { code: "59", slug: "nord", name: "Nord", lat: 50.45, lon: 3.2 },
  { code: "60", slug: "oise", name: "Oise", lat: 49.4, lon: 2.4 },
  { code: "61", slug: "orne", name: "Orne", lat: 48.6, lon: 0.1 },
  { code: "62", slug: "pas-de-calais", name: "Pas-de-Calais", lat: 50.45, lon: 2.3 },
  { code: "63", slug: "puy-de-dome", name: "Puy-de-Dôme", lat: 45.75, lon: 3.1 },
  { code: "64", slug: "pyrenees-atlantiques", name: "Pyrénées-Atlantiques", lat: 43.25, lon: -0.75 },
  { code: "65", slug: "hautes-pyrenees", name: "Hautes-Pyrénées", lat: 43.05, lon: 0.15 },
  { code: "66", slug: "pyrenees-orientales", name: "Pyrénées-Orientales", lat: 42.6, lon: 2.55 },
  { code: "67", slug: "bas-rhin", name: "Bas-Rhin", lat: 48.65, lon: 7.6 },
  { code: "68", slug: "haut-rhin", name: "Haut-Rhin", lat: 47.85, lon: 7.25 },
  { code: "69", slug: "rhone", name: "Rhône", lat: 45.85, lon: 4.65 },
  { code: "70", slug: "haute-saone", name: "Haute-Saône", lat: 47.65, lon: 6.1 },
  { code: "71", slug: "saone-et-loire", name: "Saône-et-Loire", lat: 46.65, lon: 4.55 },
  { code: "72", slug: "sarthe", name: "Sarthe", lat: 48.0, lon: 0.2 },
  { code: "73", slug: "savoie", name: "Savoie", lat: 45.5, lon: 6.45 },
  { code: "74", slug: "haute-savoie", name: "Haute-Savoie", lat: 46.05, lon: 6.4 },
  { code: "75", slug: "paris", name: "Paris", lat: 48.86, lon: 2.35 },
  { code: "76", slug: "seine-maritime", name: "Seine-Maritime", lat: 49.65, lon: 1.0 },
  { code: "77", slug: "seine-et-marne", name: "Seine-et-Marne", lat: 48.6, lon: 2.95 },
  { code: "78", slug: "yvelines", name: "Yvelines", lat: 48.8, lon: 1.85 },
  { code: "79", slug: "deux-sevres", name: "Deux-Sèvres", lat: 46.55, lon: -0.3 },
  { code: "80", slug: "somme", name: "Somme", lat: 49.95, lon: 2.3 },
  { code: "81", slug: "tarn", name: "Tarn", lat: 43.8, lon: 2.15 },
  { code: "82", slug: "tarn-et-garonne", name: "Tarn-et-Garonne", lat: 44.05, lon: 1.3 },
  { code: "83", slug: "var", name: "Var", lat: 43.45, lon: 6.2 },
  { code: "84", slug: "vaucluse", name: "Vaucluse", lat: 44.0, lon: 5.15 },
  { code: "85", slug: "vendee", name: "Vendée", lat: 46.65, lon: -1.3 },
  { code: "86", slug: "vienne", name: "Vienne", lat: 46.55, lon: 0.45 },
  { code: "87", slug: "haute-vienne", name: "Haute-Vienne", lat: 45.9, lon: 1.2 },
  { code: "88", slug: "vosges", name: "Vosges", lat: 48.15, lon: 6.4 },
  { code: "89", slug: "yonne", name: "Yonne", lat: 47.85, lon: 3.6 },
  { code: "90", slug: "territoire-de-belfort", name: "Territoire de Belfort", lat: 47.63, lon: 6.9 },
  { code: "91", slug: "essonne", name: "Essonne", lat: 48.52, lon: 2.25 },
  { code: "92", slug: "hauts-de-seine", name: "Hauts-de-Seine", lat: 48.85, lon: 2.24 },
  { code: "93", slug: "seine-saint-denis", name: "Seine-Saint-Denis", lat: 48.92, lon: 2.45 },
  { code: "94", slug: "val-de-marne", name: "Val-de-Marne", lat: 48.78, lon: 2.45 },
  { code: "95", slug: "val-d-oise", name: "Val-d'Oise", lat: 49.05, lon: 2.15 },
  { code: "971", slug: "guadeloupe", name: "Guadeloupe", lat: 16.2, lon: -61.55 },
  { code: "972", slug: "martinique", name: "Martinique", lat: 14.65, lon: -61.0 },
  { code: "973", slug: "guyane", name: "Guyane", lat: 4.0, lon: -53.0 },
  { code: "974", slug: "la-reunion", name: "La Réunion", lat: -21.13, lon: 55.53 },
  { code: "976", slug: "mayotte", name: "Mayotte", lat: -12.83, lon: 45.15 },
];

export const DEPT_BY_SLUG = new Map(DEPARTEMENTS.map((d) => [d.slug, d]));

// Rayon de recherche des foyers autour du centre (couvre le département et
// ses abords immédiats — un feu limitrophe concerne aussi les riverains).
export const DEPT_RADIUS_KM = 80;

export function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const kx = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)) * 111.32;
  const dx = (lon1 - lon2) * kx;
  const dy = (lat1 - lat2) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}
