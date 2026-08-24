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
- **HDX** : demande d'organisation « kanari » soumise le 24/08/2026 (réponse sous 2 jours ouvrés) ; à la validation, publier le dataset (mêmes textes).
- **Kaggle** : FAIT (24/08/2026) : https://www.kaggle.com/datasets/vincentryckbosch/kanari-wildfire-archive-satellite-witnesses (public, CC BY 4.0, description + DOI).

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

## 5. Newsletter — FAIT (implémentation le 24/08/2026, commit fd55a53)

Choix du prestataire, tarifs verifies le 24/08/2026 sur les pages officielles.
Resend, offre **Marketing** gratuite : 1 000 contacts et broadcasts illimites (les plans
marketing sont limites par le nombre de contacts, pas par le nombre d'e-mails). Ne pas
confondre avec l'offre Transactional gratuite du meme compte, plafonnee a 3 000
e-mails/mois et 100/jour : c'est pourquoi la masse passe par /broadcasts. Buttondown a
ete ecarte, gratuit jusqu'a 100 abonnes seulement puis 9 $/mois, avec automatisations et
archive sur domaine personnalise en options a 29 $. Argument decisif au-dela du prix :
avec Resend le formulaire et l'archive restent sur kanari.io et produisent des pages
indexables chez nous.

Infra (conversation Référencement) : Resend offre Marketing gratuite (1 000 contacts),
domaine d'envoi news.kanari.io vérifié (eu-west-1, DKIM chez Hostinger), audience
« General » 61f9b271-be52-46cd-a423-46a7c7f1a494, RESEND_API_KEY sur Vercel
(Preview + Production ; PAS sur Development). Pas de MX sur news.kanari.io :
Reply-To contact@kanari.io partout. Pas de tracking ouverture/clic (choix privacy).

Application (cette implémentation) :
- Double opt-in : POST /api/newsletter/subscribe (mail de confirmation via /emails,
  transactionnel) → clic → /api/newsletter/confirm (jeton HMAC 7 j, secret
  NEWSLETTER_SECRET ?? CRON_SECRET ?? RESEND_API_KEY) → contact créé dans l'audience.
  Zone (bbox/label) et langue stockées côté kanari (Blob newsletter-subscribers.json,
  l'API Contacts Resend n'a pas de propriétés libres). Cap MAX_EMAIL_SUBS = 950.
  Honeypot « website » anti-robots.
- Envoi du bilan : /api/cron/newsletter (x-cron-secret), tiré par GitHub Actions
  newsletter-cron.yml chaque lundi 06:05 UTC. Hebdo de mai à octobre, mensuel
  (premier lundi) de novembre à avril. UNIQUEMENT via /broadcasts (jamais /emails
  pour la masse). Anti-doublon par slug. `?dry=1` = HTML sans envoi ni stockage.
  Blocs : chiffres période (+ comparaison précédente), feu de la période,
  « vu avant la presse » (précocité, bloc omis si vide). E-mail en FR (V1),
  lien « Lire le bilan complet » vers l'archive. Désinscription Resend
  {{{RESEND_UNSUBSCRIBE_URL}}}.
- Archive indexable : /[lang]/newsletter (formulaire + numéros) et
  /[lang]/newsletter/[slug] en 4 langues, JSON-LD Article, sitemap (page + slugs),
  seo-guard (43 cibles). Slugs : semaine-AAAA-MM-JJ (lundi de début) / mois-AAAA-MM.
- Formulaires : /[lang]/canadair (audience n°1 Search Console), pages feu
  /fr/feu/[slug] (bbox ±0.4°), départements /fr/feux/[dept] (bbox ±0.6°), archive.
  Sur la carte : encart e-mail proposé après interaction avec « M'alerter sur cette
  zone » (push accepté, refusé ou non supporté), bbox de la vue. Jamais de pop-up.
- Premier envoi automatique : lundi 31/08/2026, 06:05 UTC (couvre 24→30/08).
- Flux complet validé le 24/08/2026 par Vincent avec sa vraie boîte mail
  (inscription → confirmation → contact dans l'audience) : premier abonné réel.
- Reste à faire : page « ça sent le feu dehors » (attendre la copie 4 langues de la
  conversation Référencement) ; segments par langue si l'audience non-FR grossit.

Detail des enregistrements DNS poses le 24/08/2026, **chez Hostinger et non chez Vercel**
(serveurs artemis/hermes.dns-parking.com ; les MX et le SPF Hostinger servent
contact@kanari.io, ne pas les casser) :
- `TXT  resend._domainkey.news` = cle publique DKIM
- `CNAME rsend.news` -> `rsend.forge.rmta.net`
- `CNAME send.news`  -> `send.forge.rmta.net`
Le MX de reception n'a volontairement pas ete pose : la newsletter n'a pas besoin de
recevoir, d'ou le Reply-To sur contact@kanari.io. Region Ireland (eu-west-1) pour le
RGPD, return-path `send`, sans tracking d'ouverture ni de clic. Domaine passe
**Verified** le 24/08 vers 15h. Piege a retenir : `vercel env pull` ne restitue plus
aucune valeur chiffree, un secret perdu doit etre recree chez le fournisseur.

## 6. Vidéos — FAIT le 24/08/2026

Chaîne YouTube : https://www.youtube.com/channel/UCbGPRoyCqUInu8t0WgriKIw
(handle @kanari_io ; nom renommé « kanari », propagation Google en cours).
Profil complet : bannière et photo charte, description, liens (carte, méthodologie,
API), e-mail contact@kanari.io, filigrane vidéo, onglet Accueil activé.

4 vidéos publiées (produites par Claude : captures du site en headless Chrome +
cartons PIL/Jost + schémas des guides, assemblage ffmpeg, miniatures custom) :
- Bande-annonce 14 s : https://youtu.be/-iv5_Dml9qM
- Détection satellite : https://youtu.be/WhHJ73JoQdA
- Canadair en direct : https://youtu.be/CFmz7iW-PIc
- Lire la carte : https://youtu.be/0M0ovJBy-Jo
Fichiers sources sur ~/Desktop (v1/v2/v3-*.mp4). La chaîne est référencée dans le
JSON-LD Organization (sameAs) et llms.txt.

Reste (Vincent) : « validation unique » de la chaîne (vérification téléphone) pour
rendre les liens de description cliquables — bandeau dans Studio → Détails vidéo.
Prochaines vidéos possibles : bilans mensuels auto, précocité, météo des forêts.

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
