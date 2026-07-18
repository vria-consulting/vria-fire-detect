"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEvent, Confidence } from "@/lib/cluster";
import type { SocialResult, SocialPost } from "@/lib/social";
import type { SocialSignal } from "@/lib/socialscan";
import { DICT, type Lang, type Dict } from "@/lib/i18n";

const REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  France: { center: [2.5, 46.6], zoom: 5.2 },
  "Europe du Sud": { center: [12, 41], zoom: 4.3 },
  "Amérique du Nord": { center: [-105, 42], zoom: 3.2 },
  "Amérique du Sud": { center: [-60, -12], zoom: 3.2 },
  Afrique: { center: [20, 2], zoom: 3.0 },
  "Asie du Sud-Est": { center: [105, 12], zoom: 3.5 },
  Australie: { center: [134, -26], zoom: 3.5 },
};

// Fond clair (maquette « Kanari App Redesign v2 ») : CARTO Positron.
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
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

function formatAge(h: number, t: Dict): string {
  if (h < 1) return t.ago(`${Math.max(1, Math.round(h * 60))} min`);
  if (h < 48) return t.ago(`${Math.round(h)} h`);
  return t.ago(`${Math.round(h / 24)} j`);
}

// Horodatage court, aligné à droite dans le flux (« 12 min », « 3 h »).
function formatShort(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}

const NEW_EVENT_HOURS = 12; // un foyer est "nouveau" si son 1er signal a < 12 h
const DEPART_WATCH_MIN = 120; // urgents : 1er signalement il y a 2 h max
const DEPART_HOT_MIN = 20; // pulsation : signal de moins de 20 min

// Clé publique VAPID (non sensible) — la clé privée reste côté serveur.
const VAPID_PUBLIC_KEY =
  "BDkzUjBlN8TEIWHqe9Fo5UrCHbxzFp8MYPH3q2bqqLyZ5rob33ci-B4dFr2GLAGw_aO9zhT2prXSb7w7LD8rnjk";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Code couleur d'âge de la charte : danger < 3 h, braise 3-12 h,
// jaune fort 12-24 h, gris au-delà. Bleu = signalement citoyen.
const AGE_COLORS = {
  active: "#D64545",
  recent: "#E8622C",
  watched: "#F0B400",
  old: "#8A8880",
  citizen: "#4A90C2",
};

function ageColor(lastAgeH: number): string {
  if (lastAgeH < 3) return AGE_COLORS.active;
  if (lastAgeH < 12) return AGE_COLORS.recent;
  if (lastAgeH < 24) return AGE_COLORS.watched;
  return AGE_COLORS.old;
}

// Icône flamme dessinée au canvas, teintée aux couleurs de la charte,
// liseré blanc pour rester lisible sur le fond clair Positron.
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

// Palette charte : [flamme, cœur] — danger, braise, jaune fort, gris, citoyen.
const FLAMES: Record<string, [string, string]> = {
  "flame-active": ["#D64545", "#F9E0E0"],
  "flame-recent": ["#E8622C", "#FBE5DA"],
  "flame-watched": ["#F0B400", "#FFF1C9"],
  "flame-old": ["#8A8880", "#F3F0E8"],
  "flame-citizen": ["#4A90C2", "#DCEBF7"],
};

type Wind = { speed: number; gusts: number; direction: number };

function sourceLabel(posts: SocialPost[]): string {
  if (posts.some((p) => p.source === "bluesky")) return "Bluesky";
  if (posts.some((p) => p.source === "telegram")) return "Telegram";
  return "presse";
}

