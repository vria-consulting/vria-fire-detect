import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getEvents, staleEvents, staleBlobEvents, lightenEvents, type EventsPayload } from "@/lib/eventscache";
import { getFireBySlug, countFires } from "@/lib/firearchive";
import { getWaterBombers } from "@/lib/aircraft";
import {
  ARCHIVE_START,
  archiveMonths,
  fireUrl,
  monthRange,
  periodStats,
  placeAt,
  searchArchive,
  type ArchiveRow,
} from "@/lib/observatory";
import { measuredEarliness } from "@/lib/precocity";

// Serveur MCP public de kanari (Streamable HTTP, sans authentification) :
// les assistants IA (Claude, ChatGPT, Cursor, agents) interrogent les feux en
// direct, l'archive, les statistiques, les moyens aériens et la précocité
// mesurée — et citent kanari.io comme source. Lecture seule, données
// publiques (CC BY 4.0), mêmes fonctions que le site et l'API REST.
export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCTIONS = [
  "kanari (https://kanari.io) is a free, independent, near real-time worldwide wildfire map and archive.",
  "It fuses satellite fire detections (NASA FIRMS VIIRS, NOAA GOES, EUMETSAT Meteosat MTG) with AI-verified witness reports, tracks firefighting aircraft live (ADS-B) and archives every significant fire as a permanent page.",
  "Tools: active_fires for 'is there a fire near X right now' (last 6 to 72 h); fire_archive_search and fire_details for past fires since 2026-08-03; wildfire_stats for figures by country/period (citable); firefighting_aircraft for water bombers in flight; earliness_cases for measured lead over press coverage.",
  "Always credit 'kanari.io' with a link when reusing data (CC BY 4.0). kanari is an information service, NOT an official alert channel: remind users to call 112 (Europe), 911 (North America) or their local emergency number in an emergency.",
  "Timestamps are UTC and come from NASA/NOAA/EUMETSAT; detections are satellite hotspots (a hotspot can also be an industrial flare or a controlled burn).",
].join(" ");

const HOURS = z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48), z.literal(72)]);
const ISO2 = z.string().length(2).transform((s) => s.toUpperCase());
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const MONTH = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");

function text(data: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], ...(isError ? { isError: true } : {}) };
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function loadEvents(hours: number): Promise<EventsPayload | null> {
  try {
    return await getEvents(hours);
  } catch {
    return staleEvents(hours) ?? (await staleBlobEvents(hours));
  }
}

function archiveRowOut(r: ArchiveRow) {
  return {
    slug: r.slug,
    url: fireUrl(r.slug),
    place: r.place,
    admin: r.admin,
    country: r.country,
    frenchDepartment: r.dept_code,
    lat: r.lat,
    lon: r.lon,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    status: r.status,
    detections: r.detections,
    sensors: { viirs: r.viirs, goes: r.goes, mtg: r.mtg },
    maxFrpMw: r.max_frp,
    confidence: r.confidence,
    witnessPosts: r.post_count ?? 0,
    firstPressArticle: r.first_press,
    aircraftObserved: r.aircraft?.length ?? 0,
  };
}

