# kanari-fires

Tiny, dependency-free client for the [kanari](https://kanari.io) wildfire API: live satellite fire clusters (NASA FIRMS, GOES, Meteosat MTG), AI-verified witness signals, the open-data archive, and the MCP endpoint URL for AI agents.

```bash
npm install kanari-fires
```

```ts
import { KanariClient } from "kanari-fires";

const kanari = new KanariClient({ userAgent: "my-app/1.0 (contact@example.com)" });

// Fire clusters of the last 24 h (2,000 most relevant; pass true for the full set)
const { events, meta } = await kanari.events(24);
console.log(meta.fetchedAt, events.length);

// Fires within 30 km of Marseille over the last 6 h
const nearby = await kanari.near(43.3, 5.4, 30, 6);

// Verified witness signals
const { signals } = await kanari.signals(24);

// Full archive as CSV (CC BY 4.0)
const csv = await kanari.archiveCsv();
```

AI agents: point any MCP client at `https://kanari.io/api/mcp` (`KANARI_MCP_URL`).

Data licence CC BY 4.0: credit “kanari.io” with a link. kanari is an information service, not an official alert channel; in an emergency call 112 / 911 or your local number. Docs: <https://kanari.io/en/api>.
