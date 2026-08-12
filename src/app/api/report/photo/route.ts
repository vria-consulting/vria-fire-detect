import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

// Vérification photo par IA d'un signalement témoin : le témoin joint une
// photo (downscalée côté client), un modèle vision juge « vrai feu/fumée en
// extérieur, pas une reproduction d'écran ». Photo conservée et affichée
// UNIQUEMENT si validée — sinon rien n'est stocké (modération par défaut).
//
// Les verdicts vivent dans LEUR PROPRE blob (citizen-photo-verdicts.json),
// fusionné par /api/report au moment de la lecture : le CDN Blob peut servir
// citizen-reports.json avec quelques secondes de retard juste après le POST
// du signalement (appris en test : « UNKNOWN_REPORT »), et deux routes qui
// réécrivent le même fichier s'écraseraient mutuellement. Un verdict orphelin
// est inoffensif : sans report correspondant, il n'est jamais affiché.

const VERDICTS_PATH = "citizen-photo-verdicts.json";
const RETENTION_MS = 12 * 60 * 60 * 1000;
const MAX_VERDICTS = 200;
const MAX_BYTES = 1_500_000; // le client downscale à ~1280 px JPEG
const PER_IP_MS = 2 * 60 * 1000;
const lastByIp = new Map<string, number>();

export type PhotoVerdict = {
  id: string; // id du signalement
  verified: boolean;
  photoUrl?: string;
  at: string; // ISO
};

type Judgement = {
  fire_or_smoke: boolean;
  outdoor: boolean;
  screen_or_reproduction: boolean;
  confidence: number;
};

function prune(verdicts: PhotoVerdict[]): PhotoVerdict[] {
  const cutoff = Date.now() - RETENTION_MS;
  return verdicts.filter((v) => Date.parse(v.at) >= cutoff).slice(-MAX_VERDICTS);
}

async function judgePhoto(dataUrl: string): Promise<Judgement | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.VISION_MODEL ?? "gpt-5.4-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning_effort: "low",
        max_completion_tokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "Tu vérifies la photo d'un témoin signalant un feu de forêt/végétation. Réponds STRICTEMENT au schéma. fire_or_smoke: vraies flammes ou vraie fumée de feu visibles (pas nuages, brouillard, poussière, coucher de soleil). outdoor: scène extérieure réelle. screen_or_reproduction: photo d'un écran, d'une photo imprimée, image de synthèse ou mème évident. confidence: 0 à 1.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Cette photo montre-t-elle un vrai feu ou de la vraie fumée de feu, en extérieur ?" },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "photo_verdict",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                fire_or_smoke: { type: "boolean" },
                outdoor: { type: "boolean" },
                screen_or_reproduction: { type: "boolean" },
                confidence: { type: "number" },
              },
              required: ["fire_or_smoke", "outdoor", "screen_or_reproduction", "confidence"],
            },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = j.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as Judgement) : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const last = lastByIp.get(ip);
  if (last && Date.now() - last < PER_IP_MS) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { id?: string; dataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.slice(0, 40) : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  if (!/^[a-z0-9-]{6,40}$/.test(id) || !dataUrl.startsWith("data:image/jpeg;base64,")) {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }
  const b64 = dataUrl.slice("data:image/jpeg;base64,".length);
  if (b64.length > MAX_BYTES * 1.4) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  }

  const verdicts = prune(await readJson<PhotoVerdict[]>(VERDICTS_PATH, []));
  if (verdicts.some((v) => v.id === id)) {
    return NextResponse.json({ error: "ALREADY_CHECKED" }, { status: 409 });
  }

  lastByIp.set(ip, Date.now());
  const judgement = await judgePhoto(dataUrl);
  if (!judgement) {
    return NextResponse.json({ error: "JUDGE_UNAVAILABLE" }, { status: 503 });
  }
  const verified =
    judgement.fire_or_smoke &&
    judgement.outdoor &&
    !judgement.screen_or_reproduction &&
    judgement.confidence >= 0.5;

  const verdict: PhotoVerdict = { id, verified, at: new Date().toISOString() };
  if (verified) {
    try {
      const { url } = await put(`citizen-photos/${id}.jpg`, Buffer.from(b64, "base64"), {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      verdict.photoUrl = url;
    } catch {
      /* photo non stockée : le badge vérifié reste */
    }
  }
  verdicts.push(verdict);
  await writeJson(VERDICTS_PATH, verdicts);

  return NextResponse.json({ ok: true, verified });
}
