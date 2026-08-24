// Newsletter kanari : capture d'e-mails en double opt-in, génération du bilan
// périodique depuis l'archive, envoi via Resend et archive web indexable.
// Choix posés avec la spec du 24/08/2026 (conversation Référencement) :
// - envoi de masse UNIQUEMENT par /broadcasts (le plan marketing est limité
//   par contacts, pas par envois) ; /emails est réservé au mail de
//   confirmation, transactionnel par nature (quota 100/jour, largement
//   au-dessus du rythme d'inscriptions attendu) ;
// - pas de tracking d'ouverture ni de clic (choix privacy assumé) ;
// - Reply-To contact@kanari.io (news.kanari.io n'a pas de MX) ;
// - cadence : hebdomadaire de mai à octobre, mensuelle de novembre à avril,
//   envoi le lundi matin ;
// - la zone choisie est stockée côté kanari (l'API Contacts de Resend n'a pas
//   de propriétés libres) : elle servira au ciblage des alertes locales.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "@/lib/store";
import { periodStats } from "@/lib/observatory";
import { measuredEarliness } from "@/lib/precocity";
import type { Lang } from "@/lib/i18n";

// ---- Constantes Resend ------------------------------------------------------
const RESEND_API = "https://api.resend.com";
export const RESEND_AUDIENCE_ID = "61f9b271-be52-46cd-a423-46a7c7f1a494"; // General
const FROM = "kanari <bonjour@news.kanari.io>";
const REPLY_TO = "contact@kanari.io";
const SITE = "https://kanari.io";

// Garde-fou : le palier gratuit Resend plafonne à 1 000 contacts.
export const MAX_EMAIL_SUBS = 950;

// ---- Stockage (Vercel Blob, comme les abonnements push) --------------------
export const NEWS_PENDING_PATH = "newsletter-pending.json";
export const NEWS_SUBS_PATH = "newsletter-subscribers.json";
export const NEWS_ISSUES_PATH = "newsletter-issues.json";

export type EmailPending = {
  email: string;
  lang: Lang;
  bbox?: [number, number, number, number];
  label?: string;
  createdAt: string;
};

export type EmailSubscriber = EmailPending & {
  id: string;
  confirmedAt: string;
};

export type NewsletterIssue = {
  slug: string; // "semaine-2026-08-17" | "mois-2026-10"
  period: "week" | "month";
  fromIso: string;
  toIso: string;
  sentAt: string;
  total: number;
  prevTotal: number;
  countries: number; // pays distincts observés (plafonné au top 15 des stats)
  countriesTruncated: boolean;
  withAircraft: number;
  corroborated: number;
  maxFrp: number;
  topFire: {
    slug: string;
    place: string | null;
    country: string | null;
    maxFrp: number;
    detections: number;
    firstSeen: string;
  } | null;
  earliness: { cases: number; medianMin: number | null; bestPlace: string | null; bestDeltaMin: number | null } | null;
};

