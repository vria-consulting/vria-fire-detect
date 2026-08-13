// GOES ABI L2 FDCF (Fire Detection and Characterization, Full Disk) lu en
// DIRECT depuis les buckets AWS publics (noaa-goes19/18, gratuits, anonymes) :
// un fichier toutes les 10 minutes, disponible ~10 min après le début du
// scan — contre ~40 min via FIRMS (mesuré le 13/08/2026). On ne fusionne que
// les détections PLUS FRAÎCHES que le dernier point GOES publié par FIRMS
// (filtre en aval dans eventscache) : le reste ferait double emploi.
//
// Parsing NetCDF4/HDF5 via h5wasm (déclaré dans serverExternalPackages).
// Piège appris : les attributs scalaires HDF5 arrivent en TypedArray(1) — à
// déballer avant tout calcul, sinon NaN silencieux sur toute la géolocalisation.

import type { FireFeature, FireProperties } from "./firms";

const BUCKETS = [
  { bucket: "noaa-goes19", sat: "G19" }, // GOES-East (75° O)
  { bucket: "noaa-goes18", sat: "G18" }, // GOES-West (137° O)
];

// Codes du Mask retenus : 10-14 (feu traité/saturé/contaminé nuage/haute et
// moyenne probabilité) + 30-34 (mêmes catégories, filtrées temporellement).
// 15/35 (basse probabilité) écartés — même philosophie que le seuil de
// confiance appliqué au flux FIRMS.
const CODES = new Set([10, 11, 12, 13, 14, 30, 31, 32, 33, 34]);
const GRID = 5424;
const LIST_TIMEOUT_MS = 5000;
const FILE_TIMEOUT_MS = 12000;

// Détections par fichier S3 (clé immuable) : un scan de cron ne re-parse que
// le fichier nouveau de chaque satellite.
const fileCache = new Map<string, FireFeature[]>();
const FILE_CACHE_MAX = 24;

/* eslint-disable @typescript-eslint/no-explicit-any */
let h5mod: any | null = null;
async function h5(): Promise<any> {
  if (!h5mod) {
    h5mod = await import("h5wasm/node");
    await h5mod.ready;
  }
  return h5mod;
}

const num = (v: unknown): number =>
  typeof v === "number" ? v : v && (v as ArrayLike<number>).length ? (v as ArrayLike<number>)[0] : Number(v);

function confOf(code: number): FireProperties["conf"] {
  const c = code % 20; // 10-14 et 30-34 partagent la même échelle
  if (c === 10 || c === 11) return "h";
  if (c === 12 || c === 13) return "n";
  return "l";
}

// Horodatage de fin de scan depuis le nom de fichier (…_eYYYYDDDHHMMSST_…).
function endScanIso(key: string): string | null {
  const m = key.match(/_e(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})\d_/);
  if (!m) return null;
  const [, y, doy, hh, mm, ss] = m;
  const t = Date.UTC(Number(y), 0, 1) + (Number(doy) - 1) * 86400_000;
  const d = new Date(t);
  return `${d.toISOString().slice(0, 10)}T${hh}:${mm}:${ss}Z`;
}

async function listLatestKeys(bucket: string, want = 2): Promise<string[]> {
  const keys: string[] = [];
  const now = Date.now();
  for (const at of [now, now - 3600_000]) {
    const d = new Date(at);
    const yyyy = d.getUTCFullYear();
    const doy = String(Math.floor((at - Date.UTC(yyyy, 0, 1)) / 86400_000) + 1).padStart(3, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const url = `https://${bucket}.s3.amazonaws.com/?list-type=2&prefix=ABI-L2-FDCF/${yyyy}/${doy}/${hh}/`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS), next: { revalidate: 0 } });
      if (!res.ok) continue;
      const xml = await res.text();
      keys.push(...[...xml.matchAll(/<Key>([^<]+\.nc)<\/Key>/g)].map((m) => m[1]));
    } catch {
      /* heure suivante */
    }
    if (keys.length >= want) break;
  }
  keys.sort();
  return keys.slice(-want);
}

