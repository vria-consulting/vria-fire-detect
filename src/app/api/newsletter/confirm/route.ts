import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";
import {
  verifyConfirmToken,
  createResendContact,
  newSubscriberRecord,
  MAX_EMAIL_SUBS,
  NEWS_PENDING_PATH,
  NEWS_SUBS_PATH,
  type EmailPending,
  type EmailSubscriber,
} from "@/lib/newsletter";

export const runtime = "nodejs";

// Double opt-in, étape 2 : le lien du mail de confirmation atterrit ici. Le
// jeton HMAC porte tout (e-mail, langue, zone) : pas d'état requis côté
// serveur, le clic vaut preuve. C'est SEULEMENT ici que le contact Resend est
// créé. Redirections : l'utilisateur sort d'un client mail, il doit atterrir
// sur une page humaine dans sa langue, jamais sur du JSON.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const p = verifyConfirmToken(token);
  if (!p) {
    return NextResponse.redirect("https://kanari.io/fr/newsletter?confirmed=expired", 302);
  }
  const dest = (q: string) => NextResponse.redirect(`https://kanari.io/${p.lang}/newsletter?confirmed=${q}`, 302);

  const subs = await readJson<EmailSubscriber[]>(NEWS_SUBS_PATH, []);
  if (subs.some((s) => s.email === p.email)) return dest("1");
  if (subs.length >= MAX_EMAIL_SUBS) return dest("full");

  const created = await createResendContact(p.email);
  if (!created) return dest("error");

  subs.push(newSubscriberRecord(p));
  await writeJson(NEWS_SUBS_PATH, subs);
  const pendings = await readJson<EmailPending[]>(NEWS_PENDING_PATH, []);
  await writeJson(
    NEWS_PENDING_PATH,
    pendings.filter((x) => x.email !== p.email)
  );
  return dest("1");
}