// ---- Secret et jetons de confirmation --------------------------------------
function tokenSecret(): string | null {
  return process.env.NEWSLETTER_SECRET ?? process.env.CRON_SECRET ?? process.env.RESEND_API_KEY ?? null;
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function createConfirmToken(p: EmailPending): string | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        e: p.email,
        l: p.lang,
        b: p.bbox ?? null,
        n: p.label ?? null,
        x: Date.now() + TOKEN_TTL_MS,
      })
    )
  );
  const sig = b64url(createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyConfirmToken(token: string): EmailPending | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", secret).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.x !== "number" || Date.now() > data.x) return null;
    if (typeof data.e !== "string" || !isEmail(data.e)) return null;
    const lang: Lang = data.l === "fr" || data.l === "es" || data.l === "pt" ? data.l : "en";
    return {
      email: data.e.toLowerCase(),
      lang,
      bbox: Array.isArray(data.b) && data.b.length === 4 ? (data.b as [number, number, number, number]) : undefined,
      label: typeof data.n === "string" && data.n ? data.n.slice(0, 120) : undefined,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function isEmail(x: unknown): x is string {
  return typeof x === "string" && x.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x);
}

// ---- Client Resend minimal (fetch, pas de dépendance) ----------------------
async function resendFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

// Contact dans l'audience General — créé uniquement APRÈS confirmation.
export async function createResendContact(email: string): Promise<boolean> {
  const res = await resendFetch(`/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
    method: "POST",
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  // 409/422 « déjà présent » compte comme un succès : l'état voulu est atteint.
  return !!res && (res.ok || res.status === 409 || res.status === 422);
}

export async function deleteResendContact(email: string): Promise<boolean> {
  const res = await resendFetch(
    `/audiences/${RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
    { method: "DELETE" }
  );
  return !!res && res.ok;
}

// ---- E-mail de confirmation (transactionnel : /emails) ---------------------
const CONFIRM_TEXTS: Record<Lang, { subject: string; hello: string; body: string; cta: string; ignore: string }> = {
  fr: {
    subject: "Confirmez votre inscription au bilan des feux kanari",
    hello: "Bonjour,",
    body: "Un clic et c'est fait : vous recevrez le bilan kanari des départs de feu (hebdomadaire en saison, mensuel l'hiver), avec le feu marquant de la période et ce que les satellites ont vu en premier. Gratuit, sans publicité, désinscription en un clic.",
    cta: "Confirmer mon inscription",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : rien ne sera envoyé.",
  },
  en: {
    subject: "Confirm your subscription to the kanari wildfire digest",
    hello: "Hello,",
    body: "One click and you are in: you will receive the kanari wildfire digest (weekly in season, monthly in winter), with the standout fire of the period and what satellites saw first. Free, no ads, one-click unsubscribe.",
    cta: "Confirm my subscription",
    ignore: "If you did not request this, simply ignore this message: nothing will be sent.",
  },
  es: {
    subject: "Confirma tu suscripción al resumen de incendios de kanari",
    hello: "Hola:",
    body: "Un clic y listo: recibirás el resumen de incendios de kanari (semanal en temporada, mensual en invierno), con el incendio destacado del período y lo que los satélites vieron primero. Gratis, sin publicidad, baja en un clic.",
    cta: "Confirmar mi suscripción",
    ignore: "Si no solicitaste esto, ignora este mensaje: no se enviará nada.",
  },
  pt: {
    subject: "Confirme a sua inscrição no resumo de incêndios kanari",
    hello: "Olá,",
    body: "Um clique e pronto: você receberá o resumo kanari dos incêndios (semanal na temporada, mensal no inverno), com o incêndio marcante do período e o que os satélites viram primeiro. Grátis, sem anúncios, cancelamento em um clique.",
    cta: "Confirmar minha inscrição",
    ignore: "Se você não fez este pedido, ignore esta mensagem: nada será enviado.",
  },
};

function emailShell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FBF9F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF9F4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:#FFC72E;padding:18px 28px;font-size:22px;font-weight:700;color:#1B1C1E;">kanari</td></tr>
${inner}
<tr><td style="padding:18px 28px 26px;font-size:12px;line-height:1.6;color:#8A8880;border-top:1px solid #EFECE4;">
kanari est un service d'information indépendant, pas un canal d'alerte officiel. En urgence : 112 (Europe) · 18 (France) · 911 · 193 (Brasil).<br>
kanari.io · CC BY 4.0 · <a href="mailto:${REPLY_TO}" style="color:#8A8880;">${REPLY_TO}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendConfirmationEmail(p: EmailPending): Promise<boolean> {
  const token = createConfirmToken(p);
  if (!token) return false;
  const t = CONFIRM_TEXTS[p.lang];
  const url = `${SITE}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  const inner = `<tr><td style="padding:26px 28px 8px;font-size:15px;line-height:1.7;color:#1B1C1E;">
<p style="margin:0 0 12px;">${t.hello}</p>
<p style="margin:0 0 20px;">${t.body}</p>
<p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;background:#1B1C1E;color:#FBF9F4;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px;">${t.cta}</a></p>
<p style="margin:0 0 8px;font-size:12.5px;color:#8A8880;">${t.ignore}</p>
</td></tr>`;
  const res = await resendFetch("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: FROM,
      to: [p.email],
      reply_to: REPLY_TO,
      subject: t.subject,
      html: emailShell(inner),
    }),
  });
  return !!res && res.ok;
}

// ---- Cadence : hebdo de mai à octobre, mensuel de novembre à avril ---------
// L'envoi part le lundi matin (le cron GitHub tire le lundi à 06:05 UTC).
export function issueDue(now: Date): { period: "week" | "month"; fromIso: string; toIso: string; slug: string } | null {
  if (now.getUTCDay() !== 1) return null; // lundi uniquement
  const month = now.getUTCMonth(); // mai=4 … octobre=9
  const weekly = month >= 4 && month <= 9;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (weekly) {
    const to = new Date(today);
    const from = new Date(today - 7 * 24 * 3600 * 1000);
    const f = from.toISOString();
    return { period: "week", fromIso: f, toIso: to.toISOString(), slug: `semaine-${f.slice(0, 10)}` };
  }
  if (now.getUTCDate() > 7) return null; // mensuel : premier lundi du mois
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    period: "month",
    fromIso: prev.toISOString(),
    toIso: first.toISOString(),
    slug: `mois-${prev.toISOString().slice(0, 7)}`,
  };
}

// ---- Construction d'un numéro ----------------------------------------------
export async function buildIssue(due: { period: "week" | "month"; fromIso: string; toIso: string; slug: string }): Promise<NewsletterIssue> {
  const spanMs = Date.parse(due.toIso) - Date.parse(due.fromIso);
  const [stats, prev, earliness] = await Promise.all([
    periodStats(due.fromIso, due.toIso, null),
    periodStats(new Date(Date.parse(due.fromIso) - spanMs).toISOString(), due.fromIso, null),
    measuredEarliness(5).catch(() => null),
  ]);
  const top = stats.biggest[0] ?? null;
  const bestCase = earliness && earliness.cases.length > 0 ? earliness.cases[0] : null;
  return {
    slug: due.slug,
    period: due.period,
    fromIso: due.fromIso,
    toIso: due.toIso,
    sentAt: new Date().toISOString(),
    total: stats.total,
    prevTotal: prev.total,
    countries: stats.byCountry.length,
    countriesTruncated: stats.byCountry.length >= 15,
    withAircraft: stats.withAircraft,
    corroborated: stats.corroborated,
    maxFrp: Math.round(stats.maxFrp),
    topFire: top
      ? {
          slug: top.slug,
          place: top.place,
          country: top.country,
          maxFrp: Math.round(top.max_frp),
          detections: top.detections,
          firstSeen: top.first_seen,
        }
      : null,
    earliness:
      earliness && earliness.cases.length > 0
        ? {
            cases: earliness.cases.length,
            medianMin: earliness.medianMin,
            bestPlace: bestCase?.place ?? null,
            bestDeltaMin: bestCase?.deltaMin ?? null,
          }
        : null,
  };
}

// ---- Rendu e-mail (FR : langue d'envoi V1, l'archive web est en 4 langues) --
function fmtPeriodFr(issue: NewsletterIssue): string {
  const from = new Date(issue.fromIso);
  const to = new Date(Date.parse(issue.toIso) - 24 * 3600 * 1000);
  const f = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  if (issue.period === "month")
    return from.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return `du ${f(from)} au ${f(to)}`;
}

export const ISSUE_LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-US", es: "es-ES", pt: "pt-BR" };

// Libellé humain de la période d'un numéro (« 17 → 23 août 2026 », « octobre
// 2026 ») — partagé entre l'archive, la page du numéro et ses metadata.
export function periodLabel(issue: NewsletterIssue, lang: Lang): string {
  const from = new Date(issue.fromIso);
  const to = new Date(Date.parse(issue.toIso) - 24 * 3600 * 1000);
  if (issue.period === "month") {
    return from.toLocaleDateString(ISSUE_LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const f = (d: Date) => d.toLocaleDateString(ISSUE_LOCALE[lang], { day: "numeric", month: "long", timeZone: "UTC" });
  return `${f(from)} → ${f(to)} ${to.getUTCFullYear()}`;
}

export function fmtDeltaMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

export function issueSubjectFr(issue: NewsletterIssue): string {
  const p = issue.period === "week" ? "cette semaine" : fmtPeriodFr(issue);
  return `Le chant du canari : ${issue.total.toLocaleString("fr-FR")} départs de feu détectés ${p}`;
}

export function renderIssueEmailHtml(issue: NewsletterIssue): string {
  const delta = issue.prevTotal > 0 ? Math.round(((issue.total - issue.prevTotal) / issue.prevTotal) * 100) : null;
  const deltaTxt =
    delta === null
      ? ""
      : delta >= 0
        ? ` (+${delta} % vs période précédente)`
        : ` (${delta} % vs période précédente)`;
  const top = issue.topFire;
  const topBlock = top
    ? `<p style="margin:0 0 6px;font-weight:700;color:#1B1C1E;">Le feu de la période</p>
<p style="margin:0 0 18px;">${top.place ?? "Zone non nommée"}${top.country ? ` (${top.country})` : ""} : ${top.maxFrp.toLocaleString("fr-FR")} MW de puissance maximale, ${top.detections.toLocaleString("fr-FR")} détections satellite. <a href="${SITE}/fr/feu/${top.slug}" style="color:#B96A00;">Voir sa page permanente</a>.</p>`
    : "";
  const earl = issue.earliness;
  const earlBlock =
    earl && earl.bestPlace && earl.bestDeltaMin
      ? `<p style="margin:0 0 6px;font-weight:700;color:#1B1C1E;">Vu avant la presse</p>
<p style="margin:0 0 18px;">${earl.cases} foyer${earl.cases > 1 ? "s" : ""} détecté${earl.cases > 1 ? "s" : ""} avant le premier article de presse${earl.medianMin ? ` (avance médiane ${fmtDeltaMin(earl.medianMin)})` : ""}. Record : ${earl.bestPlace}, ${fmtDeltaMin(earl.bestDeltaMin)} d'avance. <a href="${SITE}/fr/precocite" style="color:#B96A00;">La méthodologie</a>.</p>`
      : "";
  const inner = `<tr><td style="padding:26px 28px 8px;font-size:15px;line-height:1.7;color:#3D3C38;">
<p style="margin:0 0 4px;font-size:13px;color:#8A8880;">Le bilan des feux de forêt ${fmtPeriodFr(issue)}</p>
<p style="margin:0 0 16px;font-size:30px;font-weight:700;color:#1B1C1E;">${issue.total.toLocaleString("fr-FR")} départs de feu détectés</p>
<p style="margin:0 0 18px;">dans ${issue.countries}${issue.countriesTruncated ? "+" : ""} pays${deltaTxt}. ${issue.withAircraft.toLocaleString("fr-FR")} foyers avec des moyens aériens observés sur zone, ${issue.corroborated.toLocaleString("fr-FR")} corroborés par des témoignages vérifiés.</p>
${topBlock}
${earlBlock}
<p style="margin:0 0 26px;"><a href="${SITE}/fr/newsletter/${issue.slug}" style="display:inline-block;background:#1B1C1E;color:#FBF9F4;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;">Lire le bilan complet</a>
&nbsp;&nbsp;<a href="${SITE}/fr" style="color:#B96A00;font-size:14px;">Voir la carte en direct</a></p>
<p style="margin:0 0 10px;font-size:12px;color:#8A8880;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8A8880;">Se désinscrire en un clic</a></p>
</td></tr>`;
  return emailShell(inner);
}

// ---- Envoi du numéro : broadcasts UNIQUEMENT (jamais /emails) --------------
export async function sendIssueBroadcast(issue: NewsletterIssue): Promise<{ ok: boolean; id?: string; error?: string }> {
  const create = await resendFetch("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      audience_id: RESEND_AUDIENCE_ID,
      from: FROM,
      reply_to: REPLY_TO,
      subject: issueSubjectFr(issue),
      html: renderIssueEmailHtml(issue),
      name: issue.slug,
    }),
  });
  if (!create || !create.ok) {
    return { ok: false, error: create ? `create ${create.status}: ${await create.text().catch(() => "")}` : "no api key" };
  }
  const { id } = (await create.json()) as { id: string };
  const send = await resendFetch(`/broadcasts/${id}/send`, { method: "POST", body: "{}" });
  if (!send || !send.ok) {
    return { ok: false, id, error: send ? `send ${send.status}: ${await send.text().catch(() => "")}` : "no api key" };
  }
  return { ok: true, id };
}

// ---- Accès aux numéros publiés ---------------------------------------------
export async function listIssues(): Promise<NewsletterIssue[]> {
  const issues = await readJson<NewsletterIssue[]>(NEWS_ISSUES_PATH, []);
  return issues.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

export async function getIssue(slug: string): Promise<NewsletterIssue | null> {
  const issues = await readJson<NewsletterIssue[]>(NEWS_ISSUES_PATH, []);
  return issues.find((i) => i.slug === slug) ?? null;
}

export async function saveIssue(issue: NewsletterIssue): Promise<void> {
  const issues = await readJson<NewsletterIssue[]>(NEWS_ISSUES_PATH, []);
  const next = issues.filter((i) => i.slug !== issue.slug);
  next.push(issue);
  await writeJson(NEWS_ISSUES_PATH, next);
}

export function newSubscriberRecord(p: EmailPending): EmailSubscriber {
  return { ...p, id: randomUUID(), confirmedAt: new Date().toISOString() };
}
