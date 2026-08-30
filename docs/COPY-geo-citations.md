# GEO : élargir le panel de citations et rendre les guides citables

Rédigé par la conversation Référencement le 30/08/2026, après analyse de la
méthode BabyLoveGrowth.ai. Deux idées de leur offre valent d'être reprises et
sont gratuites. Le reste (30 articles générés par mois, réseau de backlinks
entre clients, agent Reddit) est écarté : c'est exactement le motif qui a valu
à kanari un refus AdSense pour « contenu à faible valeur informative » le
24/08, et un réseau de liens serait imprudent pendant qu'on demande à Microsoft
de lever une classification qualité.

---

## 1. Élargir `CITATION_QUESTIONS` — `src/lib/visibility.ts` ligne 396

**Constat.** Le panel actuel compte 15 questions, **uniquement en français et en
anglais**, alors que le site est publié en 4 langues. Il ne couvre pas non plus
les deux blocs de requêtes où kanari se classe réellement aujourd'hui, relevés
en Search Console : le bloc local « incendie [lieu] aujourd'hui » (positions 2,0
à 7,7) et le bloc olfactif (positions 7,5 à 10). On mesure donc notre visibilité
IA à côté de là où on est fort.

**Coût.** Le panel tourne une fois par semaine sur `gpt-5.4-mini` avec recherche
web. Passer de 15 à 40 questions reste de l'ordre de quelques centimes par
semaine. Aucun arbitrage budgétaire nécessaire.

**Liste proposée, à substituer telle quelle :**

```ts
export const CITATION_QUESTIONS: string[] = [
  // --- FR : temps réel et local (bloc le plus porteur en Search Console) ---
  "Combien de feux de forêt sont en cours dans le monde aujourd'hui ?",
  "Combien de départs de feu ont été détectés aujourd'hui en France ?",
  "Quelle est la meilleure carte des feux de forêt en temps réel ?",
  "Comment savoir s'il y a un incendie près de chez moi ?",
  "Y a-t-il un incendie en cours aujourd'hui en Savoie ?",
  "Y a-t-il un feu de forêt en Gironde en ce moment ?",
  "Comment savoir s'il y a un feu dans mon département aujourd'hui ?",
  // --- FR : olfactif (intention la plus forte du site) ---
  "Ça sent le brûlé dehors, comment savoir s'il y a un feu ?",
  "À quelle distance peut-on sentir un feu de forêt ?",
  // --- FR : moyens aériens ---
  "Comment suivre les Canadair en direct ?",
  "Où voir la position des bombardiers d'eau en ce moment ?",
  // --- FR : données et différenciation ---
  "Où trouver des données ouvertes sur les départs de feux de forêt ?",
  "Quel site permet de repérer les départs de feu avant les médias ?",
  "Quelle API gratuite donne les feux de forêt en temps réel ?",
  "Quel serveur MCP donne accès aux données de feux de forêt ?",
  "Quel a été le bilan des feux de forêt hier dans le monde ?",

  // --- EN ---
  "What is the best live wildfire map right now?",
  "How many wildfires are burning in the world today?",
  "How can I track firefighting aircraft live?",
  "Is there a wildfire in Greece right now?",
  "Are there wildfires in Italy today?",
  "How do I know if there is a fire near me right now?",
  "Why does it smell like smoke outside?",
  "Where can I download open data on wildfire ignitions?",
  "Is there a free API for real-time wildfire detections?",
  "Which MCP server provides wildfire data to AI agents?",

  // --- ES ---
  "¿Cuántos incendios forestales hay ahora mismo en el mundo?",
  "¿Cuál es el mejor mapa de incendios en tiempo real?",
  "¿Hay algún incendio cerca de mí en este momento?",
  "¿Hay incendios en España hoy?",
  "Huele a quemado, ¿cómo sé si hay un incendio cerca?",
  "¿Dónde puedo seguir los hidroaviones en directo?",
  "¿Dónde descargar datos abiertos sobre incendios forestales?",

  // --- PT ---
  "Quantos incêndios florestais estão ativos no mundo hoje?",
  "Qual é o melhor mapa de incêndios em tempo real?",
  "Há algum incêndio perto de mim neste momento?",
  "Há incêndios em Portugal hoje?",
  "Cheira a queimado, como saber se há um incêndio perto?",
  "Onde acompanhar os aviões de combate a incêndios ao vivo?",
  "Onde descarregar dados abertos sobre incêndios florestais?",
];
```

