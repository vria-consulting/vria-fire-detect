// Niveau 2 — API & INVARIANTS : chaque endpoint de l'app est appelé et chaque
// objet retourné est vérifié champ par champ (cohérence interne des foyers et
// des signalements, périodes, validation d'entrée, pages, icônes, manifest).

import { check, fetchT, hoursAgo, type QaOptions, type EventsPayload, type SignalsPayload } from "./util";
import { normalizePlace } from "../../src/lib/geoparse";

const L = "2-api";

// Réutilisé par le niveau 3/4 : mémorise les payloads déjà chargés.
export const cache: { events: Map<number, EventsPayload>; signals?: SignalsPayload } = {
  events: new Map(),
};

export async function getEvents(target: string, hours: number): Promise<EventsPayload> {
  const hit = cache.events.get(hours);
  if (hit) return hit;
  const res = await fetchT(`${target}/api/events?hours=${hours}`, 180_000);
  if (!res.ok) throw new Error(`/api/events?hours=${hours} → HTTP ${res.status}`);
  const data = (await res.json()) as EventsPayload;
  cache.events.set(hours, data);
  return data;
}

export async function getSignals(target: string): Promise<SignalsPayload> {
  if (cache.signals) return cache.signals;
  const res = await fetchT(`${target}/api/signals`, 120_000);
  if (!res.ok) throw new Error(`/api/signals → HTTP ${res.status}`);
  cache.signals = (await res.json()) as SignalsPayload;
  return cache.signals;
}

