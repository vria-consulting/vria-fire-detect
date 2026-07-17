# Instructions pour Claude Code — Refonte du front kanari.io

## Contexte
Kanari est une app de détection précoce des feux de forêt (écoute des réseaux sociaux + corroboration satellite/météo). Ce dossier contient la charte graphique complète et une maquette HTML de référence de la nouvelle interface carte. Ta mission : appliquer cette charte et cette maquette au front existant du site.

## Fichiers fournis
- `SKILL.md` + `readme.md` — la charte : voix/copy, fondations visuelles, iconographie. **Lis-les en premier.**
- `styles.css` + `tokens/` — les design tokens CSS (couleurs, typo, espacement, rayons, ombres, motion). À importer tel quel dans le projet.
- `assets/` — les logos SVG (transparence réelle, ne jamais les redessiner) : symbole couleur, monochromes noir/blanc/jaune, versions animées, favicon simplifié.
- `maquette/Kanari App Redesign v2.dc.html` — **la cible visuelle** de l'interface carte (ouvrable dans un navigateur). C'est la référence pixel : header clair, recherche, chips de période, flux « En direct », CTA central, fiche foyer.
- `components/` — primitives React de référence (Button, Input, Badge, Alert, Toast, Tabs, Card, Switch…) avec leurs contrats `.d.ts`.
- `ui_kits/website/index.html` — homepage marketing de référence.

## Directives d'implémentation (dans l'ordre)
1. **Tokens d'abord** : importe `styles.css` globalement ; remplace toute couleur/taille codée en dur par les variables (`--canary`, `--charcoal`, `--paper`, `--radius-pill`…). Fonts : Fredoka (titres) + DM Sans (corps) via Google Fonts.
2. **Header** : fond clair `rgba(251,249,244,.9)` + blur 12px, lockup = `assets/logo-symbole.svg` + « kanari » en Fredoka 500 noir (jamais blanc sur clair). Bouton « Urgence ? 112 » en braise `--ember`, pill.
3. **Fond de carte** : passer le style MapLibre/OSM en thème CLAIR (le placeholder rayé de la maquette montre l'emplacement).
4. **Marqueurs** : supprimer les emoji 🔥💧. Pastilles rondes bordées de blanc : `--danger` (<3h, avec anneau pulsant `kping`), `--ember` (3–12h), `--canary-strong` (12–24h), `--ink-3` (>24h), `#4A90C2` (signalement citoyen).
5. **Contrôles** : barre de recherche pill blanche + bouton « Ma position » jaune ; période réduite à 3 chips (6h / 24h / 72h, actif = charbon) ; légende repliée derrière un chip « Légende ».
6. **Flux droite** : panneau blanc radius 22, onglets « Tout / Urgents » segmentés, items groupés par temps (« À l'instant », « Dernière heure ») : lieu en gras, méta sourcée dessous, horodatage à droite. Hover `--canary-tint`.
7. **CTA principal** : « M'alerter sur cette zone » en pill jaune flottant bas-centre, avec point pulsant ; état activé = charbon « Zone sous alerte — kanari veille ✓ ».
8. **Fiche foyer** (clic marqueur) : carte blanche avec badge d'état, mini-timeline sourcée (mention → satellite → météo), actions « Voir le détail / Partager ».
9. **Micro-interactions** : `--ease-out`, 150–250ms ; hover = fond plus foncé ou lift léger ; press scale(0.98) ; animation signature `kanari-wave` sur tout indicateur « écoute en cours ». Focus ring jaune jamais supprimé.
10. **Copy** : ton factuel-chaleureux, tutoiement, toujours sourcé (« il y a 12 min · 2 posts »), verbes d'action en tête. Pas d'emoji dans l'UI.

## Interdits
Dégradés complexes, ombres dures, emoji comme icônes, texte blanc sur jaune, rouge criard en masse (le rouge = uniquement les feux actifs et l'urgence), redessiner le logo.
