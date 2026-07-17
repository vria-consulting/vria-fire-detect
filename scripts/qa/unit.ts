// Niveau 0 — TESTS UNITAIRES « GOLDEN » : chaque bug corrigé par le passé
// devient un test permanent. Purement local (aucun réseau) : géoparsing,
// clustering, calcul de couverture FIRMS, invariant lieu-dans-texte.

import { check } from "./util";
import { extractPlaces, countPlaceNames, normalizePlace } from "../../src/lib/geoparse";
import { clusterFires } from "../../src/lib/cluster";
import { daysNeeded } from "../../src/lib/eventscache";
import type { FireFeature } from "../../src/lib/firms";

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
