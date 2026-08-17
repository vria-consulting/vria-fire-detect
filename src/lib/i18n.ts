// Internationalisation Kanari — FR (pays francophones), EN (défaut monde),
// ES (Espagne + Amérique hispanophone), PT (Brésil + Portugal). La langue est
// portée par l'URL (/fr, /en, /es, /pt) : indispensable au SEO (hreflang) et
// au référencement dans les LLM. L'Amérique latine est le plus gros gisement
// de requêtes feux au monde (Amazonie, Chili, Bolivie) sans acteur gratuit.

export const LANGS = ["fr", "en", "es", "pt"] as const;
export type Lang = (typeof LANGS)[number];

// Pays dont la langue par défaut est le français (détection géo Vercel).
export const FRANCOPHONE = new Set([
  "FR", "BE", "CH", "LU", "MC", "SN", "CI", "ML", "BF", "NE", "TG", "BJ",
  "GA", "CG", "CD", "CM", "MG", "TN", "DZ", "MA", "HT", "GN", "RW", "BI",
  "TD", "CF", "DJ", "KM", "GQ", "VU", "NC", "PF", "GP", "MQ", "GF", "RE", "YT",
]);

// Pays hispanophones et lusophones (même mécanique de détection géo).
export const HISPANOPHONE = new Set([
  "ES", "MX", "AR", "CL", "CO", "PE", "VE", "EC", "BO", "PY", "UY", "GT",
  "HN", "SV", "NI", "CR", "PA", "DO", "CU", "PR",
]);
export const LUSOPHONE = new Set(["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"]);

export function isValidLang(x: string | undefined): x is Lang {
  return x === "fr" || x === "en" || x === "es" || x === "pt";
}

// Dictionnaires locaux de pages : beaucoup n'existent qu'en fr/en — les
// langues sans traduction retombent sur l'anglais sans casser le typage.
export function localize<
  D extends { readonly fr: unknown; readonly en: unknown } & Partial<Readonly<Record<Lang, unknown>>>,
>(dict: D, lang: Lang): D["fr"] | D["en"] {
  return (dict[lang] ?? dict.en) as D["fr"] | D["en"];
}

// Numéro d'urgence selon le pays du visiteur (cookie kanari-geo posé par le
// middleware). Le 112 (norme GSM) fonctionne dans la plupart des pays : il
// sert de repli — sauf en anglais sans géo, où l'audience est majoritairement
// nord-américaine (911).
const EMERGENCY_BY_COUNTRY: Record<string, string> = {
  // En France, le 18 (pompiers) est LE réflexe feu — retour d'un préventeur
  // sur le post de lancement ; le 112 route vers les mêmes centres mais parle
  // moins aux habitants.
  FR: "18",
  US: "911", CA: "911", MX: "911", PH: "911",
  GB: "999", IE: "999",
  AU: "000",
  NZ: "111",
  // Brésil : 193 = Corpo de Bombeiros — LE réflexe feu (le 190 est la police).
  IN: "112", BR: "193", JP: "119", CN: "119", KR: "119",
  // Amérique latine hispanophone (cible es) : le 112 européen n'y existe pas.
  // Chili 132 et Pérou 116 = lignes Bomberos dédiées ; ailleurs le 911 est la
  // ligne unique nationale.
  CL: "132", PE: "116", CO: "123",
  AR: "911", EC: "911", UY: "911", PY: "911", VE: "911",
  CR: "911", PA: "911", DO: "911", HN: "911", SV: "911", NI: "911",
  // Indonésie : 113 = pompiers.
  ID: "113",
};

export function emergencyNumber(country: string | null, lang: Lang): string {
  if (country && EMERGENCY_BY_COUNTRY[country.toUpperCase()]) {
    return EMERGENCY_BY_COUNTRY[country.toUpperCase()];
  }
  if (country) return "112"; // norme GSM, valable dans la plupart des pays
  return lang === "fr" ? "112" : "911";
}