async function parseFile(bucket: string, sat: string, key: string): Promise<FireFeature[]> {
  const cached = fileCache.get(key);
  if (cached) return cached;

  const res = await fetch(`https://${bucket}.s3.amazonaws.com/${key}`, {
    signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const buf = new Uint8Array(await res.arrayBuffer());

  const H5 = await h5();
  const fname = `goes-${sat}.nc`;
  H5.FS.writeFile(fname, buf);
  const f = new H5.File(fname, "r");
  try {
    const mask = f.get("Mask").value as Int16Array;
    const xds = f.get("x");
    const yds = f.get("y");
    const xv = xds.value as Int16Array;
    const yv = yds.value as Int16Array;
    const xs = num(xds.attrs.scale_factor.value);
    const xo = num(xds.attrs.add_offset.value);
    const ys = num(yds.attrs.scale_factor.value);
    const yo = num(yds.attrs.add_offset.value);
    const proj = f.get("goes_imager_projection").attrs;
    const lam0 = (num(proj.longitude_of_projection_origin.value) * Math.PI) / 180;
    const Hs = num(proj.perspective_point_height.value) + num(proj.semi_major_axis.value);
    const req = num(proj.semi_major_axis.value);
    const rpol = num(proj.semi_minor_axis.value);
    const acq = endScanIso(key) ?? new Date().toISOString();

    // Indices feu, regroupés par ligne : Power est lu par tranches de ligne
    // (5 424 floats) au lieu du plan complet (117 Mo) — la lambda respire.
    const byRow = new Map<number, number[]>();
    for (let i = 0; i < mask.length; i++) {
      if (!CODES.has(mask[i])) continue;
      const row = Math.floor(i / GRID);
      const cols = byRow.get(row);
      if (cols) cols.push(i % GRID);
      else byRow.set(row, [i % GRID]);
    }

    const powerDs = f.get("Power");
    const features: FireFeature[] = [];
    for (const [row, cols] of byRow) {
      const line = powerDs.slice([[row, row + 1], []]) as Float32Array;
      for (const col of cols) {
        const x = xv[col] * xs + xo;
        const y = yv[row] * ys + yo;
        const sinx = Math.sin(x);
        const cosx = Math.cos(x);
        const siny = Math.sin(y);
        const cosy = Math.cos(y);
        const a = sinx * sinx + cosx * cosx * (cosy * cosy + ((req * req) / (rpol * rpol)) * siny * siny);
        const b = -2 * Hs * cosx * cosy;
        const c = Hs * Hs - req * req;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const rs = (-b - Math.sqrt(disc)) / (2 * a);
        const sx = rs * cosx * cosy;
        const sy = -rs * sinx;
        const sz = rs * cosx * siny;
        const lat = (Math.atan(((req * req) / (rpol * rpol)) * (sz / Math.sqrt((Hs - sx) * (Hs - sx) + sy * sy))) * 180) / Math.PI;
        const lon = ((lam0 - Math.atan(sy / (Hs - sx))) * 180) / Math.PI;
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const code = mask[row * GRID + col];
        const frp = line[col];
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] },
          properties: {
            frp: isFinite(frp) && frp > 0 ? Math.round(frp * 10) / 10 : 0,
            conf: confOf(code),
            sat,
            acq,
            dn: "D",
            src: "goes",
          },
        });
      }
    }

    fileCache.set(key, features);
    if (fileCache.size > FILE_CACHE_MAX) {
      const first = fileCache.keys().next().value;
      if (first) fileCache.delete(first);
    }
    return features;
  } finally {
    try {
      f.close();
      H5.FS.unlink(fname);
    } catch {
      /* nettoyage best-effort */
    }
  }
}

// Détections GOES fraîches (2 derniers fichiers par satellite, ~20 min).
// Toute erreur = liste vide : FIRMS reste la colonne vertébrale.
export async function fetchGoesDirectFires(): Promise<FireFeature[]> {
  try {
    const perSat = await Promise.all(
      BUCKETS.map(async ({ bucket, sat }) => {
        try {
          const keys = await listLatestKeys(bucket);
          const out: FireFeature[] = [];
          // Séquentiel par satellite : au plus 2 masques (~60 Mo) en vol.
          for (const key of keys) {
            try {
              out.push(...(await parseFile(bucket, sat, key)));
            } catch (e) {
              console.error(`goes-direct ${sat} ${key.slice(-40)}:`, e instanceof Error ? e.message : e);
            }
          }
          return out;
        } catch {
          return [];
        }
      })
    );
    return perSat.flat();
  } catch {
    return [];
  }
}
