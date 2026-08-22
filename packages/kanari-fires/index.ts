// kanari-fires — minimal client for the public kanari wildfire API.
// No dependency, works in Node 18+, Deno, Bun and browsers (fetch).
// Data: CC BY 4.0, credit "kanari.io" with a link. Not an official alert channel.

export const KANARI_BASE = "https://kanari.io";
export const KANARI_MCP_URL = `${KANARI_BASE}/api/mcp`;

export type Hours = 6 | 12 | 24 | 48 | 72;

export type FireCluster = {
  id: string;
  centroid: [number, number]; // [lon, lat]
  bbox: [number, number, number, number];
  count: number;
  viirsCount: number;
  goesCount: number;
  mtgCount: number;
  firstSeen: string; // ISO UTC — first satellite pass (proxy for ignition)
  lastSeen: string;
  maxFrp: number; // MW
  confidence?: "possible" | "probable" | "corrobore";
  social?: { place: string; postCount: number; firstPress?: string };
};

export type EventsResponse = {
  events: FireCluster[];
  meta: { fetchedAt: string; totalEvents?: number; returned?: number; truncated?: boolean; light?: boolean } & Record<string, unknown>;
};

export type WitnessSignal = {
  place: string;
  countryCode?: string;
  lat: number;
  lon: number;
  postCount: number;
  firstPost: string;
  lastPost: string;
  firstPress?: string;
  newFire?: boolean;
};

export type SignalsResponse = { signals: WitnessSignal[]; meta: Record<string, unknown> };

export type ClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Identify your app, e.g. "my-weather-site/1.0 (contact@example.com)". */
  userAgent?: string;
};

export class KanariClient {
  private base: string;
  private f: typeof fetch;
  private ua?: string;

  constructor(opts: ClientOptions = {}) {
    this.base = (opts.baseUrl ?? KANARI_BASE).replace(/\/$/, "");
    this.f = opts.fetch ?? globalThis.fetch;
    this.ua = opts.userAgent;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.f(`${this.base}${path}`, { headers: this.ua ? { "user-agent": this.ua } : undefined });
    if (!res.ok) throw new Error(`kanari ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Fire clusters of the last `hours` (6|12|24|48|72). `full` = complete set instead of the 2,000 most relevant. */
  events(hours: Hours = 24, full = false): Promise<EventsResponse> {
    return this.get<EventsResponse>(`/api/events?hours=${hours}${full ? "&full=1" : ""}`);
  }

  /** Places with witness reports verified twice by AI over the last `hours`. */
  signals(hours: Hours = 24): Promise<SignalsResponse> {
    return this.get<SignalsResponse>(`/api/signals?hours=${hours}`);
  }

  /** Clusters within `radiusKm` of a point (client-side filter on `events`). */
  async near(lat: number, lon: number, radiusKm = 50, hours: Hours = 24): Promise<FireCluster[]> {
    const { events } = await this.events(hours, true);
    return events.filter((e) => haversineKm(lat, lon, e.centroid[1], e.centroid[0]) <= radiusKm);
  }

  /** Full archive of significant fires as CSV text (CC BY 4.0). */
  async archiveCsv(): Promise<string> {
    const res = await this.f(`${this.base}/opendata/feux.csv`);
    if (!res.ok) throw new Error(`kanari archive: HTTP ${res.status}`);
    return res.text();
  }

  /** URL of the permanent page of an archived fire. */
  fireUrl(slug: string): string {
    return `${this.base}/fr/feu/${slug}`;
  }
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default KanariClient;
