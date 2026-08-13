import { NextRequest, NextResponse } from "next/server";
import { fetchGoesDirectFires } from "@/lib/goesdirect";

export const runtime = "nodejs";
export const maxDuration = 60;

// Diagnostic TEMPORAIRE du pipeline GOES direct (les logs applicatifs ne
// remontent pas par la CLI Vercel) : à retirer une fois la latence confirmée.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== "kdiag26") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const out: Record<string, unknown> = {};
  try {
    const mod = await import("h5wasm/node");
    await (mod as { ready: Promise<unknown> }).ready;
    out.h5wasm = "ok";
  } catch (e) {
    out.h5wasm = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
  }
  // Listing S3 brut : statut + extrait de corps, pour voir ce que la lambda
  // reçoit réellement (les catch du pipeline sont volontairement silencieux).
  try {
    const now = Date.now();
    const d = new Date(now);
    const yyyy = d.getUTCFullYear();
    const doy = String(Math.floor((now - Date.UTC(yyyy, 0, 1)) / 86400_000) + 1).padStart(3, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const url = `https://noaa-goes19.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-FDCF/${yyyy}/${doy}/${hh}/`;
    out.listUrl = url;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 0 } });
    const body = await res.text();
    out.listStatus = res.status;
    out.listKeys = (body.match(/<Key>/g) ?? []).length;
    out.listBody = body.slice(0, 260);
  } catch (e) {
    out.list = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
  }
  try {
    const t0 = Date.now();
    const dets = await fetchGoesDirectFires();
    out.count = dets.length;
    out.ms = Date.now() - t0;
    out.sample = dets.slice(0, 2).map((d) => ({
      c: d.geometry.coordinates,
      frp: d.properties.frp,
      acq: d.properties.acq,
      sat: d.properties.sat,
    }));
  } catch (e) {
    out.fetch = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
  }
  return NextResponse.json(out);
}
