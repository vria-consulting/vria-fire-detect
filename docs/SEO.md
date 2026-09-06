# Référencement kanari.io : état de l'art, audit, corrections, plan

Tenu par la conversation Référencement et croissance. Dernière mise à jour : 7 septembre 2026.
Méthode : règle zéro (photographie avant et après dans `docs/seo-baseline-<date>.txt`,
changements additifs, un lot par déploiement). Toute mesure ci-dessous vient de la
production, de la Search Console, de Bing Webmaster Tools ou de Lighthouse local, jamais
du code seul.

## 1. Où en est kanari.io le 7 septembre 2026

| Mesure | Valeur | Source |
| --- | --- | --- |
| Pages indexées Google | 4 890 (propriété de domaine), 4 840 (préfixe https) | Search Console, rapport du 04/09 |
| Non indexées | 3 010, dont 1 914 « détectée, non indexée », 675 `noindex` voulus, 393 « explorée, non indexée » | idem |
| Clics Google 28 j | 173 (86 le 28/08, 72 le 24/08) | Search Console |
| Impressions 28 j | 4 200 (1 800 le 28/08) | Search Console |
| Position moyenne 28 j | 28,1 ; requêtes distinctes : 977 | Search Console |
| Core Web Vitals terrain | pas assez de données (site trop jeune) | Search Console |
| Lighthouse mobile, accueil `/fr` | perf 87, SEO 100, LCP 3,9 s, TBT 110 ms, CLS 0 | Lighthouse 12.8 local |
| Lighthouse mobile, guide | perf 99, LCP 2,1 s | idem |
| Lighthouse mobile, page département | perf 98, LCP 2,3 s | idem |
| JavaScript de l'accueil | 1 753 Ko compressés, 11 chunks ; 287 Ko inutilisés ; 14 Ko de polyfills | curl + Lighthouse |
| Liens externes vus par Google | 0 (rapport encore vide) ; Bing en voit 2 à 3 | Search Console, Bing WMT |
| Bing | toujours filtré : « No pages found », sitemaps non relus depuis le 24 et 25/08 | Bing WMT |
| Sitemaps | 738 + 1 446 + 302 URL, 2 890 vérifiées en 200, 1 timeout transitoire revérifié en 200 | baseline |

Lecture : Google progresse vite (clics doublés en dix jours, impressions ×2,3) et le
correctif de cache du 26/08 a débloqué l'indexation (« détectée, non indexée » de 5 062
à 1 914). Le trafic vient d'une longue traîne géographique en quatre langues (« incendie
[département] aujourd'hui », « fires in [country] today »), en positions 2 à 9. Bing reste
perdu à court terme, dossier escaladé chez Microsoft le 27/08, sans suite. Le plafond
structurel est l'autorité : trois liens entrants réels.

## 2. Audit des six chantiers