const fr = {
  // Layout
  tagline: "l'alerte feu de forêt, avant tout le monde",
  navHow: "Comment ça marche",
  navAbout: "À propos",
  navFaq: "FAQ",
  navContribute: "Contribuer",
  emergency: (n: string) => `Urgence ? ${n}`,
  emergencyWord: "Urgence ?",
  planesShort: "moyens aériens en vol · monde",
  hotspotNow: "En ce moment :",
  hotspotFires: (n: number) => `${n} feu${n > 1 ? "x" : ""} actif${n > 1 ? "s" : ""}`,
  legendPlane: "Moyens aériens (Canadair, tankers, hélicos…)",
  minimize: "Réduire",
  viewSatellite: "Satellite",
  viewPlan: "Plan",
  // Titre = requête principale d'abord (« carte des feux… temps réel »),
  // marque ensuite : c'est la requête tapée, pas la marque, qui amène le SEO.
  metaTitle: "Carte des feux de forêt en temps réel — kanari, l'alerte avant tout le monde",
  metaDescription:
    "Carte mondiale en temps quasi réel des départs de feu de forêt : détection satellite (NASA FIRMS, Meteosat), témoignages citoyens vérifiés par IA, alertes gratuites par zone. Le canari chante avant la sirène.",

  // Recherche & contrôles
  searchPlaceholder: "Rechercher une ville ou une zone",
  myPosition: "Ma position",
  legend: "Légende",
  smoke: "Fumée",
  smokeTitle: "Panaches de fumée et particules observés par la NASA (la veille)",
  legendSmoke: "Voile brun : fumée / particules (aérosols NASA, la veille)",
  legendActive: "Feu actif · moins de 3 h",
  legendRecent: "Récent · 3 – 12 h",
  legendWatched: "Surveillé · 12 – 24 h",
  legendOld: "Ancien · plus de 24 h",
  legendCitizen: "Signalement citoyen · satellite à proximité",
  legendUnverified: "Signalement à vérifier · pas encore de satellite",
  legendSize: "Taille de la flamme = nombre de détections",
  analyzing: "kanari analyse les signaux…",
  errFirmsKey: "Clé NASA FIRMS manquante ou invalide (variable FIRMS_MAP_KEY).",
  errData: "Données satellite momentanément indisponibles — nouvel essai dans 2 min.",

  // Flux
  live: "En direct",
  listening: "kanari écoute",
  tabAll: "Tout",
  tabUrgent: "Urgents",
  bucketNow: "À l'instant",
  bucketHour: "Dernière heure",
  bucketEarlier: "Plus tôt",
  loadingFeed: "Récupération des satellites et analyse IA des signaux…",
  emptyAll:
    "Rien à signaler dans la vue affichée. kanari écoute — déplace la carte ou élargis la période.",
  emptyUrgent:
    "Aucun départ de feu (1er signal < 2 h) dans la vue affichée. Élargis la carte : la couverture la plus rapide vient de GOES (Amériques), Meteosat (Europe/Afrique) et des témoignages citoyens.",
  urgentBanner: (n: number) =>
    `${n} départ${n > 1 ? "s" : ""} signalé${n > 1 ? "s" : ""} il y a moins de 20 min`,
  satDetection: "Détection satellite",
  detectionsSat: (n: number) => `${n} détection${n > 1 ? "s" : ""} satellite`,
  mwMax: "MW max",
  corroboratedTag: "corroboré",
  probablePrefix: "Départ probable — ",
  postsOn: (n: number, src: string) => `${n} post${n > 1 ? "s" : ""} ${src}`,
  lastMentionAgo: "dernière mention",
  verifying: "en cours de vérification",
  satShort: "Satellite",
  footerStats: (ev: string, sig: number) => `${ev} foyers · ${sig} signalements`,
  updatedNow: "maj à l'instant",
  updatedAgo: (s: number) => `maj il y a ${s} s`,
  refreshNow: "Rafraîchir maintenant",

  // CTA alertes
  ctaOff: "M'alerter sur cette zone",
  ctaOn: "Zone sous alerte — kanari veille ✓",
  ctaBusy: "Activation…",
  alertNotSupported: "Notifications non supportées par ce navigateur.",
  alertAllow: "Autorise les notifications pour activer les alertes.",
  alertOn: "Zone sous alerte : tu seras prévenu·e des nouveaux foyers probables ici.",
  alertOff: "Alertes désactivées.",
  alertFailed: "Échec de l'activation — réessaie.",
  geoUnsupported: "Géolocalisation non supportée par ce navigateur.",
  geoUnavailable: "Position indisponible — vérifie l'autorisation de localisation.",
  yourPosition: "Ta position",

  // Signalement citoyen direct
  reportBtn: "Signaler un feu",
  reportConfirm:
    "Envoyer un signalement de feu à ta position actuelle ?\n\nN'utilise ce bouton que si tu vois réellement un départ de feu. En cas d'urgence, appelle d'abord les secours.",
  reportSent:
    "Merci ! Signalement transmis — il apparaît sur la carte comme « à vérifier ».",
  reportFailed: "Envoi impossible — réessaie.",
  reportRateLimited: "Un signalement maximum toutes les 5 minutes.",
  reportPopup: (age: string) => `Témoin direct · ${age}`,
  reportPhotoAsk: "Signalement envoyé. Ajoute une photo du feu pour vérification par IA ? (optionnel)",
  reportPhotoAdd: "📸 Ajouter une photo",
  reportPhotoSkip: "Non merci",
  reportPhotoChecking: "Vérification de la photo par IA…",
  reportPhotoVerified: "Photo vérifiée ✓ Ton signalement est marqué comme authentifié.",
  reportPhotoRejected:
    "Photo non concluante : le signalement reste affiché, sans badge de vérification.",
  reportPhotoFailed: "Envoi de la photo impossible. Le signalement reste pris en compte.",
  reportPhotoBadge: "📸 Photo vérifiée par IA",

  // Fiches
  badgeNewFire: "NOUVEAU FEU",
  badgeReport: "SIGNALEMENT",
  badgeActive: "ACTIF",
  badgeRecent: "RÉCENT",
  badgeWatched: "SURVEILLÉ",
  badgeOld: "ANCIEN",
  confPossible: "possible",
  confProbable: "probable",
  confCorroborated: "corroboré",
  close: "Fermer",
  firstMention: "1ère mention",
  postsWindow: (n: number, src: string) => `${n} post${n > 1 ? "s" : ""} ${src} (12 h)`,
  lastLabel: "dernière",
  positionNote: "Position = centre de la commune citée, pas du feu",
  share: "Partager",
  linkCopied: "Lien copié ✓",
  shareSignal: (place: string) => `kanari — signalement à ${place}`,
  shareEvent: (place: string) => `kanari — foyer ${place}`,
  signalFootnote:
    "Témoignage non confirmé par satellite : soit le feu est trop petit ou trop récent pour être vu (précocité !), soit il ne s'agit pas d'un feu de forêt.",
  beforePress: (d: string) => `détecté ${d} avant la presse`,
  citizenMention: "1ère mention citoyenne",
  satFirst: "1er signal satellite",
  lastSignal: "Dernier signal",
  wind: (speed: number, dir: string) => `Vent ${speed} km/h de ${dir}`,
  spreadLine: (km: number, dir: string) =>
    `Propagation estimée 3 h : ~${km} km vers ${dir} (vent seul, indicatif)`,
  legendSpread: "Cône orangé : propagation estimée (vent + relief, indicatif)",
  gusts: (g: number) => ` · rafales ${g}`,
  riskLabel: "Risque météo estimé",
  riskLevels: ["faible", "modéré", "élevé", "très élevé"],
  riskNote:
    "Risque météo estimé à partir de la température, de l'humidité, du vent et de la pluie récente (Open-Meteo). Estimation indicative, non officielle.",
  viewDetail: "Voir le détail",
  hideDetail: "Masquer le détail",
  dlFirstUTC: "Premier signal (UTC)",
  dlDetections: "Détections",
  dlPower: "Puissance max",
  dlPosition: "Position",
  dlDfci: "Carroyage DFCI",
  worldviewLink: "Image satellite (NASA Worldview)",
  statusFading: (h: number) =>
    `Plus de signal depuis ${h} h — extinction possible, ou feu masqué (nuages, canopée)`,
  corrobBy: (n: number, place: string, km?: number) =>
    `Corroboré par ${n} témoignage${n > 1 ? "s" : ""} près de ${place}${
      km !== undefined && km >= 5 ? ` (à ~${km} km)` : ""
    }`,
  nearLabel: (place: string) => `près de ${place}`,
  badgeUnverified: "À VÉRIFIER",
  searchWitnesses: (more: boolean) => `Chercher ${more ? "plus de " : "des "}témoignages`,
  searchingWitnesses: "Recherche de témoignages en cours…",
  searchUnavailable: "Recherche indisponible pour le moment.",
  zoneLabel: "Zone",
  witnessesFound: (n: number) =>
    `${n} témoignage${n !== 1 ? "s" : ""} trouvé${n !== 1 ? "s" : ""} (48 h)`,
  bskyUnreachable:
    "La recherche Bluesky est momentanément inaccessible depuis nos serveurs — réessaie plus tard.",
  noWitnesses:
    "Aucune mention sur Bluesky pour cette zone. Ça ne veut pas dire qu'il n'y a pas de feu — juste pas de témoin connecté.",
  eventFootnote:
    "Le « 1er signal » est l'heure du premier passage satellite ayant vu ce foyer — l'ignition réelle peut être antérieure.",

  // Temps
  ago: (txt: string) => `il y a ${txt}`,
  compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
};

