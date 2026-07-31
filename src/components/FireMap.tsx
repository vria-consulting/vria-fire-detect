"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireEvent, Confidence } from "@/lib/cluster";
import type { SocialResult, SocialPost } from "@/lib/social";
import type { SocialSignal } from "@/lib/socialscan";
import { DICT, type Lang, type Dict } from "@/lib/i18n";
import { dfciCode } from "@/lib/dfci";
import type { FireRisk } from "@/lib/firerisk";
import type { Plane } from "@/lib/aircraft";

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

// Bouton « M'alerter sur cette zone » masqué en attendant une refonte (fiabilité
// des alertes push) : passer à true pour le réafficher.
const ALERTS_ENABLED = false;

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

// Icône avion (vue de dessus) des bombardiers d'eau : silhouette PLEINE haute
// résolution (dessinée à 2x pour rester nette), liserée de blanc pour ressortir
// sur fond clair comme sur imagerie satellite, avec un cockpit jaune (charte).
// Orientée vers le nord — pivotée ensuite selon le cap.
function planeImage(): ImageData {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.translate(S / 2, S / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Contour de l'appareil (aile haute droite type Canadair, empennage en T).
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0, -50); // nez
    ctx.bezierCurveTo(6, -44, 8, -30, 8, -15); // flanc droit
    ctx.lineTo(56, 1); // bord d'attaque aile droite
    ctx.lineTo(56, 9); // saumon d'aile
    ctx.lineTo(9, 14); // bord de fuite -> fuselage
    ctx.lineTo(6, 33); // fuselage arrière
    ctx.lineTo(23, 43); // stabilisateur droit
    ctx.lineTo(23, 48);
    ctx.lineTo(4, 45);
    ctx.bezierCurveTo(3, 49, 1, 51, 0, 51); // pointe de queue
    ctx.bezierCurveTo(-1, 51, -3, 49, -4, 45);
    ctx.lineTo(-23, 48);
    ctx.lineTo(-23, 43);
    ctx.lineTo(-6, 33);
    ctx.lineTo(-9, 14);
    ctx.lineTo(-56, 9);
    ctx.lineTo(-56, 1);
    ctx.lineTo(-8, -15);
    ctx.bezierCurveTo(-8, -30, -6, -44, 0, -50);
    ctx.closePath();
  };

  // Halo blanc (contour épais dessiné avant le remplissage).
  body();
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.lineWidth = 9;
  ctx.stroke();

  // Corps charbon.
  body();
  ctx.fillStyle = "#33322F";
  ctx.fill();

  // Cockpit jaune (accent charte) près du nez.
  ctx.beginPath();
  ctx.ellipse(0, -34, 4.6, 6.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#F5C518";
  ctx.fill();

  // Deux réacteurs (petits points clairs sur l'aile) pour le détail.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const x of [-26, 26]) {
    ctx.beginPath();
    ctx.ellipse(x, 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return ctx.getImageData(0, 0, S, S);
}

// Drapeau emoji à partir d'un code pays ISO-2 ("IT" -> 🇮🇹). "" si inconnu.
function flagEmoji(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  );
}

// Palette charte : [flamme, cœur] — danger, braise, jaune fort, gris, citoyen.
// « unverified » : bleu délavé pour un signalement sans satellite à proximité
// (retour utilisateur : impossible de distinguer un signal isolé d'un foyer
// confirmé sur la carte).
const FLAMES: Record<string, [string, string]> = {
  "flame-active": ["#D64545", "#F9E0E0"],
  "flame-recent": ["#E8622C", "#FBE5DA"],
  "flame-watched": ["#F0B400", "#FFF1C9"],
  "flame-old": ["#8A8880", "#F3F0E8"],
  "flame-citizen": ["#4A90C2", "#DCEBF7"],
  "flame-unverified": ["#A9C6DD", "#F0F6FB"],
};

// Distance (km) sous laquelle un signalement citoyen est considéré comme
// « appuyé » par une détection satellite — même seuil que la corroboration
// serveur, recalculé côté client pour styler les flammes bleues.
const SIGNAL_VERIFY_KM = 30;

function fastDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Équirectangulaire : largement suffisant à 30 km, et assez rapide pour
  // croiser chaque signal avec des milliers de foyers à chaque rafraîchissement.
  const kx = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)) * 111.32;
  const dx = (lon1 - lon2) * kx;
  const dy = (lat1 - lat2) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

