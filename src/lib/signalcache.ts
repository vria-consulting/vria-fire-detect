// Cache partagé de la veille sociale : /api/signals et /api/events (pour la
// corroboration des foyers) consomment le même scan, rafraîchi toutes les 5 min.
//
// Ce module décide aussi si un signalement est un NOUVEAU feu (newFire) :
// 1. l'historique des lieux (Vercel Blob) mémorise la première fois où chaque
//    lieu a été vu avec des mentions de feu ;
// 2. pour un lieu jamais vu, une contre-vérification Bluesky (recherche avec
//    borne "until") détecte les feux déjà en cours avant notre première
//    observation.

import { scanSocial, latestMentionBefore, SocialSignal } from "./socialscan";
import { readJson, writeJson } from "./store";

export type SignalsPayload = {
  signals: SocialSignal[];
  meta: { fetchedAt: string; scannedPosts: number; statuses: number[] };
};

const HISTORY_PATH = "signal-history.json";
const NEW_FIRE_WINDOW_MS = 2 * 60 * 60 * 1000; // "nouveau feu" = rafale démarrée < 2 h
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Un lieu redevient éligible aux "départs" si ses mentions repartent après
// ce silence : un NOUVEAU feu à Montpellier ne doit pas être masqué parce que
// Montpellier a déjà brûlé la semaine dernière.
const QUIET_GAP_MS = 6 * 60 * 60 * 1000;

const TTL_MS = 3 * 60 * 1000;
let cached: { at: number; data: SignalsPayload } | null = null;
let inflight: Promise<SignalsPayload> | null = null;

// Historique par lieu : l = dernière mention vue, b = début de la rafale en
// cours. Un lieu est en "rafale nouvelle" si ses mentions repartent après
// QUIET_GAP_MS de silence ; newFire = la rafale a commencé il y a < 2 h.
type PlaceHistory = { l: string; b: string };

function upgrade(v: string | PlaceHistory): PlaceHistory {
  // Migration de l'ancien format (simple ISO string).
  return typeof v === "string" ? { l: v, b: v } : v;
}

async function flagNewFires(signals: SocialSignal[]): Promise<void> {
  const now = Date.now();
  try {
    const raw = await readJson<Record<string, string | PlaceHistory>>(HISTORY_PATH, {});
    const history: Record<string, PlaceHistory> = {};
    for (const [k, v] of Object.entries(raw)) history[k] = upgrade(v);
    let dirty = false;

    for (const sig of signals) {
      const key = `${sig.place}|${sig.countryCode}`.toLowerCase();
      const h = history[key];
      let burstStart: string;

      if (h && Date.parse(sig.firstPost) - Date.parse(h.l) < QUIET_GAP_MS) {
        // Mentions continues depuis la dernière observation : même rafale.
        burstStart = h.b < sig.firstPost ? h.b : sig.firstPost;
      } else {
        // Lieu jamais vu, ou silence > 6 h : candidate nouvelle rafale.
        // Contre-vérification Bluesky : y avait-il des mentions juste avant
        // notre première observation (biais d'échantillonnage) ?
        const prior = await latestMentionBefore(sig.place, sig.countryCode, sig.firstPost);
        if (prior && Date.parse(sig.firstPost) - Date.parse(prior) < QUIET_GAP_MS) {
          burstStart = prior; // feu déjà en cours avant notre fenêtre
        } else {
          burstStart = sig.firstPost; // véritable nouveau départ
        }
      }

      sig.newFire = now - Date.parse(burstStart) < NEW_FIRE_WINDOW_MS;
      history[key] = { l: sig.lastPost, b: burstStart };
      dirty = true;
    }

    // Purge des lieux silencieux depuis > 7 j.
    for (const k of Object.keys(history)) {
      if (now - Date.parse(history[k].l) > HISTORY_RETENTION_MS) {
        delete history[k];
        dirty = true;
      }
    }
    if (dirty) await writeJson(HISTORY_PATH, history);
  } catch (e) {
    // Sans stockage (dev sans token Blob…), repli : fraîcheur de la 1re mention.
    console.error("signal history unavailable:", e);
    for (const sig of signals) {
      sig.newFire = now - new Date(sig.firstPost).getTime() < NEW_FIRE_WINDOW_MS;
    }
  }
}

export async function getSignals(): Promise<SignalsPayload> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { signals, scannedPosts, statuses } = await scanSocial(12);
      await flagNewFires(signals);
      const data: SignalsPayload = {
        signals,
        meta: { fetchedAt: new Date().toISOString(), scannedPosts, statuses },
      };
      cached = { at: Date.now(), data };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
