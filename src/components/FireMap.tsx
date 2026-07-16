"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireCollection, FireFeature } from "@/lib/firms";

const REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  France: { center: [2.5, 46.6], zoom: 5.2 },
  "Europe du Sud": { center: [12, 41], zoom: 4.3 },
  "Amérique du Nord": { center: [-105, 42], zoom: 3.2 },
  "Amérique du Sud": { center: [-60, -12], zoom: 3.2 },
  Afrique: { center: [20, 2], zoom: 3.0 },
  "Asie du Sud-Est": { center: [105, 12], zoom: 3.5 },
  Australie: { center: [134, -26], zoom: 3.5 },
};

const SAT_NAMES: Record<string, string> = {
  N: "Suomi-NPP",
  "1": "NOAA-20",
  "2": "NOAA-21",
};

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Données feux : <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatAge(h: number): string {
  if (h < 1) return `il y a ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `il y a ${Math.round(h)} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; count: number; fetchedAt: string }
  | { kind: "error"; code: string };

export default function FireMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [days, setDays] = useState(1);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [selected, setSelected] = useState<FireFeature | null>(null);

  const loadFires = useCallback(async (map: maplibregl.Map, nDays: number) => {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`/api/fires?days=${nDays}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "UNKNOWN" }));
        setStatus({ kind: "error", code: body.error ?? `HTTP_${res.status}` });
        return;
      }
      const data: FireCollection = await res.json();
      // L'âge est figé au chargement — précision suffisante pour un rafraîchissement
      // toutes les 10 min côté serveur.
      for (const f of data.features) {
        (f.properties as Record<string, unknown>).ageH = hoursAgo(f.properties.acq);
      }
      const src = map.getSource("fires") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data as unknown as GeoJSON.FeatureCollection);
      setStatus({
        kind: "ready",
        count: data.meta.count,
        fetchedAt: data.meta.fetchedAt,
      });
    } catch {
      setStatus({ kind: "error", code: "NETWORK" });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: REGIONS["Europe du Sud"].center,
      zoom: REGIONS["Europe du Sud"].zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // Filet de sécurité : si le canvas s'est initialisé avant que le layout
    // flex ne soit stabilisé, on force un recalcul de taille.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on("load", () => {
      requestAnimationFrame(() => map.resize());
      map.addSource("fires", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // Halo discret sous chaque détection récente.
      map.addLayer({
        id: "fires-glow",
        type: "circle",
        source: "fires",
        filter: ["<", ["get", "ageH"], 6],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 6, 8, 18],
          "circle-color": "#ff3b00",
          "circle-opacity": 0.18,
          "circle-blur": 1,
        },
      });
      map.addLayer({
        id: "fires",
        type: "circle",
        source: "fires",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["interpolate", ["linear"], ["get", "frp"], 0, 1.6, 100, 4],
            9,
            ["interpolate", ["linear"], ["get", "frp"], 0, 5, 100, 12],
          ],
          "circle-color": [
            "step",
            ["get", "ageH"],
            "#ff2d00", // < 3 h : rouge vif
            3,
            "#ff7a00", // 3-12 h : orange
            12,
            "#ffc400", // 12-24 h : jaune
            24,
            "#8a6d3b", // > 24 h : brun atténué
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(255,255,255,0.25)",
        },
      });
      map.on("click", "fires", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelected({
          type: "Feature",
          geometry: f.geometry as FireFeature["geometry"],
          properties: f.properties as unknown as FireFeature["properties"],
        });
      });
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["fires"] });
        if (hits.length === 0) setSelected(null);
      });
      map.on("mouseenter", "fires", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "fires", () => (map.getCanvas().style.cursor = ""));
      loadFires(map, 1);
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [loadFires]);

  const changeDays = (n: number) => {
    setDays(n);
    if (mapRef.current) loadFires(mapRef.current, n);
  };

  const jumpTo = (name: string) => {
    const r = REGIONS[name];
    if (r && mapRef.current) mapRef.current.flyTo({ center: r.center, zoom: r.zoom });
  };

  const p = selected?.properties;
  const coords = selected?.geometry.coordinates;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Barre de contrôle */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 rounded-xl bg-zinc-900/90 p-3 text-sm text-zinc-100 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Période</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => changeDays(n)}
              className={`rounded-md px-2 py-1 ${
                days === n ? "bg-orange-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {n * 24} h
            </button>
          ))}
        </div>
        <select
          onChange={(e) => jumpTo(e.target.value)}
          defaultValue="Europe du Sud"
          className="rounded-md bg-zinc-800 px-2 py-1"
          aria-label="Aller à une région"
        >
          {Object.keys(REGIONS).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <div className="flex flex-col gap-1 border-t border-zinc-700 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff2d00]" /> moins de 3 h
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff7a00]" /> 3 – 12 h
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ffc400]" /> 12 – 24 h
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8a6d3b]" /> plus de 24 h
          </div>
        </div>
        <div className="border-t border-zinc-700 pt-2 text-xs text-zinc-400">
          {status.kind === "loading" && "Chargement des détections…"}
          {status.kind === "ready" && (
            <>
              <span className="font-semibold text-zinc-200">
                {status.count.toLocaleString("fr-FR")}
              </span>{" "}
              détections VIIRS
            </>
          )}
          {status.kind === "error" && (
            <span className="text-red-400">
              {status.code === "FIRMS_MAP_KEY_MISSING" || status.code === "FIRMS_MAP_KEY_INVALID"
                ? "Clé NASA FIRMS manquante ou invalide (variable FIRMS_MAP_KEY)."
                : "Données FIRMS momentanément indisponibles."}
            </span>
          )}
        </div>
      </div>

      {/* Panneau de détail */}
      {p && coords && (
        <div className="absolute bottom-8 left-3 w-72 rounded-xl bg-zinc-900/95 p-4 text-sm text-zinc-100 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-start justify-between">
            <h2 className="font-semibold text-orange-400">Détection thermique</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Détecté</dt>
              <dd>{formatAge(hoursAgo(p.acq))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Heure (UTC)</dt>
              <dd>{new Date(p.acq).toISOString().slice(0, 16).replace("T", " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Puissance (FRP)</dt>
              <dd>{Number(p.frp).toFixed(1)} MW</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Confiance</dt>
              <dd>{p.conf === "h" ? "Haute" : p.conf === "l" ? "Faible" : "Nominale"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Satellite</dt>
              <dd>{SAT_NAMES[p.sat] ?? p.sat} (VIIRS)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Passage</dt>
              <dd>{p.dn === "N" ? "Nuit" : "Jour"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Position</dt>
              <dd>
                {coords[1].toFixed(3)}, {coords[0].toFixed(3)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-500">
            Une détection = un pixel thermique de 375 m, pas nécessairement un feu de forêt
            (torchères, brûlages agricoles…).
          </p>
        </div>
      )}
    </div>
  );
}
