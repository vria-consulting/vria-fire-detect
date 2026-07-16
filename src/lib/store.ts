// Persistance minimaliste sur Vercel Blob : deux documents JSON.
// Volume minuscule (abonnements + journal d'alertes), pas besoin de base de
// données à ce stade — et ça reste dans le plan gratuit.

import { head, put } from "@vercel/blob";

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  // [ouest, sud, est, nord]
  bbox: [number, number, number, number];
  createdAt: string;
};

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const meta = await head(pathname);
    const res = await fetch(meta.downloadUrl, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // BlobNotFoundError au premier lancement
    return fallback;
  }
}

export async function writeJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export const SUBS_PATH = "subscriptions.json";
export const ALERTLOG_PATH = "alertlog.json";
