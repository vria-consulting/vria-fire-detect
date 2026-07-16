// Lecture des messages Telegram collectés par le worker GitHub Actions
// (scripts/telegram_scan.py -> /api/ingest/telegram -> Blob).

import { readJson } from "./store";

export type TelegramPost = {
  text: string;
  url: string;
  channel: string;
  handle: string;
  createdAt: string; // ISO
};

export const TELEGRAM_PATH = "telegram-posts.json";

let cached: { at: number; posts: TelegramPost[] } | null = null;
const TTL_MS = 2 * 60 * 1000;

export async function fetchTelegramPosts(): Promise<TelegramPost[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.posts;
  try {
    const posts = await readJson<TelegramPost[]>(TELEGRAM_PATH, []);
    cached = { at: Date.now(), posts };
    return posts;
  } catch {
    // Blob indisponible (dev local sans token) : pas de veille Telegram.
    return cached?.posts ?? [];
  }
}
