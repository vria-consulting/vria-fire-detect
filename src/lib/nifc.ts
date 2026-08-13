// Périmètres officiels NIFC (WFIGS, États-Unis) : pour un feu américain
// actif, le périmètre interagences le plus proche (< 30 km) — nom officiel,
// surface, % de containment. Service ArcGIS public, gratuit, sans clé.
// Appelé UNIQUEMENT pour les feux US actifs (même règle qu'Overpass : les
// pages archivées crawlées en masse ne génèrent aucun appel externe).

export type NifcPerimeter = {
  name: string;
  acres: number;
  hectares: number;
  containedPct: number | null;
  discovered: string | null; // ISO
};

const SERVICE =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

export async function fetchNifcPerimeter(lat: number, lon: number): Promise<NifcPerimeter | null> {
  const params = new URLSearchParams({
    geometry: `${lon.toFixed(4)},${lat.toFixed(4)}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: "30000",
    units: "esriSRUnit_Meter",
    outFields: "attr_IncidentName,poly_GISAcres,attr_PercentContained,attr_FireDiscoveryDateTime",
    returnGeometry: "false",
    resultRecordCount: "3",
    f: "json",
  });
  try {
    const res = await fetch(`${SERVICE}?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      features?: {
        attributes: {
          attr_IncidentName?: string | null;
          poly_GISAcres?: number | null;
          attr_PercentContained?: number | null;
          attr_FireDiscoveryDateTime?: number | null;
        };
      }[];
    };
    // Plusieurs périmètres possibles à 30 km : on garde le plus grand (le
    // feu principal), les satellites administratifs sont du bruit.
    const best = (j.features ?? [])
      .map((f) => f.attributes)
      .filter((a) => a.attr_IncidentName && (a.poly_GISAcres ?? 0) > 5)
      .sort((a, b) => (b.poly_GISAcres ?? 0) - (a.poly_GISAcres ?? 0))[0];
    if (!best) return null;
    const acres = Math.round(best.poly_GISAcres ?? 0);
    return {
      name: best.attr_IncidentName!,
      acres,
      hectares: Math.round(acres * 0.4047),
      containedPct:
        typeof best.attr_PercentContained === "number" ? Math.round(best.attr_PercentContained) : null,
      discovered: best.attr_FireDiscoveryDateTime
        ? new Date(best.attr_FireDiscoveryDateTime).toISOString()
        : null,
    };
  } catch {
    return null;
  }
}
