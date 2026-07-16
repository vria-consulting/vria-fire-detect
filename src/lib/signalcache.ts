// Cache partagé de la veille sociale : /api/signals et /api/events (pour la
// corroboration des foyers) consomment le même scan, rafraîchi toutes les 5 min.
//
// Ce module décide aussi si un signalement est un NOUVEAU feu (newFire) :
// 1. l'historique des lieux (Vercel Blob) mémorise la première fois où chaque
//    lieu a été vu avec des mentions de feu ;
// 2. pour un lieu jamais vu, une contre-vérification Bluesky (recherche avec
//    borne "until") détecte les feux déjà en cours avant notre première
//    observation.

import { scanSocial, hasMentionsBefore, SocialSignal } from "./socialscan";
import { readJson, writeJson } from "./store";

export type SignalsPayload = {
  signals: SocialSignal[];
  meta: { fetchedAt: string; scannedPosts: number; statuses: number[] };
};

const HISTORY_PATH = "signal-history.json";
const NEW_FIRE_WINDOW_MS = 2 * 60 * 60 * 1000; // "nouveau feu" = 1res mentions < 2 h
const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// Marqueur "feu déjà établi avant notre première observation" : on antidate.
const ESTABLISHED_BACKDATE_MS = 24 * 60 * 60 * 1000;

const TTL_MS = 3 * 60 * 1000;
let cached: { at: number; data: SignalsPayload } | null = null;
let inflight: Promise<SignalsPayload> | null = null;

async function flagNewFires(signals: SocialSignal[]): Promise<void> {
  const now = Date.now();
  try {
    const history = await readJson<Record<string, string>>(HISTORY_PATH, {});
    let dirty = false;

    for (const sig of signals) {
      const key = `${sig.place}|${sig.countryCode}`.toLowerCase();
      const known = history[key];
      if (known) {
        sig.newFire = now - new Date(known).getTime() < NEW_FIRE_WINDOW_MS;
        continue;
      }
      // Lieu jamais observé. Si même sa plus ancienne mention de notre fenêtre
      // est déjà vieille (> 1 h), inutile de vérifier : pas un départ.
      const firstPostAge = now - new Date(sig.firstPost).getTime();
      if (firstPostAge >= NEW_FIRE_WINDOW_MS) {
        sig.newFire = false;
        history[key] = sig.firstPost;
        dirty = true;
        continue;
      }
      // Mentions toutes récentes : le feu existait-il déjà avant 1 h ?
      const cutoff = new Date(now - NEW_FIRE_WINDOW_MS).toISOString();
      const established = await hasMentionsBefore(sig.place, sig.countryCode, cutoff);
      sig.newFire = !established;
      history[key] = established
        ? new Date(now - ESTABLISHED_BACKDATE_MS).toISOString()
        : sig.firstPost;
      dirty = true;
    }

    // Purge des lieux anciens (un feu > 7 j repassera par la contre-vérification).
    for (const k of Object.keys(history)) {
      if (now - new Date(history[k]).getTime() > HISTORY_RETENTION_MS) {
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
