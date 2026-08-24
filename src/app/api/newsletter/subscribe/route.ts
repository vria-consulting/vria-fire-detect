import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";
import {
  isEmail,
  sendConfirmationEmail,
  MAX_EMAIL_SUBS,
  NEWS_PENDING_PATH,
  NEWS_SUBS_PATH,
  type EmailPending,
  type EmailSubscriber,
} from "@/lib/newsletter";
import { isValidLang, type Lang } from "@/lib/i18n";

export const runtime = "nodejs";

// Double opt-in, étape 1 : on n'écrit RIEN chez Resend ici. L'adresse part en
// « pending » et reçoit un e-mail de confirmation ; le contact n'est créé
// qu'au clic (voir /api/newsletter/confirm). Anti-abus : honeypot `website`
// (les remplisseurs automatiques y écrivent), cap global, dédoublonnage.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website.trim() !== "") {
    // Honeypot rempli : on répond comme si tout allait bien, sans rien faire.
    return NextResponse.json({ ok: true });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) {
    return NextResponse.json({ error: "BAD_EMAIL" }, { status: 400 });
  }
  const lang: Lang = isValidLang(body.lang) ? body.lang : "en";
  let bbox: [number, number, number, number] | undefined;
  if (Array.isArray(body.bbox) && body.bbox.length === 4 && body.bbox.every((v: unknown) => typeof v === "number" && isFinite(v as number))) {
    const [w, s, e, n] = body.bbox as number[];
    if (w < e && s < n && Math.abs(s) <= 90 && Math.abs(n) <= 90) bbox = [w, s, e, n];
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : undefined;

  const subs = await readJson<EmailSubscriber[]>(NEWS_SUBS_PATH, []);
  if (subs.some((s) => s.email === email)) {
    // Déjà confirmé : idempotent, pas de second e-mail.
    return NextResponse.json({ ok: true, already: true });
  }
  if (subs.length >= MAX_EMAIL_SUBS) {
    return NextResponse.json({ error: "FULL" }, { status: 503 });
  }

  const pending: EmailPending = { email, lang, bbox, label, createdAt: new Date().toISOString() };
  const sent = await sendConfirmationEmail(pending);
  if (!sent) {
    return NextResponse.json({ error: "SEND_FAILED" }, { status: 502 });
  }
  const pendings = await readJson<EmailPending[]>(NEWS_PENDING_PATH, []);
  const next = pendings.filter((p) => p.email !== email && Date.now() - Date.parse(p.createdAt) < 14 * 24 * 3600 * 1000);
  next.push(pending);
  await writeJson(NEWS_PENDING_PATH, next);
  return NextResponse.json({ ok: true });
}
