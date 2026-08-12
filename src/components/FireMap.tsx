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
  // Glyphes nécessaires aux compteurs de clusters (serveur MapLibre officiel).
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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

// ---- Braises : dimension réelle et phase d'animation ----------------------
// Rayon d'emprise du foyer (km) depuis sa bbox de détections : la taille du
// halo sur la carte reflète l'étendue RÉELLE du feu, plus une icône uniforme.
function footprintKm(ev: FireEvent): number {
  const [w, s, e, n] = ev.bbox;
  const kx = Math.cos((((s + n) / 2) * Math.PI) / 180) * 111.32;
  const dx = (e - w) * kx;
  const dy = (n - s) * 110.57;
  return Math.min(30, Math.max(1.2, Math.sqrt(dx * dx + dy * dy) / 2));
}

// Phase pseudo-aléatoire stable par foyer (0..2π) : les respirations sont
// déphasées feu par feu — rendu organique, jamais métronome.
function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6283) / 1000;
}

// Rayon de braise en pixels : suit la taille RÉELLE au sol (0,008 px/km au
// zoom 0, ×2 par niveau — exact aux latitudes moyennes), borné par un
// minimum lisible. Contrainte MapLibre : ["zoom"] doit rester au premier
// niveau -> le « max » vit DANS les stops. `t` non nul ajoute la respiration
// organique (sinus déphasé par foyer).
function emberRadius(
  mult: number,
  mins: [number, number, number, number],
  t: number | null
): maplibregl.ExpressionSpecification {
  const stop = (f: number, m: number): unknown => {
    const base = ["max", ["*", ["get", "radiusKm"], f * mult], m];
    return t == null
      ? base
      : ["*", base, ["+", 1, ["*", 0.07, ["sin", ["+", t * 1.2, ["get", "phase"]]]]]];
  };
  return [
    "interpolate", ["exponential", 2], ["zoom"],
    2, stop(0.032, mins[0]),
    7, stop(1.024, mins[1]),
    12, stop(32.77, mins[2]),
    20, stop(8389, mins[3]),
  ] as unknown as maplibregl.ExpressionSpecification;
}
// Tailles partagées entre la définition des couches et la boucle d'animation
// (une seule source de vérité — retour terrain : « les points sont trop petits »).
const CORE_MULT = 0.6;
const CORE_MINS: [number, number, number, number] = [3, 5.5, 9, 12];
const AURA_MULT = 1.3;
const AURA_MINS: [number, number, number, number] = [6, 10, 16, 20];

// Couleur par âge du dernier signal (braise qui refroidit).
const AGE_COLOR_EXPR = [
  "step", ["get", "lastAgeH"],
  "#D64545", 3, "#E8622C", 12, "#F0B400", 24, "#8A8880",
] as unknown as maplibregl.ExpressionSpecification;

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

