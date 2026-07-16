import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";
import { TELEGRAM_PATH, TelegramPost } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

const RETENTION_MS = 12 * 60 * 60 * 1000;

// Réception des messages trouvés par le worker Telegram (GitHub Actions).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const incoming = body?.posts;
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const existing = await readJson<TelegramPost[]>(TELEGRAM_PATH, []);
  const byUrl = new Map<string, TelegramPost>(existing.map((p) => [p.url, p]));
  let added = 0;
  for (const p of incoming.slice(0, 500)) {
    if (
      typeof p?.url !== "string" ||
      typeof p?.text !== "string" ||
      typeof p?.createdAt !== "string" ||
      byUrl.has(p.url)
    ) {
      continue;
    }
    byUrl.set(p.url, {
      text: p.text.slice(0, 600),
      url: p.url,
      channel: String(p.channel ?? "telegram"),
      handle: String(p.handle ?? "telegram"),
      createdAt: p.createdAt,
    });
    added++;
  }

  const cutoff = Date.now() - RETENTION_MS;
  const kept = [...byUrl.values()].filter(
    (p) => new Date(p.createdAt).getTime() > cutoff
  );
  await writeJson(TELEGRAM_PATH, kept);
  return NextResponse.json({ ok: true, added, total: kept.length });
}
