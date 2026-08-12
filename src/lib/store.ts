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
    // Blobs privés : le downloadUrl seul répond désormais « Forbidden » — le
    // token est exigé au téléchargement (constaté le 12/08/2026 ; la lecture
    // échouait en silence et tout retombait sur les fallbacks).
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(meta.downloadUrl, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
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

// Date de dernière écriture d'un blob, sans le télécharger (contrôle de
// fraîcheur des snapshots de foyers). null si le blob n'existe pas encore.
export async function blobUpdatedAt(pathname: string): Promise<number | null> {
  try {
    const meta = await head(pathname);
    return new Date(meta.uploadedAt).getTime();
  } catch {
    return null;
  }
}

export const SUBS_PATH = "subscriptions.json";
export const ALERTLOG_PATH = "alertlog.json";
