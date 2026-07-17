# Kanari — Charte graphique & Design System

Kanari (kanari.io) est une app mobile grand public de détection précoce des feux de forêt. Elle écoute les réseaux sociaux en temps réel, corrobore avec les données satellite et météo, et alerte les habitants avant les canaux officiels. Le nom vient du canari dans la mine : le symbole universel de l'alerte précoce — quand le canari chante, il est encore temps d'agir.

**Cibles** : grand public international (France, US, Australie, Espagne).
**Positionnement de ton** : protecteur et vif, jamais catastrophiste. Simplicité de Yuka, lisibilité de Waze, chaleur de Duolingo, crédibilité d'un outil de sécurité.
**Logo retenu** : « Le chant qui alerte » — tête de canari + 3 ondes de signal rayonnant depuis le bec (voir `assets/`).

## CONTENT FUNDAMENTALS

- **Voix** : calme, directe, factuelle-chaleureuse. On rassure par la précision, pas par l'euphémisme. Jamais alarmiste, jamais de sensationnalisme.
- **Adresse** : tutoiement en FR (« Tu es à 4 km du départ de feu »), "you" direct en EN. L'app parle comme un voisin fiable, pas comme une préfecture.
- **Casse** : phrases en sentence case. Le wordmark « kanari » toujours en bas de casse. Pas de MAJUSCULES CRIANTES sauf overlines de section (12px, letterspacing 1.5px).
- **Phrases** : courtes. Une information par phrase. Verbe d'action en tête pour les alertes : « Prépare un sac. Surveille les mises à jour. »
- **Chiffres** : toujours concrets et sourcés (« signalé il y a 12 min · 3 sources »), jamais de vague (« récemment », « plusieurs »).
- **Emoji** : aucun dans l'UI produit. Toléré avec parcimonie en marketing social uniquement.
- **Exemples de copy** :
  - Héro site : « Le canari chante avant la sirène. »
  - Alerte : « Départ de feu probable à 6 km — signalé il y a 9 min, confirmé par satellite. »
  - État calme : « Rien à signaler autour de toi. Kanari écoute. »
  - CTA : « Protéger ma zone », « Voir la carte », « Activer les alertes ».

## VISUAL FOUNDATIONS

- **Couleurs** : jaune canari `#FFC72E` (signature, énergie) + charbon `#1B1C1E` (crédibilité sécurité) sur blancs chauds (`#FBF9F4` page, `#FFFFFF` cartes). Braise `#E8622C` réservée aux alertes actives et micro-accents — avec parcimonie. Danger `#D64545` et Sûr `#3E9B6E` pour la sémantique d'état. Jamais de dégradés complexes ; aplats flat uniquement.
- **Règle des surfaces** : max 2 fonds par vue (paper + une section teintée `--canary-tint` ou une bande charbon). Les sections charbon servent de moments de contraste (héro, alertes, footer).
- **Type** : Fredoka (500/600) pour titres et chiffres-clés — ronde, amicale, solide, en écho au wordmark. DM Sans pour tout le reste (corps, UI, labels). Jamais plus de ces 2 familles.
- **Rayons** : généreux et ronds. Boutons principaux en pill (999px), cartes 22px, champs 14px. Aucun angle vif.
- **Ombres** : chaudes et douces (`--shadow-s/m/l`, teintées charbon à faible opacité). Jamais d'ombre dure ni de bordure + ombre cumulées lourdes.
- **Bordures** : 1px `#E8E4D9` pour délimiter sans peser. Les cartes blanches sur paper peuvent s'en passer (ombre seule).
- **Backgrounds** : aplats unis. Motif décoratif autorisé : les **ondes du logo** (arcs concentriques, trait rond) en filigrane jaune à faible opacité ou en accent animé. Aucune texture, aucun pattern chargé, pas d'illustrations 3D.
- **Animation** : rapide et optimiste. `--ease-out` (cubic-bezier(.2,.8,.3,1)), 150–250ms pour l'UI, 450ms pour les entrées de section. Signature : la pulsation d'onde `kanari-wave` (opacité 0.12→1, décalée par arc) sur le symbole et les indicateurs « écoute en cours ». Pas de bounce excessif, pas de parallax.
- **Hover** : boutons jaunes → `--canary-strong` ; boutons sombres → `--charcoal-2` ; cartes cliquables → translateY(-2px) + ombre m→l ; liens → `--ember`.
- **Press** : scale(0.98), durée fast.
- **Focus** : anneau jaune `--focus-ring` (3px, 55% opacité) — jamais supprimé.
- **Imagerie** : photos chaudes, lumière naturelle, forêts et personnes réelles (jamais de flammes spectaculaires ni d'images de destruction). Le danger n'est jamais montré, il est cartographié.
- **Transparence/blur** : header sticky en `rgba(251,249,244,.85)` + blur 12px, seul usage autorisé.
- **Cartes** : fond blanc, radius 22px, shadow-s au repos, padding 24–32px.
- **Accessibilité** : texte sur jaune toujours en charbon (jamais blanc sur jaune). Contraste AA minimum. Cibles tactiles ≥ 44px.

## ICONOGRAPHY

- **Système** : [Lucide](https://lucide.dev) via CDN — traits arrondis (stroke-linecap round) cohérents avec les ondes du logo. Stroke 2px, taille 20/24px. *Substitution CDN : pas de set propriétaire fourni — à remplacer si un set custom est dessiné.*
- Icônes clés : `bell`, `map`, `flame` (réservée aux états d'alerte), `radio` (écoute), `shield-check` (zone protégée), `users` (signalements communautaires).
- **Logo** : ne jamais redessiner. Utiliser les fichiers `assets/` :
  - `logo-symbole.svg` (couleur), `logo-symbole-anime.svg` (ondes pulsées — fonds clairs uniquement)
  - `logo-mono-jaune-anime.svg` (ondes pulsées pour fonds sombres)
  - `logo-mono-noir.svg` / `logo-mono-blanc.svg` / `logo-mono-jaune.svg` (l'œil est percé en réserve — transparence réelle)
  - `favicon.svg` (variante simplifiée : une onde épaisse, pour ≤ 32px)
- **Lockup horizontal** : symbole + « kanari » en Fredoka Medium, bas de casse, letterspacing -0.5px, espace = 20% de la hauteur du symbole.
- Zone de protection du logo : la hauteur de la tête du canari sur chaque côté. Jamais d'emoji en guise d'icône.

## INDEX

- `styles.css` — point d'entrée global (importe tous les tokens)
- `tokens/` — `colors.css`, `typography.css`, `spacing.css` (+ rayons, ombres, motion), `fonts.css`
- `assets/` — logos SVG (transparence gérée) + favicon
- `components/` — primitives React : `buttons/` (Button, IconButton), `forms/` (Input, Checkbox, Switch), `display/` (Card, Badge), `feedback/` (Alert, Toast), `navigation/` (Tabs)
- `guidelines/` — cartes specimen (couleurs, type, espacement, marque, motion)
- `ui_kits/website/` — homepage kanari.io de référence
- `SKILL.md` — pour utilisation dans Claude Code
- Exploration d'origine du logo : `Kanari Logo Concepts.dc.html` (3 concepts, reco = 1c)

**Intentional additions** : set de composants standard créé from scratch (aucun inventaire source n'existait) ; Alert/Toast inclus car cœur du produit.
