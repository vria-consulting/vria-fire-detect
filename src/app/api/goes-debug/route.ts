import { NextRequest, NextResponse } from "next/server";
import { fetchGoesDirectFires } from "@/lib/goesdirect";

export const runtime = "nodejs";
export const maxDuration = 60;

// Diagnostic TEMPORAIRE du pipeline GOES direct (les logs applicatifs ne
// remontent pas par la CLI Vercel) : à retirer une fois la latence confirmée.
// ?k=kdiag26 — étapes verbeuses : listing par bucket, téléchargement du
// fichier le plus récent, parsing h5wasm avec comptage des pixels feu.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== "kdiag26") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const out: Record<string, unknown> = {};

  // 1. Listing reproduisant listLatestKeys (2 heures, regex .nc).
  const keysByBucket: Record<string, string[]> = {};
  for (const bucket of ["noaa-goes19", "noaa-goes18"]) {
    const found: string[] = [];
    const now = Date.now();
    const steps: string[] = [];
    for (const at of [now, now - 3600_000]) {
      const d = new Date(at);
      const yyyy = d.getUTCFullYear();
      const doy = String(Math.floor((at - Date.UTC(yyyy, 0, 1)) / 86400_000) + 1).padStart(3, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const url = `https://${bucket}.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-FDCF/${yyyy}/${doy}/${hh}/`;
      try {
        const t0 = Date.now();
        const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 0 } });
        const xml = await res.text();
        const nc = [...xml.matchAll(/<Key>([^<]+\.nc)<\/Key>/g)].map((m) => m[1]);
        steps.push(`${hh}h: HTTP ${res.status}, ${(xml.match(/<Key>/g) ?? []).length} clés, ${nc.length} .nc, ${Date.now() - t0} ms`);
        found.push(...nc);
      } catch (e) {
        steps.push(`${hh}h: ERREUR ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
      }
      if (found.length >= 2) break;
    }
    found.sort();
    keysByBucket[bucket] = found.slice(-2);
    out[`list_${bucket}`] = steps;
    out[`keys_${bucket}`] = found.slice(-2).map((k) => k.slice(-45));
  }

  // 2. Téléchargement + parsing du fichier le plus récent de GOES-19.
  const key = keysByBucket["noaa-goes19"]?.at(-1);
  if (key) {
    try {
      const t0 = Date.now();
      const res = await fetch(`https://noaa-goes19.s3.amazonaws.com/${key}`, {
        signal: AbortSignal.timeout(20000),
        next: { revalidate: 0 },
      });
      out.dlStatus = res.status;
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        out.dlBytes = buf.length;
        out.dlMs = Date.now() - t0;
        try {
          const t1 = Date.now();
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const H5: any = await import("h5wasm/node");
          await H5.ready;
          H5.FS.writeFile("/tmp/diag.nc", buf);
          const f = new H5.File("/tmp/diag.nc", "r");
          try {
            const mask = f.get("Mask").value as Int16Array;
            out.maskLen = mask.length;
            const CODES = new Set([10, 11, 12, 13, 14, 30, 31, 32, 33, 34]);
            let fire = 0;
            const histo = new Map<number, number>();
            for (let i = 0; i < mask.length; i++) {
              if (CODES.has(mask[i])) fire++;
              if (mask[i] >= 10 && mask[i] <= 35) histo.set(mask[i], (histo.get(mask[i]) ?? 0) + 1);
            }
            out.firePixels = fire;
            out.maskHisto = Object.fromEntries([...histo.entries()].sort((a, b) => a[0] - b[0]));
            out.parseMs = Date.now() - t1;
          } finally {
            try {
              f.close();
              H5.FS.unlink("/tmp/diag.nc");
            } catch {
              /* best-effort */
            }
          }
        } catch (e) {
          out.parse = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
        }
      } else {
        out.dlBody = (await res.text()).slice(0, 200);
      }
    } catch (e) {
      out.dl = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
    }
  } else {
    out.dl = "aucune clé .nc listée pour goes19";
  }

  // 3. Pipeline complet réel.
  try {
    const t0 = Date.now();
    const dets = await fetchGoesDirectFires();
    out.pipelineCount = dets.length;
    out.pipelineMs = Date.now() - t0;
    out.sample = dets.slice(0, 2).map((d) => ({
      c: d.geometry.coordinates,
      frp: d.properties.frp,
      acq: d.properties.acq,
      sat: d.properties.sat,
    }));
  } catch (e) {
    out.pipeline = `ERREUR: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
  }
  return NextResponse.json(out);
}
