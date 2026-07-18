// Internationalisation Kanari — FR (défaut pays francophones) / EN (reste du
// monde). La langue est portée par l'URL (/fr, /en) : indispensable au SEO
// (hreflang, indexation des deux versions) et au référencement dans les LLM.

export const LANGS = ["fr", "en"] as const;
export type Lang = (typeof LANGS)[number];

// Pays dont la langue par défaut est le français (détection géo Vercel).
export const FRANCOPHONE = new Set([
  "FR", "BE", "CH", "LU", "MC", "SN", "CI", "ML", "BF", "NE", "TG", "BJ",
  "GA", "CG", "CD", "CM", "MG", "TN", "DZ", "MA", "HT", "GN", "RW", "BI",
  "TD", "CF", "DJ", "KM", "GQ", "VU", "NC", "PF", "GP", "MQ", "GF", "RE", "YT",
]);

export function isValidLang(x: string | undefined): x is Lang {
  return x === "fr" || x === "en";
}

const fr = {
  // Layout
  tagline: "l'alerte feu de forêt, avant tout le monde",
  navHow: "Comment ça marche",
  navAbout: "À propos",
  emergency: "Urgence ? 112",
  metaTitle: "kanari — l'alerte feu de forêt, avant tout le monde",
  metaDescription:
    "Carte mondiale en temps quasi réel des départs de feu de forêt : détection satellite (NASA FIRMS, Meteosat), témoignages citoyens vérifiés par IA, alertes gratuites par zone. Le canari chante avant la sirène.",

  // Recherche & contrôles
  searchPlaceholder: "Rechercher une ville ou une zone",
  myPosition: "Ma position",
  legend: "Légende",
  legendActive: "Feu actif · moins de 3 h",
  legendRecent: "Récent · 3 – 12 h",
  legendWatched: "Surveillé · 12 – 24 h",
  legendOld: "Ancien · plus de 24 h",
  legendCitizen: "Signalement citoyen",
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
  gusts: (g: number) => ` · rafales ${g}`,
  viewDetail: "Voir le détail",
  hideDetail: "Masquer le détail",
  dlFirstUTC: "Premier signal (UTC)",
  dlDetections: "Détections",
  dlPower: "Puissance max",
  dlPosition: "Position",
  corrobBy: (n: number, place: string) =>
    `Corroboré par ${n} témoignage${n > 1 ? "s" : ""} près de ${place}`,
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
  emergency: "Emergency? 112",
  metaTitle: "kanari — the wildfire alert, before anyone else",
  metaDescription:
    "Near real-time world map of wildfire ignitions: satellite detection (NASA FIRMS, Meteosat), AI-verified citizen reports, free area alerts. The canary sings before the siren.",

  searchPlaceholder: "Search a city or area",
  myPosition: "My location",
  legend: "Legend",
  legendActive: "Active fire · under 3 h",
  legendRecent: "Recent · 3 – 12 h",
  legendWatched: "Monitored · 12 – 24 h",
  legendOld: "Old · over 24 h",
  legendCitizen: "Citizen report",
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
  gusts: (g: number) => ` · gusts ${g}`,
  viewDetail: "View details",
  hideDetail: "Hide details",
  dlFirstUTC: "First signal (UTC)",
  dlDetections: "Detections",
  dlPower: "Max power",
  dlPosition: "Position",
  corrobBy: (n: number, place: string) =>
    `Corroborated by ${n} report${n > 1 ? "s" : ""} near ${place}`,
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

export const DICT: Record<Lang, typeof fr> = { fr, en };
export type Dict = typeof fr;
