// kanari-fires — minimal client for the public kanari wildfire API.
// No dependency, works in Node 18+, Deno, Bun and browsers (fetch).
// Data: CC BY 4.0, credit "kanari.io" with a link. Not an official alert channel.
export const KANARI_BASE = "https://kanari.io";
export const KANARI_MCP_URL = `${KANARI_BASE}/api/mcp`;
export class KanariClient {
    constructor(opts = {}) {
        this.base = (opts.baseUrl ?? KANARI_BASE).replace(/\/$/, "");
        this.f = opts.fetch ?? globalThis.fetch;
        this.ua = opts.userAgent;
    }
    async get(path) {
        const res = await this.f(`${this.base}${path}`, { headers: this.ua ? { "user-agent": this.ua } : undefined });
        if (!res.ok)
            throw new Error(`kanari ${path}: HTTP ${res.status}`);
        return (await res.json());
    }
    /** Fire clusters of the last `hours` (6|12|24|48|72). `full` = complete set instead of the 2,000 most relevant. */
    events(hours = 24, full = false) {
        return this.get(`/api/events?hours=${hours}${full ? "&full=1" : ""}`);
    }
    /** Places with witness reports verified twice by AI over the last `hours`. */
    signals(hours = 24) {
        return this.get(`/api/signals?hours=${hours}`);
    }
    /** Clusters within `radiusKm` of a point (client-side filter on `events`). */
    async near(lat, lon, radiusKm = 50, hours = 24) {
        const { events } = await this.events(hours, true);
        return events.filter((e) => haversineKm(lat, lon, e.centroid[1], e.centroid[0]) <= radiusKm);
    }
    /** Full archive of significant fires as CSV text (CC BY 4.0). */
    async archiveCsv() {
        const res = await this.f(`${this.base}/opendata/feux.csv`);
        if (!res.ok)
            throw new Error(`kanari archive: HTTP ${res.status}`);
        return res.text();
    }
    /** URL of the permanent page of an archived fire. */
    fireUrl(slug) {
        return `${this.base}/fr/feu/${slug}`;
    }
}
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
export default KanariClient;
