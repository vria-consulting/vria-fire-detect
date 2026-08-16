// US states for the English local pages (/en/fires/[state-slug]) — the
// same play as the French department pages, on the biggest wildfire search
// market in the world ("california fire map", "oregon wildfires today"…).
//
// The archive's `admin` field is empty for US fires, so fires are assigned
// to states by bounding box (minLat, maxLat, minLon, maxLon). Boxes overlap
// slightly at borders; at state scale the counts stay honest.

export type UsState = {
  code: string; // USPS
  slug: string;
  name: string;
  lat: number; // map deep-link center
  lon: number;
  zoom: number;
  bbox: [number, number, number, number]; // minLat, maxLat, minLon, maxLon
};

export const US_STATES: UsState[] = [
  { code: "AL", slug: "alabama", name: "Alabama", lat: 32.7, lon: -86.8, zoom: 6.2, bbox: [30.2, 35.0, -88.5, -84.9] },
  { code: "AK", slug: "alaska", name: "Alaska", lat: 64.0, lon: -152.0, zoom: 3.6, bbox: [51.2, 71.4, -179.1, -129.9] },
  { code: "AZ", slug: "arizona", name: "Arizona", lat: 34.2, lon: -111.7, zoom: 6.0, bbox: [31.3, 37.0, -114.8, -109.0] },
  { code: "AR", slug: "arkansas", name: "Arkansas", lat: 34.8, lon: -92.4, zoom: 6.4, bbox: [33.0, 36.5, -94.6, -89.6] },
  { code: "CA", slug: "california", name: "California", lat: 37.2, lon: -119.3, zoom: 5.3, bbox: [32.5, 42.0, -124.4, -114.1] },
  { code: "CO", slug: "colorado", name: "Colorado", lat: 39.0, lon: -105.5, zoom: 6.0, bbox: [37.0, 41.0, -109.1, -102.0] },
  { code: "CT", slug: "connecticut", name: "Connecticut", lat: 41.6, lon: -72.7, zoom: 7.6, bbox: [40.9, 42.1, -73.7, -71.8] },
  { code: "DE", slug: "delaware", name: "Delaware", lat: 39.0, lon: -75.5, zoom: 7.8, bbox: [38.4, 39.8, -75.8, -75.0] },
  { code: "FL", slug: "florida", name: "Florida", lat: 28.3, lon: -82.4, zoom: 5.8, bbox: [24.5, 31.0, -87.6, -80.0] },
  { code: "GA", slug: "georgia", name: "Georgia", lat: 32.7, lon: -83.4, zoom: 6.2, bbox: [30.4, 35.0, -85.6, -80.8] },
  { code: "HI", slug: "hawaii", name: "Hawaii", lat: 20.6, lon: -157.5, zoom: 6.4, bbox: [18.9, 22.3, -160.3, -154.8] },
  { code: "ID", slug: "idaho", name: "Idaho", lat: 44.4, lon: -114.6, zoom: 5.6, bbox: [42.0, 49.0, -117.2, -111.0] },
  { code: "IL", slug: "illinois", name: "Illinois", lat: 40.0, lon: -89.2, zoom: 6.0, bbox: [37.0, 42.5, -91.5, -87.5] },
  { code: "IN", slug: "indiana", name: "Indiana", lat: 39.9, lon: -86.3, zoom: 6.4, bbox: [37.8, 41.8, -88.1, -84.8] },
  { code: "IA", slug: "iowa", name: "Iowa", lat: 42.0, lon: -93.5, zoom: 6.2, bbox: [40.4, 43.5, -96.6, -90.1] },
  { code: "KS", slug: "kansas", name: "Kansas", lat: 38.5, lon: -98.4, zoom: 6.2, bbox: [37.0, 40.0, -102.1, -94.6] },
  { code: "KY", slug: "kentucky", name: "Kentucky", lat: 37.5, lon: -85.3, zoom: 6.4, bbox: [36.5, 39.1, -89.6, -81.9] },
  { code: "LA", slug: "louisiana", name: "Louisiana", lat: 31.0, lon: -92.0, zoom: 6.4, bbox: [28.9, 33.0, -94.0, -88.8] },
  { code: "ME", slug: "maine", name: "Maine", lat: 45.3, lon: -69.2, zoom: 6.4, bbox: [43.0, 47.5, -71.1, -66.9] },
  { code: "MD", slug: "maryland", name: "Maryland", lat: 39.0, lon: -76.8, zoom: 7.0, bbox: [37.9, 39.7, -79.5, -75.0] },
  { code: "MA", slug: "massachusetts", name: "Massachusetts", lat: 42.3, lon: -71.8, zoom: 7.2, bbox: [41.2, 42.9, -73.5, -69.9] },
  { code: "MI", slug: "michigan", name: "Michigan", lat: 44.3, lon: -85.4, zoom: 5.8, bbox: [41.7, 48.3, -90.4, -82.4] },
  { code: "MN", slug: "minnesota", name: "Minnesota", lat: 46.3, lon: -94.3, zoom: 5.8, bbox: [43.5, 49.4, -97.2, -89.5] },
  { code: "MS", slug: "mississippi", name: "Mississippi", lat: 32.7, lon: -89.7, zoom: 6.2, bbox: [30.2, 35.0, -91.7, -88.1] },
  { code: "MO", slug: "missouri", name: "Missouri", lat: 38.4, lon: -92.5, zoom: 6.2, bbox: [36.0, 40.6, -95.8, -89.1] },
  { code: "MT", slug: "montana", name: "Montana", lat: 47.0, lon: -109.6, zoom: 5.6, bbox: [44.4, 49.0, -116.1, -104.0] },
  { code: "NE", slug: "nebraska", name: "Nebraska", lat: 41.5, lon: -99.8, zoom: 6.2, bbox: [40.0, 43.0, -104.1, -95.3] },
  { code: "NV", slug: "nevada", name: "Nevada", lat: 39.3, lon: -116.6, zoom: 5.8, bbox: [35.0, 42.0, -120.0, -114.0] },
  { code: "NH", slug: "new-hampshire", name: "New Hampshire", lat: 43.7, lon: -71.6, zoom: 7.0, bbox: [42.7, 45.3, -72.6, -70.6] },
  { code: "NJ", slug: "new-jersey", name: "New Jersey", lat: 40.1, lon: -74.7, zoom: 7.2, bbox: [38.9, 41.4, -75.6, -73.9] },
  { code: "NM", slug: "new-mexico", name: "New Mexico", lat: 34.4, lon: -106.1, zoom: 6.0, bbox: [31.3, 37.0, -109.1, -103.0] },
  { code: "NY", slug: "new-york", name: "New York", lat: 42.9, lon: -75.5, zoom: 6.2, bbox: [40.5, 45.0, -79.8, -71.9] },
  { code: "NC", slug: "north-carolina", name: "North Carolina", lat: 35.5, lon: -79.4, zoom: 6.2, bbox: [33.8, 36.6, -84.3, -75.5] },
  { code: "ND", slug: "north-dakota", name: "North Dakota", lat: 47.4, lon: -100.5, zoom: 6.2, bbox: [45.9, 49.0, -104.1, -96.6] },
  { code: "OH", slug: "ohio", name: "Ohio", lat: 40.3, lon: -82.8, zoom: 6.4, bbox: [38.4, 42.0, -84.8, -80.5] },
  { code: "OK", slug: "oklahoma", name: "Oklahoma", lat: 35.5, lon: -97.5, zoom: 6.2, bbox: [33.6, 37.0, -103.0, -94.4] },
  { code: "OR", slug: "oregon", name: "Oregon", lat: 43.9, lon: -120.6, zoom: 5.8, bbox: [42.0, 46.3, -124.6, -116.5] },
  { code: "PA", slug: "pennsylvania", name: "Pennsylvania", lat: 40.9, lon: -77.6, zoom: 6.4, bbox: [39.7, 42.3, -80.5, -74.7] },
  { code: "RI", slug: "rhode-island", name: "Rhode Island", lat: 41.7, lon: -71.5, zoom: 8.2, bbox: [41.1, 42.0, -71.9, -71.1] },
  { code: "SC", slug: "south-carolina", name: "South Carolina", lat: 33.9, lon: -80.9, zoom: 6.6, bbox: [32.0, 35.2, -83.4, -78.5] },
  { code: "SD", slug: "south-dakota", name: "South Dakota", lat: 44.4, lon: -100.2, zoom: 6.2, bbox: [42.5, 45.9, -104.1, -96.4] },
  { code: "TN", slug: "tennessee", name: "Tennessee", lat: 35.8, lon: -86.4, zoom: 6.4, bbox: [35.0, 36.7, -90.3, -81.6] },
  { code: "TX", slug: "texas", name: "Texas", lat: 31.4, lon: -99.3, zoom: 5.2, bbox: [25.8, 36.5, -106.6, -93.5] },
  { code: "UT", slug: "utah", name: "Utah", lat: 39.3, lon: -111.7, zoom: 6.0, bbox: [37.0, 42.0, -114.1, -109.0] },
  { code: "VT", slug: "vermont", name: "Vermont", lat: 44.0, lon: -72.7, zoom: 7.0, bbox: [42.7, 45.0, -73.4, -71.5] },
  { code: "VA", slug: "virginia", name: "Virginia", lat: 37.5, lon: -78.8, zoom: 6.4, bbox: [36.5, 39.5, -83.7, -75.2] },
  { code: "WA", slug: "washington", name: "Washington", lat: 47.4, lon: -120.4, zoom: 6.0, bbox: [45.5, 49.0, -124.8, -116.9] },
  { code: "WV", slug: "west-virginia", name: "West Virginia", lat: 38.6, lon: -80.6, zoom: 6.6, bbox: [37.2, 40.6, -82.6, -77.7] },
  { code: "WI", slug: "wisconsin", name: "Wisconsin", lat: 44.6, lon: -89.9, zoom: 6.0, bbox: [42.5, 47.1, -92.9, -86.8] },
  { code: "WY", slug: "wyoming", name: "Wyoming", lat: 43.0, lon: -107.5, zoom: 6.0, bbox: [41.0, 45.0, -111.1, -104.1] },
  { code: "DC", slug: "washington-dc", name: "Washington, D.C.", lat: 38.9, lon: -77.0, zoom: 9.0, bbox: [38.79, 39.0, -77.12, -76.9] },
];

export const STATE_BY_SLUG = new Map(US_STATES.map((s) => [s.slug, s]));

export function stateOf(lat: number, lon: number): UsState | null {
  // Smallest matching box wins: DC beats Maryland/Virginia at the overlap.
  let best: UsState | null = null;
  let bestArea = Infinity;
  for (const s of US_STATES) {
    const [la, LA, lo, LO] = s.bbox;
    if (lat >= la && lat <= LA && lon >= lo && lon <= LO) {
      const area = (LA - la) * (LO - lo);
      if (area < bestArea) {
        best = s;
        bestArea = area;
      }
    }
  }
  return best;
}