| Chantier | État | Preuve |
| --- | --- | --- |
| **1. Autorité sur le sujet** : pilier 2 500 mots + satellites + maillage descriptif | Partiel. Pas de page pilier : la page la plus longue fait 1 108 mots (`/fr/feux-en-cours`), l'accueil 78 mots contre 1 887 pour incendieencours.fr. Satellites nombreux (guides 800 à 1 057 mots, observatoire, départements, pays). Maillage : 918 des 926 URL du sitemap principal à 3 clics ou moins ; **8 pages orphelines : les pages newsletter**, absentes du pied de page et du menu | `docs/seo-baseline-2026-09-07.txt` (mots par page) ; crawl interne du 07/09 |
| **2. Confiance (E-E-A-T)** | Partiel. `Organization` présente avec logo mais `sameAs` limité à GitHub et YouTube, pas de `WebSite`, pas de fondateur ni d'éditeur nommé, `datePublished` absent des articles (`dateModified` présent). Page À propos 336 mots, méthodologie 852 mots avec DOI. Données originales : observatoire pays × mois, précocité mesurée, archive CC BY 4.0 | `curl https://kanari.io/fr` JSON-LD ; baseline |
| **3. Technique** | Bon. Rendu serveur, redirections http et www et vercel.app en 308 une seule étape, 404 réel, canoniques absolus partout, un seul h1 partout, 0 JSON-LD invalide, sitemaps propres, `robots.txt` correct. Manques : `x-default` absent de toutes les pages internes, `hreflang` incomplet sur `/a-propos` (fr, en déclarés ; es, pt existent), descriptions trop longues (accueil 208, 223, 227 car.), titres > 60 sur `/fr`, `/fr/statistiques`, `/fr/api`, titres trop courts sur `/a-propos` (17) et `/precocite` (26). LCP accueil 3,9 s, 0 police en `preload`, 14 Ko de polyfills | baseline ; Lighthouse |
| **4. Écrit pour être cité par les IA** | Bon sur les guides (FAQPage, réponse d'ouverture, sections en questions), l'observatoire (Dataset, FAQ), canadair, widget, feux-en-cours (FAQ + ItemList). Manques : aucune FAQ sur l'accueil, ni sur les pages pays et département qui sont celles qui se classent ; `llms.txt` présent (7,3 Ko, 4 langues, licence) mais sans éditeur ni règles de confidentialité ; robots IA tous autorisés (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended en 200) | `curl -A GPTBot` ; `public/llms.txt` |
| **5. Liens gagnés** | Faible. 26 domaines référents dont 3 éditoriaux réels (bizjournals, trackawesomelist, github). Registres faits : Zenodo (DOI), data.gouv, Kaggle, npm, registre MCP, Smithery. En cours : plugin Windy (feu vert reçu le 28 et 30/08), relances partenaires, Qwoted (pitch Trill Mag lu le 24/08) | Bing WMT Backlinks ; `docs/DISTRIBUTION-CHECKLIST.md` |
| **6. Marque et entité** | Partiel. « kanari feu » et « kanari.io » en position 1 sur Google. `Organization` en `@graph` avec logo, mais `sameAs` incomplet et pas de `WebSite`. Sur Bing, la requête de marque ne renvoie rien (filtre) | Search Console requêtes ; Bing SERP |

### Détail par page clé (production, 7 septembre 2026, avant corrections)

| Page | Mots | Titre | Desc. | hreflang | JSON-LD (hors Organization, WebApplication, Offer) |
| --- | ---: | ---: | ---: | ---: | --- |
| `/fr` | 78 | 68 | 208 | 5 | aucun |
| `/en` | 68 | 49 | 173 | 5 | aucun |
| `/fr/a-propos` | 336 | 17 | 152 | 2 (es, pt manquants) | FAQPage |
| `/fr/methodologie` | 852 | 56 | 222 | 4 | TechArticle, Dataset, BreadcrumbList |
| `/fr/canadair` | 806 | 63 | 221 | 4 | FAQPage |
| `/fr/canadair/f-zbmg` | 118 | 61 | 149 | 0 (FR seul) | aucun |
| `/fr/statistiques` | 723 | 68 | 188 | 4 | Dataset, FAQPage |
| `/fr/statistiques/france/2026-08` | 662 | 51 | 207 | 4 | Dataset, BreadcrumbList, Place |
| `/fr/feux` (hub 101 départements) | 440 | 60 | 181 | 0 (FR seul) | aucun |
| `/fr/feux/savoie` | 590 | 54 | 150 | 0 (FR seul) | BreadcrumbList |
| `/en/fires` (hub 96 pays) | 327 | 56 | 185 | 3 | aucun |
| `/en/fires/germany` | 514 | 50 | 162 | 3 | aucun |
| `/fr/guide` (hub) | 232 | 62 | 165 | 4 | aucun |
| `/fr/guide/odeur-de-fumee-que-faire` | 1 057 | 67 | 172 | 4 | Article, FAQPage |
| `/fr/feux-en-cours` | 1 108 | 65 | 212 | 0 (FR seul) | FAQPage, ItemList, BreadcrumbList |
| `/fr/feu` (hub archive) | 977 | 63 | 170 | 0 (FR seul) | aucun |
| `/fr/newsletter` | 251 | 37 | 172 | 4 | aucun ; **orpheline** |
| `/fr/api` | 723 | 70 | 179 | 2 | WebAPI, BreadcrumbList |
| `/fr/precocite` | 425 | 26 | 173 | 2 | aucun |

Concurrents sur « carte des feux en direct » : incendieencours.fr 1 887 mots, nifc.gov
642, feuxdeforet.fr 572, Watch Duty 9 (application).

## 3. Corrections dans le code

Chaque lot est un commit et un déploiement, vérifié en production par rejeu de
`scripts/seo-baseline.sh` et comparaison avec la baseline du 07/09.

| Lot | Contenu | État |
| --- | --- | --- |
| 1. Schéma | `WebSite` en `@graph` ; `Organization` : logo `ImageObject`, description, e-mail, fondateur, éditeur VRIA Consulting (SIREN), `sameAs` de 2 à 7 profils ; `Person` fondateur ; `datePublished` réel (git) et auteur `Person` sur les articles des guides | [fait] commit 5213975, PR ouverte |
| 2. hreflang | `x-default` sur toutes les pages internes ; `/a-propos` complété en es et pt | à faire |
| 3. Hubs | `CollectionPage` + `ItemList` + `BreadcrumbList` sur `/feux`, `/fires`, `/guide`, `/feu`, `/bilan`, `/newsletter` | à faire |
| 4. Maillage | lien newsletter dans le pied de page (4 langues) ; À propos et Confidentialité localisés en es et pt ; pages voisines sur les pages pays | à faire |
| 5. FAQ | 5 à 8 questions en `<details>` natifs + `FAQPage` sur l'accueil (4 langues) et gabarit de FAQ courte sur pages pays et département | à faire |
| 6. `llms.txt` | éditeur, règles de confidentialité, données ouvertes et licence, pages clés par langue | à faire |
| 7. Métadonnées | descriptions ramenées à 140 à 160 caractères sur les pages qui dépassent 190 ; titres trop courts enrichis sur `/a-propos` et `/precocite` (pages sans trafic) | à faire, titres soumis à accord |
| 8. Performance | polices en `preload`, polyfills retirés via `browserslist`, LCP de l'accueil | à faire |

## 4. Ce qui reste, par ordre d'effet

1. Plugin Windy (autorité et distribution) : chez la conversation Développement depuis le 30/08.
2. Page pilier « carte des feux de forêt en direct » de 2 500 mots reliant carte, observatoire, départements, pays, guides.
3. FAQ sur pays et départements, qui sont les pages qui se classent.
4. Liens : relances partenaires, annuaires de données de recherche (re3data, OpenAIRE), Qwoted.
5. Bing : attendre Microsoft, ne rien pousser.

## 5. Gestes qui ne dépendent que de Vincent (cinq minutes chacun)

- Fusionner la PR du lot 1, puis les suivantes, une par une (CI vert).
- Validation vidéo YouTube niveau 3 pour rendre les liens de description cliquables.
- Demander l'indexation dans Search Console des pages piliers modifiées (dix par jour au plus) : `/fr`, `/en`, `/fr/statistiques`, `/fr/canadair`, `/fr/guide/odeur-de-fumee-que-faire`, `/fr/feux`, `/en/fires`.
- Propriété de domaine `kanari.io` : faite le 06/09.

## 6. Sources lues

- `node_modules/next/dist/docs/` (Next 16.2.10, conventions App Router, proxy, cache).
- Google Search Central : hreflang et `x-default`, données structurées `Organization`, `WebSite`, `Article`, `FAQPage`, `CollectionPage`, `ItemList`, `BreadcrumbList`, `Dataset` ; Core Web Vitals.
- docs.windy-plugins.com (publication d'un plugin, revue par l'équipe Windy).
- Leçons lysea.io reprises telles quelles (exclusions voulues, robots des annonces, quota PageSpeed, validation DNS Hostinger).
