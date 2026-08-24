export declare const KANARI_BASE = "https://kanari.io";
export declare const KANARI_MCP_URL = "https://kanari.io/api/mcp";
export type Hours = 6 | 12 | 24 | 48 | 72;
export type FireCluster = {
    id: string;
    centroid: [number, number];
    bbox: [number, number, number, number];
    count: number;
    viirsCount: number;
    goesCount: number;
    mtgCount: number;
    firstSeen: string;
    lastSeen: string;
    maxFrp: number;
    confidence?: "possible" | "probable" | "corrobore";
    social?: {
        place: string;
        postCount: number;
        firstPress?: string;
    };
};
export type EventsResponse = {
    events: FireCluster[];
    meta: {
        fetchedAt: string;
        totalEvents?: number;
        returned?: number;
        truncated?: boolean;
        light?: boolean;
    } & Record<string, unknown>;
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
export type SignalsResponse = {
    signals: WitnessSignal[];
    meta: Record<string, unknown>;
};
export type ClientOptions = {
    baseUrl?: string;
    fetch?: typeof fetch;
    /** Identify your app, e.g. "my-weather-site/1.0 (contact@example.com)". */
    userAgent?: string;
};
export declare class KanariClient {
    private base;
    private f;
    private ua?;
    constructor(opts?: ClientOptions);
    private get;
    /** Fire clusters of the last `hours` (6|12|24|48|72). `full` = complete set instead of the 2,000 most relevant. */
    events(hours?: Hours, full?: boolean): Promise<EventsResponse>;
    /** Places with witness reports verified twice by AI over the last `hours`. */
    signals(hours?: Hours): Promise<SignalsResponse>;
    /** Clusters within `radiusKm` of a point (client-side filter on `events`). */
    near(lat: number, lon: number, radiusKm?: number, hours?: Hours): Promise<FireCluster[]>;
    /** Full archive of significant fires as CSV text (CC BY 4.0). */
    archiveCsv(): Promise<string>;
    /** URL of the permanent page of an archived fire. */
    fireUrl(slug: string): string;
}
export declare function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
export default KanariClient;
