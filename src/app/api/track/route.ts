import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  geoFromHeaders,
  insertPageView,
  isBot,
  parseUA,
  referrerHost,
  visitorHash,
} from "@/lib/analytics";

export const runtime = "nodejs";

// Anti-abus léger : 90 hits / min / IP (un pic de navigation reste sous la barre).
const WINDOW = 60 * 1000;
const MAX = 90;
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown) => {
  const x = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(x) && x > 0 && x < 20000 ? Math.round(x) : null;
};

export async function POST(req: NextRequest) {
  const h = req.headers;
  const ip = clientIp(h);
  if (limited(ip)) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = s(body.path, 300) || "/";
  const ua = h.get("user-agent") || "";
  const geo = geoFromHeaders(h);
  const { device, browser, os } = parseUA(ua);

  await insertPageView({
    path,
    referrer_host: referrerHost(s(body.referrer, 400)) || null,
    utm_source: s(body.utm_source, 120) || null,
    utm_medium: s(body.utm_medium, 120) || null,
    utm_campaign: s(body.utm_campaign, 120) || null,
    country: geo.country || null,
    region: geo.region || null,
    city: geo.city || null,
    device,
    browser,
    os,
    lang: s(body.lang, 8) || null,
    screen_w: n(body.screen_w),
    screen_h: n(body.screen_h),
    visitor_hash: visitorHash(ip, ua),
    is_bot: isBot(ua),
  });

  // Réponse minimale : le beacon n'attend rien.
  return new NextResponse(null, { status: 204 });
}