function PostList({ posts, t }: { posts: SocialPost[]; t: Dict }) {
  return (
    <ul className="space-y-2">
      {posts.map((post, i) => (
        // Clé suffixée par l'index : une URL dupliquée dans la liste (bug
        // amont) casserait la réconciliation React — enfants « dupliqués ou
        // omis », posts périmés affichés sous le mauvais signal (vu en prod).
        <li
          key={`${post.url}#${i}`}
          className="rounded-[14px] p-2.5 text-xs"
          style={{ background: "var(--paper-2)" }}
        >
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium"
            style={{ color: "var(--link)" }}
          >
            {post.source === "presse" ? post.handle : `@${post.handle}`}
          </a>{" "}
          <span style={{ color: "var(--ink-3)" }}>
            · {post.source} · {formatAge(hoursAgo(post.createdAt), t)}
          </span>
          <p className="mt-1 whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
            {post.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; events: number; detections: number; signals: number }
  | { kind: "error"; code: string };

type SocialState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: SocialResult }
  | { kind: "error" };

// Recherche de lieu (Photon / OSM — gratuit, CORS ouvert, typeahead).
type Suggestion = { label: string; sub: string; lon: number; lat: number; zoom: number };

function photonZoom(type: string | undefined): number {
  switch (type) {
    case "country":
      return 4.3;
    case "state":
      return 6;
    case "county":
      return 7.5;
    case "city":
      return 9.5;
    case "district":
    case "town":
      return 10.5;
    case "village":
    case "locality":
      return 11.5;
    default:
      return 10;
  }
}

// Position du visiteur (cookie posé par le middleware depuis la géo Vercel) :
// la carte s'ouvre sur son pays. Repli : France.
function visitorStart(): { center: [number, number]; zoom: number } {
  try {
    const raw = document.cookie.match(/(?:^|;\s*)kanari-geo=([^;]+)/)?.[1];
    if (raw) {
      const [lat, lon] = decodeURIComponent(raw).split(",").map(parseFloat);
      if (isFinite(lat) && isFinite(lon)) return { center: [lon, lat], zoom: 5.3 };
    }
  } catch {
    /* cookie illisible : repli */
  }
  return REGIONS["France"];
}

export default function FireMap({ lang }: { lang: Lang }) {
  const t = DICT[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const eventsRef = useRef<FireEvent[]>([]);
  const signalsRef = useRef<SocialSignal[]>([]);
  // 6 h par défaut : fenêtre la plus légère (chargement initial rapide) et la
  // plus « temps réel » — le cron réchauffe ce cache en continu.
  const [hours, setHours] = useState(6);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [selected, setSelected] = useState<FireEvent | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<SocialSignal | null>(null);
  const [social, setSocial] = useState<SocialState>({ kind: "idle" });
  const [wind, setWind] = useState<Wind | null>(null);
  const [alertState, setAlertState] = useState<"off" | "busy" | "on">("off");
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const pendingSelectRef = useRef<string | null>(null);
  // Onglet du flux : « Tout » = vue globale, « Urgents » = départs de feu
  // (< 2 h) — l'onglet pilote aussi les filtres de la carte.
  const [mode, setMode] = useState<"tout" | "departs">("tout");
  const [signals, setSignals] = useState<SocialSignal[]>([]);
  const pulseMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [, setTick] = useState(0); // re-rendu périodique des "il y a X min"
  // Emprise affichée [ouest, sud, est, nord] : filtre le flux de droite.
  const [viewBounds, setViewBounds] = useState<[number, number, number, number] | null>(
    null
  );
  // UI maquette v2
  const [legendOpen, setLegendOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false); // flux sur mobile
  const [detailOpen, setDetailOpen] = useState(false); // fiche foyer étendue
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Recherche de ville / zone
  const [query, setQuery] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (localStorage.getItem("vigifire-alert-endpoint")) setAlertState("on");
    const id = setInterval(() => setTick((x) => x + 1), 10_000);
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
          features: signals.map((s) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
            properties: {
              // Identité stable du signal : les tuiles se reconstruisent en
              // asynchrone après setData, un simple index peut donc pointer
              // vers le mauvais élément du tableau rafraîchi entre-temps.
              sigKey: `${s.place}|${s.countryCode}|${s.lat}|${s.lon}`,
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
    // Sans lien profond : la carte s'ouvre sur le pays du visiteur (géo).
    const start = visitorStart();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: hasDeepLink ? [pLon, pLat] : start.center,
      zoom: hasDeepLink ? (isFinite(pZ) ? pZ : 9) : start.zoom,
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
      // Halo doux sous les feux actifs (< 3 h).
      map.addLayer({
        id: "events-glow",
        type: "circle",
        source: "events",
        filter: ["<", ["get", "lastAgeH"], 3],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 12, 8, 30],
          "circle-color": AGE_COLORS.active,
          "circle-opacity": 0.14,
          "circle-blur": 1,
        },
      });
      // Icônes flamme aux couleurs de la charte (liseré blanc).
      for (const [name, [main, core]] of Object.entries(FLAMES)) {
        map.addImage(name, flameImage(main, core));
      }
      // Foyers : flamme teintée par âge du dernier signal, taille = nombre
      // de détections.
      map.addLayer({
        id: "events-icons",
        type: "symbol",
        source: "events",
        layout: {
          "icon-image": [
            "step",
            ["get", "lastAgeH"],
            "flame-active",
            3,
            "flame-recent",
            12,
            "flame-watched",
            24,
            "flame-old",
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]], 0, 0.18, 3, 0.32, 7, 0.55],
            9,
            ["interpolate", ["linear"], ["ln", ["+", ["get", "count"], 1]], 0, 0.4, 3, 0.72, 7, 1.25],
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      // Signalements citoyens : flamme bleue source humaine.
      map.addLayer({
        id: "signals-icons",
        type: "symbol",
        source: "signals",
        layout: {
          "icon-image": "flame-citizen",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.26, 9, 0.5],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Un seul gestionnaire de clic avec ZONE DE TOLÉRANCE : au zoom monde,
      // les flammes font ~10 px et exiger le pixel exact rendait la sélection
      // impossible sans zoomer. On cherche dans un carré de ±12 px et on
      // sélectionne l'élément le plus proche du clic.
      map.on("click", (e) => {
        // queryRenderedFeatures peut lever « Out of bounds » si le clic tombe
        // pendant la reconstruction des tuiles (setData toutes les 2 min).
        try {
          const layers = ["events-icons", "signals-icons"].filter((l) => map.getLayer(l));
          if (layers.length === 0) return;
          const pad = 12;
          const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ];
          const hits = map.queryRenderedFeatures(bbox, { layers });
          if (hits.length === 0) {
            setSelected(null);
            setSelectedSignal(null);
            return;
          }
          let best: maplibregl.GeoJSONFeature | null = null;
          let bestDist = Infinity;
          for (const f of hits) {
            if (f.geometry.type !== "Point") continue;
            const p = map.project(f.geometry.coordinates as [number, number]);
            const d = (p.x - e.point.x) ** 2 + (p.y - e.point.y) ** 2;
            if (d < bestDist) {
              bestDist = d;
              best = f;
            }
          }
          if (!best) return;
          if (best.layer.id === "signals-icons") {
            const sig = signalsRef.current.find(
              (s) => `${s.place}|${s.countryCode}|${s.lat}|${s.lon}` === best!.properties.sigKey
            );
            if (sig) {
              setSelectedSignal(sig);
              setSelected(null);
            }
          } else {
            const ev = eventsRef.current.find((x) => x.id === best!.properties.id);
            if (ev) {
              setSelected(ev);
              setSelectedSignal(null);
              setSocial({ kind: "idle" });
              setDetailOpen(false);
            }
          }
        } catch {
          /* tuiles en cours de reconstruction : on ignore ce clic */
        }
      });
      for (const layer of ["events-icons", "signals-icons"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      loadData(map, 6);
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
    setDetailOpen(false);
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
      setAlertMsg(t.alertNotSupported);
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
        setAlertMsg(t.alertOff);
        return;
      }
      // Abonnement sur la vue courante
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setAlertState("off");
        setAlertMsg(t.alertAllow);
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
      setAlertMsg(t.alertOn);
    } catch (e) {
      console.error(e);
      setAlertState(localStorage.getItem("vigifire-alert-endpoint") ? "on" : "off");
      setAlertMsg(t.alertFailed);
    }
  };

  const selectSignal = (sig: SocialSignal) => {
    setSelectedSignal(sig);
    setSelected(null);
    mapRef.current?.flyTo({ center: [sig.lon, sig.lat], zoom: 9 });
  };

  // Partage d'un feu ou d'un signalement : lien profond natif ou presse-papiers.
  const share = async (title: string, url: string) => {
    const full = `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: full });
      } catch {
        /* partage annulé par l'utilisateur */
      }
      return;
    }
    try {
      // Course avec un délai court : dans certains webviews la demande de
      // permission ne se résout jamais — le retour visuel doit toujours venir.
      await Promise.race([
        navigator.clipboard.writeText(full),
        new Promise((_, reject) => setTimeout(reject, 800)),
      ]);
    } catch {
      // Repli sans permission Clipboard (navigateurs stricts / webviews).
      const ta = document.createElement("textarea");
      ta.value = full;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* dernier recours : rien à faire, le lien reste dans l'URL */
      }
      ta.remove();
    }
    setShareMsg(t.linkCopied);
    setTimeout(() => setShareMsg(null), 2500);
  };

  // Recherche de ville / pays / zone (Photon, données OSM).
  const runSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setSugs([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${lang}`
        );
        if (!res.ok) return;
        const j = await res.json();
        type PhotonFeature = {
          geometry: { coordinates: [number, number] };
          properties: {
            name?: string;
            country?: string;
            state?: string;
            type?: string;
            osm_value?: string;
          };
        };
        const seen = new Set<string>();
        const out: Suggestion[] = [];
        for (const f of (j.features ?? []) as PhotonFeature[]) {
          const p = f.properties;
          if (!p.name) continue;
          const sub = [p.state, p.country].filter(Boolean).join(" · ");
          const key = `${p.name}|${sub}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            label: p.name,
            sub,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            zoom: photonZoom(p.type),
          });
        }
        setSugs(out);
      } catch {
        /* recherche silencieusement indisponible */
      }
    }, 300);
  };

  const pickSuggestion = (s: Suggestion) => {
    setQuery(s.label);
    setSearchOpen(false);
    setSugs([]);
    mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: s.zoom });
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setAlertMsg(t.geoUnsupported);
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        const { longitude, latitude } = pos.coords;
        posMarkerRef.current?.remove();
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;border-radius:50%;background:var(--charcoal);border:3px solid #fff;box-shadow:var(--shadow-m)";
        el.title = t.yourPosition;
        posMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current!);
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 10 });
      },
      () => {
        setGeoBusy(false);
        setAlertMsg(t.geoUnavailable);
      },
      { timeout: 8000 }
    );
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
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelected(ev);
          setSelectedSignal(null);
          setSocial({ kind: "idle" });
          setDetailOpen(false);
        });
        pulseMarkersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat(ev.centroid).addTo(map)
        );
      }
      for (const sig of signals) {
        if (!sig.newFire || hoursAgo(sig.firstPost) * 60 > DEPART_HOT_MIN) continue;
        const el = document.createElement("div");
        el.className = "pulse-marker pulse-social";
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
      map.setFilter("events-glow", ["<", ["get", "lastAgeH"], 3]);
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

  // Le flux de droite suit la zone affichée à l'écran.
  const inView = (lon: number, lat: number) =>
    !viewBounds ||
    (lon >= viewBounds[0] &&
      lon <= viewBounds[2] &&
      lat >= viewBounds[1] &&
      lat <= viewBounds[3]);

  // Onglet « Tout » : foyers satellite ET signalements humains, triés par
  // premier signal / première mention.
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

  // Onglet « Urgents » : foyers ET signalements dont le 1er signal a < 2 h.
  type DepartItem =
    | { kind: "sat"; ageMin: number; ev: FireEvent }
    | { kind: "social"; ageMin: number; sig: SocialSignal };
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

  // Groupes temporels du flux (maquette : « À l'instant », « Dernière heure »).
  const bucketOf = (h: number) =>
    h < 0.25 ? t.bucketNow : h < 1 ? t.bucketHour : t.bucketEarlier;

  const eventTitle = (ev: FireEvent) =>
    ev.social?.place ??
    `${t.satDetection} — ${ev.centroid[1].toFixed(2)}, ${ev.centroid[0].toFixed(2)}`;

  const AGE_BADGE: { max: number; label: string; bg: string; fg: string }[] = [
    { max: 3, label: t.badgeActive, bg: "var(--danger-soft)", fg: "#9C2B2B" },
    { max: 12, label: t.badgeRecent, bg: "var(--ember-soft)", fg: "#8C3A16" },
    { max: 24, label: t.badgeWatched, bg: "var(--canary-soft)", fg: "#7A5A00" },
    { max: Infinity, label: t.badgeOld, bg: "var(--paper-2)", fg: "var(--ink-2)" },
  ];
  const CONF_LABEL: Record<Confidence, { text: string; bg: string; fg: string }> = {
    possible: { text: t.confPossible, bg: "var(--paper-2)", fg: "var(--ink-2)" },
    probable: { text: t.confProbable, bg: "var(--canary-soft)", fg: "#7A5A00" },
    corrobore: { text: t.confCorroborated, bg: "var(--safe-soft)", fg: "#22684A" },
  };
  const eventBadge = (ev: FireEvent) => AGE_BADGE.find((b) => hoursAgo(ev.lastSeen) < b.max)!;

  const compass = (deg: number) => t.compass[Math.round(deg / 45) % 8];
  const formatDelta = (ms: number): string => {
    const min = Math.round(ms / 60_000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return `${h} h${min % 60 ? ` ${min % 60}` : ""}`;
  };

  // Ligne « 1ère mention citoyenne » de la fiche foyer : plus ancien post attaché.
  const firstMention = (ev: FireEvent): string | null => {
    const posts = ev.social?.posts;
    if (!posts || posts.length === 0) return null;
    return posts.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), posts[0].createdAt);
  };

  const chip =
    "flex h-[38px] items-center whitespace-nowrap rounded-full px-[18px] text-[13px] font-medium transition-all duration-150 cursor-pointer";
  const card = { background: "var(--white)", boxShadow: "var(--shadow-m)" };
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  return (
    <div className="relative h-full w-full" style={{ fontFamily: "var(--font-body)" }}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Recherche + filtres (haut gauche, maquette v2) */}
      <div className="absolute left-3 top-3 z-30 flex flex-col gap-2.5 sm:left-5 sm:top-5">
        <div
          className="flex h-12 w-[min(320px,calc(100vw-150px))] items-center gap-2.5 rounded-full pl-[18px] pr-2 sm:w-[320px]"
          style={card}
        >
          <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="#8A8880" strokeWidth="2" />
            <line
              x1="11.5"
              y1="11.5"
              x2="16"
              y2="16"
              stroke="#8A8880"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder={t.searchPlaceholder}
            className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] outline-none"
            style={{ color: "var(--ink)" }}
            aria-label={t.searchPlaceholder}
          />
          <button
            onClick={locateMe}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors sm:px-3.5"
            style={{ background: "var(--canary)", color: "var(--charcoal)" }}
            aria-label={t.myPosition}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M12 2v4M12 18v4M2 12h4M18 12h4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden sm:inline">{geoBusy ? "…" : t.myPosition}</span>
          </button>
        </div>

        {/* Suggestions de recherche / accès rapides régions */}
        {searchOpen && (sugs.length > 0 || query.trim().length < 2) && (
          <div
            className="k-rise flex w-[min(320px,calc(100vw-150px))] flex-col overflow-hidden rounded-[22px] py-2 sm:w-[320px]"
            style={card}
          >
            {sugs.length > 0
              ? sugs.map((s) => (
                  <button
                    key={`${s.label}|${s.sub}|${s.lat}`}
                    onMouseDown={() => pickSuggestion(s)}
                    className="flex items-baseline gap-2 px-[18px] py-2 text-left transition-colors hover:bg-[var(--canary-tint)]"
                  >
                    <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                      {s.label}
                    </span>
                    <span className="truncate text-xs" style={{ color: "var(--ink-3)" }}>
                      {s.sub}
                    </span>
                  </button>
                ))
              : Object.keys(REGIONS).map((r) => (
                  <button
                    key={r}
                    onMouseDown={() => {
                      jumpTo(r);
                      setSearchOpen(false);
                    }}
                    className="px-[18px] py-2 text-left text-[14px] transition-colors hover:bg-[var(--canary-tint)]"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {r}
                  </button>
                ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {[6, 24, 72].map((h) => (
            <button
              key={h}
              onClick={() => changeHours(h)}
              className={chip}
              style={
                hours === h
                  ? { background: "var(--charcoal)", color: "var(--paper)" }
                  : { background: "var(--white)", color: "var(--ink-2)", boxShadow: "var(--shadow-s)" }
              }
            >
              {h} h
            </button>
          ))}
          <button
            onClick={() => setLegendOpen(!legendOpen)}
            className={chip}
            style={
              legendOpen
                ? { background: "var(--paper-2)", color: "var(--ink)", boxShadow: "var(--shadow-s)" }
                : { background: "var(--white)", color: "var(--ink-2)", boxShadow: "var(--shadow-s)" }
            }
          >
            {t.legend}
          </button>
        </div>

        {legendOpen && (
          <div
            className="k-rise flex w-[250px] flex-col gap-[9px] rounded-[22px] px-[18px] py-4 text-[13px]"
            style={{ ...card, color: "var(--ink-2)" }}
          >
            {(
              [
                [AGE_COLORS.active, t.legendActive],
                [AGE_COLORS.recent, t.legendRecent],
                [AGE_COLORS.watched, t.legendWatched],
                [AGE_COLORS.old, t.legendOld],
                [AGE_COLORS.citizen, t.legendCitizen],
              ] as const
            ).map(([color, label]) => (
              <span key={label} className="flex items-center gap-[9px]">
                <span
                  className="inline-block h-[11px] w-[11px] rounded-full"
                  style={{ background: color }}
                />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* État de chargement / erreur */}
        {status.kind === "loading" && (
          <div
            className="flex h-[38px] items-center gap-2 self-start rounded-full px-4 text-[13px]"
            style={{ ...card, color: "var(--ink-2)" }}
          >
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--canary)", borderTopColor: "transparent" }}
            />
            {t.analyzing}
          </div>
        )}
        {status.kind === "error" && (
          <div
            className="w-[min(320px,calc(100vw-24px))] rounded-[14px] px-4 py-3 text-[13px]"
            style={{ background: "var(--danger-soft)", color: "#9C2B2B" }}
          >
            {status.code.startsWith("FIRMS_MAP_KEY") ? t.errFirmsKey : t.errData}
          </div>
        )}
      </div>

      {/* Bouton flux sur mobile */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="absolute right-3 top-3 z-30 flex h-[38px] items-center gap-2 rounded-full px-4 text-[13px] font-medium md:hidden"
        style={{ ...card, color: "var(--ink)" }}
      >
        <span
          className="k-listen inline-block h-[7px] w-[7px] rounded-full"
          style={{ background: "var(--canary-strong)" }}
        />
        {t.live}
        {hotCount > 0 ? ` · ${hotCount}` : ""}
      </button>

      {/* Flux « En direct » (droite, maquette v2) */}
      <aside
        className={`${panelOpen ? "flex" : "hidden md:flex"} absolute z-20 flex-col overflow-hidden rounded-[22px] max-md:inset-x-3 max-md:bottom-24 max-md:top-16 md:bottom-4 md:right-4 md:top-4 md:w-[350px]`}
        style={card}
      >
        <div className="flex flex-col gap-3 border-b px-[18px] pb-3.5 pt-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-[17px]">{t.live}</h3>
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-3)" }}>
              <span
                className="k-listen inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--canary-strong)" }}
              />
              {t.listening}
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] md:hidden"
              style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
              aria-label={t.close}
            >
              ✕
            </button>
          </div>
          <div
            className="flex gap-[3px] rounded-full p-[3px]"
            style={{ background: "var(--paper-2)" }}
          >
            <button
              onClick={() => setMode("tout")}
              className="h-[34px] flex-1 rounded-full text-[13px] font-medium transition-colors"
              style={
                mode === "tout"
                  ? { background: "var(--white)", color: "var(--ink)", boxShadow: "var(--shadow-s)" }
                  : { background: "transparent", color: "var(--ink-2)" }
              }
            >
              {t.tabAll} · {globalItems.length}
            </button>
            <button
              onClick={() => setMode("departs")}
              className="h-[34px] flex-1 rounded-full text-[13px] font-medium transition-colors"
              style={
                mode === "departs"
                  ? { background: "var(--ember)", color: "#fff" }
                  : { background: "transparent", color: "var(--ink-2)" }
              }
            >
              {t.tabUrgent} · {departItems.length}
            </button>
          </div>
        </div>

        <div className="k-scroll flex flex-1 flex-col overflow-y-auto pb-2">
          {mode === "departs" && hotCount > 0 && (
            <div
              className="mx-3 mt-3 rounded-[14px] px-3.5 py-2.5 text-[13px] font-bold text-white"
              style={{ background: "var(--danger)" }}
            >
              {t.urgentBanner(hotCount)}
            </div>
          )}

          {status.kind === "loading" &&
            (mode === "tout" ? globalItems : departItems).length === 0 && (
              <p className="flex items-center gap-2 p-4 text-xs" style={{ color: "var(--ink-3)" }}>
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2"
                  style={{ borderColor: "var(--line)", borderTopColor: "var(--canary-strong)" }}
                />
                {t.loadingFeed}
              </p>
            )}
          {status.kind !== "loading" && mode === "tout" && globalItems.length === 0 && (
            <p className="p-4 text-[13px]" style={{ color: "var(--ink-3)" }}>
              {t.emptyAll}
            </p>
          )}
          {status.kind !== "loading" && mode === "departs" && departItems.length === 0 && (
            <p className="p-4 text-[13px]" style={{ color: "var(--ink-3)" }}>
              {t.emptyUrgent}
            </p>
          )}

          {mode === "tout" &&
            globalItems.map((item, i) => {
              const h = hoursAgo(item.when);
              const bucket = bucketOf(h);
              const prevBucket = i > 0 ? bucketOf(hoursAgo(globalItems[i - 1].when)) : null;
              const header =
                bucket !== prevBucket ? (
                  <span
                    key={`g:${bucket}`}
                    className="px-[18px] pb-1.5 pt-3.5 text-[11px] font-bold uppercase"
                    style={{ letterSpacing: "1.5px", color: "var(--ink-3)" }}
                  >
                    {bucket}
                  </span>
                ) : null;
              if (item.kind === "foyer") {
                const ev = item.ev;
                const isSel = selected?.id === ev.id;
                return (
                  <div key={ev.id} className="flex flex-col">
                    {header}
                    <button
                      onClick={() => selectEvent(ev)}
                      className="mx-1.5 flex items-start gap-[11px] rounded-[14px] px-3 py-[11px] text-left transition-colors hover:bg-[var(--canary-tint)]"
                      style={isSel ? { background: "var(--canary-tint)" } : undefined}
                    >
                      <span
                        className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full"
                        style={{ background: ageColor(hoursAgo(ev.lastSeen)) }}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <strong className="truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                          {eventTitle(ev)}
                        </strong>
                        <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                          {t.detectionsSat(ev.count)} · {ev.maxFrp} {t.mwMax}
                          {ev.confidence === "corrobore" ? ` · ${t.corroboratedTag}` : ""}
                        </span>
                      </span>
                      <span
                        className="mt-0.5 whitespace-nowrap text-xs"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {formatShort(h)}
                      </span>
                    </button>
                  </div>
                );
              }
              const sig = item.sig;
              const isSel = selectedSignal?.place === sig.place;
              return (
                <div key={`sig:${sig.place}:${sig.countryCode}`} className="flex flex-col">
                  {header}
                  <button
                    onClick={() => selectSignal(sig)}
                    className="mx-1.5 flex items-start gap-[11px] rounded-[14px] px-3 py-[11px] text-left transition-colors hover:bg-[var(--canary-tint)]"
                    style={isSel ? { background: "var(--canary-tint)" } : undefined}
                  >
                    <span
                      className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full"
                      style={{ background: AGE_COLORS.citizen }}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {sig.newFire ? t.probablePrefix : ""}
                        {sig.place} ({sig.countryCode.toUpperCase()})
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {t.postsOn(sig.postCount, sourceLabel(sig.posts))} · {t.lastMentionAgo}{" "}
                        {formatAge(hoursAgo(sig.lastPost), t)}
                      </span>
                    </span>
                    <span
                      className="mt-0.5 whitespace-nowrap text-xs"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {formatShort(h)}
                    </span>
                  </button>
                </div>
              );
            })}

          {mode === "departs" &&
            departItems.map((item) => {
              const hot = item.ageMin <= DEPART_HOT_MIN;
              const key = item.kind === "sat" ? item.ev.id : `s:${item.sig.place}`;
              return (
                <button
                  key={key}
                  onClick={() =>
                    item.kind === "sat" ? selectEvent(item.ev) : selectSignal(item.sig)
                  }
                  className="mx-1.5 mt-1 flex items-start gap-[11px] rounded-[14px] px-3 py-[11px] text-left transition-colors hover:bg-[var(--canary-tint)]"
                >
                  <span
                    className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full"
                    style={{ background: hot ? AGE_COLORS.active : AGE_COLORS.recent }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                      {item.kind === "sat"
                        ? item.ev.social?.place ??
                          `${t.satDetection} — ${item.ev.centroid[1].toFixed(2)}, ${item.ev.centroid[0].toFixed(2)}`
                        : `${t.probablePrefix}${item.sig.place} (${item.sig.countryCode.toUpperCase()})`}
                    </strong>
                    <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                      {item.kind === "sat" ? (
                        <>
                          {t.satShort} · {t.detectionsSat(item.ev.count)} · {item.ev.maxFrp} MW
                        </>
                      ) : (
                        <>
                          {t.postsOn(item.sig.postCount, sourceLabel(item.sig.posts))} ·{" "}
                          {t.verifying}
                        </>
                      )}
                    </span>
                  </span>
                  <span
                    className="mt-0.5 whitespace-nowrap text-xs font-medium"
                    style={{ color: hot ? "var(--danger)" : "var(--ink-3)" }}
                  >
                    {Math.max(1, Math.round(item.ageMin))} min
                  </span>
                </button>
              );
            })}
        </div>

        <div
          className="flex items-center justify-between border-t px-[18px] py-3 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
        >
          <span>
            {status.kind === "ready"
              ? t.footerStats(status.events.toLocaleString(locale), status.signals)
              : "…"}
          </span>
          <span className="flex items-center gap-1.5">
            {lastUpdate &&
              (Date.now() - lastUpdate < 15_000
                ? t.updatedNow
                : t.updatedAgo(Math.round((Date.now() - lastUpdate) / 1000)))}
            <button
              onClick={() => mapRef.current && loadData(mapRef.current, hours, true)}
              className="rounded-full px-1.5 py-0.5 transition-colors hover:bg-[var(--paper-2)]"
              title={t.refreshNow}
              aria-label={t.refreshNow}
            >
              ↻
            </button>
          </span>
        </div>
      </aside>

      {/* CTA principal : alerte sur la zone affichée (maquette v2) */}
      <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
        {alertMsg && (
          <div
            className="k-rise max-w-[min(420px,calc(100vw-24px))] rounded-[14px] px-4 py-2.5 text-center text-[13px]"
            style={{ ...card, color: "var(--ink-2)" }}
          >
            {alertMsg}
          </div>
        )}
        <button
          onClick={toggleAlerts}
          disabled={alertState === "busy"}
          className="flex h-[54px] items-center gap-[11px] whitespace-nowrap rounded-full px-[30px] text-[15px] font-medium transition-all sm:text-base"
          style={
            alertState === "on"
              ? { background: "var(--charcoal)", color: "var(--paper)", boxShadow: "var(--shadow-l)" }
              : { background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-l)" }
          }
        >
          <span
            className={alertState === "on" ? "" : "k-listen"}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: alertState === "on" ? "var(--canary)" : "var(--charcoal)",
            }}
          />
          {alertState === "busy" ? t.ctaBusy : alertState === "on" ? t.ctaOn : t.ctaOff}
        </button>
      </div>

      {/* Fiche signalement citoyen */}
      {selectedSignal && (
        <div
          className="k-rise k-scroll absolute bottom-24 left-3 z-30 max-h-[60%] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-[22px] p-5 sm:left-5"
          style={{ background: "var(--white)", boxShadow: "var(--shadow-l)" }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-[22px] items-center rounded-full px-[9px] text-[11px] font-bold"
              style={
                selectedSignal.newFire
                  ? { background: "var(--danger-soft)", color: "#9C2B2B", letterSpacing: ".4px" }
                  : { background: "#E3F0FA", color: "#2C6E9E", letterSpacing: ".4px" }
              }
            >
              {selectedSignal.newFire ? t.badgeNewFire : t.badgeReport}
            </span>
            <strong className="flex-1 truncate text-base" style={{ color: "var(--ink)" }}>
              {selectedSignal.place} ({selectedSignal.countryCode.toUpperCase()})
            </strong>
            <button
              onClick={() => setSelectedSignal(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
              style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
              aria-label={t.close}
            >
              ✕
            </button>
          </div>
          <div className="mb-2.5 flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
            <span className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ember)" }} />
              {t.firstMention} · {formatAge(hoursAgo(selectedSignal.firstPost), t)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: AGE_COLORS.citizen }} />
              {t.postsWindow(selectedSignal.postCount, sourceLabel(selectedSignal.posts))} ·{" "}
              {t.lastLabel} {formatAge(hoursAgo(selectedSignal.lastPost), t)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ink-3)" }} />
              {t.positionNote}
            </span>
          </div>
          <div className="mb-3 flex gap-2">
            <button
              onClick={() =>
                share(
                  t.shareSignal(selectedSignal.place),
                  `/?lat=${selectedSignal.lat.toFixed(3)}&lon=${selectedSignal.lon.toFixed(3)}&z=10`
                )
              }
              className="h-[38px] flex-1 rounded-full border text-[13px] font-medium transition-colors hover:bg-[var(--paper-2)]"
              style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
            >
              {shareMsg ?? t.share}
            </button>
          </div>
          <PostList posts={selectedSignal.posts} t={t} />
          <p className="mt-3 border-t pt-2.5 text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
            {t.signalFootnote}
          </p>
        </div>
      )}

      {/* Fiche foyer (progressive disclosure : résumé -> détail) */}
      {selected && (
        <div
          className="k-rise k-scroll absolute bottom-24 left-3 z-30 max-h-[65%] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-[22px] p-5 sm:left-5"
          style={{ background: "var(--white)", boxShadow: "var(--shadow-l)" }}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-[22px] shrink-0 items-center rounded-full px-[9px] text-[11px] font-bold"
              style={{
                background: eventBadge(selected).bg,
                color: eventBadge(selected).fg,
                letterSpacing: ".4px",
              }}
            >
              {eventBadge(selected).label}
            </span>
            <strong className="flex-1 truncate text-base" style={{ color: "var(--ink)" }}>
              {eventTitle(selected)}
            </strong>
            <button
              onClick={() => setSelected(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
              style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
              aria-label={t.close}
            >
              ✕
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.confidence && (
              <span
                className="flex h-[22px] items-center rounded-full px-[9px] text-[11px] font-bold"
                style={{
                  background: CONF_LABEL[selected.confidence].bg,
                  color: CONF_LABEL[selected.confidence].fg,
                }}
              >
                {CONF_LABEL[selected.confidence].text}
              </span>
            )}
            {selected.social?.firstPress &&
              Date.parse(selected.social.firstPress) > Date.parse(selected.firstSeen) && (
                <span
                  className="flex h-[22px] items-center rounded-full px-[9px] text-[11px] font-bold"
                  style={{ background: "var(--safe-soft)", color: "#22684A" }}
                >
                  {t.beforePress(
                    formatDelta(
                      Date.parse(selected.social.firstPress) - Date.parse(selected.firstSeen)
                    )
                  )}
                </span>
              )}
          </div>

          {/* Mini-timeline sourcée (maquette v2) */}
          <div className="mb-3 flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
            {firstMention(selected) && (
              <span className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ember)" }} />
                {t.citizenMention} · {formatAge(hoursAgo(firstMention(selected)!), t)}
              </span>
            )}
            <span className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: AGE_COLORS.citizen }} />
              {t.satFirst} · {formatAge(hoursAgo(selected.firstSeen), t)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: ageColor(hoursAgo(selected.lastSeen)) }} />
              {t.lastSignal} · {formatAge(hoursAgo(selected.lastSeen), t)}
            </span>
            {wind && (
              <span className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ink-3)" }} />
                {t.wind(wind.speed, compass(wind.direction))}
                {wind.gusts > wind.speed + 10 ? t.gusts(wind.gusts) : ""}
              </span>
            )}
          </div>

          <div className="mb-1 flex gap-2">
            <button
              onClick={() => setDetailOpen(!detailOpen)}
              className="h-[38px] flex-1 rounded-full text-[13px] font-medium transition-colors"
              style={{ background: "var(--charcoal)", color: "var(--paper)" }}
            >
              {detailOpen ? t.hideDetail : t.viewDetail}
            </button>
            <button
              onClick={() =>
                share(
                  t.shareEvent(eventTitle(selected)),
                  `/?lat=${selected.centroid[1].toFixed(3)}&lon=${selected.centroid[0].toFixed(3)}&z=9&ev=${encodeURIComponent(selected.id)}`
                )
              }
              className="h-[38px] flex-1 rounded-full border text-[13px] font-medium transition-colors hover:bg-[var(--paper-2)]"
              style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
            >
              {shareMsg ?? t.share}
            </button>
          </div>

          {detailOpen && (
            <dl className="mt-3 space-y-1.5 border-t pt-3 text-[13px]" style={{ borderColor: "var(--line)" }}>
              <div className="flex justify-between">
                <dt style={{ color: "var(--ink-3)" }}>{t.dlFirstUTC}</dt>
                <dd style={{ color: "var(--ink)" }}>
                  {new Date(selected.firstSeen).toISOString().slice(0, 16).replace("T", " ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--ink-3)" }}>{t.dlDetections}</dt>
                <dd style={{ color: "var(--ink)" }}>
                  {selected.count} ({selected.viirsCount} VIIRS
                  {selected.goesCount > 0 ? ` + ${selected.goesCount} GOES` : ""}
                  {selected.mtgCount > 0 ? ` + ${selected.mtgCount} MTG` : ""})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--ink-3)" }}>{t.dlPower}</dt>
                <dd style={{ color: "var(--ink)" }}>{selected.maxFrp} MW</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--ink-3)" }}>{t.dlPosition}</dt>
                <dd style={{ color: "var(--ink)" }}>
                  {selected.centroid[1].toFixed(3)}, {selected.centroid[0].toFixed(3)}
                </dd>
              </div>
            </dl>
          )}

          {/* Témoignages attachés automatiquement (corroboration) */}
          {detailOpen && selected.social && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
              <p className="mb-2 text-xs font-medium" style={{ color: "#22684A" }}>
                {t.corrobBy(selected.social.postCount, selected.social.place)}
              </p>
              <PostList posts={selected.social.posts} t={t} />
            </div>
          )}

          {/* Recherche manuelle complémentaire */}
          {detailOpen && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
              {social.kind === "idle" && (
                <button
                  onClick={() => searchWitnesses(selected)}
                  className="h-[38px] w-full rounded-full text-[13px] font-medium transition-colors"
                  style={{ background: "var(--canary)", color: "var(--charcoal)" }}
                >
                  {t.searchWitnesses(!!selected.social)}
                </button>
              )}
              {social.kind === "loading" && (
                <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                  {t.searchingWitnesses}
                </p>
              )}
              {social.kind === "error" && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>
                  {t.searchUnavailable}
                </p>
              )}
              {social.kind === "done" && (
                <div>
                  <p className="mb-2 text-xs" style={{ color: "var(--ink-3)" }}>
                    {social.result.place ? (
                      <>
                        {t.zoneLabel} :{" "}
                        <span style={{ color: "var(--ink)" }}>{social.result.place}</span> —{" "}
                      </>
                    ) : null}
                    {t.witnessesFound(social.result.posts.length)}
                  </p>
                  {social.result.posts.length === 0 &&
                    (social.result.searchStatuses?.every((s) => s >= 400 || s === 0) ? (
                      <p className="text-xs" style={{ color: "#8C3A16" }}>
                        {t.bskyUnreachable}
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                        {t.noWitnesses}
                      </p>
                    ))}
                  <PostList posts={social.result.posts} t={t} />
                </div>
              )}
            </div>
          )}

          <p className="mt-3 border-t pt-2.5 text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
            {t.eventFootnote}
          </p>
        </div>
      )}
    </div>
  );
}
