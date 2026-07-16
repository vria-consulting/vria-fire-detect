// Cache partagé de la veille sociale : /api/signals et /api/events (pour la
// corroboration des foyers) consomment le même scan, rafraîchi toutes les 5 min.

import { scanSocial, SocialSignal } from "./socialscan";

export type SignalsPayload = {
  signals: SocialSignal[];
  meta: { fetchedAt: string; scannedPosts: number; statuses: number[] };
};

const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; data: SignalsPayload } | null = null;
let inflight: Promise<SignalsPayload> | null = null;

export async function getSignals(): Promise<SignalsPayload> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { signals, scannedPosts, statuses } = await scanSocial(12);
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