const en: typeof fr = {
  tagline: "the wildfire alert, before anyone else",
  navHow: "How it works",
  navAbout: "About",
  navFaq: "FAQ",
  navContribute: "Contribute",
  emergency: (n: string) => `Emergency? ${n}`,
  emergencyWord: "Emergency?",
  planesShort: "firefighting aircraft airborne · world",
  hotspotNow: "Right now:",
  hotspotFires: (n: number) => `${n} active fire${n > 1 ? "s" : ""}`,
  legendPlane: "Firefighting aircraft (tankers, helos…)",
  minimize: "Minimize",
  viewSatellite: "Satellite",
  viewPlan: "Map",
  metaTitle: "Live wildfire map, real-time fire alerts — kanari",
  metaDescription:
    "Near real-time world map of wildfire ignitions: satellite detection (NASA FIRMS, Meteosat), AI-verified citizen reports, free area alerts. The canary sings before the siren.",

  searchPlaceholder: "Search a city or area",
  myPosition: "My location",
  legend: "Legend",
  smoke: "Smoke",
  smokeTitle: "Smoke plumes and particles observed by NASA (previous day)",
  legendSmoke: "Brown haze: smoke / particles (NASA aerosols, previous day)",
  legendActive: "Active fire · under 3 h",
  legendRecent: "Recent · 3 – 12 h",
  legendWatched: "Monitored · 12 – 24 h",
  legendOld: "Old · over 24 h",
  legendCitizen: "Citizen report · satellite nearby",
  legendUnverified: "Report being verified · no satellite yet",
  legendSize: "Flame size = number of detections",
  analyzing: "kanari is analyzing signals…",
  errFirmsKey: "NASA FIRMS key missing or invalid (FIRMS_MAP_KEY variable).",
  errData: "Satellite data temporarily unavailable — retrying in 2 min.",

  live: "Live",
  listening: "kanari is listening",
  tabAll: "All",
  tabUrgent: "Urgent",
  bucketNow: "Just now",
  bucketHour: "Last hour",
  bucketEarlier: "Earlier",
  loadingFeed: "Fetching satellites and running AI signal analysis…",
  emptyAll:
    "Nothing to report in the current view. kanari is listening — move the map or widen the period.",
  emptyUrgent:
    "No fire start (first signal < 2 h) in the current view. Widen the map: the fastest coverage comes from GOES (Americas), Meteosat (Europe/Africa) and citizen reports.",
  urgentBanner: (n: number) => `${n} fire start${n > 1 ? "s" : ""} reported less than 20 min ago`,
  satDetection: "Satellite detection",
  detectionsSat: (n: number) => `${n} satellite detection${n > 1 ? "s" : ""}`,
  mwMax: "MW max",
  corroboratedTag: "corroborated",
  probablePrefix: "Probable fire start — ",
  postsOn: (n: number, src: string) => `${n} ${src} post${n > 1 ? "s" : ""}`,
  lastMentionAgo: "last mention",
  verifying: "being verified",
  satShort: "Satellite",
  footerStats: (ev: string, sig: number) => `${ev} fires · ${sig} reports`,
  updatedNow: "updated just now",
  updatedAgo: (s: number) => `updated ${s} s ago`,
  refreshNow: "Refresh now",

  ctaOff: "Alert me on this area",
  ctaOn: "Area under watch — kanari is on it ✓",
  ctaBusy: "Activating…",
  alertNotSupported: "Notifications are not supported by this browser.",
  alertAllow: "Allow notifications to enable alerts.",
  alertOn: "Area under watch: you'll be notified of probable new fires here.",
  alertOff: "Alerts disabled.",
  alertFailed: "Activation failed — try again.",
  geoUnsupported: "Geolocation is not supported by this browser.",
  geoUnavailable: "Location unavailable — check the location permission.",
  yourPosition: "Your location",

  reportBtn: "Report a fire",
  reportConfirm:
    "Send a fire report at your current position?\n\nOnly use this button if you can actually see a fire starting. In an emergency, call emergency services first.",
  reportSent: "Thank you! Report sent — it appears on the map as “to verify”.",
  reportFailed: "Could not send — try again.",
  reportRateLimited: "One report every 5 minutes maximum.",
  reportPopup: (age: string) => `Direct witness · ${age}`,
  reportPhotoAsk: "Report sent. Add a photo of the fire for AI verification? (optional)",
  reportPhotoAdd: "📸 Add a photo",
  reportPhotoSkip: "No thanks",
  reportPhotoChecking: "AI is checking the photo…",
  reportPhotoVerified: "Photo verified ✓ Your report is now marked as authenticated.",
  reportPhotoRejected: "Photo inconclusive: your report stays visible, without the verified badge.",
  reportPhotoFailed: "Could not upload the photo. Your report still counts.",
  reportPhotoBadge: "📸 Photo verified by AI",

  badgeNewFire: "NEW FIRE",
  badgeReport: "REPORT",
  badgeActive: "ACTIVE",
  badgeRecent: "RECENT",
  badgeWatched: "MONITORED",
  badgeOld: "OLD",
  confPossible: "possible",
  confProbable: "probable",
  confCorroborated: "corroborated",
  close: "Close",
  firstMention: "First mention",
  postsWindow: (n: number, src: string) => `${n} ${src} post${n > 1 ? "s" : ""} (12 h)`,
  lastLabel: "last",
  positionNote: "Position = center of the mentioned town, not the fire",
  share: "Share",
  linkCopied: "Link copied ✓",
  shareSignal: (place: string) => `kanari — report near ${place}`,
  shareEvent: (place: string) => `kanari — fire ${place}`,
  signalFootnote:
    "Report not yet confirmed by satellite: either the fire is too small or too recent to be seen (earliness!), or it is not a wildfire.",
  beforePress: (d: string) => `detected ${d} before the press`,
  citizenMention: "First citizen mention",
  satFirst: "First satellite signal",
  lastSignal: "Last signal",
  wind: (speed: number, dir: string) => `Wind ${speed} km/h from ${dir}`,
  spreadLine: (km: number, dir: string) =>
    `Estimated 3 h spread: ~${km} km ${dir} (wind only, indicative)`,
  legendSpread: "Orange cone: estimated spread (wind + terrain, indicative)",
  gusts: (g: number) => ` · gusts ${g}`,
  riskLabel: "Estimated fire-weather risk",
  riskLevels: ["low", "moderate", "high", "very high"],
  riskNote:
    "Fire-weather risk estimated from temperature, humidity, wind and recent rain (Open-Meteo). Indicative, unofficial estimate.",
  viewDetail: "View details",
  hideDetail: "Hide details",
  dlFirstUTC: "First signal (UTC)",
  dlDetections: "Detections",
  dlPower: "Max power",
  dlPosition: "Position",
  dlDfci: "DFCI grid",
  worldviewLink: "Satellite imagery (NASA Worldview)",
  statusFading: (h: number) =>
    `No signal for ${h} h — possibly extinguished, or hidden (clouds, canopy)`,
  corrobBy: (n: number, place: string, km?: number) =>
    `Corroborated by ${n} report${n > 1 ? "s" : ""} near ${place}${
      km !== undefined && km >= 5 ? ` (~${km} km away)` : ""
    }`,
  nearLabel: (place: string) => `near ${place}`,
  badgeUnverified: "TO VERIFY",
  searchWitnesses: (more: boolean) => `Search for ${more ? "more " : ""}witnesses`,
  searchingWitnesses: "Searching for witnesses…",
  searchUnavailable: "Search unavailable right now.",
  zoneLabel: "Area",
  witnessesFound: (n: number) => `${n} witness${n !== 1 ? "es" : ""} found (48 h)`,
  bskyUnreachable:
    "Bluesky search is temporarily unreachable from our servers — try again later.",
  noWitnesses:
    "No Bluesky mention for this area. That doesn't mean there is no fire — just no connected witness.",
  eventFootnote:
    "The “first signal” is the time of the first satellite pass that saw this fire — actual ignition may be earlier.",

  ago: (txt: string) => `${txt} ago`,
  compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
};

