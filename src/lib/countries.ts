// Fire-prone countries for the English local pages (/en/fires/[slug]).
// Center/zoom seed the map deep-link; fires come from the archive (ISO-2).

export type FireCountry = {
  cc: string; // ISO-2
  slug: string;
  name: string;
  lat: number;
  lon: number;
  zoom: number;
};

export const COUNTRIES: FireCountry[] = [
  { cc: "US", slug: "united-states", name: "the United States", lat: 39.5, lon: -98.5, zoom: 3.6 },
  { cc: "CA", slug: "canada", name: "Canada", lat: 56, lon: -106, zoom: 3.2 },
  { cc: "MX", slug: "mexico", name: "Mexico", lat: 23.8, lon: -102.5, zoom: 4.2 },
  { cc: "BR", slug: "brazil", name: "Brazil", lat: -10.8, lon: -53, zoom: 3.6 },
  { cc: "AR", slug: "argentina", name: "Argentina", lat: -34.6, lon: -65, zoom: 3.8 },
  { cc: "CL", slug: "chile", name: "Chile", lat: -35.7, lon: -71.5, zoom: 4.2 },
  { cc: "BO", slug: "bolivia", name: "Bolivia", lat: -16.7, lon: -64.4, zoom: 4.6 },
  { cc: "PE", slug: "peru", name: "Peru", lat: -9.2, lon: -75, zoom: 4.4 },
  { cc: "CO", slug: "colombia", name: "Colombia", lat: 4.6, lon: -73.1, zoom: 4.6 },
  { cc: "AU", slug: "australia", name: "Australia", lat: -25.7, lon: 134.5, zoom: 3.4 },
  { cc: "NZ", slug: "new-zealand", name: "New Zealand", lat: -41.5, lon: 172.8, zoom: 4.6 },
  { cc: "ID", slug: "indonesia", name: "Indonesia", lat: -2.5, lon: 118, zoom: 3.8 },
  { cc: "TH", slug: "thailand", name: "Thailand", lat: 15.1, lon: 101, zoom: 4.8 },
  { cc: "IN", slug: "india", name: "India", lat: 22.4, lon: 79.5, zoom: 4 },
  { cc: "RU", slug: "russia", name: "Russia", lat: 61, lon: 95, zoom: 2.6 },
  { cc: "KZ", slug: "kazakhstan", name: "Kazakhstan", lat: 48.2, lon: 66.9, zoom: 3.8 },
  { cc: "MN", slug: "mongolia", name: "Mongolia", lat: 46.9, lon: 103.8, zoom: 4.2 },
  { cc: "CN", slug: "china", name: "China", lat: 35.5, lon: 103.9, zoom: 3.6 },
  { cc: "TR", slug: "turkey", name: "Turkey", lat: 39, lon: 35.4, zoom: 4.8 },
  { cc: "GR", slug: "greece", name: "Greece", lat: 39.1, lon: 22.9, zoom: 5.6 },
  { cc: "IT", slug: "italy", name: "Italy", lat: 42.5, lon: 12.5, zoom: 5 },
  { cc: "ES", slug: "spain", name: "Spain", lat: 40.2, lon: -3.6, zoom: 5.2 },
  { cc: "PT", slug: "portugal", name: "Portugal", lat: 39.6, lon: -8, zoom: 5.8 },
  { cc: "FR", slug: "france", name: "France", lat: 46.6, lon: 2.5, zoom: 5.2 },
  { cc: "HR", slug: "croatia", name: "Croatia", lat: 44.9, lon: 16.4, zoom: 5.8 },
  { cc: "AL", slug: "albania", name: "Albania", lat: 41.1, lon: 20.1, zoom: 6.4 },
  { cc: "MK", slug: "north-macedonia", name: "North Macedonia", lat: 41.6, lon: 21.7, zoom: 6.6 },
  { cc: "BA", slug: "bosnia", name: "Bosnia and Herzegovina", lat: 44.2, lon: 17.8, zoom: 6.2 },
  { cc: "RS", slug: "serbia", name: "Serbia", lat: 44.2, lon: 20.9, zoom: 6.2 },
  { cc: "BG", slug: "bulgaria", name: "Bulgaria", lat: 42.7, lon: 25.2, zoom: 6.2 },
  { cc: "RO", slug: "romania", name: "Romania", lat: 45.9, lon: 24.9, zoom: 5.6 },
  { cc: "UA", slug: "ukraine", name: "Ukraine", lat: 48.9, lon: 31.4, zoom: 4.8 },
  { cc: "DE", slug: "germany", name: "Germany", lat: 51.1, lon: 10.4, zoom: 5.2 },
  { cc: "GB", slug: "united-kingdom", name: "the United Kingdom", lat: 54.3, lon: -2.7, zoom: 4.8 },
  { cc: "SE", slug: "sweden", name: "Sweden", lat: 62.2, lon: 16.3, zoom: 4 },
  { cc: "MA", slug: "morocco", name: "Morocco", lat: 31.9, lon: -6.9, zoom: 5 },
  { cc: "DZ", slug: "algeria", name: "Algeria", lat: 32.5, lon: 2.6, zoom: 4.4 },
  { cc: "TN", slug: "tunisia", name: "Tunisia", lat: 34.8, lon: 9.5, zoom: 5.8 },
  { cc: "ZA", slug: "south-africa", name: "South Africa", lat: -29, lon: 25, zoom: 4.6 },
  { cc: "MZ", slug: "mozambique", name: "Mozambique", lat: -18.4, lon: 35.5, zoom: 4.6 },
  { cc: "AO", slug: "angola", name: "Angola", lat: -12.3, lon: 17.5, zoom: 4.6 },
  { cc: "CD", slug: "dr-congo", name: "DR Congo", lat: -2.9, lon: 23.6, zoom: 4.2 },
  { cc: "ZM", slug: "zambia", name: "Zambia", lat: -14.6, lon: 27.8, zoom: 4.8 },
  { cc: "TZ", slug: "tanzania", name: "Tanzania", lat: -6.4, lon: 34.9, zoom: 4.8 },
  { cc: "KE", slug: "kenya", name: "Kenya", lat: 0.4, lon: 37.9, zoom: 5 },
];

export const COUNTRY_BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
export const COUNTRY_BY_CC = new Map(COUNTRIES.map((c) => [c.cc, c]));
