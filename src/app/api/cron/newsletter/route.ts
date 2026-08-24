import { NextRequest, NextResponse } from "next/server";
import {
  issueDue,
  buildIssue,
  saveIssue,
  getIssue,
  sendIssueBroadcast,
  renderIssueEmailHtml,
  issueSubjectFr,
} from "@/lib/newsletter";

export const runtime = "nodejs";
export const maxDuration = 120;

// Déclenché par GitHub Actions le lundi à 06:05 UTC (newsletter-cron.yml).
// Cadence : hebdomadaire de mai à octobre, mensuelle (premier lundi) de
// novembre à avril — la décision est prise ici, le cron tire tous les lundis.
// `?dry=1` : génère le numéro et renvoie le HTML sans rien envoyer ni stocker
// (test de bout en bout sans toucher l'audience).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const due = issueDue(new Date());
  if (!due) {
    return NextResponse.json({ ok: true, skipped: "not due today" });
  }
  const existing = await getIssue(due.slug);
  if (existing && !dry) {
    // Relance du cron le même lundi : le numéro est déjà parti.
    return NextResponse.json({ ok: true, skipped: "already sent", slug: due.slug });
  }
  const issue = await buildIssue(due);
  if (dry) {
    return new NextResponse(renderIssueEmailHtml(issue), {
      headers: { "content-type": "text/html; charset=utf-8", "x-subject": encodeURIComponent(issueSubjectFr(issue)) },
    });
  }
  // L'archive web d'abord : le lien « Lire le bilan complet » de l'e-mail doit
  // exister avant que le premier destinataire ne clique.
  await saveIssue(issue);
  const sent = await sendIssueBroadcast(issue);
  if (!sent.ok) {
    return NextResponse.json({ ok: false, slug: issue.slug, error: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, slug: issue.slug, broadcastId: sent.id, total: issue.total });
}
