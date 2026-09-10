import { test } from "node:test";
import assert from "node:assert/strict";
import { readArchive } from "../src/lib/archive-reader";
import { periodStats } from "../src/lib/observatory";
import { GET as exportCsv } from "../src/app/opendata/feux.csv/route";
import { getFireBySlug } from "../src/lib/firearchive";
import { summarizeEarliness } from "../src/lib/precocity";
import type { EventsPayload } from "../src/lib/eventscache";

test("complete datasets, failure semantics, and unbiased earliness", async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://archive.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  const rows = Array.from({ length: 20005 }, (_, i) => ({
    slug: `event-${String(i).padStart(6, "0")}`, first_seen: "2026-08-10T00:00:00Z", last_seen: "2026-08-10T01:00:00Z",
    country: i % 2 ? "FR" : "BR", status: "ended", detections: 20, aircraft: [], post_count: 0,
    max_frp: i, lat: 1, lon: 2, viirs: 20, goes: 0, mtg: 0,
  }));
  let fail = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const u = new URL(String(input));
    assert.equal(u.hostname, "archive.invalid");
    const cursor = u.searchParams.get("slug")?.slice(3) ?? "";
    if (fail && cursor) return new Response("upstream failure", { status: 503 });
    const country = u.searchParams.get("country")?.slice(3);
    assert.ok(u.searchParams.get("created_at"), "freeze new inserts at read start");
    assert.equal(u.searchParams.get("order"), "slug.asc");
    return Response.json(rows.filter((r) => r.slug > cursor && (!country || r.country === country)).slice(0, 700));
  });
  await t.test("reader exceeds both old ceilings and tolerates upstream pages below 1000", async () => {
    const result = await readArchive<{slug:string}>("select=slug");
    assert.equal(result.length, 20005);
    assert.equal(new Set(result.map((r) => r.slug)).size, 20005);
  });
  await t.test("monthly statistics and their filtered CSV agree", async () => {
    const stats = await periodStats("2026-08-01", "2026-09-01");
    assert.equal(stats.total, 20005); assert.equal(stats.truncated, false);
    assert.equal(stats.byDay.reduce((n, r) => n + r.n, 0), stats.total);
    const frStats = await periodStats("2026-08-01", "2026-09-01", "FR");
    const csv = await exportCsv(new Request("https://kanari.io/opendata/feux.csv?month=2026-08&country=FR"));
    assert.equal(csv.status, 200);
    assert.equal((await csv.text()).trim().split("\n").length - 1, frStats.total);
  });
  await t.test("later-page outage is never returned as a low total or successful partial CSV", async () => {
    fail = true;
    await assert.rejects(() => periodStats("2026-08-01", "2026-09-01"), /unavailable/);
    const response = await exportCsv(new Request("https://kanari.io/opendata/feux.csv"));
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    fail = false;
  });
  await t.test("missing fire and unavailable archive are different outcomes", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
    await assert.rejects(() => getFireBySlug("known-fire"), /unavailable/);
    t.mock.method(globalThis, "fetch", async () => Response.json([]));
    assert.equal(await getFireBySlug("absent-fire"), null);
  });
  await t.test("malformed export filters are rejected before any archive read", async () => {
    assert.equal((await exportCsv(new Request("https://kanari.io/opendata/feux.csv?month=2026-13"))).status, 400);
    assert.equal((await exportCsv(new Request("https://kanari.io/opendata/feux.csv?country=France"))).status, 400);
  });
  await t.test("median includes negative gaps, is independent of display limit and uses the even median", () => {
    const events = [-60, 20, 40, 100].map((gap, i) => ({
      centroid: [i, 0], firstSeen: "2026-08-10T12:00:00Z",
      social: { place: `place${i}`, firstPress: new Date(Date.parse("2026-08-10T12:00:00Z") + gap * 60000).toISOString(), posts: [] },
    }));
    const payload = { events: [...events, events[0]], meta: { fetchedAt: "2026-08-11" } } as unknown as EventsPayload;
    const result = summarizeEarliness(payload, 1);
    assert.equal(result.matched, 4); assert.equal(result.pressFirst, 1);
    assert.equal(result.medianMin, 30); assert.equal(result.cases.length, 1);
  });
});
