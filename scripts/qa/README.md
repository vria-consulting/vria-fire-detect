# QA Kanari — programme de vérification complet

À lancer **avant chaque commit**. Sort en erreur (code 1) dès qu'une
vérification échoue : toute régression est détectée immédiatement.

```bash
npm run qa          # audite la production (vria-fire-detect.vercel.app)
npm run qa:local    # audite le serveur de dev (localhost:3100)
```

Options : `--target=<url>`, `--event-sample=N` (foyers contre-vérifiés vs
FIRMS brut, défaut 8), `--ai-sample=N` (posts re-jugés par IA, défaut 24),
`--skip-ai`.

## Les 5 niveaux

0. **Tests unitaires « golden »** — chaque bug corrigé par le passé devient un
   test permanent (géoparsing Épouville/Guadalajara/León, anti-mélange,
   garde revue de presse, clustering, `daysNeeded` — le bug « carte vide le
   matin »). Dès leur premier passage, ces tests ont trouvé deux bugs de
   géoparsing présents depuis l'origine (lieu en fin de texte jamais extrait,
   élision « d'Épouville » à apostrophe typographique).
1. **Connecteurs** — chaque source est testée directement, comme un opérateur
   qui vérifie ses instruments : disponibilité et volume FIRMS (VIIRS N20/N21,
   GOES), produits Meteosat MTG des 2 dernières heures, recherche Bluesky,
   GDELT, worker Telegram (GitHub Actions) + endpoint d'ingestion protégé,
   jugement témoin OpenAI, vent Open-Meteo, historique du cron primaire
   (cron-job.org).
2. **API & invariants** — pages, manifest/icônes/service worker, chaque
   période de `/api/events` avec vérification champ par champ de chaque foyer
   (fenêtre temporelle, somme des sources, confiance, centroïde…), invariants
   de `/api/signals` (pas de doublon, horodatages cohérents, **le lieu ancré
   apparaît dans le texte de chaque post**), validation d'entrée et endpoints
   protégés.
3. **Croisement avec les sources** — pour un échantillon de foyers affichés,
   on re-télécharge le CSV FIRMS brut autour du foyer et on vérifie que la
   position, le 1er signal, le dernier signal et la puissance correspondent à
   de vraies détections. Distance des corroborations citoyennes ≤ 50 km.
   Fraîcheur des caches (preuve que le cron tourne).
4. **Pertinence IA** (nécessite `OPENAI_API_KEY` dans `.env.local`) — chaque
   post affiché sur la carte est re-jugé deux fois : par le pipeline de
   production (luna + vérificateur adversarial terra, sans cache) qui doit
   reconfirmer « feu » ET le même lieu ; puis par un relecteur IA indépendant
   qui répond à trois questions — feu de végétation actuel ? lieu ancré
   correct ? dates cohérentes ? Tout écart est signalé avec le texte fautif.

## Rétrospective : le programme s'améliore à chaque passage

Chaque run est archivé dans `scripts/qa/history/` (local, hors git). En fin de
passage, la rétrospective compare avec les runs précédents et imprime :

- 🔴 les **régressions** (tests passés → échoués) et 🟢 les réparations ;
- ⚠️ les tests aux **verdicts instables** (à fiabiliser ou isoler du réseau) ;
- 👁️ les **tests aveugles** : SKIP chroniques (clé manquante) et vérifications
  qui n'ont rien pu couvrir ce run (« aucun foyer corroboré ») ;
- 🕳️ les **trous de couverture** : surfaces de l'app (routes, libs,
  connecteurs) sans aucune vérification, via une carte des surfaces à tenir à
  jour quand l'app grandit ;
- 🤖 si `OPENAI_API_KEY` est présente : un **analyste IA** lit le bilan et
  propose les tests à ajouter, ceux à durcir et les risques prioritaires.

Le tout est journalisé dans `scripts/qa/history/retro.md`. Règle d'usage :
appliquer les recommandations de la rétrospective (nouveaux tests, correctifs)
avant le commit suivant — c'est ainsi que le programme apprend.

## Environnement requis (.env.local)

| Variable | Niveau | Sans elle |
|---|---|---|
| `FIRMS_MAP_KEY` | 1, 3 | vérifications satellite sautées |
| `BSKY_IDENTIFIER` / `BSKY_APP_PASSWORD` | 1 | repli via les statuts de l'app |
| `OPENAI_API_KEY` | 1, 4 | batterie IA sautée (SKIP affiché) |
| `EUMETSAT_CONSUMER_KEY` / `_SECRET` | 1 | MTG inféré via l'app |
| `CRONJOB_API_KEY` | 1 | cron vérifié via la fraîcheur des données |

Coût IA d'un run par défaut : ~24 posts × 2 jugements ≈ quelques centimes.