const es: typeof fr = {
  tagline: "la alerta de incendios forestales, antes que nadie",
  navHow: "Cómo funciona",
  navAbout: "Acerca de",
  navFaq: "FAQ",
  navContribute: "Contribuir",
  emergency: (n: string) => `¿Emergencia? ${n}`,
  emergencyWord: "¿Emergencia?",
  planesShort: "medios aéreos en vuelo · mundo",
  hotspotNow: "Ahora mismo:",
  hotspotFires: (n: number) => `${n} incendio${n > 1 ? "s" : ""} activo${n > 1 ? "s" : ""}`,
  legendPlane: "Medios aéreos (hidroaviones, tanqueros, helicópteros…)",
  minimize: "Minimizar",
  viewSatellite: "Satélite",
  viewPlan: "Mapa",
  metaTitle: "Mapa de incendios forestales en tiempo real — kanari",
  metaDescription:
    "Mapa mundial casi en tiempo real de los focos de incendio forestal: detección satelital (NASA FIRMS, Meteosat, GOES), reportes ciudadanos verificados por IA, alertas gratuitas por zona. El canario canta antes que la sirena.",

  searchPlaceholder: "Buscar una ciudad o zona",
  myPosition: "Mi ubicación",
  legend: "Leyenda",
  smoke: "Humo",
  smokeTitle: "Columnas de humo y partículas observadas por la NASA (día anterior)",
  legendSmoke: "Velo marrón: humo / partículas (aerosoles NASA, día anterior)",
  legendActive: "Fuego activo · menos de 3 h",
  legendRecent: "Reciente · 3 – 12 h",
  legendWatched: "Vigilado · 12 – 24 h",
  legendOld: "Antiguo · más de 24 h",
  legendCitizen: "Reporte ciudadano · satélite cercano",
  legendUnverified: "Reporte por verificar · aún sin satélite",
  legendSize: "Tamaño de la llama = número de detecciones",
  analyzing: "kanari está analizando las señales…",
  errFirmsKey: "Clave NASA FIRMS ausente o inválida (variable FIRMS_MAP_KEY).",
  errData: "Datos satelitales momentáneamente no disponibles — reintento en 2 min.",

  live: "En vivo",
  listening: "kanari está escuchando",
  tabAll: "Todo",
  tabUrgent: "Urgentes",
  bucketNow: "Ahora mismo",
  bucketHour: "Última hora",
  bucketEarlier: "Antes",
  loadingFeed: "Consultando satélites y analizando señales con IA…",
  emptyAll:
    "Nada que señalar en la vista actual. kanari está escuchando — mueve el mapa o amplía el período.",
  emptyUrgent:
    "Ningún foco nuevo (primera señal < 2 h) en la vista actual. Amplía el mapa: la cobertura más rápida viene de GOES (Américas), Meteosat (Europa/África) y los reportes ciudadanos.",
  urgentBanner: (n: number) => `${n} foco${n > 1 ? "s" : ""} señalado${n > 1 ? "s" : ""} hace menos de 20 min`,
  satDetection: "Detección satelital",
  detectionsSat: (n: number) => `${n} detección${n > 1 ? "es" : ""} satelital${n > 1 ? "es" : ""}`,
  mwMax: "MW máx",
  corroboratedTag: "corroborado",
  probablePrefix: "Foco probable — ",
  postsOn: (n: number, src: string) => `${n} publicación${n > 1 ? "es" : ""} en ${src}`,
  lastMentionAgo: "última mención",
  verifying: "en verificación",
  satShort: "Satélite",
  footerStats: (ev: string, sig: number) => `${ev} focos · ${sig} reportes`,
  updatedNow: "actualizado ahora",
  updatedAgo: (s: number) => `actualizado hace ${s} s`,
  refreshNow: "Actualizar ahora",

  ctaOff: "Alertarme en esta zona",
  ctaOn: "Zona bajo vigilancia — kanari está atento ✓",
  ctaBusy: "Activando…",
  alertNotSupported: "Este navegador no soporta notificaciones.",
  alertAllow: "Permite las notificaciones para activar las alertas.",
  alertOn: "Zona bajo vigilancia: te avisaremos de nuevos focos probables aquí.",
  alertOff: "Alertas desactivadas.",
  alertFailed: "No se pudo activar — inténtalo de nuevo.",
  geoUnsupported: "Este navegador no soporta la geolocalización.",
  geoUnavailable: "Ubicación no disponible — revisa el permiso de ubicación.",
  yourPosition: "Tu ubicación",

  reportBtn: "Reportar un incendio",
  reportConfirm:
    "¿Enviar un reporte de incendio en tu posición actual?\n\nUsa este botón solo si realmente ves un fuego comenzando. En una emergencia, llama primero a los servicios de emergencia.",
  reportSent: "¡Gracias! Reporte enviado — aparece en el mapa como « por verificar ».",
  reportFailed: "No se pudo enviar — inténtalo de nuevo.",
  reportRateLimited: "Máximo un reporte cada 5 minutos.",
  reportPopup: (age: string) => `Testigo directo · ${age}`,
  reportPhotoAsk: "Reporte enviado. ¿Agregar una foto del fuego para verificación por IA? (opcional)",
  reportPhotoAdd: "📸 Agregar una foto",
  reportPhotoSkip: "No, gracias",
  reportPhotoChecking: "La IA está revisando la foto…",
  reportPhotoVerified: "Foto verificada ✓ Tu reporte queda marcado como autenticado.",
  reportPhotoRejected: "Foto no concluyente: el reporte sigue visible, sin insignia de verificación.",
  reportPhotoFailed: "No se pudo subir la foto. Tu reporte sigue contando.",
  reportPhotoBadge: "📸 Foto verificada por IA",

  badgeNewFire: "FUEGO NUEVO",
  badgeReport: "REPORTE",
  badgeActive: "ACTIVO",
  badgeRecent: "RECIENTE",
  badgeWatched: "VIGILADO",
  badgeOld: "ANTIGUO",
  confPossible: "posible",
  confProbable: "probable",
  confCorroborated: "corroborado",
  close: "Cerrar",
  firstMention: "Primera mención",
  postsWindow: (n: number, src: string) => `${n} publicación${n > 1 ? "es" : ""} en ${src} (12 h)`,
  lastLabel: "última",
  positionNote: "Posición = centro del municipio citado, no del fuego",
  share: "Compartir",
  linkCopied: "Enlace copiado ✓",
  shareSignal: (place: string) => `kanari — reporte cerca de ${place}`,
  shareEvent: (place: string) => `kanari — foco ${place}`,
  signalFootnote:
    "Testimonio aún no confirmado por satélite: o el fuego es demasiado pequeño o reciente para ser visto (¡precocidad!), o no es un incendio forestal.",
  beforePress: (d: string) => `detectado ${d} antes que la prensa`,
  citizenMention: "Primera mención ciudadana",
  satFirst: "Primera señal satelital",
  lastSignal: "Última señal",
  wind: (speed: number, dir: string) => `Viento ${speed} km/h del ${dir}`,
  spreadLine: (km: number, dir: string) =>
    `Propagación estimada 3 h: ~${km} km hacia el ${dir} (solo viento, indicativo)`,
  legendSpread: "Cono naranja: propagación estimada (viento + relieve, indicativo)",
  gusts: (g: number) => ` · ráfagas ${g}`,
  riskLabel: "Riesgo meteorológico estimado",
  riskLevels: ["bajo", "moderado", "alto", "muy alto"],
  riskNote:
    "Riesgo estimado a partir de temperatura, humedad, viento y lluvia reciente (Open-Meteo). Estimación indicativa, no oficial.",
  viewDetail: "Ver detalle",
  hideDetail: "Ocultar detalle",
  dlFirstUTC: "Primera señal (UTC)",
  dlDetections: "Detecciones",
  dlPower: "Potencia máx",
  dlPosition: "Posición",
  dlDfci: "Cuadrícula DFCI",
  worldviewLink: "Imagen satelital (NASA Worldview)",
  statusFading: (h: number) =>
    `Sin señal desde hace ${h} h — posible extinción, o fuego oculto (nubes, dosel)`,
  corrobBy: (n: number, place: string, km?: number) =>
    `Corroborado por ${n} testimonio${n > 1 ? "s" : ""} cerca de ${place}${
      km !== undefined && km >= 5 ? ` (a ~${km} km)` : ""
    }`,
  nearLabel: (place: string) => `cerca de ${place}`,
  badgeUnverified: "POR VERIFICAR",
  searchWitnesses: (more: boolean) => `Buscar ${more ? "más " : ""}testigos`,
  searchingWitnesses: "Buscando testigos…",
  searchUnavailable: "Búsqueda no disponible por el momento.",
  zoneLabel: "Zona",
  witnessesFound: (n: number) => `${n} testimonio${n !== 1 ? "s" : ""} encontrado${n !== 1 ? "s" : ""} (48 h)`,
  bskyUnreachable:
    "La búsqueda en Bluesky está momentáneamente inaccesible desde nuestros servidores — inténtalo más tarde.",
  noWitnesses:
    "Ninguna mención en Bluesky para esta zona. No significa que no haya fuego — solo que no hay testigos conectados.",
  eventFootnote:
    "La « primera señal » es la hora del primer paso satelital que vio este foco — la ignición real puede ser anterior.",

  ago: (txt: string) => `hace ${txt}`,
  compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
};

