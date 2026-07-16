import { NextRequest, NextResponse } from "next/server";
import {
  readJson,
  writeJson,
  SUBS_PATH,
  PushSubscriptionRecord,
} from "@/lib/store";

export const runtime = "nodejs";

const MAX_SUBSCRIPTIONS = 5000; // garde-fou plan gratuit

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const bbox = body?.bbox;
  if (
    !sub?.endpoint ||
    !sub?.keys?.p256dh ||
    !sub?.keys?.auth ||
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    bbox.some((v: unknown) => typeof v !== "number" || !isFinite(v as number))
  ) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const [w, s, e, n] = bbox as number[];
  if (w >= e || s >= n || Math.abs(s) > 90 || Math.abs(n) > 90) {
    return NextResponse.json({ error: "BAD_BBOX" }, { status: 400 });
  }

  const subs = await readJson<PushSubscriptionRecord[]>(SUBS_PATH, []);
  if (subs.length >= MAX_SUBSCRIPTIONS) {
    return NextResponse.json({ error: "FULL" }, { status: 503 });
  }
  const record: PushSubscriptionRecord = {
    id: crypto.randomUUID(),
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    bbox: [w, s, e, n],
    createdAt: new Date().toISOString(),
  };
  // Un même navigateur (endpoint) ne garde qu'une zone : la dernière.
  const next = subs.filter((x) => x.endpoint !== record.endpoint);
  next.push(record);
  await writeJson(SUBS_PATH, next);
  return NextResponse.json({ ok: true, id: record.id });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const subs = await readJson<PushSubscriptionRecord[]>(SUBS_PATH, []);
  const next = subs.filter((x) => x.endpoint !== endpoint);
  if (next.length !== subs.length) await writeJson(SUBS_PATH, next);
  return NextResponse.json({ ok: true });
}
