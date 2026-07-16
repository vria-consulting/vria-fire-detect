"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEvent, Confidence } from "@/lib/cluster";
import type { SocialResult, SocialPost } from "@/lib/social";
import type { SocialSignal } from "@/lib/socialscan";

const REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  France: { center: [2.5, 46.6], zoom: 5.2 },
  "Europe du Sud": { center: [12, 41], zoom: 4.3 },
  "Amérique du Nord": { center: [-105, 42], zoom: 3.2 },
  "Amérique du Sud": { center: [-60, -12], zoom: 3.2 },
  Afrique: { center: [20, 2], zoom: 3.0 },
  "Asie du Sud-Est": { center: [105, 12], zoom: 3.5 },
  Australie: { center: [134, -26], zoom: 3.5 },
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
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Feux : <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a> | Lieux : <a href="https://www.geonames.org/">GeoNames</a>',
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

const NEW_EVENT_HOURS = 12; // un foyer est "nouveau" si son 1er signal a < 12 h

// Clé publique VAPID (non sensible) — la clé privée reste côté serveur.
const VAPID_PUBLIC_KEY =
  "BDkzUjBlN8TEIWHqe9Fo5UrCHbxzFp8MYPH3q2bqqLyZ5rob33ci-B4dFr2GLAGw_aO9zhT2prXSb7w7LD8rnjk";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const CONF_LABEL: Record<Confidence, { text: string; cls: string }> = {
  possible: { text: "possible", cls: "bg-zinc-700 text-zinc-300" },
  probable: { text: "probable", cls: "bg-amber-700 text-amber-100" },
  corrobore: { text: "corroboré", cls: "bg-emerald-700 text-emerald-100" },
};

type Status =
  | { kind: "loading" }
  | { kind: "ready"; events: number; detections: number; signals: number }
  | { kind: "error"; code: string };

type SocialState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: SocialResult }
  | { kind: "error" };

function PostList({ posts }: { posts: SocialPost[] }) {
  return (
    <ul className="space-y-2">
      {posts.map((post) => (
        <li key={post.url} className="rounded-md bg-zinc-800/80 p-2 text-xs">
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-400 hover:underline"
          >
            @{post.handle}
          </a>{" "}
          <span className="text-zinc-500">· {formatAge(hoursAgo(post.createdAt))}</span>
          <p className="mt-1 whitespace-pre-wrap text-zinc-300">{post.text}</p>
        </li>
      ))}
    </ul>
  );
}

