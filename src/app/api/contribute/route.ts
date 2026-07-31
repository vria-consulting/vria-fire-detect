import { NextRequest, NextResponse } from "next/server";
import {
  saveContribution,
  storeFile,
  isValidEmail,
  hashIp,
  ALLOWED_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  type Attachment,
} from "@/lib/contributions";
import { geoFromHeaders, parseUA, referrerHost } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 30;

// Anti-abus par instance : 3 contributions / 10 min / IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

const s = (v: FormDataEntryValue | null, max: number) =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "BAD_FORM" }, { status: 400 });
  }

  const name = s(form.get("name"), 120);
  const email = s(form.get("email"), 200);
  const phone = s(form.get("phone"), 40) || undefined;
  const role = s(form.get("role"), 120) || undefined;
  const message = s(form.get("message"), 5000);
  const lang = s(form.get("lang"), 5) || undefined;

  if (!name || !isValidEmail(email) || message.length < 5) {
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "TOO_MANY_FILES" }, { status: 400 });
  }

  const attachments: Attachment[] = [];
  let total = 0;
  for (const f of files) {
    if (!ALLOWED_TYPES.has(f.type)) {
      return NextResponse.json({ error: "BAD_FILE_TYPE" }, { status: 415 });
    }
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
    }
    total += f.size;
    if (total > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "TOTAL_TOO_LARGE" }, { status: 413 });
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const safeName = (f.name || "fichier").replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    try {
      const url = await storeFile(path, buf, f.type);
      attachments.push({ name: safeName, url, size: f.size, type: f.type });
    } catch (e) {
      console.error("contribution file store failed:", e);
      return NextResponse.json({ error: "STORAGE_ERROR" }, { status: 502 });
    }
  }

  const ua = req.headers.get("user-agent") || "";
  const geo = geoFromHeaders(req.headers);
  const { device } = parseUA(ua);

  try {
    const { backend } = await saveContribution({
      name,
      email,
      phone,
      role,
      message,
      attachments,
      lang,
      userAgent: ua.slice(0, 300) || undefined,
      ipHash: hashIp(ip),
      referrerHost: referrerHost(s(form.get("referrer"), 400)) || undefined,
      utmSource: s(form.get("utm_source"), 120) || undefined,
      utmMedium: s(form.get("utm_medium"), 120) || undefined,
      utmCampaign: s(form.get("utm_campaign"), 120) || undefined,
      country: geo.country || undefined,
      device: device || undefined,
    });
    return NextResponse.json({ ok: true, backend });
  } catch (e) {
    console.error("contribution save failed:", e);
    return NextResponse.json({ error: "SAVE_ERROR" }, { status: 502 });
  }
}
