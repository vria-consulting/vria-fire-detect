// Strict, keyset-paginated archive reads. Never publish partial data as a total.
// No credentials is the existing offline/CI mode; configured failures throw.
export function archiveConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function* archivePages<T extends { slug: string }>(
  query: string,
  snapshot = new Date().toISOString(),
): AsyncGenerator<T[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  let cursor: string | null = null;
  const deadline = Date.now() + 50_000;
  for (;;) {
    if (Date.now() >= deadline) throw new Error("Archive read deadline exceeded");
    const params = new URLSearchParams(query);
    params.set("order", "slug.asc");
    params.set("limit", "1000");
    params.set("created_at", `lte.${snapshot}`);
    if (cursor) params.set("slug", `gt.${cursor}`);
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/fire_events?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(8000, Math.max(1, deadline - Date.now()))),
    });
    if (!response.ok) throw new Error(`Archive unavailable (HTTP ${response.status})`);
    const rows: T[] = await response.json();
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r.slug !== "string")) {
      throw new Error("Invalid archive response");
    }
    if (!rows.length) return;
    const next = rows[rows.length - 1].slug;
    if (cursor !== null && next <= cursor) throw new Error("Archive cursor did not advance");
    yield rows;
    cursor = next;
    // Continue even after a short page: upstream row limits can change.
  }
}

export async function readArchive<T extends { slug: string }>(query: string): Promise<T[]> {
  const rows: T[] = [];
  for await (const page of archivePages<T>(query)) rows.push(...page);
  return rows;
}