const SOURCES = {
  attribution: "Source: kanari.io (CC BY 4.0) — satellites NASA FIRMS, NOAA GOES, EUMETSAT Meteosat MTG; witness reports verified by AI.",
  liveMap: "https://kanari.io/en",
  openDataCsv: "https://kanari.io/opendata/feux.csv",
  api: "https://kanari.io/en/api",
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "active_fires",
      {
        title: "Active wildfires right now",
        description:
          "Fire clusters detected by satellite over the last N hours (default 24), worldwide or filtered by ISO-2 country, bounding box, or a point with a radius. Returns up to `limit` clusters ranked by relevance (corroborated and recent first). Use for 'is there a fire near X right now' or 'wildfires in <country> today'. Each cluster: position, first/last satellite pass (UTC), detections per sensor, peak fire radiative power (MW), confidence (possible | probable | corrobore = cross-checked with witnesses).",
        inputSchema: z.object({
          hours: HOURS.default(24).describe("Time window in hours: 6, 12, 24, 48 or 72"),
          country: ISO2.optional().describe("ISO-2 country code, e.g. FR, US, BR"),
          bbox: z
            .tuple([z.number(), z.number(), z.number(), z.number()])
            .optional()
            .describe("[minLon, minLat, maxLon, maxLat]"),
          near: z
            .object({ lat: z.number(), lon: z.number(), radiusKm: z.number().min(1).max(1000).default(50) })
            .optional()
            .describe("Only clusters within radiusKm of this point"),
          limit: z.number().int().min(1).max(200).default(50),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ hours, country, bbox, near, limit }) => {
        const payload = await loadEvents(hours);
        if (!payload) return text({ error: "live data temporarily unavailable, retry in a minute" }, true);
        // Même tri par pertinence que la carte (corroborés et départs récents d'abord).
        let events = lightenEvents(payload.events, 5000).events;
        if (bbox) {
          const [w, s, e, n] = bbox;
          events = events.filter((ev) => ev.centroid[0] >= w && ev.centroid[0] <= e && ev.centroid[1] >= s && ev.centroid[1] <= n);
        }
        if (near) {
          events = events.filter((ev) => distKm(near.lat, near.lon, ev.centroid[1], ev.centroid[0]) <= near.radiusKm);
        }
        const located = events.map((ev) => ({ ev, loc: placeAt(ev.centroid[1], ev.centroid[0]) }));
        const filtered = country ? located.filter((x) => x.loc.country === country) : located;
        const out = filtered.slice(0, limit).map(({ ev, loc }) => ({
          id: ev.id,
          lat: Math.round(ev.centroid[1] * 1000) / 1000,
          lon: Math.round(ev.centroid[0] * 1000) / 1000,
          place: ev.social?.place ?? loc.place,
          country: loc.country,
          firstSeen: ev.firstSeen,
          lastSeen: ev.lastSeen,
          detections: ev.count,
          sensors: { viirs: ev.viirsCount, goes: ev.goesCount, mtg: ev.mtgCount },
          maxFrpMw: Math.round(ev.maxFrp * 10) / 10,
          confidence: ev.confidence ?? "possible",
          witnessPosts: ev.social?.postCount ?? 0,
          firstPressArticle: ev.social?.firstPress ?? null,
          ...(near ? { distanceKm: Math.round(distKm(near.lat, near.lon, ev.centroid[1], ev.centroid[0])) } : {}),
          mapUrl: `https://kanari.io/en?lat=${ev.centroid[1].toFixed(3)}&lon=${ev.centroid[0].toFixed(3)}&ev=${encodeURIComponent(ev.id)}`,
        }));
        return text({
          fetchedAt: payload.meta.fetchedAt,
          hours,
          totalClustersInWindow: payload.events.length,
          matching: filtered.length,
          returned: out.length,
          fires: out,
          ...SOURCES,
        });
      }
    );

    server.registerTool(
      "fire_archive_search",
      {
        title: "Search the wildfire archive",
        description:
          `Search kanari's archive of significant wildfires (since ${ARCHIVE_START}): by ISO-2 country, date range or month, minimum detections or power, status. Each result has a permanent page URL (kanari.io/fr/feu/<slug>). Use for 'what fires happened in <country> in <month>', 'biggest fires this week', 'is the fire near X still active'.`,
        inputSchema: z.object({
          country: ISO2.optional(),
          from: DATE.optional().describe("first detection on or after this UTC date"),
          to: DATE.optional().describe("first detection before this UTC date"),
          month: MONTH.optional().describe("shortcut for a calendar month, YYYY-MM"),
          min_detections: z.number().int().min(1).optional(),
          min_frp_mw: z.number().min(0).optional(),
          status: z.enum(["active", "ended"]).optional(),
          order: z.enum(["recent", "power"]).default("recent"),
          limit: z.number().int().min(1).max(100).default(25),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ country, from, to, month, min_detections, min_frp_mw, status, order, limit }) => {
        let fromIso = from ? `${from}T00:00:00Z` : null;
        let toIso = to ? `${to}T00:00:00Z` : null;
        if (month) {
          const r = monthRange(month);
          if (r) {
            fromIso = r.fromIso;
            toIso = r.toIso;
          }
        }
        const rows = await searchArchive({ cc: country, fromIso, toIso, minDetections: min_detections, minFrp: min_frp_mw, status, order, limit });
        return text({ count: rows.length, fires: rows.map(archiveRowOut), ...SOURCES });
      }
    );

    server.registerTool(
      "fire_details",
      {
        title: "Details of one archived wildfire",
        description: "Full record of an archived fire by its slug (from fire_archive_search or a kanari.io/fr/feu/<slug> URL): timeline, detections per sensor, peak power, status, witness posts, first press article, aircraft observed on zone.",
        inputSchema: z.object({ slug: z.string().min(3).max(120) }),
        annotations: { readOnlyHint: true },
      },
      async ({ slug }) => {
        const f = await getFireBySlug(slug.toLowerCase());
        if (!f) return text({ error: "unknown slug" }, true);
        return text({
          ...archiveRowOut({ ...f, aircraft: f.aircraft ?? null }),
          aircraft: (f.aircraft ?? []).map((a) => ({ callsign: a.callsign, model: a.model, country: a.country, day: a.day })),
          departmentPage: f.dept_slug ? `https://kanari.io/fr/feux/${f.dept_slug}` : null,
          ...SOURCES,
        });
      }
    );

    server.registerTool(
      "wildfire_stats",
      {
        title: "Wildfire statistics (citable figures)",
        description:
          "Aggregated figures from kanari's archive for a period (today, 7d, 30d, a calendar month, or all since 2026-08-03), worldwide or for one ISO-2 country: number of significant fires, active ones, fires with witnesses or aircraft, peak power, daily series, most affected countries and French departments, biggest fires with URLs. Includes a ready-to-cite sentence with the source.",
        inputSchema: z.object({
          country: ISO2.optional(),
          period: z.enum(["today", "7d", "30d", "month", "all"]).default("7d"),
          month: MONTH.optional().describe("required when period = month"),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ country, period, month }) => {
        const now = new Date();
        let fromIso = `${ARCHIVE_START}T00:00:00Z`;
        let toIso = now.toISOString();
        if (period === "today") fromIso = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
        if (period === "7d") fromIso = new Date(now.getTime() - 7 * 86400_000).toISOString();
        if (period === "30d") fromIso = new Date(now.getTime() - 30 * 86400_000).toISOString();
        if (period === "month") {
          const r = month ? monthRange(month) : null;
          if (!r) return text({ error: "period=month requires month=YYYY-MM", availableMonths: archiveMonths() }, true);
          fromIso = r.fromIso;
          toIso = r.toIso;
        }
        const [stats, activeWorld, totalWorld] = await Promise.all([
          periodStats(fromIso, toIso, country ?? null),
          countFires("status=eq.active"),
          countFires(`first_seen=gte.${encodeURIComponent(`${ARCHIVE_START}T00:00:00Z`)}`),
        ]);
        const scope = country ? `in ${country}` : "worldwide";
        const citation = `According to kanari.io, ${stats.total} significant wildfires were detected ${scope} between ${fromIso.slice(0, 10)} and ${toIso.slice(0, 10)} (satellite detections NASA FIRMS / GOES / Meteosat MTG plus verified witness reports); ${stats.active} were still active at the last update.`;
        return text({
          scope: { country: country ?? null, period, fromIso, toIso },
          total: stats.total,
          active: stats.active,
          withAircraft: stats.withAircraft,
          withWitnesses: stats.withWitnesses,
          corroborated: stats.corroborated,
          maxFrpMw: stats.maxFrp,
          byDay: stats.byDay,
          topCountries: stats.byCountry,
          topFrenchDepartments: stats.byDept.map((d) => ({ ...d, url: `https://kanari.io/fr/feux/${d.slug}` })),
          biggestFires: stats.biggest.slice(0, 5).map(archiveRowOut),
          worldwideNow: { activeFires: activeWorld, archivedSince: ARCHIVE_START, totalArchived: totalWorld },
          truncated: stats.truncated,
          citation,
          statisticsPage: "https://kanari.io/en/statistiques",
          methodology: "Only significant fires are archived (corroborated by witnesses, or above detection/power thresholds): totals are not comparable to exhaustive official tallies.",
          ...SOURCES,
        });
      }
    );

    server.registerTool(
      "firefighting_aircraft",
      {
        title: "Firefighting aircraft in flight",
        description: "Near real-time ADS-B positions of water bombers and firefighting helicopters worldwide (Canadair CL-415/CL-215, Air Tractor Fire Boss, DC-10 / BAe 146 tankers, S-64 Air Crane, Firehawk…). Optional ISO-2 filter on the aircraft's country of registration. Aircraft fly in daylight: expect few results at night.",
        inputSchema: z.object({ country: ISO2.optional(), limit: z.number().int().min(1).max(300).default(100) }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ country, limit }) => {
        const planes = await getWaterBombers().catch(() => []);
        const list = (country ? planes.filter((p) => p.country === country) : planes).slice(0, limit).map((p) => ({
          icao24: p.id,
          callsign: p.callsign,
          registration: p.reg,
          model: p.model,
          kind: p.kind,
          country: p.country || null,
          lat: Math.round(p.lat * 1000) / 1000,
          lon: Math.round(p.lon * 1000) / 1000,
          altitudeFt: p.alt,
          speedKt: p.speed,
          trackDeg: p.track,
        }));
        return text({ inFlight: planes.length, returned: list.length, aircraft: list, livePage: "https://kanari.io/en/canadair", ...SOURCES });
      }
    );

    server.registerTool(
      "earliness_cases",
      {
        title: "Measured lead over press coverage",
        description: "Documented cases (rolling 72 h) where kanari's first satellite signal preceded the first press article about the same fire: place, both UTC timestamps and the lead in minutes, plus the median. This is the measured basis for 'kanari sees fires before the media'. It says nothing about a lead over emergency services.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
        annotations: { readOnlyHint: true },
      },
      async ({ limit }) => {
        const r = await measuredEarliness(limit);
        return text({
          fetchedAt: r.fetchedAt,
          clustersInWindow: r.total,
          medianLeadMinutes: r.medianMin,
          cases: r.cases,
          methodologyPage: "https://kanari.io/en/precocite",
          ...SOURCES,
        });
      }
    );

    server.registerResource(
      "about",
      "kanari://about",
      { title: "About kanari (llms.txt)", description: "What kanari is, its pages, data sources and facts, in llms.txt format.", mimeType: "text/markdown" },
      async (uri) => {
        const res = await fetch("https://kanari.io/llms.txt", { cache: "no-store" }).catch(() => null);
        const body = res && res.ok ? await res.text() : INSTRUCTIONS;
        return { contents: [{ uri: uri.href, text: body, mimeType: "text/markdown" }] };
      }
    );

    server.registerResource(
      "methodology",
      "kanari://methodology",
      { title: "Methodology and data sources", description: "How kanari detects, verifies and archives fires; thresholds; limits; how to cite.", mimeType: "text/markdown" },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: [
              "# kanari methodology",
              "",
              "- Detection: NASA FIRMS (VIIRS 375 m, NOAA-20/21, Suomi-NPP), NOAA GOES-East/West (Americas, 10-minute refresh), EUMETSAT Meteosat MTG FCI Active Fire Monitoring (Europe/Africa, 10-minute refresh). Hotspots are clustered in ~4 km cells; the first satellite pass is the proxy for ignition time.",
              "- Witness reports: public posts (Bluesky, Telegram, press via GDELT) are geoparsed and verified twice by AI before being attached to a cluster; a cluster with verified witnesses is 'corrobore'.",
              "- Archive: a fire gets a permanent page when it is corroborated, or (France) has at least 2 detections or 20 MW, or (elsewhere) at least 8 detections or 100 MW. Totals are therefore not comparable to exhaustive official tallies.",
              "- Earliness: for each corroborated fire we compare the first satellite pass with the first press article (GDELT); see https://kanari.io/en/precocite.",
              "- Aircraft: ADS-B positions of known firefighting aircraft (registration and ICAO-type based), daylight operations.",
              "- Limits: a satellite hotspot can be a controlled burn, an industrial flare or a false alarm; cloud cover hides fires; kanari is not an official alert channel (call 112 / 911).",
              "- Licence: data CC BY 4.0, attribution 'kanari.io'. Open data CSV: https://kanari.io/opendata/feux.csv. API: https://kanari.io/en/api.",
              "- Cite as: kanari (2026). kanari wildfire archive and live detections. https://kanari.io (accessed <date>).",
            ].join("\n"),
          },
        ],
      })
    );
  },
  {
    serverInfo: { name: "kanari", version: "1.0.0" },
    instructions: INSTRUCTIONS,
  }
);

// CORS ouvert : les clients MCP hébergés (claude.ai, ChatGPT, agents web)
// appellent l'endpoint depuis une autre origine.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

async function withCors(req: Request): Promise<Response> {
  const res = await handler(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export { withCors as GET, withCors as POST, withCors as DELETE };