export async function runEndpoints(opts: QaOptions): Promise<void> {
  const t = opts.target;

  // ---- Pages et assets -------------------------------------------------------
  await check(L, "Page d'accueil", async () => {
    const res = await fetchT(`${t}/`, 30_000);
    const html = await res.text();
    if (!res.ok) return { verdict: "FAIL", detail: `HTTP ${res.status}` };
    if (!html.includes("kanari")) return { verdict: "FAIL", detail: "la page ne contient pas « kanari »" };
    return { verdict: "PASS" };
  });

  await check(L, "Page À propos", async () => {
    const res = await fetchT(`${t}/a-propos`, 30_000);
    const html = await res.text();
    if (!res.ok || !html.includes("112")) return { verdict: "FAIL", detail: `HTTP ${res.status}` };
    return { verdict: "PASS" };
  });

  await check(L, "Manifest PWA + icônes", async () => {
    const man = await fetchT(`${t}/manifest.webmanifest`, 20_000);
    if (!man.ok) return { verdict: "FAIL", detail: `manifest HTTP ${man.status}` };
    const j = (await man.json()) as { icons?: { src: string }[] };
    for (const icon of j.icons ?? []) {
      const r = await fetchT(`${t}${icon.src}`, 20_000);
      if (!r.ok) return { verdict: "FAIL", detail: `icône ${icon.src} HTTP ${r.status}` };
    }
    const sw = await fetchT(`${t}/sw.js`, 20_000);
    if (!sw.ok) return { verdict: "FAIL", detail: "service worker sw.js introuvable" };
    return { verdict: "PASS", detail: `${j.icons?.length ?? 0} icônes + sw.js OK` };
  });

  // ---- /api/events : chaque période, invariants par foyer ---------------------
  for (const hours of [6, 24, 72]) {
    await check(L, `/api/events?hours=${hours} invariants`, async () => {
      const data = await getEvents(t, hours);
      if (data.meta.hours !== hours) {
        return { verdict: "FAIL", detail: `meta.hours=${data.meta.hours} ≠ ${hours}` };
      }
      const problems: string[] = [];
      const slackH = 0.4; // tolérance cache (TTL 2 min) + arrondi acquisition
      for (const ev of data.events) {
        const errs: string[] = [];
        if (Date.parse(ev.firstSeen) > Date.parse(ev.lastSeen)) errs.push("firstSeen > lastSeen");
        if (hoursAgo(ev.lastSeen) > hours + slackH) {
          errs.push(`lastSeen hors fenêtre (${hoursAgo(ev.lastSeen).toFixed(1)} h)`);
        }
        if (ev.count !== ev.viirsCount + ev.goesCount + ev.mtgCount) {
          errs.push(`count=${ev.count} ≠ viirs+goes+mtg=${ev.viirsCount + ev.goesCount + ev.mtgCount}`);
        }
        if (ev.count < 1) errs.push("count < 1");
        if (!(ev.maxFrp >= 0)) errs.push("maxFrp invalide");
        if (ev.confidence && !["possible", "probable", "corrobore"].includes(ev.confidence)) {
          errs.push(`confidence=${ev.confidence}`);
        }
        const [lon, lat] = ev.centroid;
        if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) errs.push("centroïde hors limites");
        if (ev.social) {
          if (ev.social.postCount < 1 || ev.social.posts.length === 0) errs.push("corroboration vide");
          if (!ev.social.place) errs.push("corroboration sans lieu");
          if (ev.confidence !== "corrobore") errs.push("social présent mais confiance ≠ corroboré");
          // Cas Montereau/Fontainebleau : un témoignage attaché doit rester
          // dans le rayon de corroboration (30 km). Champ absent toléré tant
          // qu'un snapshot antérieur au correctif peut encore être servi.
          const km = (ev.social as { distanceKm?: number }).distanceKm;
          if (km !== undefined && (km < 0 || km > 30)) errs.push(`distanceKm=${km} (rayon 30 max)`);
        }
        if (errs.length > 0) problems.push(`${ev.id} : ${errs.join(", ")}`);
      }
      if (problems.length > 0) {
        return {
          verdict: "FAIL",
          detail: `${problems.length}/${data.events.length} foyers incohérents — ex : ${problems[0]}`,
        };
      }
      return { verdict: "PASS", detail: `${data.events.length} foyers, ${data.meta.totalDetections.toLocaleString("fr-FR")} détections, tous cohérents` };
    });
  }

  await check(L, "Monotonie des périodes (6 h ⊆ 24 h ⊆ 72 h)", async () => {
    const [e6, e24, e72] = [cache.events.get(6)!, cache.events.get(24)!, cache.events.get(72)!];
    if (!e6 || !e24 || !e72) return { verdict: "SKIP", detail: "payloads manquants" };
    if (e6.meta.totalDetections > e24.meta.totalDetections || e24.meta.totalDetections > e72.meta.totalDetections) {
      return {
        verdict: "WARN",
        detail: `détections 6h=${e6.meta.totalDetections} 24h=${e24.meta.totalDetections} 72h=${e72.meta.totalDetections} (léger jitter de cache toléré)`,
      };
    }
    return { verdict: "PASS", detail: `${e6.meta.totalDetections} ≤ ${e24.meta.totalDetections} ≤ ${e72.meta.totalDetections}` };
  });

  await check(L, "/api/events validation d'entrée", async () => {
    // Choix produit : une valeur invalide est CLAMPÉE sur 24 h (dégradation
    // gracieuse) — l'important est qu'elle ne produise jamais une fenêtre
    // invalide ni une erreur serveur.
    const res = await fetchT(`${t}/api/events?hours=999`, 120_000);
    if (res.status >= 400 && res.status < 500) return { verdict: "PASS", detail: `hours=999 → ${res.status}` };
    if (res.ok) {
      const j = (await res.json()) as EventsPayload;
      if ([6, 12, 24, 48, 72].includes(j.meta.hours)) {
        return { verdict: "PASS", detail: `hours=999 clampé sur ${j.meta.hours} h` };
      }
      return { verdict: "FAIL", detail: `hours=999 a produit meta.hours=${j.meta.hours}` };
    }
    return { verdict: "FAIL", detail: `hours=999 → HTTP ${res.status}` };
  });

  // ---- /api/signals : invariants par signalement -------------------------------
  await check(L, "/api/signals invariants", async () => {
    const data = await getSignals(t);
    const problems: string[] = [];
    for (const s of data.signals) {
      const errs: string[] = [];
      if (s.posts.length === 0) errs.push("aucun post");
      if (s.postCount < s.posts.length) errs.push(`postCount=${s.postCount} < posts=${s.posts.length}`);
      if (s.postCount <= 5 && s.postCount !== s.posts.length) {
        errs.push(`postCount=${s.postCount} ≠ posts=${s.posts.length} (sous le plafond de 5)`);
      }
      if (Date.parse(s.firstPost) > Date.parse(s.lastPost)) errs.push("firstPost > lastPost");
      const urls = s.posts.map((p) => p.url);
      if (new Set(urls).size !== urls.length) errs.push("posts dupliqués (même URL)");
      for (const p of s.posts) {
        const at = Date.parse(p.createdAt);
        if (at < Date.parse(s.firstPost) - 60_000) errs.push(`post antérieur à firstPost (${p.url})`);
        if (at > Date.parse(s.lastPost) + 60_000) errs.push(`post postérieur à lastPost (${p.url})`);
        // Invariant produit : le lieu ancré doit apparaître dans le texte.
        const txt = normalizePlace(p.text).replace(/\s+/g, " ");
        if (!txt.includes(normalizePlace(s.place))) {
          errs.push(`« ${s.place} » absent du texte du post ${p.url}`);
        }
      }
      if (!/^[a-z]{2}$/i.test(s.countryCode)) errs.push(`countryCode=${s.countryCode}`);
      if (!(s.lon >= -180 && s.lon <= 180 && s.lat >= -90 && s.lat <= 90)) errs.push("coordonnées invalides");
      if (errs.length > 0) problems.push(`${s.place} (${s.countryCode}) : ${errs.join(" ; ")}`);
    }
    const badStatus = data.meta.statuses.filter((x) => x >= 400 || x === 0);
    // Un 5xx isolé sur 16 requêtes est un aléa Bluesky rattrapé au scan
    // suivant (3 min) : WARN. Plusieurs échecs = vraie dégradation : FAIL.
    if (badStatus.length > 1) problems.push(`${badStatus.length}/16 requêtes Bluesky en échec`);
    if (problems.length > 0) {
      return { verdict: "FAIL", detail: problems.slice(0, 3).join(" | ") };
    }
    if (badStatus.length === 1) {
      return {
        verdict: "WARN",
        detail: `${data.signals.length} signalements cohérents · 1/16 requête Bluesky en échec transitoire (${badStatus[0]})`,
      };
    }
    return { verdict: "PASS", detail: `${data.signals.length} signalements, ${data.meta.scannedPosts} posts scannés, tous cohérents` };
  });

  // ---- /api/social : recherche manuelle de témoins ------------------------------
  await check(L, "/api/social recherche de témoins", async () => {
    const res = await fetchT(`${t}/api/social?lat=41.9&lon=12.5`, 60_000);
    if (!res.ok) return { verdict: "FAIL", detail: `HTTP ${res.status}` };
    const j = (await res.json()) as { posts?: unknown[]; place?: string | null };
    if (!Array.isArray(j.posts)) return { verdict: "FAIL", detail: "réponse sans tableau posts" };
    return { verdict: "PASS", detail: `${j.posts.length} témoignage(s) autour de Rome, lieu=${j.place ?? "—"}` };
  });

  // ---- Lien profond des notifications --------------------------------------------
  await check(L, "Lien profond /?lat&lon&z&ev", async () => {
    const res = await fetchT(`${t}/?lat=43.3&lon=5.4&z=9&ev=test`, 30_000);
    const html = await res.text();
    if (!res.ok || !html.includes("kanari")) return { verdict: "FAIL", detail: `HTTP ${res.status}` };
    return { verdict: "PASS", detail: "la page accepte les paramètres de lien profond" };
  });

  // ---- Endpoints protégés / validation -----------------------------------------
  await check(L, "/api/cron/check protégé", async () => {
    const res = await fetchT(`${t}/api/cron/check`, 20_000);
    if (res.status === 403) return { verdict: "PASS", detail: "refus sans secret (403)" };
    return { verdict: "FAIL", detail: `attendu 403, reçu ${res.status}` };
  });

  await check(L, "/api/subscribe validation", async () => {
    const res = await fetchT(`${t}/api/subscribe`, 20_000, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mauvais: "corps" }),
    });
    if (res.status >= 400 && res.status < 500) return { verdict: "PASS", detail: `corps invalide → ${res.status}` };
    return { verdict: "FAIL", detail: `corps invalide accepté (HTTP ${res.status})` };
  });
}