const pt: typeof fr = {
  tagline: "o alerta de incêndio florestal, antes de todo mundo",
  navHow: "Como funciona",
  navAbout: "Sobre",
  navFaq: "FAQ",
  navContribute: "Contribuir",
  emergency: (n: string) => `Emergência? ${n}`,
  emergencyWord: "Emergência?",
  planesShort: "meios aéreos em voo · mundo",
  hotspotNow: "Agora:",
  hotspotFires: (n: number) => `${n} incêndio${n > 1 ? "s" : ""} ativo${n > 1 ? "s" : ""}`,
  legendPlane: "Meios aéreos (aviões-tanque, helicópteros…)",
  minimize: "Minimizar",
  viewSatellite: "Satélite",
  viewPlan: "Mapa",
  metaTitle: "Mapa de incêndios florestais e queimadas em tempo real — kanari",
  metaDescription:
    "Mapa mundial quase em tempo real dos focos de incêndio florestal e queimadas: detecção por satélite (NASA FIRMS, GOES, Meteosat), relatos cidadãos verificados por IA, alertas gratuitos por zona. O canário canta antes da sirene.",

  searchPlaceholder: "Buscar uma cidade ou área",
  myPosition: "Minha localização",
  legend: "Legenda",
  smoke: "Fumaça",
  smokeTitle: "Plumas de fumaça e partículas observadas pela NASA (dia anterior)",
  legendSmoke: "Véu marrom: fumaça / partículas (aerossóis NASA, dia anterior)",
  legendActive: "Fogo ativo · menos de 3 h",
  legendRecent: "Recente · 3 – 12 h",
  legendWatched: "Monitorado · 12 – 24 h",
  legendOld: "Antigo · mais de 24 h",
  legendCitizen: "Relato cidadão · satélite próximo",
  legendUnverified: "Relato em verificação · ainda sem satélite",
  legendSize: "Tamanho da chama = número de detecções",
  analyzing: "kanari está analisando os sinais…",
  errFirmsKey: "Chave NASA FIRMS ausente ou inválida (variável FIRMS_MAP_KEY).",
  errData: "Dados de satélite momentaneamente indisponíveis — nova tentativa em 2 min.",

  live: "Ao vivo",
  listening: "kanari está escutando",
  tabAll: "Tudo",
  tabUrgent: "Urgentes",
  bucketNow: "Agora mesmo",
  bucketHour: "Última hora",
  bucketEarlier: "Antes",
  loadingFeed: "Consultando satélites e analisando sinais com IA…",
  emptyAll:
    "Nada a relatar na vista atual. kanari está escutando — mova o mapa ou amplie o período.",
  emptyUrgent:
    "Nenhum foco novo (primeiro sinal < 2 h) na vista atual. Amplie o mapa: a cobertura mais rápida vem do GOES (Américas), Meteosat (Europa/África) e dos relatos cidadãos.",
  urgentBanner: (n: number) => `${n} foco${n > 1 ? "s" : ""} relatado${n > 1 ? "s" : ""} há menos de 20 min`,
  satDetection: "Detecção por satélite",
  detectionsSat: (n: number) => `${n} detecção${n > 1 ? "ões" : ""} por satélite`,
  mwMax: "MW máx",
  corroboratedTag: "corroborado",
  probablePrefix: "Foco provável — ",
  postsOn: (n: number, src: string) => `${n} publicação${n > 1 ? "ões" : ""} no ${src}`,
  lastMentionAgo: "última menção",
  verifying: "em verificação",
  satShort: "Satélite",
  footerStats: (ev: string, sig: number) => `${ev} focos · ${sig} relatos`,
  updatedNow: "atualizado agora",
  updatedAgo: (s: number) => `atualizado há ${s} s`,
  refreshNow: "Atualizar agora",

  ctaOff: "Alertar-me nesta área",
  ctaOn: "Área sob vigilância — kanari está de olho ✓",
  ctaBusy: "Ativando…",
  alertNotSupported: "Este navegador não suporta notificações.",
  alertAllow: "Permita as notificações para ativar os alertas.",
  alertOn: "Área sob vigilância: você será avisado de novos focos prováveis aqui.",
  alertOff: "Alertas desativados.",
  alertFailed: "Falha na ativação — tente de novo.",
  geoUnsupported: "Este navegador não suporta geolocalização.",
  geoUnavailable: "Localização indisponível — verifique a permissão de localização.",
  yourPosition: "Sua localização",

  reportBtn: "Relatar um incêndio",
  reportConfirm:
    "Enviar um relato de incêndio na sua posição atual?\n\nUse este botão apenas se você realmente vê um fogo começando. Em uma emergência, ligue primeiro para os serviços de emergência.",
  reportSent: "Obrigado! Relato enviado — ele aparece no mapa como « a verificar ».",
  reportFailed: "Não foi possível enviar — tente de novo.",
  reportRateLimited: "No máximo um relato a cada 5 minutos.",
  reportPopup: (age: string) => `Testemunha direta · ${age}`,
  reportPhotoAsk: "Relato enviado. Adicionar uma foto do fogo para verificação por IA? (opcional)",
  reportPhotoAdd: "📸 Adicionar uma foto",
  reportPhotoSkip: "Não, obrigado",
  reportPhotoChecking: "A IA está verificando a foto…",
  reportPhotoVerified: "Foto verificada ✓ Seu relato está marcado como autenticado.",
  reportPhotoRejected: "Foto inconclusiva: o relato continua visível, sem selo de verificação.",
  reportPhotoFailed: "Não foi possível enviar a foto. Seu relato continua valendo.",
  reportPhotoBadge: "📸 Foto verificada por IA",

  badgeNewFire: "FOGO NOVO",
  badgeReport: "RELATO",
  badgeActive: "ATIVO",
  badgeRecent: "RECENTE",
  badgeWatched: "MONITORADO",
  badgeOld: "ANTIGO",
  confPossible: "possível",
  confProbable: "provável",
  confCorroborated: "corroborado",
  close: "Fechar",
  firstMention: "Primeira menção",
  postsWindow: (n: number, src: string) => `${n} publicação${n > 1 ? "ões" : ""} no ${src} (12 h)`,
  lastLabel: "última",
  positionNote: "Posição = centro do município citado, não do fogo",
  share: "Compartilhar",
  linkCopied: "Link copiado ✓",
  shareSignal: (place: string) => `kanari — relato perto de ${place}`,
  shareEvent: (place: string) => `kanari — foco ${place}`,
  signalFootnote:
    "Relato ainda não confirmado por satélite: ou o fogo é pequeno ou recente demais para ser visto (precocidade!), ou não é um incêndio florestal.",
  beforePress: (d: string) => `detectado ${d} antes da imprensa`,
  citizenMention: "Primeira menção cidadã",
  satFirst: "Primeiro sinal de satélite",
  lastSignal: "Último sinal",
  wind: (speed: number, dir: string) => `Vento ${speed} km/h de ${dir}`,
  spreadLine: (km: number, dir: string) =>
    `Propagação estimada 3 h: ~${km} km para ${dir} (só vento, indicativo)`,
  legendSpread: "Cone laranja: propagação estimada (vento + relevo, indicativo)",
  gusts: (g: number) => ` · rajadas ${g}`,
  riskLabel: "Risco meteorológico estimado",
  riskLevels: ["baixo", "moderado", "alto", "muito alto"],
  riskNote:
    "Risco estimado a partir de temperatura, umidade, vento e chuva recente (Open-Meteo). Estimativa indicativa, não oficial.",
  viewDetail: "Ver detalhes",
  hideDetail: "Ocultar detalhes",
  dlFirstUTC: "Primeiro sinal (UTC)",
  dlDetections: "Detecções",
  dlPower: "Potência máx",
  dlPosition: "Posição",
  dlDfci: "Grade DFCI",
  worldviewLink: "Imagem de satélite (NASA Worldview)",
  statusFading: (h: number) =>
    `Sem sinal há ${h} h — possível extinção, ou fogo encoberto (nuvens, copa das árvores)`,
  corrobBy: (n: number, place: string, km?: number) =>
    `Corroborado por ${n} relato${n > 1 ? "s" : ""} perto de ${place}${
      km !== undefined && km >= 5 ? ` (a ~${km} km)` : ""
    }`,
  nearLabel: (place: string) => `perto de ${place}`,
  badgeUnverified: "A VERIFICAR",
  searchWitnesses: (more: boolean) => `Buscar ${more ? "mais " : ""}testemunhas`,
  searchingWitnesses: "Buscando testemunhas…",
  searchUnavailable: "Busca indisponível no momento.",
  zoneLabel: "Área",
  witnessesFound: (n: number) => `${n} relato${n !== 1 ? "s" : ""} encontrado${n !== 1 ? "s" : ""} (48 h)`,
  bskyUnreachable:
    "A busca no Bluesky está momentaneamente inacessível dos nossos servidores — tente mais tarde.",
  noWitnesses:
    "Nenhuma menção no Bluesky para esta área. Não significa que não há fogo — só que não há testemunhas conectadas.",
  eventFootnote:
    "O « primeiro sinal » é a hora da primeira passagem de satélite que viu este foco — a ignição real pode ser anterior.",

  ago: (txt: string) => `há ${txt}`,
  compass: ["N", "NE", "L", "SE", "S", "SO", "O", "NO"],
};

export const DICT: Record<Lang, typeof fr> = { fr, en, es, pt };
export type Dict = typeof fr;
