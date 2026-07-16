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
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Feux : <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a> | Lieux : <a href="https://www.geonames.org/">GeoNames</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

function hoursAgo(iso: string): number {
  // Clampé à 0 : certains bots postent avec un horodatage futur (fuseau mal
  // configuré), ce qui faussait le tri et l'affichage.
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

function formatAge(h: number): string {
  if (h < 1) return `il y a ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `il y a ${Math.round(h)} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

const NEW_EVENT_HOURS = 12; // un foyer est "nouveau" si son 1er signal a < 12 h
const DEPART_WATCH_MIN = 120; // mode départs : 1er signalement il y a 2 h max
const DEPART_HOT_MIN = 20; // pulsation rouge : signal de moins de 20 min

// Clé publique VAPID (non sensible) — la clé privée reste côté serveur.
const VAPID_PUBLIC_KEY =
  "BDkzUjBlN8TEIWHqe9Fo5UrCHbxzFp8MYPH3q2bqqLyZ5rob33ci-B4dFr2GLAGw_aO9zhT2prXSb7w7LD8rnjk";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Icône flamme dessinée au canvas, teintée par âge (même code couleur que les
// anciens points), liseré blanc pour rester lisible sur fond clair.
function flameImage(main: string, core: string): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(40, 18, 52, 24, 52, 40);
  ctx.bezierCurveTo(52, 52, 43, 60, 32, 60);
  ctx.bezierCurveTo(21, 60, 12, 52, 12, 40);
  ctx.bezierCurveTo(12, 24, 24, 18, 32, 4);
  ctx.closePath();
  ctx.fillStyle = main;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  // cœur clair de la flamme
  ctx.beginPath();
  ctx.moveTo(32, 30);
  ctx.bezierCurveTo(38, 38, 43, 40, 43, 47);
  ctx.bezierCurveTo(43, 54, 38, 58, 32, 58);
  ctx.bezierCurveTo(26, 58, 21, 54, 21, 47);
  ctx.bezierCurveTo(21, 40, 26, 38, 32, 30);
  ctx.closePath();
  ctx.fillStyle = core;
  ctx.fill();
  return ctx.getImageData(0, 0, 64, 64);
}

const FLAMES: Record<string, [string, string]> = {
  "flame-red": ["#ff2d00", "#ffd166"],
  "flame-orange": ["#ff7a00", "#ffe08a"],
  "flame-yellow": ["#ffc400", "#fff3bf"],
  "flame-brown": ["#8a6d3b", "#d9c9a3"],
  "flame-blue": ["#0ea5e9", "#bae6fd"],
};

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

type Wind = { speed: number; gusts: number; direction: number };

// Direction météo = d'où vient le vent.
function compass(deg: number): string {
  const pts = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return pts[Math.round(deg / 45) % 8];
}

function formatDelta(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h${min % 60 ? ` ${min % 60}` : ""}`;
}

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
            {post.source === "presse"
              ? `📰 ${post.handle}`
              : post.source === "telegram"
                ? `✈️ ${post.handle}`
                : `@${post.handle}`}
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
  const [hours, setHours] = useState(24);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [selected, setSelected] = useState<FireEvent | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<SocialSignal | null>(null);
  const [social, setSocial] = useState<SocialState>({ kind: "idle" });
  const [wind, setWind] = useState<Wind | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [alertState, setAlertState] = useState<"off" | "busy" | "on">("off");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const pendingSelectRef = useRef<string | null>(null);
  // Mode "départs de feu" : ne montrer que les signaux < 1 h, pulsation < 20 min
  const [mode, setMode] = useState<"tout" | "departs">("tout");
  const [signals, setSignals] = useState<SocialSignal[]>([]);
  const pulseMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [, setTick] = useState(0); // re-rendu périodique des "il y a X min"
  // Emprise affichée [ouest, sud, est, nord] : filtre les listes de droite.
  const [viewBounds, setViewBounds] = useState<[number, number, number, number] | null>(
    null
  );

  useEffect(() => {
    if (localStorage.getItem("vigifire-alert-endpoint")) setAlertState("on");
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // Vent au droit du foyer sélectionné (Open-Meteo, gratuit).
  useEffect(() => {
    setWind(null);
    if (!selected) return;
    let stale = false;
    const [lon, lat] = selected.centroid;
    fetch(`/api/wind?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => {
        if (!stale && w && typeof w.speed === "number") setWind(w);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [selected]);

  const loadData = useCallback(async (map: maplibregl.Map, nHours: number, silent = false) => {
    if (!silent) setStatus({ kind: "loading" });
    try {
      const [evRes, sigRes] = await Promise.all([
        fetch(`/api/events?hours=${nHours}`),
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
      setSignals(signals);

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
              firstAgeMin: Math.round(hoursAgo(ev.firstSeen) * 60),
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
            properties: {
              idx: i,
              postCount: s.postCount,
              ageMin: Math.round(hoursAgo(s.lastPost) * 60),
              firstAgeMin: Math.round(hoursAgo(s.firstPost) * 60),
              newFire: s.newFire ? 1 : 0,
            },
          })),
        });

      setStatus({
        kind: "ready",
        events: data.events.length,
        detections: data.meta.totalDetections,
        signals: signals.length,
      });
      setLastUpdate(Date.now());
    } catch {
      if (!silent) setStatus({ kind: "error", code: "NETWORK" });
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

    const syncBounds = () => {
      const b = map.getBounds();
      setViewBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on("moveend", syncBounds);

    map.on("load", () => {
      requestAnimationFrame(() => map.resize());
      syncBounds();
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
      for (const [name, [main, core]] of Object.entries(FLAMES)) {
        map.addImage(name, flameImage(main, core));
      }
      // Foyers : icône flamme teintée par âge, taille selon le nombre de détections
      map.addLayer({
        id: "events-icons",
        type: "symbol",
        source: "events",
        layout: {
          "icon-image": [
            "step",
            ["get", "lastAgeH"],
            "flame-red",
            3, "flame-orange",
            12, "flame-yellow",
            24, "flame-brown",
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]],
              0, 0.18, 3, 0.32, 7, 0.55],
            9,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]],
              0, 0.4, 3, 0.72, 7, 1.25],
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      // Signalements citoyens (veille Bluesky) — flamme bleue
      map.addLayer({
        id: "signals-icons",
        type: "symbol",
        source: "signals",
        layout: {
          "icon-image": "flame-blue",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.26, 9, 0.5],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      map.on("click", "events-icons", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const ev = eventsRef.current.find((x) => x.id === f.properties.id);
        if (ev) {
          setSelected(ev);
          setSelectedSignal(null);
          setSocial({ kind: "idle" });
        }
      });
      map.on("click", "signals-icons", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const sig = signalsRef.current[f.properties.idx];
        if (sig) {
          setSelectedSignal(sig);
          setSelected(null);
        }
      });
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["events-icons", "signals-icons"] });
        if (hits.length === 0) {
          setSelected(null);
          setSelectedSignal(null);
        }
      });
      for (const layer of ["events-icons", "signals-icons"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      loadData(map, 24);
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [loadData]);

  const changeHours = (n: number) => {
    setHours(n);
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

  const selectSignal = (sig: SocialSignal) => {
    setSelectedSignal(sig);
    setSelected(null);
    mapRef.current?.flyTo({ center: [sig.lon, sig.lat], zoom: 9 });
  };

  // Applique le mode aux couches carte + marqueurs pulsants des départs < 20 min
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("events-icons")) return;
    for (const m of pulseMarkersRef.current) m.remove();
    pulseMarkersRef.current = [];

    if (mode === "departs") {
      const freshFilter: maplibregl.FilterSpecification = [
        "<=",
        ["get", "firstAgeMin"],
        DEPART_WATCH_MIN,
      ];
      map.setFilter("events-icons", freshFilter);
      map.setFilter("events-glow", freshFilter);
      // Un signalement n'est un "départ" que si ses PREMIÈRES mentions sont
      // récentes (newFire) — un feu qui dure fait encore parler de lui.
      map.setFilter("signals-icons", [
        "all",
        ["==", ["get", "newFire"], 1],
        ["<=", ["get", "firstAgeMin"], DEPART_WATCH_MIN],
      ]);

      for (const ev of events) {
        if (hoursAgo(ev.firstSeen) * 60 > DEPART_HOT_MIN) continue;
        const el = document.createElement("div");
        el.className = "pulse-marker";
        el.title = "Départ de feu détecté il y a moins de 20 min";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelected(ev);
          setSelectedSignal(null);
          setSocial({ kind: "idle" });
        });
        pulseMarkersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat(ev.centroid).addTo(map)
        );
      }
      for (const sig of signals) {
        if (!sig.newFire || hoursAgo(sig.firstPost) * 60 > DEPART_HOT_MIN) continue;
        const el = document.createElement("div");
        el.className = "pulse-marker pulse-social";
        el.title = "Signalement citoyen de moins de 20 min";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedSignal(sig);
          setSelected(null);
        });
        pulseMarkersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([sig.lon, sig.lat]).addTo(map)
        );
      }
    } else {
      map.setFilter("events-icons", null);
      map.setFilter("events-glow", ["<", ["get", "lastAgeH"], 6]);
      map.setFilter("signals-icons", null);
    }
  }, [mode, events, signals]);

  // Rafraîchissement automatique toutes les 2 min, dans tous les modes,
  // sans clignotement (silent) — les données doivent coller au temps réel.
  useEffect(() => {
    const id = setInterval(() => {
      if (mapRef.current) loadData(mapRef.current, hours, true);
    }, 120_000);
    return () => clearInterval(id);
  }, [hours, loadData]);

  // Les listes de droite suivent la zone affichée à l'écran.
  const inView = (lon: number, lat: number) =>
    !viewBounds ||
    (lon >= viewBounds[0] &&
      lon <= viewBounds[2] &&
      lat >= viewBounds[1] &&
      lat <= viewBounds[3]);

  // Vue globale : foyers satellite ET signalements humains dans la même liste,
  // triés par premier signal / première mention.
  type GlobalItem =
    | { kind: "foyer"; when: string; ev: FireEvent }
    | { kind: "signal"; when: string; sig: SocialSignal };
  const globalItems: GlobalItem[] = [
    ...events
      .filter((ev) => hoursAgo(ev.firstSeen) < 24 && inView(ev.centroid[0], ev.centroid[1]))
      .map((ev) => ({ kind: "foyer" as const, when: ev.firstSeen, ev })),
    ...signals
      .filter((sig) => hoursAgo(sig.firstPost) < 24 && inView(sig.lon, sig.lat))
      .map((sig) => ({ kind: "signal" as const, when: sig.firstPost, sig })),
  ]
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 40);

  // Fil des départs : foyers ET signalements < 1 h, triés du plus frais au moins frais
  type DepartItem =
    | { kind: "sat"; ageMin: number; ev: FireEvent }
    | { kind: "social"; ageMin: number; sig: SocialSignal };
  // Calculé dans tous les modes : le badge du bouton « Départs » et l'alerte
  // doivent vivre même depuis la vue globale.
  const departItems: DepartItem[] = [
    ...events
      .map((ev) => ({ kind: "sat" as const, ageMin: hoursAgo(ev.firstSeen) * 60, ev }))
      .filter((x) => x.ageMin <= DEPART_WATCH_MIN && inView(x.ev.centroid[0], x.ev.centroid[1])),
    ...signals
      .filter((sig) => sig.newFire && inView(sig.lon, sig.lat))
      .map((sig) => ({
        kind: "social" as const,
        ageMin: hoursAgo(sig.firstPost) * 60,
        sig,
      }))
      .filter((x) => x.ageMin <= DEPART_WATCH_MIN),
  ].sort((a, b) => a.ageMin - b.ageMin);
  const hotCount = departItems.filter((x) => x.ageMin <= DEPART_HOT_MIN).length;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Commutateur de mode */}
      <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 rounded-full bg-zinc-900/95 p-1 text-sm shadow-lg backdrop-blur">
        <button
          onClick={() => setMode("tout")}
          className={`rounded-full px-3 py-1.5 font-medium ${
            mode === "tout" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🌍 Vue globale
        </button>
        <button
          onClick={() => setMode("departs")}
          className={`rounded-full px-3 py-1.5 font-medium ${
            mode === "departs" ? "bg-red-600 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          ⚡ Départs de feu
          {mode !== "departs" && hotCount > 0 ? ` (${hotCount})` : ""}
        </button>
      </div>

      {/* Barre de contrôle */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 rounded-xl bg-zinc-900/90 p-3 text-sm text-zinc-100 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Période</span>
          {[6, 12, 24, 48, 72].map((h) => (
            <button
              key={h}
              onClick={() => changeHours(h)}
              className={`rounded-md px-1.5 py-1 text-xs ${
                hours === h ? "bg-orange-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {h} h
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
          {status.kind === "loading" && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-orange-500" />
              Récupération et analyse en cours…
            </span>
          )}
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
          {lastUpdate && (
            <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span>
                Mise à jour{" "}
                {Date.now() - lastUpdate < 15_000
                  ? "à l'instant"
                  : `il y a ${Math.round((Date.now() - lastUpdate) / 1000)} s`}{" "}
                · auto toutes les 2 min
              </span>
              <button
                onClick={() => mapRef.current && loadData(mapRef.current, hours, true)}
                className="rounded px-1.5 py-0.5 hover:bg-zinc-800"
                title="Rafraîchir maintenant"
                aria-label="Rafraîchir maintenant"
              >
                ↻
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fil des départs de feu (< 1 h) */}
      {mode === "departs" && (
        <div className="absolute right-3 top-3 flex max-h-[70%] w-80 flex-col rounded-xl bg-zinc-900/95 text-sm text-zinc-100 shadow-lg backdrop-blur">
          <div className="border-b border-zinc-800 px-3 py-2">
            <span className="font-semibold">⚡ Départs de feu (&lt; 2 h)</span>
            <span className="ml-1 text-[10px] text-zinc-500">· dans la vue affichée</span>
            {hotCount > 0 ? (
              <div className="mt-1 animate-pulse rounded-md bg-red-600 px-2 py-1.5 text-xs font-bold text-white">
                🚨 {hotCount} départ{hotCount > 1 ? "s" : ""} signalé
                {hotCount > 1 ? "s" : ""} il y a moins de 20 min
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Aucun signal &lt; 20 min pour l&apos;instant · rafraîchi toutes les 2 min
              </p>
            )}
          </div>
          <div className="overflow-y-auto">
            {status.kind === "loading" && departItems.length === 0 && (
              <p className="flex items-center gap-2 p-3 text-xs text-zinc-400">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-orange-500" />
                Récupération des satellites et analyse IA des signaux…
              </p>
            )}
            {status.kind !== "loading" && departItems.length === 0 && (
              <p className="p-3 text-xs text-zinc-500">
                Aucun départ (1er signalement &lt; 2 h) dans la vue affichée. Élargissez
                la carte ou changez de région : la couverture la plus rapide vient de
                GOES (Amériques), Meteosat (Europe/Afrique) et des témoignages.
              </p>
            )}
            {departItems.map((item) => {
              const hot = item.ageMin <= DEPART_HOT_MIN;
              const key = item.kind === "sat" ? item.ev.id : `s:${item.sig.place}`;
              return (
                <button
                  key={key}
                  onClick={() =>
                    item.kind === "sat" ? selectEvent(item.ev) : selectSignal(item.sig)
                  }
                  className="block w-full border-b border-zinc-800/60 px-3 py-2 text-left hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-base font-bold ${hot ? "text-red-400" : "text-orange-300"}`}
                    >
                      {item.kind === "sat" ? "🛰️ 1er signal" : "💬 1ère mention"} il y a{" "}
                      {Math.max(1, Math.round(item.ageMin))} min
                    </span>
                    {hot && (
                      <span className="animate-pulse rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">
                        URGENT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {item.kind === "sat" ? (
                      <>
                        Détection satellite
                        {item.ev.social?.place ? ` · ${item.ev.social.place}` : ""} ·{" "}
                        {item.ev.centroid[1].toFixed(2)}, {item.ev.centroid[0].toFixed(2)} ·{" "}
                        {item.ev.maxFrp} MW
                      </>
                    ) : (
                      <>
                        Témoignage Bluesky · {item.sig.place} ({item.sig.countryCode.toUpperCase()}) ·{" "}
                        {item.sig.postCount} post{item.sig.postCount > 1 ? "s" : ""}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des nouveaux foyers */}
      {mode === "tout" && (
      <div className="absolute right-3 top-3 flex max-h-[70%] w-72 flex-col rounded-xl bg-zinc-900/90 text-sm text-zinc-100 shadow-lg backdrop-blur">
        <button
          onClick={() => setListOpen(!listOpen)}
          className="flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="font-semibold">
            🔥 Nouveaux foyers &amp; signalements{" "}
            <span className="text-zinc-400">({globalItems.length})</span>
            <span className="ml-1 text-[10px] font-normal text-zinc-500">
              · dans la vue affichée
            </span>
          </span>
          <span className="text-zinc-500">{listOpen ? "▾" : "▸"}</span>
        </button>
        {listOpen && (
          <div className="overflow-y-auto border-t border-zinc-800">
            {status.kind === "loading" && globalItems.length === 0 && (
              <p className="flex items-center gap-2 p-3 text-xs text-zinc-400">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-orange-500" />
                Récupération des satellites et analyse IA des signaux…
              </p>
            )}
            {globalItems.length === 0 && status.kind === "ready" && (
              <p className="p-3 text-xs text-zinc-500">
                Aucun foyer ni signalement récent dans la vue affichée — déplacez la
                carte ou changez de région.
              </p>
            )}
            {globalItems.map((item) =>
              item.kind === "foyer" ? (
                <button
                  key={item.ev.id}
                  onClick={() => selectEvent(item.ev)}
                  className={`block w-full border-b border-zinc-800/60 px-3 py-2 text-left hover:bg-zinc-800 ${
                    selected?.id === item.ev.id ? "bg-zinc-800" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-orange-400">
                      🛰️ 1er signal {formatAge(hoursAgo(item.ev.firstSeen))}
                    </span>
                    <span className="flex gap-1">
                      {item.ev.confidence && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${CONF_LABEL[item.ev.confidence].cls}`}
                        >
                          {CONF_LABEL[item.ev.confidence].text}
                        </span>
                      )}
                      {hoursAgo(item.ev.firstSeen) < NEW_EVENT_HOURS && (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">
                          NOUVEAU
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {item.ev.social?.place ? `${item.ev.social.place} · ` : ""}
                    {item.ev.centroid[1].toFixed(2)}, {item.ev.centroid[0].toFixed(2)} ·{" "}
                    {item.ev.count} détection{item.ev.count > 1 ? "s" : ""} · {item.ev.maxFrp}{" "}
                    MW max
                  </div>
                </button>
              ) : (
                <button
                  key={`sig:${item.sig.place}:${item.sig.countryCode}`}
                  onClick={() => selectSignal(item.sig)}
                  className={`block w-full border-b border-zinc-800/60 px-3 py-2 text-left hover:bg-zinc-800 ${
                    selectedSignal?.place === item.sig.place ? "bg-zinc-800" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sky-400">
                      {item.sig.posts.some((p) => p.source === "bluesky")
                        ? "💬"
                        : item.sig.posts.some((p) => p.source === "telegram")
                          ? "✈️"
                          : "📰"}{" "}
                      1ère
                      mention {formatAge(hoursAgo(item.sig.firstPost))}
                    </span>
                    {item.sig.newFire && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">
                        NOUVEAU FEU
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {item.sig.place} ({item.sig.countryCode.toUpperCase()}) ·{" "}
                    {item.sig.postCount} mention{item.sig.postCount > 1 ? "s" : ""} · dernière{" "}
                    {formatAge(hoursAgo(item.sig.lastPost))}
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>
      )}

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
          {selectedSignal.newFire && (
            <span className="mb-2 inline-block animate-pulse rounded bg-red-600 px-2 py-0.5 text-xs font-bold">
              NOUVEAU FEU — 1ère mention {formatAge(hoursAgo(selectedSignal.firstPost))}
            </span>
          )}
          <p className="mb-2 text-xs text-zinc-400">
            {selectedSignal.postCount} post{selectedSignal.postCount > 1 ? "s" : ""} Bluesky
            (12 h) mentionnant un feu près de {selectedSignal.place} — 1ère mention{" "}
            {formatAge(hoursAgo(selectedSignal.firstPost))}, dernière{" "}
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
          {selected.social?.firstPress &&
            Date.parse(selected.social.firstPress) > Date.parse(selected.firstSeen) && (
              <span className="mb-2 ml-1 inline-block rounded bg-emerald-800 px-2 py-0.5 text-xs font-bold text-emerald-100">
                ⏱️ Détecté{" "}
                {formatDelta(
                  Date.parse(selected.social.firstPress) - Date.parse(selected.firstSeen)
                )}{" "}
                avant le 1er article de presse
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
                {selected.goesCount > 0 ? ` + ${selected.goesCount} GOES` : ""}
                {selected.mtgCount > 0 ? ` + ${selected.mtgCount} MTG` : ""})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Puissance max</dt>
              <dd>{selected.maxFrp} MW</dd>
            </div>
            {wind && (
              <div className="flex justify-between">
                <dt className="text-zinc-400">Vent</dt>
                <dd>
                  <span
                    className="mr-1 inline-block font-bold text-sky-300"
                    style={{ transform: `rotate(${wind.direction}deg)` }}
                    title={`Vent venant du ${compass(wind.direction)}`}
                  >
                    ↓
                  </span>
                  {wind.speed} km/h de {compass(wind.direction)}
                  {wind.gusts > wind.speed + 10 ? ` · rafales ${wind.gusts}` : ""}
                </dd>
              </div>
            )}
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