function signalVerified(sig: SocialSignal, events: FireEvent[]): boolean {
  return events.some(
    (ev) =>
      fastDistKm(sig.lat, sig.lon, ev.centroid[1], ev.centroid[0]) <= SIGNAL_VERIFY_KM
  );
}

type Wind = { speed: number; gusts: number; direction: number; risk?: FireRisk };

// Couleurs des 4 niveaux de risque (vert / jaune / orange / rouge), calées sur
// l'esprit de la Météo des forêts pour que la bascule vers l'officiel soit
// transparente.
const RISK_COLORS = ["#3A9D5B", "#F0B400", "#E8622C", "#D64545"];

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
  const reportsRef = useRef<{ id: string; lat: number; lon: number; note?: string; at: string }[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const pulseMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [, setTick] = useState(0); // re-rendu périodique des "il y a X min"
  // Emprise affichée [ouest, sud, est, nord] : filtre le flux de droite.
  const [viewBounds, setViewBounds] = useState<[number, number, number, number] | null>(
    null
  );
  // UI maquette v2
  const [legendOpen, setLegendOpen] = useState(false);
  const [satellite, setSatellite] = useState(true); // fond satellite par défaut
  const [feedOpen, setFeedOpen] = useState(false); // panneau « En direct » : réduit par défaut
  const [detailOpen, setDetailOpen] = useState(false); // fiche foyer étendue
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Recherche de ville / zone
  const [query, setQuery] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Bombardiers d'eau (Canadair) : dernières positions réelles + horodatage,
  // pour l'interpolation « dead-reckoning » entre deux rafraîchissements.
  const planesRef = useRef<Plane[]>([]);
  const planeBaseRef = useRef<number>(0);
  const [planeCount, setPlaneCount] = useState(0);

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

  // Nom de lieu du foyer sélectionné (géocodage inverse Photon) : au zoom
  // pays, « 48.40, 2.70 » ne dit rien et fait deviner le mauvais massif
  // (retour utilisateur : un feu estimé en Ariège était à Néouvielle).
  const [nearPlace, setNearPlace] = useState<string | null>(null);
  const nearPlaceCache = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    setNearPlace(null);
    if (!selected || selected.social?.place) return;
    const cached = nearPlaceCache.current.get(selected.id);
    if (cached) {
      setNearPlace(cached);
      return;
    }
    let stale = false;
    const [lon, lat] = selected.centroid;
    fetch(
      `https://photon.komoot.io/reverse?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&lang=${lang}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.features?.[0]?.properties;
        const name = p?.name ?? p?.city ?? p?.county ?? null;
        const label = name
          ? [name, p?.state ?? p?.country].filter(Boolean).join(", ")
          : null;
        if (label) nearPlaceCache.current.set(selected.id, label);
        if (!stale && label) setNearPlace(label);
      })
      .catch(() => {
        /* géocodage silencieusement indisponible : les coordonnées restent */
      });
    return () => {
      stale = true;
    };
  }, [selected, lang]);

  const loadData = useCallback(async (map: maplibregl.Map, nHours: number, silent = false) => {
    if (!silent) setStatus({ kind: "loading" });
    try {
      const [evRes, sigRes, repRes] = await Promise.all([
        fetch(`/api/events?hours=${nHours}`),
        fetch(`/api/signals`).catch(() => null),
        fetch(`/api/report`).catch(() => null),
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
      // Signalements citoyens directs (« Je vois un feu ») : affichés en
      // signaux « à vérifier », jamais en foyers confirmés.
      let reports: { id: string; lat: number; lon: number; note?: string; at: string }[] = [];
      if (repRes?.ok) {
        const repData = await repRes.json().catch(() => null);
        if (repData?.reports) reports = repData.reports;
      }
      reportsRef.current = reports;
      const repSrc = map.getSource("reports") as maplibregl.GeoJSONSource | undefined;
      if (repSrc)
        repSrc.setData({
          type: "FeatureCollection",
          features: reports.map((r) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
            properties: { repId: r.id },
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
              verified: signalVerified(s, data.events) ? 1 : 0,
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
      attributionControl: false,
    });
    mapRef.current = map;
    // Commandes en bas à gauche : le coin bas-droite est réservé au bandeau
    // « En direct » réductible.
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        // Crédits toujours visibles (le fond « carto » qui les portait peut
        // être masqué en vue satellite).
        customAttribution:
          'Feux : <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a> · Lieux : <a href="https://www.geonames.org/">GeoNames</a>',
      }),
      "bottom-left"
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

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

      // Fond satellite (Esri World Imagery, gratuit) + labels lieux, masqués
      // par défaut. Placés juste au-dessus du fond « carto » et SOUS les feux.
      map.addSource("sat", {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
      });
      map.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "visible" } });
      map.addSource("sat-labels", {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
      });
      map.addLayer({ id: "sat-labels", type: "raster", source: "sat-labels", layout: { visibility: "visible" } });
      // Satellite par défaut : on masque le fond « plan ».
      map.setLayoutProperty("carto", "visibility", "none");

      map.addSource("events", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("signals", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("reports", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("planes", {
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
      map.addImage("plane", planeImage(), { pixelRatio: 2 });
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
      // Signalements citoyens : flamme bleue source humaine — délavée tant
      // qu'aucun satellite ne confirme à proximité (« à vérifier »).
      map.addLayer({
        id: "signals-icons",
        type: "symbol",
        source: "signals",
        layout: {
          "icon-image": [
            "case",
            ["==", ["get", "verified"], 1],
            "flame-citizen",
            "flame-unverified",
          ],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.26, 9, 0.5],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Témoins directs : petite flamme « à vérifier ».
      map.addLayer({
        id: "reports-icons",
        type: "symbol",
        source: "reports",
        layout: {
          "icon-image": "flame-unverified",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.24, 9, 0.46],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Halo doux sous chaque Canadair (effet « cible suivie », sobre).
      map.addLayer({
        id: "planes-halo",
        type: "circle",
        source: "planes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 9, 20],
          "circle-color": "#1E6FB8",
          "circle-opacity": 0.12,
          "circle-blur": 0.7,
        },
      });
      // Bombardiers d'eau (Canadair) : avion pivoté selon le cap.
      map.addLayer({
        id: "planes-icons",
        type: "symbol",
        source: "planes",
        layout: {
          "icon-image": "plane",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 9, 0.95],
          "icon-rotate": ["get", "track"],
          "icon-rotation-alignment": "map",
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
          const layers = ["events-icons", "signals-icons", "reports-icons", "planes-icons"].filter((l) =>
            map.getLayer(l)
          );
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
          let best: maplibregl.MapGeoJSONFeature | null = null;
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
          if (best.layer.id === "planes-icons") {
            const pl = planesRef.current.find((p) => p.id === best!.properties.id);
            if (pl) {
              const div = document.createElement("div");
              div.style.cssText = "font:12.5px var(--font-body);color:var(--ink-2);line-height:1.55";
              const title = document.createElement("div");
              title.style.cssText = "display:flex;align-items:center;gap:6px";
              const fl = flagEmoji(pl.country);
              if (fl) {
                const f = document.createElement("span");
                f.style.fontSize = "16px";
                f.textContent = fl;
                title.appendChild(f);
              }
              const strong = document.createElement("strong");
              strong.style.color = "var(--ink)";
              strong.textContent = pl.model;
              title.appendChild(strong);
              const meta = document.createElement("div");
              meta.textContent = [
                pl.callsign || pl.reg,
                pl.speed ? `${pl.speed} kn` : "",
                pl.alt != null ? `${pl.alt.toLocaleString(locale)} ft` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              div.append(title, meta);
              new maplibregl.Popup({ closeButton: true, offset: 14 })
                .setLngLat([pl.lon, pl.lat])
                .setDOMContent(div)
                .addTo(map);
            }
            return;
          }
          if (best.layer.id === "reports-icons") {
            const rep = reportsRef.current.find((r) => r.id === best!.properties.repId);
            if (rep) {
              const ageH = hoursAgo(rep.at);
              const age =
                ageH < 1
                  ? `${Math.max(1, Math.round(ageH * 60))} min`
                  : `${Math.round(ageH)} h`;
              const div = document.createElement("div");
              div.style.cssText = "font: 12.5px var(--font-body); color: var(--ink-2)";
              div.textContent = t.reportPopup(t.ago(age));
              new maplibregl.Popup({ closeButton: true, offset: 12 })
                .setLngLat([rep.lon, rep.lat])
                .setDOMContent(div)
                .addTo(map);
            }
            return;
          }
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

  // « Je vois un feu » : signalement direct à la position GPS du témoin.
  // Confirmation explicite avant envoi — le bouton rappelle d'appeler les
  // secours d'abord (kanari n'est pas un canal d'alerte officiel).
  const reportFire = () => {
    if (!navigator.geolocation) {
      setAlertMsg(t.geoUnsupported);
      return;
    }
    setReportBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!window.confirm(t.reportConfirm)) {
          setReportBusy(false);
          return;
        }
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: latitude, lon: longitude }),
          });
          if (res.status === 429) setAlertMsg(t.reportRateLimited);
          else if (!res.ok) setAlertMsg(t.reportFailed);
          else {
            setAlertMsg(t.reportSent);
            if (mapRef.current) {
              mapRef.current.flyTo({ center: [longitude, latitude], zoom: 10 });
              loadData(mapRef.current, hours, true);
            }
          }
        } catch {
          setAlertMsg(t.reportFailed);
        }
        setReportBusy(false);
      },
      () => {
        setReportBusy(false);
        setAlertMsg(t.geoUnavailable);
      },
      { timeout: 8000, enableHighAccuracy: true }
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

  // Rendu des Canadair avec interpolation « dead-reckoning » : entre deux
  // rafraîchissements, on avance chaque appareil selon son cap et sa vitesse
  // pour un mouvement quasi temps réel, sans requête supplémentaire.
  const renderPlanes = useCallback(() => {
    const src = mapRef.current?.getSource("planes") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const dt = (Date.now() - planeBaseRef.current) / 1000; // s depuis la vraie position
    const R = 6_371_000;
    src.setData({
      type: "FeatureCollection",
      features: planesRef.current.map((p) => {
        let lon = p.lon;
        let lat = p.lat;
        if (p.speed > 0 && dt > 0) {
          const d = (p.speed * 0.514444 * dt) / R; // distance angulaire parcourue
          const brg = (p.track * Math.PI) / 180;
          const la1 = (p.lat * Math.PI) / 180;
          const lo1 = (p.lon * Math.PI) / 180;
          const la2 = Math.asin(
            Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brg)
          );
          const lo2 =
            lo1 +
            Math.atan2(
              Math.sin(brg) * Math.sin(d) * Math.cos(la1),
              Math.cos(d) - Math.sin(la1) * Math.sin(la2)
            );
          lat = (la2 * 180) / Math.PI;
          lon = (((lo2 * 180) / Math.PI + 540) % 360) - 180;
        }
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lon, lat] },
          properties: { id: p.id, track: p.track },
        };
      }),
    });
  }, []);

  // Recentre la carte sur les Canadair (clic sur le compteur).
  const fitPlanes = () => {
    const map = mapRef.current;
    const ps = planesRef.current;
    if (!map || ps.length === 0) return;
    if (ps.length === 1) {
      map.flyTo({ center: [ps[0].lon, ps[0].lat], zoom: 9 });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    ps.forEach((p) => b.extend([p.lon, p.lat]));
    map.fitBounds(b, { padding: 90, maxZoom: 8, duration: 800 });
  };

  // Bascule fond « plan » (Positron) <-> « satellite » (Esri imagery + labels).
  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !satellite;
    setSatellite(next);
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    vis("carto", !next);
    vis("sat", next);
    vis("sat-labels", next);
  };

  // Animation sobre des feux : le halo des foyers actifs (< 3 h) « respire »
  // doucement (opacité seulement — léger et discret).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const map = mapRef.current;
      if (map && map.getLayer("events-glow")) {
        const s = 0.5 + 0.5 * Math.sin(performance.now() / 800); // 0..1, cycle ~5 s
        try {
          // Toutes les flammes « respirent » en opacité -> animation toujours
          // visible partout où il y a des feux (sobre, cycle lent).
          map.setPaintProperty("events-icons", "icon-opacity", 0.62 + 0.38 * s);
          // Halo des foyers actifs (< 3 h) : anneau qui pulse comme un radar
          // (grandit puis s'estompe).
          const r = 1 + 0.45 * s;
          map.setPaintProperty("events-glow", "circle-radius", [
            "interpolate", ["linear"], ["zoom"], 2, 12 * r, 8, 30 * r,
          ]);
          map.setPaintProperty("events-glow", "circle-opacity", 0.05 + 0.17 * (1 - s));
        } catch {
          /* couches pas prêtes : on réessaie à la frame suivante */
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Chargement PARESSEUX (2,5 s après le montage : la carte et les feux
  // passent en priorité), puis rafraîchissement toutes les 20 s. La réponse
  // est cachée côté CDN, donc l'API amont n'est presque jamais sollicitée.
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/aircraft");
        if (!res.ok || stop) return;
        const data: { planes: Plane[] } = await res.json();
        if (stop) return;
        planesRef.current = data.planes;
        planeBaseRef.current = Date.now();
        setPlaneCount(data.planes.length);
        renderPlanes();
      } catch {
        /* source indisponible : on garde l'affichage courant */
      }
    };
    const start = setTimeout(pull, 2500);
    const poll = setInterval(pull, 20_000);
    return () => {
      stop = true;
      clearTimeout(start);
      clearInterval(poll);
    };
  }, [renderPlanes]);

  // Tic d'animation : glisse les avions chaque seconde entre deux positions
  // réelles (léger : quelques appareils au maximum).
  useEffect(() => {
    if (planeCount === 0) return;
    const id = setInterval(renderPlanes, 1000);
    return () => clearInterval(id);
  }, [planeCount, renderPlanes]);

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
          <button
            onClick={reportFire}
            disabled={reportBusy}
            className={`${chip} hidden sm:flex`}
            style={{ background: "var(--ember)", color: "#fff", boxShadow: "var(--shadow-s)" }}
          >
            {reportBusy ? "…" : `🔥 ${t.reportBtn}`}
          </button>
        </div>

        {/* Sur mobile, le bouton de signalement a sa propre ligne (la rangée
            de périodes est déjà pleine). */}
        <button
          onClick={reportFire}
          disabled={reportBusy}
          className={`${chip} self-start sm:hidden`}
          style={{ background: "var(--ember)", color: "#fff", boxShadow: "var(--shadow-s)" }}
        >
          {reportBusy ? "…" : `🔥 ${t.reportBtn}`}
        </button>

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
                [FLAMES["flame-unverified"][0], t.legendUnverified],
              ] as const
            ).map(([color, label]) => (
              <span key={label} className="flex items-center gap-[9px]">
                <span
                  className="inline-block h-[11px] w-[11px] shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-[9px]">
              <span
                className="inline-flex h-[11px] w-[11px] shrink-0 items-center justify-center"
                style={{ fontSize: 11 }}
                aria-hidden="true"
              >
                🛩️
              </span>
              {t.legendPlane}
            </span>
            <span
              className="mt-0.5 border-t pt-2 text-xs"
              style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
            >
              {t.legendSize}
            </span>
          </div>
        )}

        {/* Compteur visible sur mobile : le panneau « En direct » y est replié,
            sans lui un changement de période ne donnait aucun retour chiffré. */}
        {status.kind === "ready" && (
          <div
            className="flex h-[30px] items-center gap-1.5 self-start rounded-full px-3 text-[12px] md:hidden"
            style={{ ...card, color: "var(--ink-2)" }}
          >
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {status.events.toLocaleString(locale)}
            </span>
            {lang === "fr" ? "foyers sur" : "fires in"} {hours} h
          </div>
        )}

        {/* Compteur des Canadair en vol (clic : recentre dessus). */}
        {planeCount > 0 && (
          <button
            onClick={fitPlanes}
            className="flex h-[30px] items-center gap-1.5 self-start rounded-full px-3 text-[12px] transition-transform hover:scale-[1.03]"
            style={{ ...card, color: "var(--ink-2)" }}
          >
            <span aria-hidden="true">🛩️</span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {planeCount}
            </span>
            {t.planesShort}
          </button>
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

      {/* Bascule fond Plan / Satellite (haut-droite). */}
      <button
        onClick={toggleSatellite}
        className="absolute right-3 top-3 z-30 flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-transform hover:scale-[1.03] sm:right-5 sm:top-5"
        style={{ ...card, color: "var(--ink)" }}
        aria-label={satellite ? t.viewPlan : t.viewSatellite}
      >
        <span aria-hidden="true">{satellite ? "🗺️" : "🛰️"}</span>
        <span className="hidden sm:inline">{satellite ? t.viewPlan : t.viewSatellite}</span>
      </button>

      {/* Bandeau « En direct » réduit (bas-droite) : le panneau est minimisé
          par défaut pour laisser un maximum de carte. Clic = déploiement. */}
      {!feedOpen && (
        <button
          onClick={() => setFeedOpen(true)}
          className="absolute bottom-4 right-4 z-30 flex h-[44px] items-center gap-2.5 rounded-full px-[18px] text-[14px] font-medium transition-transform hover:scale-[1.03]"
          style={{ ...card, color: "var(--ink)" }}
          aria-label={t.live}
        >
          <span
            className="k-listen inline-block h-[8px] w-[8px] rounded-full"
            style={{ background: "var(--canary-strong)" }}
          />
          {t.live}
          {hotCount > 0 && (
            <span style={{ color: "var(--danger)", fontWeight: 700 }}>· {hotCount}</span>
          )}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: 0.55 }}>
            <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Flux « En direct » (droite, maquette v2) */}
      <aside
        className={`${feedOpen ? "flex" : "hidden"} absolute z-30 flex-col overflow-hidden rounded-[22px] max-md:inset-x-3 max-md:bottom-4 max-md:top-16 md:bottom-4 md:right-4 md:top-4 md:w-[350px]`}
        style={card}
      >
        <div className="flex flex-col gap-3 border-b px-[18px] pb-3.5 pt-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <h3
              className="flex-1 cursor-pointer text-[17px]"
              onClick={() => setFeedOpen(false)}
              title={t.minimize}
            >
              {t.live}
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-3)" }}>
              <span
                className="k-listen inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--canary-strong)" }}
              />
              {t.listening}
            </span>
            <button
              onClick={() => setFeedOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
              aria-label={t.minimize}
              title={t.minimize}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
        {ALERTS_ENABLED && (
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
        )}
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
            {!signalVerified(selectedSignal, events) && (
              <span
                className="flex h-[22px] shrink-0 items-center rounded-full px-[9px] text-[11px] font-bold"
                style={{ background: "#EDF4FA", color: "#5B87A8", letterSpacing: ".4px" }}
              >
                {t.badgeUnverified}
              </span>
            )}
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
              {selected.social?.place ??
                (nearPlace ? t.nearLabel(nearPlace) : eventTitle(selected))}
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
            {/* Statut honnête (inspiré de fogos.pt) : un foyer muet depuis
                longtemps est probablement éteint — ou simplement masqué. */}
            {hoursAgo(selected.lastSeen) >= 12 && (
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                {t.statusFading(Math.round(hoursAgo(selected.lastSeen)))}
              </span>
            )}
            {wind && (
              <span className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--ink-3)" }} />
                {t.wind(wind.speed, compass(wind.direction))}
                {wind.gusts > wind.speed + 10 ? t.gusts(wind.gusts) : ""}
              </span>
            )}
            {wind?.risk && (
              <span className="flex items-center gap-2" title={t.riskNote}>
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: RISK_COLORS[wind.risk.level - 1] }}
                />
                {t.riskLabel} :{" "}
                <strong style={{ color: RISK_COLORS[wind.risk.level - 1] }}>
                  {t.riskLevels[wind.risk.level - 1]}
                </strong>
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
              {/* Carreau DFCI 2 km (France) : l'unité de dialogue radio des
                  moyens terrestres et aériens — demande d'un cdt de SDIS. */}
              {dfciCode(selected.centroid[1], selected.centroid[0]) && (
                <div className="flex justify-between">
                  <dt style={{ color: "var(--ink-3)" }}>{t.dlDfci}</dt>
                  <dd className="font-mono font-medium" style={{ color: "var(--ink)" }}>
                    {dfciCode(selected.centroid[1], selected.centroid[0])}
                  </dd>
                </div>
              )}
              <div className="pt-1">
                <a
                  href={`https://worldview.earthdata.nasa.gov/?v=${(selected.centroid[0] - 1.5).toFixed(2)},${(selected.centroid[1] - 1).toFixed(2)},${(selected.centroid[0] + 1.5).toFixed(2)},${(selected.centroid[1] + 1).toFixed(2)}&l=Reference_Labels_15m,Coastlines_15m,VIIRS_NOAA20_Thermal_Anomalies_375m_All,VIIRS_NOAA20_CorrectedReflectance_TrueColor&t=${selected.lastSeen.slice(0, 10)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--link)" }}
                >
                  {t.worldviewLink} ↗
                </a>
              </div>
            </dl>
          )}

          {/* Témoignages attachés automatiquement (corroboration) */}
          {detailOpen && selected.social && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
              <p className="mb-2 text-xs font-medium" style={{ color: "#22684A" }}>
                {t.corrobBy(
                  selected.social.postCount,
                  selected.social.place,
                  selected.social.distanceKm
                )}
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
