// Indice de risque météo de feu ESTIMÉ (non officiel), calculé à partir de
// variables Open-Meteo (gratuit, sans clé) : température, humidité, vent et
// sécheresse récente. Base = Chandler Burning Index (température + humidité,
// indice reconnu), ajusté à la hausse par le vent fort et l'absence de pluie.
//
// Conçu pour être remplacé, au même emplacement, par la « Météo des forêts »
// officielle de Météo-France dès que la clé du portail sera disponible : le
// niveau 1-4 suit volontairement la même échelle (faible / modéré / élevé /
// très élevé) pour que la bascule soit transparente.

export type RiskLevel = 1 | 2 | 3 | 4;
export type FireRisk = {
  level: RiskLevel;
  cbi: number; // Chandler Burning Index brut (indicatif)
  source: "estimated" | "meteofrance";
};

// Chandler Burning Index : T en °C, HR en %. Plus c'est chaud et sec, plus
// l'indice monte. Formule standard, bornée à 0.
export function chandlerBurningIndex(tempC: number, rh: number): number {
  const cbi =
    ((110 - 1.373 * rh) - 0.54 * (10.2 - tempC)) *
    ((124 * Math.pow(10, -0.0142 * rh)) / 60);
  return Math.max(0, cbi);
}

// Combine l'indice de Chandler avec le vent (attise) et la pluie récente
// (mouille le combustible) pour un niveau 1-4. Le mapping est volontairement
// transparent et prudent : au moindre doute on n'exagère pas le risque.
export function computeFireRisk(input: {
  tempC: number;
  rh: number;
  windKmh: number;
  recentRainMm: number; // cumul de pluie des ~3 derniers jours
}): FireRisk {
  const { tempC, rh, windKmh, recentRainMm } = input;
  const cbi = chandlerBurningIndex(tempC, rh);

  let score = cbi;
  // Le vent attise : bonus progressif.
  if (windKmh >= 40) score += 15;
  else if (windKmh >= 25) score += 8;
  else if (windKmh >= 15) score += 3;
  // La pluie récente réduit le risque (combustible humide).
  if (recentRainMm >= 15) score -= 20;
  else if (recentRainMm >= 5) score -= 10;
  else if (recentRainMm >= 1) score -= 4;

  let level: RiskLevel;
  if (score >= 90) level = 4;
  else if (score >= 75) level = 3;
  else if (score >= 50) level = 2;
  else level = 1;

  return { level, cbi: Math.round(cbi), source: "estimated" };
}
