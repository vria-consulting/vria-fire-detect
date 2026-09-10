import type { Lang } from "./i18n";
export const AIRCRAFT_EDITORIAL: Record<Lang, { night: string; how: string; why: string; title: string; steps: string[]; guide: string; methods: string; sources: string }> = {
  fr: {
    night: "L'activité varie avec les missions, les conditions de vol et la couverture du réseau. Certains hélicoptères spécialisés peuvent intervenir la nuit. Une carte vide ne prouve pas l'absence de moyens aériens.",
    how: "kanari interroge les réseaux communautaires ADS-B, puis identifie les moyens anti-incendie par type, immatriculation et indicatif. La carte actualise les positions et interpole le mouvement entre les observations. Ce mouvement n'est pas une nouvelle mesure. La réception et l'identification ne couvrent pas tous les appareils.",
    why: "Un appareil peut être hors couverture, mal identifié, au sol, en transit ou absent du flux reçu. La seule absence d'un symbole ne permet pas de conclure que son transpondeur est coupé ou qu'aucun secours n'intervient. Une position près d'un feu ne confirme pas un largage.",
    title: "Lire une position sans surinterpréter la mission",
    steps: ["Ouvrez la carte et rapprochez-vous de la zone recherchée.", "Sélectionnez un appareil : comparez son modèle, sa position, son altitude et sa trajectoire avec les détections de la zone.", "Vérifiez les informations des autorités locales pour connaître les moyens réellement engagés. Le suivi public n'est pas un outil de coordination opérationnelle."],
    guide: "Fonctionnement et capacités des Canadair", methods: "Sources et limites de kanari", sources: "Sources : réseaux ADS-B communautaires et exemple officiel d'hélicoptère capable de vol nocturne.",
  },
  en: {
    night: "Activity depends on missions, flying conditions and receiver coverage. Some specialist helicopters can operate at night. An empty map does not prove there are no firefighting aircraft.",
    how: "kanari queries community ADS-B networks and identifies firefighting assets by type, registration and callsign. The map refreshes positions and interpolates movement between observations. Interpolated movement is not a new measurement. Reception and identification do not cover every aircraft.",
    why: "An aircraft may be outside receiver coverage, unidentified, on the ground, in transit or missing from the received feed. An absent icon does not establish that its transponder is off or that no crews are responding. A position near a fire does not confirm a water drop.",
    title: "Read the position without assuming the mission",
    steps: ["Open the map and navigate to your area of interest.", "Select an aircraft and compare its type, position, altitude and track with nearby detections.", "Check local authorities for confirmed deployments. Public tracking is not an operational dispatch system."],
    guide: "How Canadair water bombers work", methods: "kanari sources and limitations", sources: "Sources: community ADS-B networks and an official example of a night-capable firefighting helicopter.",
  },
  es: {
    night: "La actividad depende de las misiones, las condiciones de vuelo y la cobertura. Algunos helicópteros especializados pueden operar de noche. Un mapa vacío no demuestra que no haya medios aéreos.",
    how: "kanari consulta redes comunitarias ADS-B e identifica los medios por tipo, matrícula e indicativo. El mapa actualiza posiciones e interpola el movimiento entre observaciones; esa animación no es una nueva medición. La recepción y la identificación no cubren todas las aeronaves.",
    why: "Un avión puede estar fuera de cobertura, sin identificar, en tierra, en tránsito o ausente del flujo recibido. Su ausencia no demuestra que tenga el transpondedor apagado ni que no haya una intervención. Una posición cerca de un incendio no confirma una descarga.",
    title: "Cómo interpretar una posición",
    steps: ["Abra el mapa y busque la zona.", "Seleccione una aeronave y compare tipo, posición, altitud y trayectoria con las detecciones cercanas.", "Consulte a las autoridades para confirmar los medios desplegados. Este seguimiento no coordina operaciones."],
    guide: "Cómo funciona un Canadair (en inglés)", methods: "Fuentes y límites de kanari", sources: "Fuentes: redes ADS-B comunitarias y ejemplo oficial de helicóptero con capacidad nocturna.",
  },
  pt: {
    night: "A atividade depende das missões, das condições de voo e da cobertura. Alguns helicópteros especializados podem operar à noite. Um mapa vazio não prova a ausência de meios aéreos.",
    how: "kanari consulta redes comunitárias ADS-B e identifica os meios por tipo, matrícula e indicativo. O mapa atualiza as posições e interpola o movimento entre observações; a animação não é uma nova medição. A recepção e a identificação não cobrem todas as aeronaves.",
    why: "Uma aeronave pode estar fora da cobertura, sem identificação, no solo, em trânsito ou ausente do fluxo recebido. Sua ausência não prova que o transponder esteja desligado nem que não haja resposta. Uma posição perto de um foco não confirma um lançamento de água.",
    title: "Como interpretar uma posição",
    steps: ["Abra o mapa e encontre a região.", "Selecione uma aeronave e compare tipo, posição, altitude e trajetória com as detecções próximas.", "Consulte as autoridades para confirmar os meios mobilizados. O rastreamento público não coordena operações."],
    guide: "Como funciona um Canadair (em inglês)", methods: "Fontes e limites do kanari", sources: "Fontes: redes ADS-B comunitárias e exemplo oficial de helicóptero com capacidade noturna.",
  },
};
