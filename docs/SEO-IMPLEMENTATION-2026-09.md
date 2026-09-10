# Mise en œuvre de l’audit SEO/GEO, septembre 2026

## Socle livré

- Export CSV complet, sans plafond silencieux de 10 000 ; filtres mois et pays, nombre de lignes en en-tête. Lecture bornée : panne explicite plutôt que fichier incomplet.
- Agrégats mensuels sans plafond de 20 000, conservation du dernier résultat valide lors d’une panne via ISR.
- Sitemaps alignés sur les seuils d’indexabilité existants ; dates artificielles retirées. Nouveau contrôle transversal borné en CI, en complément du garde 42 cibles.
- Enrichissements des fiches feu chargés après le contenu principal. Cache des données de deux minutes. Le cache de page complet a été retiré de cette route après un blocage constaté sur Vercel.
- Canadair et accueil : cache court ; sources et limites rendues lisibles. Numéro d’urgence géographique également récupéré en cas d’arrivée directe sur une page interne.
- Précocité : écarts négatifs inclus, médiane indépendante de la liste visible, sources presse lorsqu’elles sont disponibles. La mesure ne porte pas sur la latence de publication kanari.
- Attributions des widgets limitées à la marque, avec nofollow autorisé et proposé.

## Contenu utile à renforcer

Les citations de l’observatoire comptent des événements archivés, pas des incendies distincts confirmés. Pages prioritaires : Canadair en quatre langues ; Yonne et Vendée en français ; Bosnie et Algérie dans les langues déjà servies, avec sources officielles et limites géographiques explicites. Conserver les URL et les titres établis.

Le premier bilan mensuel doit être relu à partir du CSV de la même période, en vérifiant somme des jours, somme des pays, absence de doublons de slug et total du Dataset. Les chiffres issus d’un fichier anciennement plafonné ne doivent pas être republiés.

## Protocole pour les études originales

Une étude capteur/presse doit comporter l’URL des articles, leurs dates, la fenêtre géographique, la justification du rapprochement et les contre-exemples. Plusieurs enregistrements associés au même article ne prouvent pas plusieurs feux indépendants. Une étude du délai propre à kanari nécessite des horodatages de disponibilité et de publication ; ils ne sont pas historiquement établis par la simple première détection satellite. Pas de résultat quantifié sans ces preuves.

## Suivi et distribution

Suivi hebdomadaire : fenêtres de 28 jours comparables, groupes Canadair/local/guides/observatoire, pays et langues, indicateurs Google IA et Copilot séparés des visites. Mesurer aussi les intégrations utilisées et inscriptions confirmées. Les User-Agents seuls ne prouvent pas l’identité des bots. Les chiffres des comptes sont conservés localement, pas dans le dépôt public.

Démarches et prévention des doublons : voir DISTRIBUTION-CHECKLIST.md. Windy appartient déjà à une autre conversation de développement. Visorando doit pouvoir répondre à la proposition envoyée avant toute relance. L’objectif de trois à cinq intégrations est un objectif de travail, jamais un résultat acquis.

Aucun achat publicitaire, backlink payant, abonnement ou création de compte ne découle de cette mise en œuvre. La présence d’un MCP ou de llms.txt ne garantit pas une recommandation par un assistant. Une amélioration technique ne garantit pas une date de reprise Bing.
