// Kit d'intégration (page /[lang]/widget) : au-delà de l'iframe, tout ce qu'un
// partenaire peut brancher gratuitement — par public, avec le bon outil.
// 4 langues, texte brut : le rendu est dans la page.

export type KitAudience = { h: string; p: string; cta: { href: string; label: string } };

export const KIT = {
  fr: {
    whoTitle: "Pour qui, avec quel outil",
    who: [
      { h: "Médias et rédactions locales", p: "Une carte des feux en direct centrée sur votre zone dans vos articles et vos lives, des chiffres citables (observatoire par département, pays et mois), un flux RSS et des images de partage prêtes à l'emploi.", cta: { href: "/fr/statistiques", label: "Chiffres citables" } },
      { h: "Collectivités, SDIS et communes", p: "Une veille satellite mondiale gratuite en complément de vos dispositifs, des alertes par zone pour vos équipes, la page de votre département à relier depuis votre site, et l'open data pour vos bilans.", cta: { href: "/fr/sdis", label: "Offre SDIS et collectivités" } },
      { h: "Applis et sites outdoor", p: "Randonnée, trail, camping, vol libre : affichez les départs de feu autour d'un itinéraire via l'API (foyers des 6 à 72 dernières heures, JSON, sans clé) ou le widget centré sur un massif.", cta: { href: "/fr/api", label: "API JSON" } },
      { h: "Sites météo et climat", p: "Ajoutez la couche feux à vos cartes : détections satellite toutes les 10 minutes (Meteosat, GOES), avions en vol, archive complète en CSV pour vos analyses et vos comparatifs saisonniers.", cta: { href: "/opendata/feux.csv", label: "Open data CSV" } },
    ] as KitAudience[],
    beyondTitle: "Au-delà du widget : API, serveur MCP, open data",
    beyondIntro: "Mêmes données, mêmes règles (gratuit, attribution « kanari.io ») :",
    apiLabel: "Foyers en temps réel (JSON)",
    mcpLabel: "Assistants IA (serveur MCP, Claude / ChatGPT / Cursor)",
    csvLabel: "Archive complète (CSV, CC BY 4.0)",
    rssLabel: "Flux RSS des derniers feux",
    badgeTitle: "Badge et logos",
    badgeText: "Si vous affichez des données kanari hors du widget (API, CSV), ajoutez ce badge ou la mention « Données : kanari.io » avec un lien. Logos en SVG, libres pour cet usage :",
    badgeHtmlLabel: "Code HTML du badge",
    logosLabel: "Télécharger les logos",
    contact: "Une intégration particulière (volumes, webhooks, format, co-branding) ? Écrivez à contact@kanari.io, réponse rapide.",
  },
  en: {
    whoTitle: "Who it is for, with which tool",
    who: [
      { h: "Newsrooms and local media", p: "A live fire map centered on your area in articles and live blogs, citable figures (observatory by country and month), an RSS feed and ready-made share images.", cta: { href: "/en/statistiques", label: "Citable figures" } },
      { h: "Local authorities and fire services", p: "A free worldwide satellite watch alongside your own systems, area alerts for your teams, a country or state page to link from your site, and open data for your reports.", cta: { href: "/en/fires", label: "Pages by country and state" } },
      { h: "Outdoor apps and websites", p: "Hiking, trail running, camping, paragliding: show fire starts around a route with the API (clusters of the last 6 to 72 hours, JSON, no key) or the widget centered on a range.", cta: { href: "/en/api", label: "JSON API" } },
      { h: "Weather and climate sites", p: "Add a fire layer to your maps: satellite detections every 10 minutes (Meteosat, GOES), aircraft in flight, full CSV archive for analyses and seasonal comparisons.", cta: { href: "/opendata/feux.csv", label: "Open data CSV" } },
    ] as KitAudience[],
    beyondTitle: "Beyond the widget: API, MCP server, open data",
    beyondIntro: "Same data, same rules (free, credit “kanari.io”):",
    apiLabel: "Real-time fire clusters (JSON)",
    mcpLabel: "AI assistants (MCP server, Claude / ChatGPT / Cursor)",
    csvLabel: "Full archive (CSV, CC BY 4.0)",
    rssLabel: "RSS feed of latest fires",
    badgeTitle: "Badge and logos",
    badgeText: "If you display kanari data outside the widget (API, CSV), add this badge or the mention “Data: kanari.io” with a link. SVG logos, free for this use:",
    badgeHtmlLabel: "Badge HTML",
    logosLabel: "Download logos",
    contact: "A specific integration (volumes, webhooks, format, co-branding)? Write to contact@kanari.io, fast reply.",
  },
  es: {
    whoTitle: "Para quién, con qué herramienta",
    who: [
      { h: "Medios y redacciones locales", p: "Un mapa de incendios en vivo centrado en tu zona en artículos y directos, cifras citables (observatorio por país y mes), un feed RSS e imágenes para compartir.", cta: { href: "/es/statistiques", label: "Cifras citables" } },
      { h: "Administraciones y servicios de emergencia", p: "Una vigilancia satelital mundial gratuita junto a tus sistemas, alertas por zona para tus equipos, una página por país para enlazar desde tu web y datos abiertos para tus informes.", cta: { href: "/es/fires", label: "Páginas por país" } },
      { h: "Apps y sitios outdoor", p: "Senderismo, trail, camping, parapente: muestra los focos alrededor de una ruta con la API (focos de las últimas 6 a 72 horas, JSON, sin clave) o el widget centrado en un macizo.", cta: { href: "/en/api", label: "API JSON" } },
      { h: "Sitios de meteorología y clima", p: "Añade la capa de incendios a tus mapas: detecciones satelitales cada 10 minutos (Meteosat, GOES), aviones en vuelo, archivo completo en CSV para análisis y comparativas estacionales.", cta: { href: "/opendata/feux.csv", label: "Datos abiertos CSV" } },
    ] as KitAudience[],
    beyondTitle: "Más allá del widget: API, servidor MCP, datos abiertos",
    beyondIntro: "Mismos datos, mismas reglas (gratis, mención « kanari.io »):",
    apiLabel: "Focos en tiempo real (JSON)",
    mcpLabel: "Asistentes de IA (servidor MCP, Claude / ChatGPT / Cursor)",
    csvLabel: "Archivo completo (CSV, CC BY 4.0)",
    rssLabel: "Feed RSS de los últimos incendios",
    badgeTitle: "Insignia y logotipos",
    badgeText: "Si muestras datos de kanari fuera del widget (API, CSV), añade esta insignia o la mención « Datos: kanari.io » con un enlace. Logotipos en SVG, libres para este uso:",
    badgeHtmlLabel: "HTML de la insignia",
    logosLabel: "Descargar logotipos",
    contact: "¿Una integración particular (volúmenes, webhooks, formato, co-branding)? Escribe a contact@kanari.io.",
  },
  pt: {
    whoTitle: "Para quem, com qual ferramenta",
    who: [
      { h: "Veículos e redações locais", p: "Um mapa de incêndios ao vivo centrado na sua região em artigos e coberturas ao vivo, números citáveis (observatório por país e mês), um feed RSS e imagens prontas para compartilhar.", cta: { href: "/pt/statistiques", label: "Números citáveis" } },
      { h: "Prefeituras, defesa civil e bombeiros", p: "Uma vigilância satelital mundial gratuita ao lado dos seus sistemas, alertas por área para as equipes, uma página por país para linkar do seu site e dados abertos para relatórios.", cta: { href: "/pt/fires", label: "Páginas por país" } },
      { h: "Apps e sites outdoor", p: "Trilhas, trail running, camping, voo livre: mostre os focos ao redor de um percurso com a API (focos das últimas 6 a 72 horas, JSON, sem chave) ou o widget centrado em uma serra.", cta: { href: "/en/api", label: "API JSON" } },
      { h: "Sites de meteorologia e clima", p: "Adicione a camada de incêndios aos seus mapas: detecções de satélite a cada 10 minutos (Meteosat, GOES), aeronaves em voo, arquivo completo em CSV para análises e comparações sazonais.", cta: { href: "/opendata/feux.csv", label: "Dados abertos CSV" } },
    ] as KitAudience[],
    beyondTitle: "Além do widget: API, servidor MCP, dados abertos",
    beyondIntro: "Mesmos dados, mesmas regras (grátis, menção « kanari.io »):",
    apiLabel: "Focos em tempo real (JSON)",
    mcpLabel: "Assistentes de IA (servidor MCP, Claude / ChatGPT / Cursor)",
    csvLabel: "Arquivo completo (CSV, CC BY 4.0)",
    rssLabel: "Feed RSS dos últimos incêndios",
    badgeTitle: "Selo e logotipos",
    badgeText: "Se você exibe dados do kanari fora do widget (API, CSV), adicione este selo ou a menção « Dados: kanari.io » com um link. Logotipos em SVG, livres para este uso:",
    badgeHtmlLabel: "HTML do selo",
    logosLabel: "Baixar logotipos",
    contact: "Uma integração específica (volumes, webhooks, formato, co-branding)? Escreva para contact@kanari.io.",
  },
} as const;

export const BADGE_HTML = (lang: "fr" | "en" | "es" | "pt") =>
  `<a href="https://kanari.io/${lang}" title="kanari"><img src="https://kanari.io/brand/badge-kanari-${lang === "fr" ? "fr" : "en"}.svg" alt="${lang === "fr" ? "Données : kanari.io" : "Data: kanari.io"}" height="28" /></a>`;
