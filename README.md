# Kanari — détection précoce des feux de forêt

Carte mondiale en temps quasi réel des départs de feu détectés par satellite.
Service d'information indépendant — projet à mission.

**⚠️ Kanari n'est pas un service d'alerte officiel. En cas d'urgence : 112 (Europe) / 18 (France).**

## Sources de données

- **NASA FIRMS** — détections thermiques VIIRS 375 m (satellites Suomi-NPP, NOAA-20, NOAA-21),
  rafraîchies toutes les ~10 minutes, latence globale ≤ 3 h après passage satellite.
- Fond de carte : © OpenStreetMap / CARTO.

Roadmap : fusion multi-sources (satellites géostationnaires GOES / Meteosat MTG,
caméras au sol, signalements citoyens Bluesky/Telegram) avec score de confiance par événement.

## Développement

```bash
# Créer .env.local avec votre clé NASA FIRMS (gratuite, 1 min) :
# https://firms.modaps.eosdis.nasa.gov/api/map_key/
echo "FIRMS_MAP_KEY=votre_cle" > .env.local

npm install
npm run dev
```

## Déploiement

Déployé sur Vercel. Variable d'environnement requise : `FIRMS_MAP_KEY`.

## Architecture

- `src/lib/firms.ts` — ingestion et parsing des CSV FIRMS (3 sources VIIRS, monde entier)
- `src/app/api/fires/route.ts` — API interne avec cache 10 min (respect du rate limit FIRMS)
- `src/components/FireMap.tsx` — carte MapLibre GL, couleur par âge de détection, taille par FRP
