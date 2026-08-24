# Tableau de bord SEO et croissance kanari

Tenu par la conversation « Référencement et croissance », une ligne par session.
Sources : Google Search Console (propriete `https://kanari.io/`), Bing Webmaster
Tools, SERP en navigation privee, Gmail, registres.

## 1. Sortie de crise Bing (ticket UCM000007461131)

| Indicateur | Cible | 24/08 | Etat |
| --- | --- | --- | --- |
| IndexNow, URLs soumises par jour | ~3 | 3 (19 K le 21/08, 3 les 22 et 23/08) | atteint |
| `site:kanari.io` sur Bing | pages kanari listees | 0 page kanari (Bing renvoie wikipedia.de) | bloque |
| Requete de marque « kanari carte des feux » sur Bing | kanari en 1re position | 0 resultat kanari | bloque |
| Bing Search Performance | clics et impressions non nuls | « No pages found » | bloque |
| Citations Copilot (Bing AI Performance) | retour vers 70 a 90 par jour | 0 les 20, 21 et 22/08 (pic 96 le 14/08) | bloque |
| Hotes dupliques | 308 vers l'apex | www et vercel.app en 308 | atteint |
| sitemap-events.xml | ~1 644 URLs | 1 702 URLs lues le 24/08 par Google | atteint |

### Diagnostic du 24/08 : bingbot ne crawle plus depuis le 14/08

Releve dans Bing WMT > Site Explorer : 691 URLs indexees, 0 erreur, 1 avertissement,
4 exclues. **Toutes les dates « Last crawled » visibles, a la racine comme dans /fr et
/en, sont le 13 ou le 14 aout 2026. Aucune apres le 14.**

Consequences :
- La courbe colle : le trafic Bing est tombe de 109/jour a 0 entre le 15 et le 20/08,
  ce qui correspond a un arret de crawl le 14/08 suivi de l'expiration des pages.
- **Aucun de nos correctifs des 21 et 22/08 n'a jamais ete vu par bingbot.** Bing evalue
  encore le site tel qu'il etait le 14 aout.
- Les 18 pages resoumises via URL Submission le 22/08 n'ont declenche aucun crawl.

bingbot n'est pas bloque : requetes avec les deux user agents bingbot sur /fr,
/robots.txt, /sitemap.xml et /fr/canadair renvoient toutes HTTP 200, aucune regle de
pare-feu ni challenge.

Hypothese : le flood IndexNow (~48 000 URLs/jour du 9 au 21/08) a provoque une
retrogradation de crawl de l'hote autour du 13-14/08, toujours active bien que la cause
soit corrigee. Transmis au support Microsoft le 24/08 avec demande de recrawl.

Coincidence a noter : la monetisation (AdSense, affiliation, ads.txt) a ete deployee le
14/08, le jour meme du dernier crawl. Voir section monetisation.

## 2. Google Search Console (28 jours glissants)

| Indicateur | 24/08 |
| --- | --- |
| Clics | 72 |
| Impressions | 1 160 (en hausse continue) |
| CTR | 6,2 % |
| Position moyenne | 28,7 |
| Pages indexees | 3 440 (maj 21/08) |
| Sitemaps decouverts | 734 + 1 702 + 302 |
| Liens externes (rapport Liens) | 0, rapport encore vide |

Requetes qui rapportent des clics : le bloc « canadair » (suivre canadair en
direct 4 clics position 8,9 ; canadair en direct ; canadair live ; suivi vol
canadair), la marque (kanari.io position 1,1), et un bloc olfactif inattendu
(« ca sent le feu dehors » 13 impressions position 9,9 ; « odeur de feu dehors »).

## 3. Positions sur les requetes cibles (SERP, hors personnalisation)

| Requete | Marche | Position kanari | Tete de SERP |
| --- | --- | --- | --- |
| carte des feux en direct | google.fr | absent du top 30 | feuxdeforet.fr, association-psfdf.fr, incendieencours.fr |
| wildfire map live | google.com | absent du top 30 | nifc.gov, fire.airnow.gov, wfca.com, watchduty |
| incendios en tiempo real | google.es | absent du top 30 | incendiosespana.es, junta de Andalucia, GWIS |

