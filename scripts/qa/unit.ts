// Niveau 0 — TESTS UNITAIRES « GOLDEN » : chaque bug corrigé par le passé
// devient un test permanent. Purement local (aucun réseau) : géoparsing,
// clustering, calcul de couverture FIRMS, invariant lieu-dans-texte.

import { check } from "./util";
import { extractPlaces, countPlaceNames, normalizePlace } from "../../src/lib/geoparse";
import { clusterFires } from "../../src/lib/cluster";
import { daysNeeded, attachSignals } from "../../src/lib/eventscache";
import { parseCsv, type FireFeature } from "../../src/lib/firms";
import { emergencyNumber } from "../../src/lib/i18n";
import type { SocialSignal } from "../../src/lib/socialscan";

const L = "0-unité";

function feature(
  lat: number,
  lon: number,
  acqIso: string,
  src: "viirs" | "goes" | "mtg" = "viirs",
  frp = 10
): FireFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { frp, conf: "n", sat: "N20", acq: acqIso, dn: "N", src },
  };
}

export async function runUnit(): Promise<void> {
  // ---- Géoparsing : cas réels issus des bugs passés --------------------------
  await check(L, "Géoparsing : Épouville (texte réel)", async () => {
    const places = extractPlaces(
      "Feu en plein centre d'Épouville, tout près d'une résidence pour seniors : une quinzaine de pompiers mobilisés."
    );
    const ep = places.find((p) => p.key === "epouville");
    if (!ep) return { verdict: "FAIL", detail: "Épouville non extrait" };
    if (ep.entry[2] !== "FR") return { verdict: "FAIL", detail: `pays=${ep.entry[2]}` };
    return { verdict: "PASS" };
  });

  await check(L, "Géoparsing : anti-mélange Paris/Épouville", async () => {
    // Le post du feu d'appartement parisien qui s'était retrouvé sous Épouville.
    const places = extractPlaces(
      "Paris : un violent incendie se déclare dans un appartement du 17e arrondissement\n\nUn incendie s'est déclaré ce jeudi dans un appartement situé au 2e étage d'un immeuble de…"
    );
    if (places.some((p) => p.key === "epouville")) {
      return { verdict: "FAIL", detail: "Épouville extrait d'un texte parisien" };
    }
    if (!places.some((p) => p.key === "paris" && p.entry[2] === "FR")) {
      return { verdict: "FAIL", detail: "Paris (FR) manquant" };
    }
    return { verdict: "PASS" };
  });

  await check(L, "Géoparsing : homonymes multi-pays (Guadalajara, León)", async () => {
    const g = extractPlaces("Incendio forestal en Guadalajara").filter((p) => p.key === "guadalajara");
    const gCountries = new Set(g.map((p) => p.entry[2]));
    if (!gCountries.has("ES") || !gCountries.has("MX")) {
      return { verdict: "FAIL", detail: `Guadalajara : pays ${[...gCountries].join(",")} (ES+MX attendus)` };
    }
    // « leon » avait été retiré par erreur du gazetteer (León ES invisible).
    const l = extractPlaces("Incendio cerca de León esta noche").filter((p) => p.key === "leon");
    if (!l.some((p) => p.entry[2] === "ES")) {
      return { verdict: "FAIL", detail: "León (ES) absent du gazetteer" };
    }
    return { verdict: "PASS", detail: `Guadalajara ×${g.length}, León ×${l.length}` };
  });

  await check(L, "Géoparsing : garde « revue de presse » (4+ lieux)", async () => {
    const n = countPlaceNames(
      "Incendies : le point à Marseille, Toulouse, Bordeaux, Lyon et Nice ce soir"
    );
    if (n < 4) return { verdict: "FAIL", detail: `${n} lieux distincts comptés (≥ 4 attendus)` };
    return { verdict: "PASS", detail: `${n} lieux distincts — un tel post serait écarté` };
  });

  await check(L, "Invariant lieu-dans-texte (normalisation)", async () => {
    const txt = normalizePlace("Grosse fumée au-dessus d'Épouville ce matin").replace(/\s+/g, " ");
    if (!txt.includes(normalizePlace("Épouville"))) {
      return { verdict: "FAIL", detail: "accents/casse mal normalisés" };
    }
    const txt2 = normalizePlace("Feu vers New\nYork City").replace(/\s+/g, " ");
    if (!txt2.includes("new york city")) {
      return { verdict: "FAIL", detail: "espaces multiples/retours à la ligne mal normalisés" };
    }
    return { verdict: "PASS" };
  });

  // ---- Clustering satellite ---------------------------------------------------
  await check(L, "Clustering : fusion proche / séparation lointaine", async () => {
    const t0 = "2026-07-17T06:00:00Z";
    const t1 = "2026-07-17T08:30:00Z";
    const events = clusterFires([
      feature(42.0, 3.0, t0, "viirs", 12),
      feature(42.02, 3.02, t1, "goes", 30), // ~2,5 km : même foyer
      feature(45.0, 6.0, t0, "viirs", 5), // ~350 km : autre foyer
    ]);
    if (events.length !== 2) return { verdict: "FAIL", detail: `${events.length} foyers (2 attendus)` };
    const big = events.find((e) => e.count === 2);
    if (!big) return { verdict: "FAIL", detail: "les détections proches n'ont pas fusionné" };
    const errs: string[] = [];
    if (big.viirsCount !== 1 || big.goesCount !== 1) errs.push("répartition des sources fausse");
    if (big.firstSeen !== t0 || big.lastSeen !== t1) errs.push("firstSeen/lastSeen faux");
    if (big.maxFrp !== 30) errs.push(`maxFrp=${big.maxFrp}`);
    if (errs.length > 0) return { verdict: "FAIL", detail: errs.join(" ; ") };
    return { verdict: "PASS", detail: "fusion, sources, horaires et FRP corrects" };
  });

  // ---- Parsing FIRMS : composite géostationnaire (bug « carte vide » 19/07) ----
  await check(L, "parseCsv : confiances hétérogènes du composite GOES", async () => {
    const header =
      "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
    const csv = [
      header,
      // Met12 (MTG) : confiance en FRACTION 0-1 -> normalisée en %, src mtg
      "40.0,-3.0,300,0,0,2026-07-19,949,Met12,,0.632,1.11NRT,290,15.5,D",
      // G18 : confiance fixe 30 % -> sous le seuil, écartée (les FRP portent les pixels sûrs)
      "41.0,-100.0,300,0,0,2026-07-19,949,G18,,30.0000,1.11NRT,290,10,D",
      // G19FRP : pourcentage haut -> gardée, src goes, conf h
      "42.0,-100.0,300,0,0,2026-07-19,949,G19FRP,,85,1.11NRT,290,10,D",
      // Himawari-9 : pourcentage nominal -> gardée, src goes
      "35.0,135.0,300,0,0,2026-07-19,1230,Him9,,55,1.11NRT,290,10,N",
    ].join("\n");
    const f = parseCsv(csv, "goes");
    const errs: string[] = [];
    if (f.length !== 3) errs.push(`${f.length} détections gardées (3 attendues)`);
    const met = f.find((x) => x.properties.sat === "Met12");
    if (!met) errs.push("Met12 écartée (fraction non normalisée ?)");
    else {
      if (met.properties.src !== "mtg") errs.push(`Met12 src=${met.properties.src} (mtg attendu)`);
      if (met.properties.conf !== "n") errs.push(`Met12 conf=${met.properties.conf} (n attendu pour 63 %)`);
    }
    if (f.some((x) => x.properties.sat === "G18")) errs.push("G18 à 30 % non écartée");
    const frp = f.find((x) => x.properties.sat === "G19FRP");
    if (frp && (frp.properties.src !== "goes" || frp.properties.conf !== "h"))
      errs.push("G19FRP mal classée");
    const him = f.find((x) => x.properties.sat === "Him9");
    if (him && him.properties.src !== "goes") errs.push("Him9 mal classée");
    if (errs.length > 0) return { verdict: "FAIL", detail: errs.join(" ; ") };
    return { verdict: "PASS", detail: "fraction normalisée, seuil 40 %, Met->mtg, Him/FRP->goes" };
  });

  await check(L, "parseCsv : VIIRS (confiance en lettres, inchangé)", async () => {
    const header =
      "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
    const csv = [header, "48.5,0.3,300,0,0,2026-07-19,130,N20,VIIRS,h,2.0NRT,290,3.2,N"].join("\n");
    const f = parseCsv(csv, "viirs");
    if (f.length !== 1) return { verdict: "FAIL", detail: "détection VIIRS perdue" };
    const p = f[0].properties;
    if (p.src !== "viirs" || p.conf !== "h" || p.acq !== "2026-07-19T01:30:00Z") {
      return { verdict: "FAIL", detail: `src=${p.src} conf=${p.conf} acq=${p.acq}` };
    }
    return { verdict: "PASS" };
  });

  // ---- Corroboration : témoignage le plus proche (cas Montereau/Fontainebleau) --
  await check(L, "attachSignals : plus proche témoin, rayon 30 km, distance", async () => {
    const t0 = "2026-07-19T06:00:00Z";
    const sig = (place: string, lat: number, lon: number): SocialSignal => ({
      place,
      countryCode: "fr",
      lat,
      lon,
      postCount: 2,
      firstPost: t0,
      lastPost: t0,
      posts: [],
    });
    // Foyer à (42.0, 3.0) ; 1° lat ~ 111 km.
    const events = clusterFires([
      feature(42.0, 3.0, t0, "viirs", 12),
      feature(45.0, 6.0, t0, "viirs", 5),
    ]);
    attachSignals(events, [
      sig("Loin", 42.405, 3.0), // ~45 km : hors rayon
      sig("Moyen", 42.225, 3.0), // ~25 km : dans le rayon
      sig("Proche", 42.09, 3.0), // ~10 km : le plus proche -> attendu
      sig("TropLoin2", 45.36, 6.0), // ~40 km du 2e foyer : hors rayon
    ]);
    const [near, far] = events[0].centroid[1] < 44 ? [events[0], events[1]] : [events[1], events[0]];
    const errs: string[] = [];
    if (near.confidence !== "corrobore") errs.push(`foyer 1 confidence=${near.confidence}`);
    if (near.social?.place !== "Proche")
      errs.push(`foyer 1 attaché à « ${near.social?.place} » (« Proche » attendu)`);
    const km = near.social?.distanceKm;
    if (km === undefined || km < 8 || km > 12) errs.push(`distanceKm=${km} (~10 attendu)`);
    if (far.confidence === "corrobore" || far.social)
      errs.push("foyer 2 corroboré à 40 km (rayon 30 attendu)");
    if (errs.length > 0) return { verdict: "FAIL", detail: errs.join(" ; ") };
    return { verdict: "PASS", detail: "plus proche choisi, distance stockée, 40 km rejeté" };
  });

  // ---- Numéro d'urgence géolocalisé --------------------------------------------
  await check(L, "emergencyNumber : 18 en France, réflexes locaux ailleurs", async () => {
    const cases: [string | null, "fr" | "en", string][] = [
      ["FR", "fr", "18"], // retour préventeur : le 18 est LE réflexe feu
      ["US", "en", "911"],
      ["GB", "en", "999"],
      ["AU", "en", "000"],
      ["DE", "fr", "112"], // pays sans entrée dédiée -> norme GSM
      [null, "fr", "112"], // sans géo : selon la langue
      [null, "en", "911"],
    ];
    const wrong = cases.filter(([c, l, want]) => emergencyNumber(c, l) !== want);
    if (wrong.length > 0) {
      return {
        verdict: "FAIL",
        detail: wrong
          .map(([c, l, want]) => `${c ?? "∅"}/${l} → ${emergencyNumber(c, l)} (attendu ${want})`)
          .join(" ; "),
      };
    }
    return { verdict: "PASS", detail: `${cases.length} pays/langues corrects` };
  });

  // ---- Couverture FIRMS (le bug « carte vide le matin ») -----------------------
  await check(L, "daysNeeded : fenêtre glissante vs jours calendaires", async () => {
    const at = (h: number) => Date.UTC(2026, 6, 17, h, 0, 0);
    const cases: [number, number, number][] = [
      // [fenêtre h, heure UTC, jours attendus]
      [24, 8, 2], // LE bug d'hier : à 8 h, 24 h glissantes exigent hier + aujourd'hui
      [6, 3, 2], // à 3 h du matin, 6 h remontent à la veille
      [6, 10, 1], // à 10 h, la journée en cours suffit
      [72, 8, 4],
      [24, 23, 2],
    ];
    const wrong = cases.filter(([h, hh, want]) => daysNeeded(h, at(hh)) !== want);
    if (wrong.length > 0) {
      return {
        verdict: "FAIL",
        detail: wrong
          .map(([h, hh, want]) => `${h} h à ${hh}h UTC → ${daysNeeded(h, at(hh))} j (attendu ${want})`)
          .join(" ; "),
      };
    }
    return { verdict: "PASS", detail: `${cases.length} scénarios horaires corrects` };
  });
}
