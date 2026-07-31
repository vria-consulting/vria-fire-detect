import { NextRequest, NextResponse } from "next/server";
import { sendMagicLink } from "@/lib/adminSession";
import { clientIp } from "@/lib/analytics";

export const runtime = "nodejs";

// Anti-spam : 3 liens / 15 min / IP + 5 / 15 min au global. Même si l'URL
// secrète est découverte, le lien ne part que vers l'adresse admin codée en dur.
const WINDOW = 15 * 60 * 1000;
const perIp = new Map<string, number[]>();
let global: number[] = [];

function throttled(ip: string): boolean {
  const now = Date.now();
  global = global.filter((t) => now - t < WINDOW);
  const arr = (perIp.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (arr.length >= 3 || global.length >= 5) {
    perIp.set(ip, arr);
    return true;
  }
  arr.push(now);
  global.push(now);
  perIp.set(ip, arr);
  return false;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (throttled(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const origin = new URL(req.url).origin;
  const redirectTo = `${origin}/veille/confirm`;
  const { ok, error } = await sendMagicLink(redirectTo);
  if (!ok) {
    console.error("magic link send failed:", error);
    return NextResponse.json({ error: "SEND_FAILED" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
