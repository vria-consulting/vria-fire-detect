// Carroyage DFCI (Défense des Forêts Contre les Incendies) — le système de
// repérage opérationnel des pompiers français : carrés imbriqués de 100 km
// (2 lettres), 20 km (2 chiffres pairs) et 2 km (lettre + chiffre), définis
// en projection Lambert II étendu. Exemple : « KD42F7 ».
// Demandé par un commandant de SDIS sur le post de lancement : le carreau
// 2 km est l'unité de dialogue radio des moyens terrestres et aériens.
//
// Chaîne de conversion (formules IGN NTG_80, précision métrique — très au-delà
// du besoin pour un carreau de 2 km) :
//   WGS84 géographique -> WGS84 cartésien -> NTF (translation IGN standard
//   +168, +60, −320) -> NTF géographique -> Lambert II étendu -> code DFCI.
// Validée point à point contre l'implémentation C de référence GPS-DFCI
// (P. Trognon) — voir le test golden du programme de QA.

// Lettres du carroyage : I et J exclus (norme DFCI).
const LETTERS = "ABCDEFGHKLMN";
const EVEN = "02468";
const DIGITS = "0123456789";

// WGS84 -> Lambert II étendu (mètres).
function toLambert2e(lat: number, lon: number): { x: number; y: number } {
  const lambdaW = (lon * Math.PI) / 180;
  const phiW = (lat * Math.PI) / 180;

  // WGS84 géographique -> cartésien
  const aW = 6378137.0;
  const bW = 6356752.314;
  const e2W = (aW * aW - bW * bW) / (aW * aW);
  const nW = aW / Math.sqrt(1 - e2W * Math.sin(phiW) ** 2);
  const Xw = nW * Math.cos(phiW) * Math.cos(lambdaW);
  const Yw = nW * Math.cos(phiW) * Math.sin(lambdaW);
  const Zw = nW * (1 - e2W) * Math.sin(phiW);

  // WGS84 -> NTF : translation standard IGN
  const Xn = Xw + 168;
  const Yn = Yw + 60;
  const Zn = Zw - 320;

  // NTF cartésien -> géographique (itératif, ellipsoïde Clarke 1880 IGN)
  const aN = 6378249.2;
  const bN = 6356515.0;
  const e2N = (aN * aN - bN * bN) / (aN * aN);
  const r = Math.sqrt(Xn * Xn + Yn * Yn);
  let p0 = Math.atan((Zn / r) * (1 - (aN * e2N) / Math.sqrt(Xn * Xn + Yn * Yn + Zn * Zn)));
  let p1 = Math.atan(
    Zn / r / (1 - (aN * e2N * Math.cos(p0)) / (r * Math.sqrt(1 - e2N * Math.sin(p0) ** 2)))
  );
  while (Math.abs(p1 - p0) >= 1e-10) {
    p0 = p1;
    p1 = Math.atan(
      Zn / r / (1 - (aN * e2N * Math.cos(p0)) / (r * Math.sqrt(1 - e2N * Math.sin(p0) ** 2)))
    );
  }
  const phiN = p1;
  const lambdaN = Math.atan(Yn / Xn);

  // NTF géographique -> Lambert II étendu
  const n = 0.7289686274;
  const c = 11745793.39;
  const Xs = 600000.0;
  const Ys = 8199695.768;
  const lambda0 = 0.04079234433198; // méridien de Paris
  const eN = Math.sqrt(e2N);
  const L = Math.log(
    Math.tan(Math.PI / 4 + phiN / 2) *
      ((1 - eN * Math.sin(phiN)) / (1 + eN * Math.sin(phiN))) ** (eN / 2)
  );
  return {
    x: Xs + c * Math.exp(-n * L) * Math.sin(n * (lambdaN - lambda0)),
    y: Ys - c * Math.exp(-n * L) * Math.cos(n * (lambdaN - lambda0)),
  };
}

// Code DFCI du carreau 2 km contenant le point, ou null hors du carroyage
// (le maillage ne couvre que la France métropolitaine + Corse).
export function dfciCode(lat: number, lon: number): string | null {
  // Écarte d'emblée les points manifestement hors de France : la projection
  // NTF n'a aucun sens au-delà et Math.atan(Yn/Xn) devient faux à ±90° du
  // méridien de Paris.
  if (lat < 41 || lat > 51.5 || lon < -5.5 || lon > 10) return null;
  const { x, y } = toLambert2e(lat, lon);
  if (x <= 0 || x >= 1_200_000 || y <= 1_600_000 || y >= 2_700_000) return null;

  const yy = y - 1_500_000; // origine du carroyage : lettre A = Y 1500 km
  const x100 = Math.floor(x / 100_000);
  const y100 = Math.floor(yy / 100_000);

  const xIn100 = x - x100 * 100_000;
  const yIn100 = yy - y100 * 100_000;
  const x20 = Math.floor(xIn100 / 20_000);
  const y20 = Math.floor(yIn100 / 20_000);

  const xIn20 = xIn100 - x20 * 20_000;
  const yIn20 = yIn100 - y20 * 20_000;
  const x2 = Math.floor(xIn20 / 2_000);
  const y2 = Math.floor(yIn20 / 2_000);

  return (
    LETTERS[x100] + LETTERS[y100] + EVEN[x20] + EVEN[y20] + LETTERS[x2] + DIGITS[y2]
  );
}
