# Distribution durable : checklist des actions qui demandent un compte

Tout ce qui suit est prêt côté code (serveur MCP, server.json, README, client npm,
pages méthodologie et observatoire). Ces étapes exigent une identité (login GitHub,
compte éditeur) : elles sont à faire par Vincent, puis Claude reprend la main.

## 1. Registre MCP officiel (registry.modelcontextprotocol.io)

Le manifeste `server.json` est à la racine du dépôt (copie servie sur
https://kanari.io/server.json). Namespace `io.github.vria-consulting/kanari-wildfires` :
il suffit d'être connecté à GitHub avec un compte membre de l'organisation.

```bash
brew install mcp-publisher          # ou binaire : https://github.com/modelcontextprotocol/registry/releases
cd ~/VRIA/vria-fire-detect
mcp-publisher login github          # ouvre le navigateur, autorise l'app
mcp-publisher publish               # lit ./server.json
```

Vérification : https://registry.modelcontextprotocol.io/v0/servers?search=kanari
PulseMCP, Glama et les annuaires qui synchronisent le registre officiel reprendront
automatiquement la fiche.

## 2. Smithery (smithery.ai)

Se connecter avec GitHub sur https://smithery.ai/new, choisir « remote server »,
URL `https://kanari.io/api/mcp`, dépôt `vria-consulting/vria-fire-detect`.
Description prête : voir `server.json` (champ `description`).

mcp.so n'est pas retenu (soumission payante, 39 $).

## 3. Client npm `kanari-fires`

FAIT (24/08/2026) : https://www.npmjs.com/package/kanari-fires — v0.1.0, licence MIT confirmée.

```bash
cd ~/VRIA/vria-fire-detect/packages/kanari-fires
npm install -D typescript && npm run build
npm login                            # compte npm (gratuit)
npm publish --access public
```

## 4. Jeu de données : DOI et portails

Le texte de description (EN et FR) est ci-dessous ; le fichier est
https://kanari.io/opendata/feux.csv (licence CC BY 4.0, mis à jour en continu).

- **Zenodo** : FAIT (24/08/2026) : https://zenodo.org/records/22078611 — DOI toutes versions 10.5281/zenodo.22078610. Prochaines versions : bouton « New version » avec un CSV daté. Ancienne consigne : https://zenodo.org/uploads/new
  — connexion GitHub ou ORCID. Type « Dataset », titre « kanari wildfire archive:
  satellite-detected wildfires with verified witness reports », licence CC BY 4.0,
  mots-clés wildfire, remote sensing, NASA FIRMS, GOES, Meteosat, early warning.
  Joindre un export CSV daté + un README (le texte ci-dessous). Après publication,
  renseigner le DOI sur `/[lang]/methodologie` (champ `citeDoi`) et dans le README.
- **data.gouv.fr** : FAIT (24/08/2026) : https://www.data.gouv.fr/datasets/feux-de-foret-detectes-par-satellite-et-temoins-verifies-kanari
- **HDX (Humanitarian Data Exchange)** : https://data.humdata.org (organisation à créer,
  validation manuelle par l'équipe HDX) — très lié par les ONG et la presse humanitaire.
- **Kaggle** : https://www.kaggle.com/datasets (nouveau dataset, CSV uploadé, licence CC BY 4.0).

### Description EN (à coller)

kanari is a free, independent, near real-time world map of wildfire ignitions. This
dataset is its archive of significant wildfires since 2026-08-03: fires detected by
satellite (NASA FIRMS VIIRS 375 m, NOAA GOES, EUMETSAT Meteosat MTG) and cross-checked
with AI-verified witness reports. One row per fire: slug and permanent URL, first and
last detection (UTC), position, place and country, detections per sensor, peak fire
radiative power (MW), confidence level, witness posts, aircraft observed on zone,
status. Only significant fires are archived (corroborated, or above detection/power
thresholds), so totals are not comparable to exhaustive official tallies. Licence CC BY
4.0, attribution "kanari.io". Methodology: https://kanari.io/en/methodologie. Live map:
https://kanari.io. API and MCP server: https://kanari.io/en/api.

### Description FR (à coller)

kanari est une carte mondiale, gratuite et indépendante, des départs de feu en temps
quasi réel. Ce jeu de données est son archive des feux de forêt significatifs depuis le
3 août 2026 : feux détectés par satellite (NASA FIRMS VIIRS 375 m, NOAA GOES, EUMETSAT
Meteosat MTG) et recoupés avec des témoignages vérifiés par IA. Une ligne par feu :
identifiant et URL permanente, première et dernière détection (UTC), position, lieu et
pays, détections par capteur, puissance radiative maximale (MW), niveau de confiance,
témoignages, moyens aériens observés, statut. Seuls les feux significatifs sont archivés
(corroborés ou au-delà de seuils), les totaux ne sont donc pas comparables aux
recensements officiels exhaustifs. Licence CC BY 4.0, mention « kanari.io ».
Méthodologie : https://kanari.io/fr/methodologie. Carte : https://kanari.io.

## 5. Newsletter hebdomadaire

Compte gratuit Buttondown (https://buttondown.com, gratuit jusqu'à 100 abonnés) ou
Resend (https://resend.com, 3 000 e-mails/mois) ; fournir la clé API à Vercel
(variable d'environnement) et Claude branche l'automatisation « bilan de la semaine ».

## 6. Vidéos

Chaîne YouTube « kanari » (compte Google) : Claude produit les vidéos explicatives
(détection satellite, Canadair, comment lire la carte) et les descriptions liées au site.

## 7. Partenaires d'intégration : statut au 22/08/2026

Mails envoyés (adresses vérifiées sur les sites officiels ou leurs canaux), ne pas redoubler :
- Entente Valabre, prévention et 15 SDIS : contact-prevention@valabre.com
- Meteociel : webmaster@meteociel.fr
- FFRandonnée (service partenariats) : partenariat@ffrandonnee.fr
- Camptocamp Association (administrateurs) : board@camptocamp.org
- Windy (proposition de plugin « kanari wildfires ») : info@windy.com
- Outdooractive (API / data) : business@outdooractive.com
- Visorando : formulaire Presse/Media/Partenariat envoyé (accusé de réception reçu).

Restent à faire par Vincent :
- Meteored (tiempo.com/contacto) : formulaire avec reCAPTCHA et bandeau cookies ; texte ES prêt ci-dessous.
- Infoclimat : le formulaire exige un compte Infoclimat.
- meteo-paris.com/contact (motif « Une question sur les widgets ») : formulaire rempli deux fois sans accusé de réception affiché, statut inconnu ; à renvoyer ou à contacter via X @Meteovilles.
- Climatempo : le formulaire « Fale conosco » ne couvre que le support client ; parcerias joignable par l'adresse indiquée sur climatempo.com.br/fale-conosco.

### Texte ES (Meteored, Wikiloc, protección civil…)

Hola, soy Vincent Ryckbosch, desarrollador independiente francés. He creado kanari.io, un mapa mundial, gratuito e independiente de los focos de incendio: detecciones satelitales NASA FIRMS, GOES y Meteosat MTG cada 10 minutos, testimonios verificados por IA, aviones cisterna en vivo y un archivo abierto de cada incendio significativo. Os propongo, gratis y sin clave, con la única condición de citar kanari.io: API JSON de focos en tiempo real (https://kanari.io/api/events?hours=24, documentación https://kanari.io/en/api), widget de mapa centrado en una región (https://kanari.io/es/widget), archivo completo en CSV CC BY 4.0 (https://kanari.io/opendata/feux.csv) y observatorio citable por país y mes (https://kanari.io/es/statistiques). kanari es un servicio de información, no un canal oficial de alerta, y seguirá siendo gratuito. Gracias, Vincent Ryckbosch, contact@kanari.io

### Texte PT (Climatempo, Defesa Civil, veículos BR/PT)

Olá, sou Vincent Ryckbosch, desenvolvedor independente francês. Criei o kanari.io, um mapa mundial, gratuito e independente dos focos de incêndio: detecções de satélite NASA FIRMS, GOES e Meteosat MTG a cada 10 minutos, relatos verificados por IA, aviões-tanque ao vivo e um arquivo aberto de cada incêndio significativo. Ofereço, grátis e sem chave, com a única condição de citar kanari.io: API JSON de focos em tempo real (https://kanari.io/api/events?hours=24, documentação https://kanari.io/en/api), widget de mapa centrado em uma região (https://kanari.io/pt/widget), arquivo completo em CSV CC BY 4.0 (https://kanari.io/opendata/feux.csv) e observatório citável por país e mês (https://kanari.io/pt/statistiques). O kanari é um serviço de informação, não um canal oficial de alerta, e continuará gratuito. Obrigado, Vincent Ryckbosch, contact@kanari.io