## 4. Autorite et audience

| Indicateur | 24/08 |
| --- | --- |
| Domaines referents (Bing Backlinks) | 2 (bizjournals.com, trackawesomelist.com) |
| Registre MCP officiel | actif, v1.0.0 |
| Smithery | fiche publique, score 71/100 |
| Zenodo | DOI 10.5281/zenodo.22078610 |
| data.gouv.fr | publie |
| Kaggle | publie, badge Dataset Creator |
| npm kanari-fires | 0.1.0 publie |
| HDX | organisation en attente de validation |
| YouTube | 4 videos ; validation telephone FAITE le 24/08 (fonctionnalites intermediaires activees), mais les liens des descriptions ne sont pas encore cliquables : a recontroler |
| Newsletter | **Pret** : Resend configure, news.kanari.io verifie, cle Full access en place (Vercel + local), audience General ; reste l'implementation |

## 5. Partenaires : dates de relance

Envoi initial le 22/08, relance a J+10 soit le 01/09 si silence.

| Partenaire | Canal | Statut |
| --- | --- | --- |
| Entente Valabre | contact-prevention@valabre.com | silence |
| Meteociel | webmaster@meteociel.fr | silence |
| FFRandonnee | partenariat@ffrandonnee.fr | silence |
| Camptocamp | board@camptocamp.org | silence |
| Windy | info@windy.com | silence |
| Outdooractive | business@outdooractive.com | accuse de reception automatique |
| Visorando | formulaire | accuse de reception |

A faire par Vincent : Meteored (reCAPTCHA), Infoclimat (compte requis),
meteo-paris, Climatempo.

## 6. Journal des sessions

### 24/08/2026
- Support Bing a repondu et clos le ticket sur un malentendu (« low signals »).
  Ticket rouvert le jour meme avec les preuves : `site:` et requete de marque a
  zero, Search Performance vide, citations Copilot tombees de 71 a 0 les 19 et
  20/08, correctifs verifies en ligne.
- IndexNow confirme a 3 par jour depuis le 22/08.
- Constat strategique : la traction Google reelle est sur le suivi des Canadair
  et sur les requetes olfactives, pas sur « carte des feux en direct ».
- Aucune opportunite Qwoted pertinente ouverte (5 credits, pitch Trill Mag du
  22/08 en attente, deadline 25/08).
- Tarifs newsletter verifies : Resend offre Marketing gratuite = 1 000 contacts et
  broadcasts illimites ; Buttondown gratuit seulement jusqu'a 100 abonnes puis
  9 $/mois. Resend retenu, l'archive restera sur kanari.io.
- Newsletter : compte Resend cree, domaine d'envoi news.kanari.io verifie le 24/08
  (region Irlande, sans tracking). DNS pose chez Hostinger et non Vercel, point a
  retenir pour toute future manipulation DNS de kanari.io.
- Newsletter operationnelle cote infrastructure en fin de session : cle Full access
  validee par appel API, audience General id 61f9b271-be52-46cd-a423-46a7c7f1a494.
  Prochaine etape : implementation par la conversation Developpement.
- YouTube : validation telephone effectuee par Vincent le 24/08. Studio > Parametres >
  Acces aux fonctionnalites confirme le niveau 2 « Activees ». En revanche le bandeau
  « validation unique » persiste sur la page de details des videos et les trois URL
  kanari.io des descriptions sont toujours rendues en texte brut cote public. Delai de
  propagation cote YouTube, a recontroler a la prochaine session ; si c'est toujours le
  cas apres 24 h, forcer un re-enregistrement des descriptions.
- **Diagnostic majeur du 24/08** : bingbot n'a plus crawle kanari.io depuis le 14/08.
  Tous les correctifs des 21-22/08 sont donc invisibles pour Bing. Signale au support
  avec demande explicite de recrawl de l'hote.
- AdSense : Vincent a decide le 24/08 de le **suspendre entierement** (priorite absolue
  a Bing, revenu negligeable). Retrait du composant et de ads.txt confie a la
  conversation Developpement. Le bouton de don et l'affiliation Amazon restent.
- Site Scan Bing lance le 24/08 (quota 10 pages), resultat a relever.
