# kanari — early wildfire detection, worldwide, free

[![Live map](https://img.shields.io/badge/live%20map-kanari.io-F6C83E)](https://kanari.io)
[![API](https://img.shields.io/badge/API-JSON%20%7C%20CSV%20%7C%20RSS-1B1C1E)](https://kanari.io/en/api)
[![MCP server](https://img.shields.io/badge/MCP-kanari.io%2Fapi%2Fmcp-6B4FBB)](https://kanari.io/en/api#mcp)
[![Open data](https://img.shields.io/badge/open%20data-CC%20BY%204.0-2DA2BB)](https://kanari.io/opendata/feux.csv)

**kanari** is a free, independent, near real-time world map of wildfire ignitions. It fuses satellite fire detections — NASA FIRMS (VIIRS 375 m), NOAA GOES and EUMETSAT Meteosat MTG (10-minute refresh) — with citizen reports verified twice by AI, tracks firefighting aircraft live (ADS-B), and archives every significant fire as a permanent page. Goal: surface fire starts as early as possible, often before the media. Available in French, English, Spanish and Portuguese.

> ⚠️ kanari is an information service, **not an official alert channel**. In an emergency call 112 (Europe), 911 (North America), 193 (Brazil) or your local emergency number.

## Use it

| What | Where |
| --- | --- |
| Live map (4 languages) | <https://kanari.io/en> · [fr](https://kanari.io/fr) · [es](https://kanari.io/es) · [pt](https://kanari.io/pt) |
| Wildfires by country / US state | <https://kanari.io/en/fires> (e.g. [/en/fires/california](https://kanari.io/en/fires/california)) |
| Feux par département (France) | <https://kanari.io/fr/feux> |
| Observatory: citable figures per country and month | <https://kanari.io/en/statistiques> (e.g. [/en/statistiques/brazil/2026-08](https://kanari.io/en/statistiques/brazil/2026-08)) |
| Fire memory: one permanent page per significant fire | <https://kanari.io/fr/feu> |
| Water bombers live | <https://kanari.io/en/canadair> |
| Measured earliness over press coverage | <https://kanari.io/en/precocite> |
| Methodology, limits, how to cite | <https://kanari.io/en/methodologie> |
| Embed the map (free widget) | <https://kanari.io/en/widget> |

## Data, API and MCP server

Everything is free, without key or account. Attribution required: “Source: kanari.io” with a link (CC BY 4.0).

- **REST API** — fire clusters `https://kanari.io/api/events?hours=24` (add `full=1` for the complete set), verified witness signals `https://kanari.io/api/signals?hours=24`. Docs: <https://kanari.io/en/api>.
- **Open data** — full archive of significant fires as CSV, continuously updated: <https://kanari.io/opendata/feux.csv>. RSS feed: <https://kanari.io/feed.xml>.
- **MCP server** (Model Context Protocol, Streamable HTTP) — let Claude, ChatGPT, Cursor or any agent query kanari directly:

  ```json
  { "mcpServers": { "kanari": { "url": "https://kanari.io/api/mcp" } } }
  ```

  Tools: `active_fires`, `fire_archive_search`, `fire_details`, `wildfire_stats`, `firefighting_aircraft`, `earliness_cases`. Stdio-only clients: `npx -y mcp-remote https://kanari.io/api/mcp`. Registry manifest: [`server.json`](server.json).

- **JavaScript client** — [`packages/kanari-fires`](packages/kanari-fires): a tiny, dependency-free wrapper around the public API.
- **For LLMs** — <https://kanari.io/llms.txt>.

## How it works (short version)

1. Satellite hotspots from NASA FIRMS, GOES and Meteosat MTG are clustered into fire events (≈4 km cells); the first detection is the proxy for ignition time.
2. Public witness reports (Bluesky, press via GDELT, Telegram) are geoparsed and assessed twice by independent AI models before being attached to an event (`possible` → `probable` → `corrobore`).
3. Significant events (corroborated, or above detection/power thresholds) are archived with a permanent page; aggregates feed the daily reports, the observatory and the API.
4. Firefighting aircraft are identified from ADS-B (registration, ICAO type) and shown live.

Full methodology, thresholds and limits: <https://kanari.io/en/methodologie>.

## Architecture

Next.js (App Router) on Vercel, Supabase (archive, witness signals), Vercel Blob (caches), GitHub Actions cron every 5 minutes.

- `src/lib/firms.ts`, `goesdirect.ts`, `mtg.ts` — satellite ingestion; `cluster.ts` — event clustering
- `src/lib/social.ts`, `triage.ts`, `press.ts` — witness reports and AI verification
- `src/lib/firearchive.ts`, `observatory.ts` — fire memory and aggregates; `precocity.ts` — measured earliness
- `src/app/api/events`, `api/signals`, `api/mcp` — public API and MCP server; `src/app/opendata` — CSV
- `src/components/FireMap.tsx` — MapLibre GL map; `src/app/[lang]/…` — pages in fr/en/es/pt
- `scripts/seo-guard.mjs` — structural SEO contracts enforced in CI

## Development

```bash
# .env.local: a free NASA FIRMS map key is enough for the live map
# https://firms.modaps.eosdis.nasa.gov/api/map_key/
echo "FIRMS_MAP_KEY=your_key" > .env.local
npm install
npm run dev
```

Archive, witness signals and aircraft need Supabase and a few provider keys; every page degrades gracefully without them (the CI builds and runs the SEO guard with no secrets).

## Cite kanari

> kanari (2026). Archive of wildfires detected by satellite and verified witnesses [dataset]. https://kanari.io. Accessed YYYY-MM-DD.

Data licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A DOI for the dataset is being registered.

## Contributing

Ideas, data sources, bug reports: open an issue or see <https://kanari.io/fr/contribuer>. Contact: contact@kanari.io.

---

### En français

kanari est une carte mondiale, gratuite et indépendante, des départs de feu détectés par satellite (NASA FIRMS, GOES, Meteosat MTG) et recoupés avec des témoignages vérifiés par IA, avec suivi des Canadair et bombardiers d'eau en direct, mémoire permanente des feux, observatoire par pays et par mois, API, open data (CC BY 4.0) et serveur MCP. Service d'information, pas un canal d'alerte officiel : en urgence, 18 ou 112. Méthodologie complète : <https://kanari.io/fr/methodologie>.