export default function FireMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const eventsRef = useRef<FireEvent[]>([]);
  const signalsRef = useRef<SocialSignal[]>([]);
  const [days, setDays] = useState(1);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [selected, setSelected] = useState<FireEvent | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<SocialSignal | null>(null);
  const [social, setSocial] = useState<SocialState>({ kind: "idle" });
  const [listOpen, setListOpen] = useState(true);
  const [alertState, setAlertState] = useState<"off" | "busy" | "on">("off");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem("vigifire-alert-endpoint")) setAlertState("on");
  }, []);

  const loadData = useCallback(async (map: maplibregl.Map, nDays: number) => {
    setStatus({ kind: "loading" });
    try {
      const [evRes, sigRes] = await Promise.all([
        fetch(`/api/events?days=${nDays}`),
        fetch(`/api/signals`).catch(() => null),
      ]);
      if (!evRes.ok) {
        const body = await evRes.json().catch(() => ({ error: "UNKNOWN" }));
        setStatus({ kind: "error", code: body.error ?? `HTTP_${evRes.status}` });
        return;
      }
      const data: { events: FireEvent[]; meta: { totalDetections: number } } =
        await evRes.json();
      eventsRef.current = data.events;
      setEvents(data.events);

      // Lien profond depuis une notification : ?ev=<id> sélectionne le foyer.
      if (pendingSelectRef.current) {
        const ev = data.events.find((x) => x.id === pendingSelectRef.current);
        pendingSelectRef.current = null;
        if (ev) setSelected(ev);
      }

      let signals: SocialSignal[] = [];
      if (sigRes?.ok) {
        const sigData: { signals: SocialSignal[] } = await sigRes.json();
        signals = sigData.signals;
      }
      signalsRef.current = signals;

      const evSrc = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
      if (evSrc)
        evSrc.setData({
          type: "FeatureCollection",
          features: data.events.map((ev) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: ev.centroid },
            properties: {
              id: ev.id,
              count: ev.count,
              lastAgeH: hoursAgo(ev.lastSeen),
              isNew: hoursAgo(ev.firstSeen) < NEW_EVENT_HOURS ? 1 : 0,
              corroborated: ev.confidence === "corrobore" ? 1 : 0,
            },
          })),
        });
      const sigSrc = map.getSource("signals") as maplibregl.GeoJSONSource | undefined;
      if (sigSrc)
        sigSrc.setData({
          type: "FeatureCollection",
          features: signals.map((s, i) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
            properties: { idx: i, postCount: s.postCount },
          })),
        });

      setStatus({
        kind: "ready",
        events: data.events.length,
        detections: data.meta.totalDetections,
        signals: signals.length,
      });
    } catch {
      setStatus({ kind: "error", code: "NETWORK" });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Lien profond : /?lat=..&lon=..&z=..&ev=<id> (notifications d'alerte)
    const params = new URLSearchParams(window.location.search);
    const pLat = parseFloat(params.get("lat") ?? "");
    const pLon = parseFloat(params.get("lon") ?? "");
    const pZ = parseFloat(params.get("z") ?? "");
    const hasDeepLink = isFinite(pLat) && isFinite(pLon);
    pendingSelectRef.current = params.get("ev");
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: hasDeepLink ? [pLon, pLat] : REGIONS["Europe du Sud"].center,
      zoom: hasDeepLink ? (isFinite(pZ) ? pZ : 9) : REGIONS["Europe du Sud"].zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on("load", () => {
      requestAnimationFrame(() => map.resize());
      map.addSource("events", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("signals", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "events-glow",
        type: "circle",
        source: "events",
        filter: ["<", ["get", "lastAgeH"], 6],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 10, 8, 26],
          "circle-color": "#ff3b00",
          "circle-opacity": 0.15,
          "circle-blur": 1,
        },
      });
      map.addLayer({
        id: "events",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]],
              0, 2, 3, 4.5, 7, 8.5],
            9,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]],
              0, 5, 3, 10, 7, 19],
          ],
          "circle-color": [
            "step",
            ["get", "lastAgeH"],
            "#ff2d00",
            3, "#ff7a00",
            12, "#ffc400",
            24, "#8a6d3b",
          ],
          "circle-opacity": 0.85,
          // Liseré : blanc = nouveau (< 12 h), vert = corroboré par témoignages
          "circle-stroke-width": [
            "case",
            ["==", ["get", "corroborated"], 1], 2,
            ["==", ["get", "isNew"], 1], 1.8,
            0.4,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "corroborated"], 1], "#34d399",
            ["==", ["get", "isNew"], 1], "#ffffff",
            "rgba(255,255,255,0.25)",
          ],
        },
      });
      // Signalements citoyens (veille Bluesky) — losanges bleus
      map.addLayer({
        id: "signals",
        type: "circle",
        source: "signals",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 9, 9],
          "circle-color": "#0ea5e9",
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#e0f2fe",
        },
      });

      map.on("click", "events", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const ev = eventsRef.current.find((x) => x.id === f.properties.id);
        if (ev) {
          setSelected(ev);
          setSelectedSignal(null);
          setSocial({ kind: "idle" });
        }
      });
      map.on("click", "signals", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const sig = signalsRef.current[f.properties.idx];
        if (sig) {
          setSelectedSignal(sig);
          setSelected(null);
        }
      });
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["events", "signals"] });
        if (hits.length === 0) {
          setSelected(null);
          setSelectedSignal(null);
        }
      });
      for (const layer of ["events", "signals"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      loadData(map, 1);
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [loadData]);

  const changeDays = (n: number) => {
    setDays(n);
    if (mapRef.current) loadData(mapRef.current, n);
  };

  const jumpTo = (name: string) => {
    const r = REGIONS[name];
    if (r && mapRef.current) mapRef.current.flyTo({ center: r.center, zoom: r.zoom });
  };

  const selectEvent = (ev: FireEvent) => {
    setSelected(ev);
    setSelectedSignal(null);
    setSocial({ kind: "idle" });
    mapRef.current?.flyTo({ center: ev.centroid, zoom: 8.5 });
  };

  const searchWitnesses = async (ev: FireEvent) => {
    setSocial({ kind: "loading" });
    try {
      const res = await fetch(`/api/social?lat=${ev.centroid[1]}&lon=${ev.centroid[0]}`);
      if (!res.ok) {
        setSocial({ kind: "error" });
        return;
      }
      setSocial({ kind: "done", result: await res.json() });
    } catch {
      setSocial({ kind: "error" });
    }
  };

  const toggleAlerts = async () => {
    setAlertMsg(null);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setAlertMsg("Notifications non supportées par ce navigateur.");
      return;
    }
    setAlertState("busy");
    try {
      if (localStorage.getItem("vigifire-alert-endpoint")) {
        // Désabonnement
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        const endpoint =
          sub?.endpoint ?? localStorage.getItem("vigifire-alert-endpoint");
        if (endpoint) {
          await fetch("/api/subscribe", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }
        await sub?.unsubscribe();
        localStorage.removeItem("vigifire-alert-endpoint");
        setAlertState("off");
        setAlertMsg("Alertes désactivées.");
        return;
      }
      // Abonnement sur la vue courante
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setAlertState("off");
        setAlertMsg("Autorisez les notifications pour activer les alertes.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const b = mapRef.current!.getBounds();
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      localStorage.setItem("vigifire-alert-endpoint", sub.endpoint);
      setAlertState("on");
      setAlertMsg("Alertes actives : nouveaux foyers probables dans cette vue (vérification toutes les 5 min).");
    } catch (e) {
      console.error(e);
      setAlertState(localStorage.getItem("vigifire-alert-endpoint") ? "on" : "off");
      setAlertMsg("Échec de l'activation — réessayez.");
    }
  };

  const newEvents = events.filter((ev) => hoursAgo(ev.firstSeen) < 24).slice(0, 40);

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
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ff2d00]" />
            nouveau foyer (&lt; 12 h)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-emerald-400 bg-[#ff2d00]" />
            corroboré par témoignages
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff2d00]" /> actif &lt; 3 h
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
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-sky-200 bg-sky-500" />
            signalement citoyen (Bluesky)
          </div>
        </div>
        <div className="border-t border-zinc-700 pt-2">
          <button
            onClick={toggleAlerts}
            disabled={alertState === "busy"}
            className={`w-full rounded-md px-2 py-1.5 text-xs font-medium ${
              alertState === "on"
                ? "bg-emerald-800 text-emerald-100 hover:bg-emerald-700"
                : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            {alertState === "on"
              ? "🔔 Alertes actives — désactiver"
              : alertState === "busy"
                ? "…"
                : "🔔 M'alerter sur cette vue"}
          </button>
          {alertMsg && <p className="mt-1 text-[11px] text-zinc-400">{alertMsg}</p>}
        </div>
        <div className="border-t border-zinc-700 pt-2 text-xs text-zinc-400">
          {status.kind === "loading" && "Analyse des détections…"}
          {status.kind === "ready" && (
            <>
              <span className="font-semibold text-zinc-200">
                {status.events.toLocaleString("fr-FR")}
              </span>{" "}
              foyers ·{" "}
              <span className="font-semibold text-zinc-200">
                {status.detections.toLocaleString("fr-FR")}
              </span>{" "}
              détections ·{" "}
              <span className="font-semibold text-sky-300">{status.signals}</span>{" "}
              signalements
            </>
          )}
          {status.kind === "error" && (
            <span className="text-red-400">
              {status.code.startsWith("FIRMS_MAP_KEY")
                ? "Clé NASA FIRMS manquante ou invalide (variable FIRMS_MAP_KEY)."
                : "Données FIRMS momentanément indisponibles."}
            </span>
          )}
        </div>
      </div>

      {/* Liste des nouveaux foyers */}
      <div className="absolute right-3 top-3 flex max-h-[70%] w-72 flex-col rounded-xl bg-zinc-900/90 text-sm text-zinc-100 shadow-lg backdrop-blur">
        <button
          onClick={() => setListOpen(!listOpen)}
          className="flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="font-semibold">
            🔥 Nouveaux foyers <span className="text-zinc-400">({newEvents.length})</span>
          </span>
          <span className="text-zinc-500">{listOpen ? "▾" : "▸"}</span>
        </button>
        {listOpen && (
          <div className="overflow-y-auto border-t border-zinc-800">
            {newEvents.length === 0 && status.kind === "ready" && (
              <p className="p-3 text-xs text-zinc-500">
                Aucun foyer apparu dans les dernières 24 h sur la période chargée.
              </p>
            )}
            {newEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => selectEvent(ev)}
                className={`block w-full border-b border-zinc-800/60 px-3 py-2 text-left hover:bg-zinc-800 ${
                  selected?.id === ev.id ? "bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-orange-400">
                    1er signal {formatAge(hoursAgo(ev.firstSeen))}
                  </span>
                  <span className="flex gap-1">
                    {ev.confidence && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CONF_LABEL[ev.confidence].cls}`}
                      >
                        {CONF_LABEL[ev.confidence].text}
                      </span>
                    )}
                    {hoursAgo(ev.firstSeen) < NEW_EVENT_HOURS && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">
                        NOUVEAU
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  {ev.social?.place ? `${ev.social.place} · ` : ""}
                  {ev.centroid[1].toFixed(2)}, {ev.centroid[0].toFixed(2)} · {ev.count}{" "}
                  détection{ev.count > 1 ? "s" : ""} · {ev.maxFrp} MW max
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panneau signalement citoyen */}
      {selectedSignal && (
        <div className="absolute bottom-8 left-3 max-h-[60%] w-80 overflow-y-auto rounded-xl bg-zinc-900/95 p-4 text-sm text-zinc-100 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-start justify-between">
            <h2 className="font-semibold text-sky-400">
              Signalement citoyen — {selectedSignal.place}
            </h2>
            <button
              onClick={() => setSelectedSignal(null)}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <p className="mb-2 text-xs text-zinc-400">
            {selectedSignal.postCount} post{selectedSignal.postCount > 1 ? "s" : ""} Bluesky
            (12 h) mentionnant un feu près de {selectedSignal.place} — dernier{" "}
            {formatAge(hoursAgo(selectedSignal.lastPost))}. Position = centre de la
            commune citée, pas du feu.
          </p>
          <PostList posts={selectedSignal.posts} />
          <p className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-500">
            Témoignage non confirmé par satellite : soit le feu est trop petit ou trop
            récent pour être vu (précocité !), soit il ne s&apos;agit pas d&apos;un feu de
            forêt.
          </p>
        </div>
      )}

      {/* Panneau de détail du foyer */}
      {selected && (
        <div className="absolute bottom-8 left-3 max-h-[60%] w-80 overflow-y-auto rounded-xl bg-zinc-900/95 p-4 text-sm text-zinc-100 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-start justify-between">
            <h2 className="font-semibold text-orange-400">
              Foyer — 1er signal {formatAge(hoursAgo(selected.firstSeen))}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          {selected.confidence && (
            <span
              className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-bold ${CONF_LABEL[selected.confidence].cls}`}
            >
              {CONF_LABEL[selected.confidence].text}
            </span>
          )}
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Premier signal (UTC)</dt>
              <dd>{new Date(selected.firstSeen).toISOString().slice(0, 16).replace("T", " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Dernier signal</dt>
              <dd>{formatAge(hoursAgo(selected.lastSeen))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Détections</dt>
              <dd>
                {selected.count} ({selected.viirsCount} VIIRS
                {selected.goesCount > 0 ? ` + ${selected.goesCount} GOES` : ""})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Puissance max</dt>
              <dd>{selected.maxFrp} MW</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Position</dt>
              <dd>
                {selected.centroid[1].toFixed(3)}, {selected.centroid[0].toFixed(3)}
              </dd>
            </div>
          </dl>

          {/* Témoignages attachés automatiquement (corroboration) */}
          {selected.social && (
            <div className="mt-3 border-t border-zinc-700 pt-3">
              <p className="mb-2 text-xs font-medium text-emerald-400">
                Corroboré par {selected.social.postCount} témoignage
                {selected.social.postCount > 1 ? "s" : ""} près de {selected.social.place}
              </p>
              <PostList posts={selected.social.posts} />
            </div>
          )}

          {/* Recherche manuelle complémentaire */}
          <div className="mt-3 border-t border-zinc-700 pt-3">
            {social.kind === "idle" && (
              <button
                onClick={() => searchWitnesses(selected)}
                className="w-full rounded-md bg-sky-700 px-3 py-1.5 font-medium hover:bg-sky-600"
              >
                🔎 Chercher {selected.social ? "plus de " : "des "}témoignages
              </button>
            )}
            {social.kind === "loading" && (
              <p className="text-xs text-zinc-400">Recherche de témoignages en cours…</p>
            )}
            {social.kind === "error" && (
              <p className="text-xs text-red-400">Recherche indisponible pour le moment.</p>
            )}
            {social.kind === "done" && (
              <div>
                <p className="mb-2 text-xs text-zinc-400">
                  {social.result.place ? (
                    <>
                      Zone : <span className="text-zinc-200">{social.result.place}</span> —{" "}
                    </>
                  ) : null}
                  {social.result.posts.length} témoignage
                  {social.result.posts.length !== 1 ? "s" : ""} trouvé
                  {social.result.posts.length !== 1 ? "s" : ""} (48 h)
                </p>
                {social.result.posts.length === 0 &&
                  (social.result.searchStatuses?.every((s) => s >= 400 || s === 0) ? (
                    <p className="text-xs text-amber-400">
                      La recherche Bluesky est momentanément inaccessible depuis nos
                      serveurs — réessayez plus tard.
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Aucune mention sur Bluesky pour cette zone. Ça ne veut pas dire
                      qu&apos;il n&apos;y a pas de feu — juste pas de témoin connecté.
                    </p>
                  ))}
                <PostList posts={social.result.posts} />
              </div>
            )}
          </div>

          <p className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-500">
            Le « 1er signal » est l&apos;heure du premier passage satellite ayant vu ce foyer —
            l&apos;ignition réelle peut être antérieure.
          </p>
        </div>
      )}
    </div>
  );
}
