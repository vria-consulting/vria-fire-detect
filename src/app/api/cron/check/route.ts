import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getEvents } from "@/lib/eventscache";
import {
  readJson,
  writeJson,
  SUBS_PATH,
  ALERTLOG_PATH,
  PushSubscriptionRecord,
} from "@/lib/store";
import type { FireEvent } from "@/lib/cluster";

export const runtime = "nodejs";
// Le cron réchauffe les caches 24 h + 6 h : à froid c'est le passage le plus
// lourd de l'app.
export const maxDuration = 300;

// Fenêtre de nouveauté : un foyer déclenche une alerte si son premier signal
// date de moins d'une heure (le cron passe toutes les 5 min, la déduplication
// fait le reste).
const NEW_WINDOW_MS = 60 * 60 * 1000;
const LOG_RETENTION_MS = 48 * 60 * 60 * 1000;

const VAPID_PUBLIC_KEY =
  "BDkzUjBlN8TEIWHqe9Fo5UrCHbxzFp8MYPH3q2bqqLyZ5rob33ci-B4dFr2GLAGw_aO9zhT2prXSb7w7LD8rnjk";

function inBbox(ev: FireEvent, [w, s, e, n]: [number, number, number, number]): boolean {
  const [lon, lat] = ev.centroid;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return NextResponse.json({ error: "VAPID_MISSING" }, { status: 503 });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@example.com",
    VAPID_PUBLIC_KEY,
    priv
  );

  // Réchauffe les caches AVANT tout : 24 h (base des alertes) puis 6 h (vue
  // par défaut du site) — le second réutilise les détections brutes du premier,
  // donc coût FIRMS quasi nul. Le premier visiteur ne paie jamais le scan.
  const { events } = await getEvents(24);
  await getEvents(6);

  const subs = await readJson<PushSubscriptionRecord[]>(SUBS_PATH, []);
  if (subs.length === 0) return NextResponse.json({ ok: true, subs: 0, sent: 0 });
  const now = Date.now();
  // Seuls les foyers récents et au moins "probables" déclenchent une alerte
  // (un pixel isolé de confiance basse ferait fuir les utilisateurs).
  const fresh = events.filter(
    (ev) =>
      now - new Date(ev.firstSeen).getTime() < NEW_WINDOW_MS &&
      (ev.confidence === "probable" || ev.confidence === "corrobore")
  );

  const log = await readJson<Record<string, number>>(ALERTLOG_PATH, {});
  const dead: string[] = [];
  let sent = 0;

  for (const sub of subs) {
    for (const ev of fresh) {
      if (!inBbox(ev, sub.bbox)) continue;
      const key = `${sub.id}:${ev.id}`;
      if (log[key]) continue;
      const place = ev.social?.place;
      const payload = JSON.stringify({
        title: "🔥 Nouveau foyer détecté",
        body: `${place ? place + " — " : ""}${ev.count} détection${ev.count > 1 ? "s" : ""}, ${ev.maxFrp} MW, confiance ${ev.confidence === "corrobore" ? "corroborée" : "probable"}. 1er signal ${new Date(ev.firstSeen).toISOString().slice(11, 16)} UTC.`,
        url: `/?lat=${ev.centroid[1].toFixed(3)}&lon=${ev.centroid[0].toFixed(3)}&z=9&ev=${encodeURIComponent(ev.id)}`,
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        log[key] = now;
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.endpoint);
          break; // abonnement expiré : inutile d'essayer les autres foyers
        }
        console.error("push failed:", status);
      }
    }
  }

  // Nettoyage : abonnements morts + entrées de journal anciennes
  if (dead.length > 0) {
    const alive = subs.filter((s) => !dead.includes(s.endpoint));
    await writeJson(SUBS_PATH, alive);
  }
  for (const k of Object.keys(log)) {
    if (now - log[k] > LOG_RETENTION_MS) delete log[k];
  }
  await writeJson(ALERTLOG_PATH, log);

  return NextResponse.json({
    ok: true,
    subs: subs.length,
    freshEvents: fresh.length,
    sent,
    removed: dead.length,
  });
}