// Icône hélicoptère (vue de dessus) : fuselage + poutre de queue charbon,
// pales en croix, halo blanc — même langage graphique que l'avion.
function heloImage(): ImageData {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.translate(S / 2, S / 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const body = () => {
    ctx.beginPath();
    // Cabine ovale + poutre de queue + rotor arrière.
    ctx.ellipse(0, -8, 13, 20, 0, 0, Math.PI * 2);
    ctx.moveTo(3, 10);
    ctx.lineTo(3, 40);
    ctx.lineTo(10, 46);
    ctx.lineTo(-10, 46);
    ctx.lineTo(-3, 40);
    ctx.lineTo(-3, 10);
    ctx.closePath();
  };
  // Halo blanc.
  body();
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.lineWidth = 9;
  ctx.stroke();
  // Corps charbon.
  body();
  ctx.fillStyle = "#33322F";
  ctx.fill();
  // Pales du rotor principal (croix) avec halo.
  for (const w of [8, 4]) {
    ctx.strokeStyle = w === 8 ? "rgba(255,255,255,0.96)" : "#33322F";
    ctx.lineWidth = w;
    for (const ang of [Math.PI / 4, (3 * Math.PI) / 4]) {
      ctx.beginPath();
      ctx.moveTo(-Math.cos(ang) * 34, -8 - Math.sin(ang) * 34);
      ctx.lineTo(Math.cos(ang) * 34, -8 + Math.sin(ang) * 34);
      ctx.stroke();
    }
  }
  // Moyeu rotor jaune (accent charte).
  ctx.beginPath();
  ctx.arc(0, -8, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = "#F5C518";
  ctx.fill();
  return ctx.getImageData(0, 0, S, S);
}

// Panache de vent (vue de dessus) : dégradé chaud, opaque à la base (le feu),
// évanescent vers la pointe — orienté ensuite vers la direction de propagation.
// Bouffée de fumée sombre pré-rendue : dessinée UNE fois, réutilisée pour
// toutes les particules (drawImage = quasi gratuit).
function smokePuffSprite(): HTMLCanvasElement {
  const S = 80;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(62,57,52,0.7)");
  g.addColorStop(0.55, "rgba(62,57,52,0.4)");
  g.addColorStop(1, "rgba(62,57,52,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
}

type SmokeSource = { id: string; lon: number; lat: number; rot: number; kmh: number; frp: number };
type SmokeParticle = { x: number; y: number; vx: number; vy: number; born: number; life: number; s0: number; w: number };
// Billboard de VRAI feu filmé (boucle Pexels sur fond noir) : mirror +
// tranche source variés par foyer = pas de clones.
type VideoFire = { lon: number; lat: number; frp: number; rot: number | null; kmh: number; mirror: boolean; sx: number };

// Masque de bords : fond en douceur sur les 4 côtés du cadre vidéo pour que
// la flamme détourée n'ait JAMAIS d'arête rectangulaire visible.
function buildEdgeMask(w: number, h: number): Float32Array {
  const m = new Float32Array(w * h);
  const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  for (let y = 0; y < h; y++) {
    const fy =
      smooth(y / (h * 0.07)) * // haut
      smooth((h - 1 - y) / (h * 0.08)); // bas (léger : la base des flammes vit)
    for (let x = 0; x < w; x++) {
      const fx = smooth(x / (w * 0.1)) * smooth((w - 1 - x) / (w * 0.1));
      m[y * w + x] = fx * fy;
    }
  }
  return m;
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

// ---- Nuit solaire (terminator) --------------------------------------------
// Polygone de l'hémisphère nuit, recalculé chaque minute : voile sombre sur
// la carte/globe, les feux brillent côté nuit. Maths standards (déclinaison
// solaire + angle horaire), précision largement suffisante pour un voile.
function nightPolygon(now = new Date()): GeoJSON.Feature<GeoJSON.Polygon> {
  const rad = Math.PI / 180;
  const day = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
  const decl = -23.44 * Math.cos(rad * (360 / 365) * (day + 10)); // déclinaison (°)
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const sunLon = -15 * (utcH - 12); // longitude subsolaire (°)
  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    // Latitude du terminator pour cette longitude.
    const ha = rad * (lon - sunLon); // angle horaire local
    const lat = Math.atan(-Math.cos(ha) / Math.tan(rad * decl || 1e-9)) / rad;
    ring.push([lon, Math.max(-89.9, Math.min(89.9, lat))]);
  }
  // Ferme le polygone par le pôle opposé au soleil.
  const pole = decl > 0 ? -89.9 : 89.9;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

// ---- Imagerie GOES GeoColor (GIBS, 10 min, gratuite) ----------------------
// Vraie couleur le jour / infrarouge la nuit, pour le mode replay. Latence de
// publication ~40-50 min : on borne le temps demandé en conséquence.
const GEOCOLOR_MAX_Z = 7;
function geocolorTiles(layer: "GOES-East_ABI_GeoColor" | "GOES-West_ABI_GeoColor", tMs: number): string {
  const t = new Date(Math.floor(tMs / 600_000) * 600_000);
  const iso = t.toISOString().slice(0, 16) + ":00Z";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${iso}/GoogleMapsCompatible_Level${GEOCOLOR_MAX_Z}/{z}/{y}/{x}.png`;
}
// Cône de propagation ESTIMÉE (v1, vent seul) : ellipse sous le vent façon
// Van Wagner. Volontairement grossier (ni combustible, ni pente, ni barrières)
// et affiché comme « estimation indicative » — jamais comme une prévision.
function spreadRing(lon: number, lat: number, degTo: number, kmh: number, minutes: number): number[][] {
  const ros = 6 + 1.7 * kmh; // m/min — ordre de grandeur forêt/garrigue
  const dHead = Math.min(15_000, ros * minutes);
  const dBack = dHead * 0.15;
  const lb = Math.min(4, 1 + 0.45 * Math.sqrt(kmh)); // rapport longueur/largeur
  const a = (dHead + dBack) / 2;
  const bAxis = a / lb;
  const beta = (degTo * Math.PI) / 180;
  const ux = Math.sin(beta);
  const uy = Math.cos(beta);
  const cE = ((dHead - dBack) / 2) * ux;
  const cN = ((dHead - dBack) / 2) * uy;
  const mLat = 110_574;
  const mLon = Math.max(20_000, 111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= 24; i++) {
    const th = (i / 24) * Math.PI * 2;
    const x = a * Math.cos(th);
    const y = bAxis * Math.sin(th);
    const east = cE + x * ux + y * uy;
    const north = cN + x * uy - y * ux;
    ring.push([lon + east / mLon, lat + north / mLat]);
  }
  return ring;
}

// Replay désactivé pour le moment (rendu jugé pas assez fiable en prod le
// 07/08/2026) : le code reste en place, repasser ce drapeau à true pour le
// réactiver une fois fiabilisé.
const REPLAY_ENABLED = false;
const REPLAY_SPAN_MS = 24 * 3600 * 1000;
const REPLAY_STEP_MS = 10 * 60 * 1000;
// La latence de publication de GeoColor sur GIBS varie de ~1 h à ~12 h+ : la
// dernière image réellement disponible est SONDÉE à l'ouverture du replay
// (petites requêtes de tuiles), ce repli ne sert qu'en attendant.
const REPLAY_FALLBACK_LAG_MS = 13 * 3600 * 1000;

// Dernier créneau GeoColor publié : lu côté serveur dans les capabilities
// GIBS (champ <Default>) via /api/geocolor — exact et léger.
async function fetchGeocolorMax(): Promise<number | null> {
  try {
    const r = await fetch("/api/geocolor");
    if (!r.ok) return null;
    const j = (await r.json()) as { east: string | null; west: string | null };
    const times = [j.east, j.west]
      .map((s) => (s ? Date.parse(s) : NaN))
      .filter((t) => Number.isFinite(t));
    if (times.length === 0) return null;
    // La fin de fenêtre commune = le moins frais des deux satellites.
    return Math.floor(Math.min(...times) / REPLAY_STEP_MS) * REPLAY_STEP_MS;
  } catch {
    return null;
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
  // --- Replay 24 h : scrubber temporel + imagerie GOES GeoColor -----------
  const [replayOn, setReplayOn] = useState(false);
  const [replayT, setReplayT] = useState<number>(() => Date.now());
  const [replayPlaying, setReplayPlaying] = useState(false);
  // Fin de fenêtre = dernière imagerie GeoColor réellement publiée (sondée).
  const [replayMax, setReplayMax] = useState<number>(() => Date.now() - REPLAY_FALLBACK_LAG_MS);
  const replayProbedRef = useRef(0); // horodatage du dernier sondage
  const replayOnRef = useRef(false); // lu par la boucle rAF (flammes/fumée off)
  // Pendant l'intro (globe qui tourne puis zoom), la projection change à
  // chaque frame : les billboards canvas seraient dessinés au mauvais
  // endroit — on ne les affiche qu'une fois le vol terminé.
  const introActiveRef = useRef(false);
  // --- Champ de vent réel (grille 5×4 interpolée) pour advecter la fumée --
  const windFieldRef = useRef<{
    at: number;
    west: number; south: number; east: number; north: number;
    cols: number; rows: number;
    u: Float32Array; v: Float32Array; kmh: Float32Array;
  } | null>(null);
  const windFieldBusyRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Bombardiers d'eau (Canadair) : dernières positions réelles + horodatage,
  // pour l'interpolation « dead-reckoning » entre deux rafraîchissements.
  const planesRef = useRef<Plane[]>([]);
  const planeBaseRef = useRef<number>(0);
  const [planeCount, setPlaneCount] = useState(0);
  // Vent par foyer (fumée de propagation) : cache 12 min, id -> {deg, kmh}.
  const windCacheRef = useRef<Map<string, { deg: number; kmh: number; at: number }>>(new Map());
  const windTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fumée vivante : sources (foyer + vent), particules, sprite, horloge sim.
  const smokeSourcesRef = useRef<SmokeSource[]>([]);
  const smokePartsRef = useRef<SmokeParticle[]>([]);
  const smokeSpawnRef = useRef<Map<string, number>>(new Map());
  const smokeSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const smokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSimRef = useRef<number>(0);
  // Feu filmé : la boucle vidéo décodée UNE fois, dessinée N fois par frame.
  const flameVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoFiresRef = useRef<VideoFire[]>([]);
  // Détourage par luminance : canvas intermédiaire (frame vidéo -> vraie
  // transparence) + masque de bords, calculés une fois par frame pour TOUS
  // les feux.
  const keyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyMaskRef = useRef<Float32Array | null>(null);

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
              frp: ev.maxFrp,
              radiusKm: footprintKm(ev),
              phase: phaseOf(ev.id),
              flameVar: Math.floor(phaseOf(ev.id) * 100) % 4,
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
    // Intro cinématique : le globe entier, puis plongée vers le pays du
    // visiteur. Une fois par session, jamais sur lien profond, et respect de
    // prefers-reduced-motion.
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let intro = false;
    try {
      intro = !hasDeepLink && !reducedMotion && sessionStorage.getItem("kanari-intro") !== "1";
      if (intro) sessionStorage.setItem("kanari-intro", "1");
    } catch {
      /* sessionStorage indisponible : pas d'intro */
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: hasDeepLink ? [pLon, pLat] : intro ? [start.center[0], 16] : start.center,
      zoom: hasDeepLink ? (isFinite(pZ) ? pZ : 9) : intro ? 1.15 : start.zoom,
      attributionControl: false,
    });
    mapRef.current = map;
    // Vue GLOBE (MapLibre v5, projection composite adaptative) : planète au
    // dézoom, mercator classique en zoomant — aucune régression de rendu.
    map.on("style.load", () => {
      try {
        (map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: "globe" });
      } catch {
        /* runtime sans globe : mercator, comme avant */
      }
      try {
        (map as unknown as { setSky: (s: Record<string, unknown>) => void }).setSky({
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.4, 8, 0],
        });
      } catch {
        /* halo atmosphérique indisponible : sans gravité */
      }
    });
    if (intro) {
      // Un court instant de planète, puis vol vers chez le visiteur. Les
      // flammes canvas restent masquées jusqu'à la fin du vol (projection
      // instable pendant l'animation = billboards mal posés).
      introActiveRef.current = true;
      map.once("load", () => {
        window.setTimeout(() => {
          map.flyTo({ center: start.center, zoom: start.zoom, duration: 4200, curve: 1.55 });
          map.once("moveend", () => {
            introActiveRef.current = false;
          });
        }, 900);
      });
      // Ceinture de sécurité : quoi qu'il arrive, on libère après 7 s.
      window.setTimeout(() => {
        introActiveRef.current = false;
      }, 7000);
    }
    if (process.env.NODE_ENV === "development") {
      // Inspection en dev uniquement (jamais présent en prod).
      (window as unknown as { __kmap?: maplibregl.Map }).__kmap = map;
    } else if (new URLSearchParams(window.location.search).has("kdebug")) {
      // Poignée de diagnostic lecture seule, uniquement sur demande explicite
      // (?kdebug) : permet de vérifier l'état de la carte en prod.
      (window as unknown as { __kmap?: maplibregl.Map }).__kmap = map;
    }
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

    // Canvas de fumée : couche de particules AU-DESSUS de la carte (sous
    // l'interface), en pixels écran — les bouffées dérivent sous le vent.
    const smoke = document.createElement("canvas");
    // width/height:100% OBLIGATOIRES : « inset:0 » seul ne contraint pas un
    // <canvas> (taille intrinsèque = son buffer) — sans ça, il s'affiche à
    // buffer×dpr et tout le calque est décalé/désynchronisé (vu en local).
    smoke.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2";
    containerRef.current.appendChild(smoke);
    smokeCanvasRef.current = smoke;
    const sizeSmoke = () => {
      const el = containerRef.current;
      if (!el) return;
      const d = window.devicePixelRatio || 1;
      smoke.width = el.clientWidth * d;
      smoke.height = el.clientHeight * d;
    };
    sizeSmoke();
    // Les particules vivent en pixels écran : un déplacement de carte les
    // rendrait fausses — on les purge (elles renaissent en < 1 s).
    map.on("move", () => {
      smokePartsRef.current.length = 0;
    });
    // Boucle de VRAI feu (Pexels, fond noir) : décodée une seule fois,
    // dessinée sur le canvas en blending « screen » pour chaque foyer actif.
    const flameVideo = document.createElement("video");
    flameVideo.src = "/fx/flame.mp4";
    flameVideo.muted = true;
    flameVideo.loop = true;
    flameVideo.playsInline = true;
    flameVideo.play().catch(() => {
      /* autoplay muet refusé (rare) : les billboards restent absents */
    });
    flameVideoRef.current = flameVideo;

    const ro = new ResizeObserver(() => {
      map.resize();
      sizeSmoke();
    });
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

      // Imagerie GOES GeoColor pour le replay (cachée hors replay). Ajoutée
      // SOUS le voile de nuit et sous les feux.
      for (const gl of ["GOES-East_ABI_GeoColor", "GOES-West_ABI_GeoColor"] as const) {
        const id = gl.startsWith("GOES-East") ? "geocolor-east" : "geocolor-west";
        map.addSource(id, {
          type: "raster",
          tiles: [geocolorTiles(gl, Date.now() - REPLAY_FALLBACK_LAG_MS)],
          tileSize: 256,
          maxzoom: GEOCOLOR_MAX_Z,
          attribution: "GeoColor &copy; NOAA/NASA GIBS",
        });
        map.addLayer({
          id,
          type: "raster",
          source: id,
          layout: { visibility: "none" },
          paint: { "raster-opacity": 0.92, "raster-fade-duration": 0 },
        });
      }

      // Voile de NUIT solaire : l'hémisphère nuit assombri, recalculé chaque
      // minute — sur le globe, les feux brillent côté nuit.
      map.addSource("night", { type: "geojson", data: nightPolygon() });
      map.addLayer({
        id: "night",
        type: "fill",
        source: "night",
        paint: { "fill-color": "#0A1030", "fill-opacity": 0.34, "fill-antialias": false },
      });
      window.setInterval(() => {
        const src = map.getSource("night") as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(nightPolygon());
      }, 60_000);

      // Cônes de propagation estimée (vent seul) : sous les icônes/flammes,
      // au-dessus du fond et du voile de nuit. Trois horizons superposés
      // (1 h / 3 h / 6 h) dont les opacités s'additionnent près du foyer.
      map.addSource("spread", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "spread-fill",
        type: "fill",
        source: "spread",
        minzoom: 6.8,
        paint: {
          "fill-color": "#E8622C",
          "fill-opacity": ["get", "op"] as unknown as maplibregl.ExpressionSpecification,
          "fill-antialias": false,
        },
      });
      map.addLayer({
        id: "spread-line",
        type: "line",
        source: "spread",
        minzoom: 6.8,
        filter: ["==", ["get", "edge"], 1],
        paint: {
          "line-color": "#E8622C",
          "line-opacity": 0.45,
          "line-width": 1.1,
          "line-dasharray": [2, 2],
        },
      });

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
      // Icônes flamme (signalements citoyens) + avions/hélicos.
      for (const [name, [main, core]] of Object.entries(FLAMES)) {
        map.addImage(name, flameImage(main, core));
      }
      map.addImage("plane", planeImage(), { pixelRatio: 2 });
      map.addImage("helo", heloImage(), { pixelRatio: 2 });

      // ---- Le nouveau langage des feux : « la Terre qui brûle » ----------
      // 1) Dézoomé : couche THERMIQUE — les feux sont des lueurs organiques
      //    qui fusionnent naturellement (poids = puissance × fraîcheur),
      //    comme les vraies images nocturnes satellites. S'estompe en fondu
      //    vers les braises individuelles à partir du zoom ~6.
      map.addLayer({
        id: "events-heat",
        type: "heatmap",
        source: "events",
        maxzoom: 7.6,
        paint: {
          // Poids TRÈS discriminé par la puissance réelle (FRP) : les milliers
          // de brûlis agricoles de savane (faible FRP) ne doivent plus peindre
          // l'Afrique en apocalypse — seuls les feux puissants pèsent lourd.
          // Chaque petit feu reste visible individuellement via son étincelle.
          "heatmap-weight": [
            "*",
            ["interpolate", ["linear"], ["get", "frp"], 0, 0.06, 20, 0.15, 60, 0.35, 150, 0.7, 400, 1],
            ["interpolate", ["linear"], ["get", "lastAgeH"], 0, 1, 24, 0.6],
          ] as unknown as maplibregl.ExpressionSpecification,
          // Rayon réduit dézoomé : les petits feux voisins ne fusionnent plus
          // en nappes continentales.
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            2, ["+", 5, ["*", ["get", "radiusKm"], 0.08]],
            4, ["+", 8, ["*", ["get", "radiusKm"], 0.25]],
            6, ["+", 15, ["*", ["get", "radiusKm"], 0.8]],
            7.5, ["+", 24, ["*", ["get", "radiusKm"], 1.5]],
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.75, 7, 1.2],
          // Basses densités = voile ambré discret (brûlis diffus) ; le rouge
          // et le blanc-chaud sont RÉSERVÉS aux fortes concentrations de
          // puissance (vrais incendies majeurs).
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(200,110,50,0)",
            0.12, "rgba(228,140,60,0.4)",
            0.35, "rgba(235,110,45,0.6)",
            0.6, "#E05038",
            0.85, "#FFB347",
            1, "#FFF3C4",
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.85, 6.5, 0],
        },
      });
      // 1bis) Étincelle : un point net et chaud par foyer, toujours visible
      // dézoomé — AUCUN feu ne peut passer inaperçu, même isolé et modeste
      // (retour terrain : l'Europe du Nord devenait invisible).
      map.addLayer({
        id: "events-spark",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 6, 3.6],
          "circle-color": [
            "step", ["get", "lastAgeH"], "#FF7A5C", 12, "#F5A05C", 24, "#BDB5A6",
          ] as unknown as maplibregl.ExpressionSpecification,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4.8, 0.95, 5.6, 0],
          "circle-stroke-color": "rgba(45,22,12,0.55)",
          "circle-stroke-width": 0.9,
        },
      });
      // 2) Aura : halo doux à l'ÉTENDUE RÉELLE du foyer (bbox), respire.
      //    Invisible dézoomé (la thermique règne), fondu entrant vers z6-7.
      map.addLayer({
        id: "events-aura",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": emberRadius(AURA_MULT, AURA_MINS, null),
          "circle-color": AGE_COLOR_EXPR,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4.4, 0, 5.4, 0.15],
          "circle-blur": 1,
        },
      });
      // 3) Cœur : la braise — luminosité selon la puissance (MW).
      map.addLayer({
        id: "events-core",
        type: "circle",
        source: "events",
        paint: {
          "circle-radius": emberRadius(CORE_MULT, CORE_MINS, null),
          "circle-color": AGE_COLOR_EXPR,
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            4.4, 0,
            5.4, ["min", 0.95, ["+", 0.45, ["*", 0.11, ["ln", ["+", ["get", "frp"], 1]]]]],
          ] as unknown as maplibregl.ExpressionSpecification,
          "circle-blur": 0.4,
        },
      });
      // 4) Point d'ignition : cœur blanc-chaud des feux encore vifs (< 12 h).
      map.addLayer({
        id: "events-dot",
        type: "circle",
        source: "events",
        filter: ["<", ["get", "lastAgeH"], 12],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 9, 4.5],
          "circle-color": "#FFEDD2",
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4.6, 0, 5.6, 0.9],
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
          "icon-image": ["case", ["==", ["get", "kind"], "helo"], "helo", "plane"],
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
          const layers = ["events-core", "events-aura", "signals-icons", "reports-icons", "planes-icons"].filter((l) =>
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
      for (const layer of ["events-core", "signals-icons"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      loadData(map, 6);
    });

    return () => {
      ro.disconnect();
      smoke.remove();
      smokeCanvasRef.current = null;
      flameVideo.pause();
      flameVideo.removeAttribute("src");
      flameVideoRef.current = null;
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
    if (!map || !map.getLayer("events-core")) return;
    for (const m of pulseMarkersRef.current) m.remove();
    pulseMarkersRef.current = [];

    // Replay : un foyer n'existe à l'instant T que si sa 1re détection est
    // antérieure — firstAgeMin (âge en minutes au moment du chargement des
    // données) suffit : apparu ⇔ firstAgeMin ≥ (maintenant − T).
    const replayAgeMin = replayOn ? (Date.now() - replayT) / 60000 : null;
    const timeF =
      replayAgeMin === null
        ? null
        : ([">=", ["get", "firstAgeMin"], replayAgeMin] as unknown as maplibregl.FilterSpecification);
    const andTime = (f: maplibregl.FilterSpecification | null): maplibregl.FilterSpecification | null =>
      timeF === null ? f : f === null ? timeF : (["all", f, timeF] as unknown as maplibregl.FilterSpecification);

    if (mode === "departs") {
      const fresh = ["<=", ["get", "firstAgeMin"], DEPART_WATCH_MIN] as unknown as maplibregl.FilterSpecification;
      map.setFilter("events-heat", andTime(fresh));
      map.setFilter("events-aura", andTime(fresh));
      map.setFilter("events-core", andTime(fresh));
      map.setFilter("events-spark", andTime(fresh));
      map.setFilter("events-dot", andTime(["all", fresh, ["<", ["get", "lastAgeH"], 12]] as unknown as maplibregl.FilterSpecification));
      // Un signalement n'est un "départ" que si ses PREMIÈRES mentions sont
      // récentes (newFire) — un feu qui dure fait encore parler de lui.
      map.setFilter(
        "signals-icons",
        replayOn
          ? (["==", ["get", "newFire"], -999] as unknown as maplibregl.FilterSpecification)
          : ["all", ["==", ["get", "newFire"], 1], ["<=", ["get", "firstAgeMin"], DEPART_WATCH_MIN]]
      );

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
      map.setFilter("events-heat", andTime(null));
      map.setFilter("events-aura", andTime(null));
      map.setFilter("events-core", andTime(null));
      map.setFilter("events-spark", andTime(null));
      map.setFilter("events-dot", andTime(["<", ["get", "lastAgeH"], 12] as unknown as maplibregl.FilterSpecification));
      map.setFilter("signals-icons", replayOn ? (["==", ["get", "newFire"], -999] as unknown as maplibregl.FilterSpecification) : null);
    }
  }, [mode, events, signals, replayOn, replayT]);

  // --- Replay : synchronisation carte (imagerie GeoColor + calques) -------
  useEffect(() => {
    replayOnRef.current = replayOn;
    const map = mapRef.current;
    if (!map || !map.getLayer("geocolor-east")) return;
    const vis = replayOn ? "visible" : "none";
    map.setLayoutProperty("geocolor-east", "visibility", vis);
    map.setLayoutProperty("geocolor-west", "visibility", vis);
    if (replayOn) {
      // Borne l'instant demandé à la fraîcheur réelle de GeoColor.
      const t = Math.min(replayT, replayMax);
      for (const [id, gl] of [
        ["geocolor-east", "GOES-East_ABI_GeoColor"],
        ["geocolor-west", "GOES-West_ABI_GeoColor"],
      ] as const) {
        const src = map.getSource(id) as (maplibregl.RasterTileSource & { setTiles?: (t: string[]) => void }) | undefined;
        if (src?.setTiles) src.setTiles([geocolorTiles(gl, t)]);
      }
    }
    // Les Canadair n'ont pas d'historique : masqués pendant le replay.
    if (map.getLayer("planes-icons")) {
      map.setLayoutProperty("planes-icons", "visibility", replayOn ? "none" : "visible");
    }
  }, [replayOn, replayT, replayMax]);

  // Lecture automatique du replay : un pas de 10 min toutes les 600 ms.
  useEffect(() => {
    if (!replayOn || !replayPlaying) return;
    const id = setInterval(() => {
      setReplayT((t) => {
        const next = t + REPLAY_STEP_MS;
        if (next >= replayMax) {
          setReplayPlaying(false);
          return replayMax;
        }
        return next;
      });
    }, 600);
    return () => clearInterval(id);
  }, [replayOn, replayPlaying, replayMax]);

  const openReplay = () => {
    // Le replay a besoin d'un historique riche : force la fenêtre 24 h+.
    if (hours < 24) changeHours(24);
    setReplayT(replayMax - REPLAY_SPAN_MS);
    setReplayOn(true);
    setReplayPlaying(true);
    // Recale la fenêtre sur la dernière imagerie réellement publiée (latence
    // GIBS variable : 1 h à 12 h+). Cache 15 min côté client ET serveur.
    if (Date.now() - replayProbedRef.current > 15 * 60 * 1000) {
      replayProbedRef.current = Date.now();
      fetchGeocolorMax().then((max) => {
        if (max === null) return;
        setReplayMax(max);
        setReplayT(max - REPLAY_SPAN_MS);
        setReplayPlaying(true);
      });
    }
  };
  const closeReplay = () => {
    setReplayOn(false);
    setReplayPlaying(false);
  };

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
          properties: { id: p.id, track: p.track, kind: p.kind },
        };
      }),
    });
  }, []);

  // Plumes de vent : pour les foyers actifs visibles (zoom rapproché), on
  // récupère le vent PAR LOTS (1 appel pour ~30 foyers, caches serveur et
  // client) et on oriente chaque panache sous le vent = direction de
  // propagation probable.
  const updateWindFeathers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const inView = eventsRef.current
      .filter(
        (ev) =>
          hoursAgo(ev.lastSeen) < 24 &&
          ev.centroid[0] >= b.getWest() &&
          ev.centroid[0] <= b.getEast() &&
          ev.centroid[1] >= b.getSouth() &&
          ev.centroid[1] <= b.getNorth()
      )
      .sort((a, x) => x.maxFrp - a.maxFrp);
    // Flammes filmées : à TOUS les zooms (taille proportionnelle), pour les
    // foyers qui brûlent vraiment (< 12 h). Plafond large : dézoomées, elles
    // ne font que quelques pixels.
    videoFiresRef.current = inView
      .filter((ev) => hoursAgo(ev.lastSeen) < 12)
      .slice(0, 150)
      .map((ev) => {
        const w = windCacheRef.current.get(ev.id);
        const ph = phaseOf(ev.id);
        return {
          lon: ev.centroid[0],
          lat: ev.centroid[1],
          frp: ev.maxFrp,
          rot: w ? (w.deg + 180) % 360 : null,
          kmh: w?.kmh ?? 0,
          mirror: Math.floor(ph * 10) % 2 === 1,
          sx: Math.floor(ph * 100) % 3,
        };
      });
    // Vent + fumée : réservés au zoom rapproché (coût API maîtrisé).
    if (map.getZoom() < 4.4) {
      smokeSourcesRef.current = [];
      return;
    }
    // --- Champ de vent RÉEL : grille 5×4 sur la vue (20 points, un appel
    // batché, cache serveur 15 min par cellule). La fumée est advectée par
    // interpolation bilinéaire — elle suit le vrai vent partout.
    {
      const b = map.getBounds();
      const padX = (b.getEast() - b.getWest()) * 0.15;
      const padY = (b.getNorth() - b.getSouth()) * 0.15;
      const west = b.getWest() - padX;
      const east = b.getEast() + padX;
      const south = Math.max(-80, b.getSouth() - padY);
      const north = Math.min(80, b.getNorth() + padY);
      const f = windFieldRef.current;
      const stale = !f || Date.now() - f.at > 15 * 60 * 1000;
      const moved =
        !f ||
        Math.abs(f.west - west) > (east - west) * 0.35 ||
        Math.abs(f.east - east) > (east - west) * 0.35 ||
        Math.abs(f.south - south) > (north - south) * 0.35 ||
        Math.abs(f.north - north) > (north - south) * 0.35;
      if ((stale || moved) && !windFieldBusyRef.current) {
        windFieldBusyRef.current = true;
        const cols = 5;
        const rows = 4;
        const pts: string[] = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lon = west + ((east - west) * c) / (cols - 1);
            const lat = south + ((north - south) * r) / (rows - 1);
            pts.push(`${lat.toFixed(2)},${lon.toFixed(2)}`);
          }
        }
        fetch(`/api/winds?pts=${pts.join(";")}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { winds: ({ deg: number; kmh: number } | null)[] } | null) => {
            if (!j) return;
            const u = new Float32Array(cols * rows);
            const v = new Float32Array(cols * rows);
            const kmh = new Float32Array(cols * rows);
            j.winds.forEach((w, i) => {
              if (!w) return;
              // Direction météo = d'où VIENT le vent ; le flux va à l'opposé.
              const rad = (((w.deg + 180) % 360) * Math.PI) / 180;
              u[i] = Math.sin(rad) * w.kmh;
              v[i] = -Math.cos(rad) * w.kmh;
              kmh[i] = w.kmh;
            });
            windFieldRef.current = { at: Date.now(), west, south, east, north, cols, rows, u, v, kmh };
          })
          .catch(() => {
            /* champ indisponible : la fumée retombe sur le vent par foyer */
          })
          .finally(() => {
            windFieldBusyRef.current = false;
          });
      }
    }
    const windTargets = inView.slice(0, 40);
    const now = Date.now();
    const missing = windTargets.filter((ev) => {
      const w = windCacheRef.current.get(ev.id);
      return !w || now - w.at > 12 * 60 * 1000;
    });
    if (missing.length > 0) {
      try {
        const pts = missing
          .map((ev) => `${ev.centroid[1].toFixed(2)},${ev.centroid[0].toFixed(2)}`)
          .join(";");
        const res = await fetch(`/api/winds?pts=${pts}`);
        if (res.ok) {
          const { winds } = (await res.json()) as { winds: ({ deg: number; kmh: number } | null)[] };
          missing.forEach((ev, i) => {
            const w = winds[i];
            if (w) windCacheRef.current.set(ev.id, { ...w, at: now });
          });
        }
      } catch {
        /* vent indisponible : fumée absente ce tour-ci */
      }
    }
    // Les sources de fumée du simulateur de particules.
    smokeSourcesRef.current = windTargets.flatMap((ev) => {
      const w = windCacheRef.current.get(ev.id);
      // Vent quasi nul : pas de panache directionnel à montrer.
      if (!w || w.kmh < 3) return [];
      return [
        {
          id: ev.id,
          lon: ev.centroid[0],
          lat: ev.centroid[1],
          // Météo = direction d'OÙ vient le vent ; la fumée part à l'opposé.
          rot: (w.deg + 180) % 360,
          kmh: w.kmh,
          frp: ev.maxFrp,
        },
      ];
    });
  }, []);

  // Vent interpolé (bilinéaire) au point demandé — null hors grille/sans champ.
  const sampleWind = useCallback((lon: number, lat: number): { u: number; v: number; kmh: number } | null => {
    const f = windFieldRef.current;
    if (!f) return null;
    const fx = ((lon - f.west) / (f.east - f.west)) * (f.cols - 1);
    const fy = ((lat - f.south) / (f.north - f.south)) * (f.rows - 1);
    if (fx < 0 || fy < 0 || fx > f.cols - 1 || fy > f.rows - 1) return null;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(f.cols - 1, x0 + 1);
    const y1 = Math.min(f.rows - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const at = (arr: Float32Array) => {
      const a = arr[y0 * f.cols + x0];
      const b = arr[y0 * f.cols + x1];
      const c = arr[y1 * f.cols + x0];
      const d = arr[y1 * f.cols + x1];
      return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    };
    return { u: at(f.u), v: at(f.v), kmh: at(f.kmh) };
  }, []);

  // Cônes de propagation estimée (vent seul) : recalculés une fois les vents
  // à jour. Réservés aux foyers significatifs et frais, zoom rapproché, hors
  // replay/intro — et TOUJOURS étiquetés « indicatif » (légende + fiche).
  const updateSpreadCones = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("spread") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    if (map.getZoom() < 6.8 || replayOnRef.current || introActiveRef.current) {
      src.setData(empty);
      return;
    }
    const b = map.getBounds();
    const now = Date.now();
    // Grand horizon d'abord : les petits cônes se superposent par-dessus et
    // leurs opacités s'additionnent près du foyer.
    const HORIZONS: [number, number, number][] = [
      [360, 0.05, 1],
      [180, 0.09, 0],
      [60, 0.15, 0],
    ];
    const feats: GeoJSON.Feature[] = [];
    let n = 0;
    for (const ev of eventsRef.current) {
      if (n >= 60) break;
      const [lon, lat] = ev.centroid;
      if (lon < b.getWest() || lon > b.getEast() || lat < b.getSouth() || lat > b.getNorth()) continue;
      if (now - Date.parse(ev.lastSeen) > 6 * 3600 * 1000) continue;
      if (!(ev.maxFrp >= 30 || ev.count >= 8 || ev.confidence === "corrobore")) continue;
      const w = windCacheRef.current.get(ev.id);
      let degTo: number | null = null;
      let kmh = 0;
      if (w) {
        degTo = (w.deg + 180) % 360;
        kmh = w.kmh;
      } else {
        const g = sampleWind(lon, lat);
        if (g) {
          degTo = ((Math.atan2(g.u, -g.v) * 180) / Math.PI + 360) % 360;
          kmh = g.kmh;
        }
      }
      if (degTo === null || kmh < 2) continue;
      n++;
      for (const [minutes, op, edge] of HORIZONS) {
        feats.push({
          type: "Feature",
          properties: { op, edge },
          geometry: { type: "Polygon", coordinates: [spreadRing(lon, lat, degTo, kmh, minutes)] },
        });
      }
    }
    src.setData(feats.length > 0 ? { type: "FeatureCollection", features: feats } : empty);
  }, [sampleWind]);

  // Recalcule les plumes quand la vue ou les foyers changent (anti-rafale 700 ms).
  useEffect(() => {
    if (windTimerRef.current) clearTimeout(windTimerRef.current);
    windTimerRef.current = setTimeout(() => {
      updateWindFeathers().then(updateSpreadCones);
    }, 700);
    return () => {
      if (windTimerRef.current) clearTimeout(windTimerRef.current);
    };
  }, [viewBounds, events, updateWindFeathers, updateSpreadCones]);

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
      if (map && map.getLayer("events-core")) {
        const t = performance.now() / 1000;
        try {
          // Respiration organique : chaque braise gonfle/dégonfle lentement,
          // déphasée par foyer (jamais métronome).
          map.setPaintProperty("events-core", "circle-radius", emberRadius(CORE_MULT, CORE_MINS, t));
          map.setPaintProperty("events-aura", "circle-opacity", [
            "interpolate", ["linear"], ["zoom"],
            4.4, 0,
            5.4, ["+", 0.11, ["*", 0.05, ["sin", ["+", t * 0.8, ["get", "phase"]]]]],
          ]);
          // La nappe thermique « couve » doucement (respiration globale lente).
          map.setPaintProperty("events-heat", "heatmap-opacity", [
            "interpolate", ["linear"], ["zoom"],
            5, 0.8 + 0.07 * Math.sin(t * 0.55),
            6.5, 0,
          ]);
        } catch {
          /* couches pas prêtes : on réessaie à la frame suivante */
        }
      }

      // --- FUMÉE VIVANTE : simulation de particules --------------------
      // Chaque foyer venté émet des bouffées sombres qui dérivent sous le
      // vent, enflent et se dissipent : la direction de propagation se lit
      // par le MOUVEMENT (aucune flèche nécessaire).
      const smoke = smokeCanvasRef.current;
      if (map && smoke) {
        const nowMs = performance.now();
        const dt = Math.min(0.1, (nowMs - lastSimRef.current) / 1000) || 0.016;
        lastSimRef.current = nowMs;
        const ctx = smoke.getContext("2d");
        if (ctx) {
          // Resynchronisation du buffer À CHAQUE FRAME : zoom navigateur,
          // redimensionnement ou course avec l'observer ne peuvent plus
          // désaligner le calque (les positions viennent de map.project en
          // pixels CSS — le buffer doit suivre exactement).
          const dpr = window.devicePixelRatio || 1;
          const host = containerRef.current;
          if (host) {
            const bw = Math.round(host.clientWidth * dpr);
            const bh = Math.round(host.clientHeight * dpr);
            if (smoke.width !== bw || smoke.height !== bh) {
              smoke.width = bw;
              smoke.height = bh;
            }
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, smoke.width / dpr, smoke.height / dpr);
          const z = map.getZoom();
          const parts = smokePartsRef.current;


          if (z >= 4.6 && !replayOnRef.current && !introActiveRef.current) {
            const zs = Math.min(3, Math.max(0.5, 2 ** (z - 7)));
            // Émission (cadence accélérée pour les feux puissants). Direction
            // initiale : champ de vent réel au foyer, sinon vent du foyer.
            for (const s of smokeSourcesRef.current) {
              const interval = s.frp > 80 ? 180 : 320;
              const last = smokeSpawnRef.current.get(s.id) ?? 0;
              if (nowMs - last < interval) continue;
              smokeSpawnRef.current.set(s.id, nowMs);
              const p = map.project([s.lon, s.lat]);
              const fw = sampleWind(s.lon, s.lat);
              const kmh = fw ? fw.kmh : s.kmh;
              const spd = Math.min(100, (12 + kmh * 0.6) * zs);
              let vx: number;
              let vy: number;
              if (fw && fw.kmh > 0.5) {
                const n = Math.hypot(fw.u, fw.v) || 1;
                vx = (fw.u / n) * spd;
                vy = (fw.v / n) * spd;
              } else {
                const rad = (s.rot * Math.PI) / 180;
                vx = Math.sin(rad) * spd;
                vy = -Math.cos(rad) * spd;
              }
              parts.push({
                x: p.x + (Math.random() - 0.5) * 5,
                y: p.y + (Math.random() - 0.5) * 5,
                vx,
                vy,
                born: nowMs,
                life: 2400 + Math.random() * 1600,
                s0: (9 + Math.min(16, s.frp * 0.05)) * zs,
                w: Math.random() * 6.28,
              });
            }
            if (parts.length > 900) parts.splice(0, parts.length - 900);
            // Advection + rendu (sprite pré-rendu : quasi gratuit). Chaque
            // particule RÉ-ÉCHANTILLONNE le champ à sa position : la fumée
            // s'incurve en traversant des vents différents — vent réel.
            const sprite =
              smokeSpriteRef.current ?? (smokeSpriteRef.current = smokePuffSprite());
            for (let i = parts.length - 1; i >= 0; i--) {
              const pt = parts[i];
              const age = (nowMs - pt.born) / pt.life;
              if (age >= 1) {
                parts.splice(i, 1);
                continue;
              }
              if (windFieldRef.current) {
                const g = map.unproject([pt.x, pt.y]);
                const fw2 = sampleWind(g.lng, g.lat);
                if (fw2 && fw2.kmh > 0.5) {
                  const spd2 = Math.min(100, (12 + fw2.kmh * 0.6) * zs);
                  const n2 = Math.hypot(fw2.u, fw2.v) || 1;
                  // Lissage 15 %/frame : virage fluide, pas de zigzag.
                  pt.vx += ((fw2.u / n2) * spd2 - pt.vx) * 0.15;
                  pt.vy += ((fw2.v / n2) * spd2 - pt.vy) * 0.15;
                }
              }
              pt.x += pt.vx * dt;
              pt.y += pt.vy * dt;
              const size = pt.s0 * (1 + 4.2 * age);
              const wobble = Math.sin(nowMs / 500 + pt.w) * size * 0.08;
              ctx.globalAlpha = 0.72 * (1 - age) ** 1.25;
              ctx.drawImage(sprite, pt.x - size / 2 + wobble, pt.y - size / 2, size, size);
            }
            ctx.globalAlpha = 1;
          } else if (parts.length > 0) {
            parts.length = 0;
          }

          // --- VRAI FEU FILMÉ, à TOUS les zooms -------------------------
          // 1) Détourage par luminance (1 fois par frame, partagé) : le fond
          //    noir devient VRAIE transparence, les bords sont fondus par le
          //    masque — plus jamais de carré visible.
          // 2) Dessin : taille proportionnelle au zoom et à l'intensité,
          //    inclinaison synchronisée avec le vent.
          const video = flameVideoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && videoFiresRef.current.length > 0 && !replayOnRef.current && !introActiveRef.current) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            let kc = keyCanvasRef.current;
            if (!kc) {
              kc = document.createElement("canvas");
              kc.width = vw;
              kc.height = vh;
              keyCanvasRef.current = kc;
            }
            const kctx = kc.getContext("2d", { willReadFrequently: true });
            if (kctx) {
              kctx.drawImage(video, 0, 0);
              const img = kctx.getImageData(0, 0, vw, vh);
              const d = img.data;
              let mask = keyMaskRef.current;
              if (!mask || mask.length !== vw * vh) {
                mask = buildEdgeMask(vw, vh);
                keyMaskRef.current = mask;
              }
              for (let i = 0, j = 0; i < d.length; i += 4, j++) {
                const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                // Seuils durs : l'ambiance rouge sombre du tournage disparaît,
                // seules la flamme vive et les braises chaudes subsistent.
                const a = l <= 36 ? 0 : l >= 110 ? 255 : ((l - 36) * 255) / 74;
                d[i + 3] = a * mask[j];
              }
              kctx.putImageData(img, 0, 0);

              const cw = smoke.width / dpr;
              const ch = smoke.height / dpr;
              // Échelle continue : petite au zoom monde, imposante zoomée.
              const zs2 = Math.min(5, Math.max(0.16, 2 ** (z - 8)));
              // Fenêtre source légèrement décalée par foyer : pas de clones.
              const sw = vw * 0.92;
              // Vue GLOBE : les billboards canvas ne sont pas occultés par la
              // sphère — on saute les foyers au-delà de l'horizon (~80° du
              // centre), sinon leurs flammes « transpercent » l'océan.
              const globeView = z < 3.2;
              const cLL = globeView ? map.getCenter() : null;
              const RAD = Math.PI / 180;
              for (const f of videoFiresRef.current) {
                if (cLL) {
                  const cosD =
                    Math.sin(cLL.lat * RAD) * Math.sin(f.lat * RAD) +
                    Math.cos(cLL.lat * RAD) * Math.cos(f.lat * RAD) * Math.cos((f.lon - cLL.lng) * RAD);
                  if (cosD < 0.17) continue; // > ~80° : derrière l'horizon
                }
                const p = map.project([f.lon, f.lat]);
                if (p.x < -110 || p.y < -110 || p.x > cw + 110 || p.y > ch + 110) continue;
                // Taille fortement PROPORTIONNELLE à la puissance du feu :
                // petit départ = flamme discrète, brasier = flamme dominante.
                const hh = (31 + 23 * Math.log(f.frp + 1)) * zs2;
                if (hh < 4) continue;
                const ww = hh * (sw / vh) * 1.25; // aspect naturel, élargi de 25 %
                const sxo = f.sx * vw * 0.04;
                ctx.save();
                ctx.translate(p.x, p.y);
                if (f.rot != null) {
                  // Synchronisée avec le vent : penche franchement sous le vent.
                  const rad = (f.rot * Math.PI) / 180;
                  ctx.rotate(Math.min(0.5, f.kmh * 0.012) * Math.sin(rad));
                }
                if (f.mirror) ctx.scale(-1, 1);
                ctx.globalAlpha = 0.95;
                ctx.drawImage(kc, sxo, 0, sw, vh, -ww / 2, -hh * 0.94, ww, hh);
                ctx.restore();
              }
              ctx.globalAlpha = 1;
            }
          }

          // --- FLÈCHES DE VENT : chevrons clairs au-dessus de la fumée ---
          // Trois chevrons fins alignés sous le vent ; une vague d'opacité
          // les parcourt vers l'extérieur — le flux se lit sans encombrer.
          if (z >= 4.6 && smokeSourcesRef.current.length > 0 && !replayOnRef.current && !introActiveRef.current) {
            const zs3 = Math.min(3, Math.max(0.5, 2 ** (z - 7)));
            const tSec = nowMs / 1000;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (const s of smokeSourcesRef.current) {
              const p = map.project([s.lon, s.lat]);
              const rad = (s.rot * Math.PI) / 180;
              const size = Math.min(4.5, Math.max(1.8, 2.2 * zs3));
              const d0 = 18 * zs3;
              const gap = 9 * zs3;
              for (let i2 = 0; i2 < 3; i2++) {
                const d = d0 + i2 * gap;
                const ax = p.x + Math.sin(rad) * d;
                const ay = p.y - Math.cos(rad) * d;
                const wave = 0.5 + 0.5 * Math.sin(tSec * 2.6 - i2 * 1.1 + s.rot * 0.01);
                const a = 0.2 + 0.6 * wave * wave;
                ctx.save();
                ctx.translate(ax, ay);
                ctx.rotate(rad);
                ctx.beginPath();
                ctx.moveTo(-size, size * 0.7);
                ctx.lineTo(0, -size * 0.5);
                ctx.lineTo(size, size * 0.7);
                // Liseré sombre (lisible même hors fumée), puis trait clair.
                ctx.strokeStyle = `rgba(40,30,24,${(a * 0.45).toFixed(3)})`;
                ctx.lineWidth = 2.2;
                ctx.stroke();
                ctx.strokeStyle = `rgba(255,248,238,${a.toFixed(3)})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();
              }
            }
          }
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
          {REPLAY_ENABLED && (
            <button
              onClick={() => (replayOn ? closeReplay() : openReplay())}
              className={chip}
              title={lang === "fr" ? "Rejouer les dernières 24 h (feux + imagerie satellite)" : "Replay the last 24 h (fires + satellite imagery)"}
              style={
                replayOn
                  ? { background: "var(--charcoal)", color: "var(--canary)", boxShadow: "var(--shadow-s)" }
                  : { background: "var(--white)", color: "var(--ink-2)", boxShadow: "var(--shadow-s)" }
              }
            >
              ⏪ Replay
            </button>
          )}
          <button
            onClick={reportFire}
            disabled={reportBusy}
            className={`${chip} hidden sm:flex`}
            style={{ background: "var(--ember)", color: "#fff", boxShadow: "var(--shadow-s)" }}
          >
            {reportBusy ? "…" : `🔥 ${t.reportBtn}`}
          </button>
        </div>

        {/* Barre de replay : scrubber 24 h + lecture. L'imagerie GOES GeoColor
            (10 min) s'anime sous les détections qui apparaissent dans l'ordre
            réel — le « magnétoscope » de la journée. */}
        {REPLAY_ENABLED && replayOn && (
          <div
            className="fixed inset-x-0 bottom-[70px] z-30 mx-auto flex w-[min(560px,92vw)] items-center gap-3 rounded-[22px] px-4 py-3"
            style={{ background: "rgba(20,20,24,0.88)", backdropFilter: "blur(8px)", boxShadow: "var(--shadow-m)" }}
          >
            <button
              onClick={() => setReplayPlaying((p) => !p)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px]"
              style={{ background: "var(--canary)", color: "var(--charcoal)" }}
              aria-label={replayPlaying ? "Pause" : "Lecture"}
            >
              {replayPlaying ? "⏸" : "▶"}
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between text-[12px]" style={{ color: "#E8D9B0" }}>
                <span className="font-bold" style={{ color: "#FBF9F4" }}>
                  {new Date(Math.floor(replayT / REPLAY_STEP_MS) * REPLAY_STEP_MS).toLocaleString(
                    lang === "fr" ? "fr-FR" : "en-GB",
                    { weekday: "short", hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
                <span>{lang === "fr" ? "imagerie GOES · feux réels" : "GOES imagery · real detections"}</span>
              </div>
              <input
                type="range"
                min={replayMax - REPLAY_SPAN_MS}
                max={replayMax}
                step={REPLAY_STEP_MS}
                value={Math.min(replayT, replayMax)}
                onChange={(e) => {
                  setReplayPlaying(false);
                  setReplayT(Number(e.target.value));
                }}
                className="w-full accent-[var(--canary)]"
                aria-label="Position temporelle"
              />
            </div>
            <button
              onClick={closeReplay}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px]"
              style={{ background: "rgba(255,255,255,0.14)", color: "#FBF9F4" }}
              aria-label={lang === "fr" ? "Fermer le replay" : "Close replay"}
            >
              ✕
            </button>
          </div>
        )}

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
                className="inline-block h-[11px] w-[11px] shrink-0 rounded-[3px]"
                style={{ background: "#E8622C", opacity: 0.35 }}
              />
              {t.legendSpread}
            </span>
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
            {/* Propagation estimée (vent seul) : même modèle que les cônes de
                la carte, toujours accompagné de la mention « indicatif ». */}
            {wind && wind.speed >= 2 && hoursAgo(selected.lastSeen) < 6 && (
              <span className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-3)" }}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#E8622C", opacity: 0.55 }} />
                {t.spreadLine(
                  Math.round(Math.min(15, ((6 + 1.7 * wind.speed) * 180) / 1000) * 10) / 10,
                  compass((wind.direction + 180) % 360)
                )}
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
