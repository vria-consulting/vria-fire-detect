"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { StrategicPoint } from "@/lib/strategic";
import type { OfficialPerimeter } from "@/lib/perimeters";

type Context = { strategic: StrategicPoint[]; perimeter: OfficialPerimeter | null; fetchedAt: string };
export function FireContext({ slug }: { slug: string }) {
  const [data, setData] = useState<Context | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/fire-context?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null).then(setData).catch(() => {});
    return () => controller.abort();
  }, [slug]);
  if (!data || (!data.perimeter && !data.strategic.length)) return null;
  const p = data.perimeter;
  return <section className="mb-7 space-y-3" aria-label="Informations complémentaires">
    {p && <div className="rounded-[18px] bg-white p-4">
      <h2 className="font-semibold">{p.source === "EFFIS" ? "Surface brûlée cartographiée" : p.source === "CWFIS" ? "Périmètre estimé" : "Périmètre officiel"} ({p.source})</h2>
      <p>{p.hectares.toLocaleString("fr-FR")} ha{p.name ? ` · ${p.name}` : ""}{p.containedPct !== null ? ` · contenu à ${p.containedPct} %` : ""}</p>
    </div>}
    {data.strategic.length > 0 && <>
      <h2 className="text-lg font-semibold">Points stratégiques à proximité</h2>
      {data.strategic.map((point, i) => <Link key={`${point.kind}-${i}`} className="flex justify-between rounded-xl bg-white p-3" href={`/fr?lat=${point.lat.toFixed(4)}&lon=${point.lon.toFixed(4)}&z=13`}>
        <span>{point.label}{point.name ? ` · ${point.name}` : ""}</span><span>{point.dist} km {point.bearing}</span>
      </Link>)}
      <p className="text-xs">Données OpenStreetMap (ODbL), indicatives et non vérifiées sur le terrain. Elles ne remplacent pas les référentiels opérationnels des services de secours.</p>
    </>}
  </section>;
}