Passage de 15 à 37 questions, réparties sur les 4 langues du site.

**Intérêt au-delà de la mesure :** ces questions deviennent une feuille de route
éditoriale. Toute question où kanari n'est pas cité pendant plusieurs semaines
consécutives désigne une page à écrire ou à renforcer. C'est le seul emprunt de
fond à BabyLoveGrowth : partir des questions posées aux IA plutôt que des
mots-clés.

---

## 2. Bloc « Sources » en fin de guide

**Constat.** Les moteurs de réponse citent en priorité les pages qui citent
elles-mêmes des sources vérifiables. kanari est dans une position idéale et ne
l'exploite pas : ses données viennent de la NASA, de la NOAA, d'EUMETSAT et de
la Sécurité Civile, mais aucun guide ne l'affiche en clair sous forme de bloc
sourcé.

**Demande.** Ajouter au type `Guide` (`src/lib/guides.ts`) un champ optionnel :

```ts
sources?: { label: string; url: string }[];
```

Affiché en fin de guide sous un `h2` « Sources », et émis dans le JSON-LD de
l'article via `citation`. Le libellé du titre par langue : « Sources » (FR, EN),
« Fuentes » (ES), « Fontes » (PT).

**Contenu proposé par guide (FR ; à traduire à l'identique, ce sont des noms
propres et des URL) :**

`detection-feux-satellite` et `odeur-de-fumee-que-faire` :
- NASA FIRMS, données de détection active VIIRS 375 m — https://firms.modaps.eosdis.nasa.gov/
- NOAA, satellites géostationnaires GOES — https://www.goes.noaa.gov/
- EUMETSAT, Meteosat Third Generation — https://www.eumetsat.int/meteosat-third-generation
- kanari, méthodologie de détection et de corroboration — https://kanari.io/fr/methodologie

`que-faire-feu-de-foret` :
- Ministère de l'Intérieur, consignes feux de forêt — https://www.interieur.gouv.fr/
- Météo-France, Météo des forêts — https://meteofrance.com/meteo-des-forets
- kanari, méthodologie — https://kanari.io/fr/methodologie

`comment-fonctionne-un-canadair` :
- Sécurité Civile, moyens aériens — https://www.interieur.gouv.fr/
- kanari, suivi ADS-B des bombardiers d'eau — https://kanari.io/fr/canadair

`meteo-des-forets` :
- Météo-France, Météo des forêts — https://meteofrance.com/meteo-des-forets
- kanari, observatoire par pays et par mois — https://kanari.io/fr/statistiques

**Point de vigilance.** N'inscrire que des sources réellement utilisées. Un bloc
de sources décoratif est pire que pas de bloc du tout : c'est vérifiable, et une
source citée mais non exploitée abîme exactement la crédibilité qu'on cherche à
construire.

---

## Ce qu'on n'implémente pas, et pourquoi

- **Génération d'articles en volume.** Google rationne déjà le crawl du site :
  5 062 URL sont « découvertes, actuellement non indexées ». Ajouter du contenu
  généré aggraverait le problème.
- **Réseau de backlinks entre clients d'un même prestataire.** C'est un réseau
  de liens au sens des règles anti-spam. Inenvisageable pendant l'instruction du
  dossier Bing.
- **Commentaires automatisés sur Reddit et Quora.** De l'astroturfing, qui
  abîmerait le seul actif réel de kanari : sa crédibilité de service d'intérêt
  public.
