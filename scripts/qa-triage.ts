// Harnais QA du pipeline de détection sociale — rejoue le VRAI code sur un
// corpus réel massif et écrit les verdicts pour revue humaine.
//
//   OPENAI_API_KEY=... BSKY_IDENTIFIER=... BSKY_APP_PASSWORD=... \
//   npx tsx scripts/qa-triage.ts <dossier-de-sortie> [heures]
//
// Sorties (JSONL) :
//   corpus-judged.jsonl  — posts AVEC lieu candidat + verdicts trieur/final
//   corpus-noplace.jsonl — posts SANS lieu (revue des alertes manquées)

import fs from "node:fs";
import path from "node:path";
import { searchPosts, postUrl } from "../src/lib/bsky";
import { extractPlaces } from "../src/lib/geoparse";
import { SCAN_QUERIES } from "../src/lib/socialscan";
import { judgeForQA, TriageCandidate } from "../src/lib/triage";

const OUT_DIR = process.argv[2] ?? ".";
const HOURS = parseInt(process.argv[3] ?? "48", 10);

type Row = {
  source: string;
  url: string;
  createdAt: string;
  text: string;
  places?: string[];
  first?: { fire: boolean; place: number | null } | null;
  final?: { fire: boolean; place: number | null } | null;
  anchored?: string | null;
};

async function collectBluesky(): Promise<{ text: string; url: string; createdAt: string }[]> {
  const since = Date.now() - HOURS * 3_600_000;
  const seen = new Set<string>();
  const posts: { text: string; url: string; createdAt: string }[] = [];
  for (const q of SCAN_QUERIES) {
    const { posts: found, status } = await searchPosts(q, 100).catch(() => ({
      posts: [],
      status: 0,
    }));
    console.error(`bluesky ${q}: ${found.length} posts (HTTP ${status})`);
    for (const p of found) {
      if (seen.has(p.uri)) continue;
      seen.add(p.uri);
      const createdAt = p.record?.createdAt ?? "";
      const text = p.record?.text ?? "";
      if (!createdAt || !text || new Date(createdAt).getTime() < since) continue;
      posts.push({ text, url: postUrl(p), createdAt });
    }
  }
  return posts;
}

function readTelegramFile(): { text: string; url: string; createdAt: string }[] {
  // corpus Telegram collecté séparément (scripts/telegram_scan.py, stdout JSON)
  const p = path.join(OUT_DIR, "telegram-corpus.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const bluesky = await collectBluesky();
  const telegram = readTelegramFile();
  console.error(`corpus: ${bluesky.length} bluesky + ${telegram.length} telegram`);

  const all = [
    ...bluesky.map((p) => ({ ...p, source: "bluesky" })),
    ...telegram.map((p) => ({ ...p, source: "telegram" })),
  ];

  const withPlaces: (Row & { candidate: TriageCandidate })[] = [];
  const noPlace: Row[] = [];
  for (const p of all) {
    const places = extractPlaces(p.text);
    if (places.length === 0 || places.length > 3) {
      noPlace.push({ source: p.source, url: p.url, createdAt: p.createdAt, text: p.text });
      continue;
    }
    const labels = places.map((x) => `${x.entry[3]} (${x.entry[2].toUpperCase()})`);
    withPlaces.push({
      source: p.source,
      url: p.url,
      createdAt: p.createdAt,
      text: p.text,
      places: labels,
      candidate: { url: p.url, text: p.text, places: labels, createdAt: p.createdAt },
    });
  }
  // Les plus récents d'abord, plafond raisonnable pour la campagne.
  withPlaces.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const toJudge = withPlaces.slice(0, 320);
  console.error(`à juger: ${toJudge.length} (sur ${withPlaces.length} avec lieu) | sans lieu: ${noPlace.length}`);

  const verdicts = await judgeForQA(toJudge.map((r) => r.candidate));
  const judged: Row[] = toJudge.map((r) => {
    const v = verdicts.get(r.url);
    const final = v?.final ?? null;
    return {
      source: r.source,
      url: r.url,
      createdAt: r.createdAt,
      text: r.text,
      places: r.places,
      first: v?.first ?? null,
      final,
      anchored:
        final?.fire && final.place != null ? (r.places?.[final.place] ?? null) : null,
    };
  });

  fs.writeFileSync(
    path.join(OUT_DIR, "corpus-judged.jsonl"),
    judged.map((r) => JSON.stringify(r)).join("\n")
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "corpus-noplace.jsonl"),
    noPlace.map((r) => JSON.stringify(r)).join("\n")
  );
  const accepted = judged.filter((r) => r.anchored);
  console.error(
    `jugés: ${judged.length} | acceptés (affichés sur la carte): ${accepted.length} | rejetés: ${judged.length - accepted.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
