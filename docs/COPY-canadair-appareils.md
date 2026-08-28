# Pages appareil Canadair — copie prête à intégrer

Rédigé par la conversation Référencement le 28/08/2026.

## Le constat, qui change la demande initiale

Je pensais proposer la création de pages par appareil. **Elles existent déjà**
(`/[lang]/canadair/[reg]`, 18 immatriculations, présentes au sitemap). Le problème
n'est pas leur absence, c'est leur contenu. Voici le texte réel d'une de ces pages :

> F-ZBMG — Canadair CL-415 « Pélican »
> Au sol actuellement (ou transpondeur coupé).
> Aucune mission enregistrée depuis le début de l'archive (3 août 2026).
> Le reste de la flotte : F-ZBFX F-ZBFN F-ZBFS…

Hors navigation et pied de page, une page appareil fait moins de 80 mots utiles, dont
deux phrases d'état vide. Ce sont **18 coquilles quasi identiques**, multipliées par
les langues. C'est exactement le motif « contenu à faible valeur » qu'AdSense nous a
opposé le 24/08, et exactement ce qui alimente les **5 062 pages « détectée,
actuellement non indexée »** de la Search Console.

Ces pages ne sont donc pas une opportunité tant qu'elles restent vides : elles
consomment du budget de crawl au détriment des pages qui en méritent.

La copie ci-dessous les rend substantielles **sans dépendre de la donnée live** :
chaque page gagne un bloc modèle et un bloc de lecture, plus une FAQ en JSON-LD.
Aucun fait inventé : tous les chiffres sont ceux déjà publiés dans le guide
`comment-fonctionne-un-canadair`, pour rester cohérent d'une page à l'autre.

**Répartition vérifiée dans `src/lib/aircraft.ts`** : 12 Canadair CL-415 « Pélican »
(F-ZBEG, F-ZBEU, F-ZBFN, F-ZBFP, F-ZBFS, F-ZBFV, F-ZBFW, F-ZBFX, F-ZBFY, F-ZBME,
F-ZBMF, F-ZBMG) et 6 Dash 8-402MR « Milan » (F-ZBMC, F-ZBMD, F-ZBMH, F-ZBMI, F-ZBMJ,
F-ZBMK). Deux blocs modèle suffisent donc à couvrir les 18 pages.

---

# FR

## Bloc modèle A — pour les 12 « Pélican » (CL-415)

### h2 : Ce que fait un Pélican

> Le CL-415 est un avion amphibie : il ne se pose pas pour recharger. Il remplit ses soutes en frôlant un plan d'eau à environ 130 km/h, écopes ouvertes, et embarque près de 6 000 litres en 12 secondes sur 1 500 mètres de glissade. Il lui faut pour cela un plan d'eau d'au moins 2 kilomètres exploitables, sans bateau ni câble, ce qui explique que les zones d'écopage soient fermées à la navigation pendant les opérations.
>
> C'est la cadence qui fait son efficacité, pas le largage isolé. Quand le point d'eau est proche du feu, un Pélican enchaîne un largage toutes les dix minutes environ : c'est ce qu'on appelle la noria, et cela représente plus de 100 000 litres dans une bonne journée. Le largage lui-même se fait entre 30 et 50 mètres du sol, à près de 200 km/h, dans les turbulences que le feu génère lui-même. L'eau n'éteint pas l'incendie : elle le ralentit et le refroidit pour que les équipes au sol puissent finir le travail.
>
> Cet appareil appartient aux 12 Canadair CL-415 de la Sécurité Civile française, basés à Nîmes-Garons et identifiés en radio par l'indicatif « Pélican ».

## Bloc modèle B — pour les 6 « Milan » (Dash 8-402MR)

### h2 : Ce que fait un Milan

> Le Dash 8-402MR n'est pas un écopeur : c'est un gros porteur terrestre, qui se recharge au sol et largue jusqu'à 10 000 litres de produit retardant, soit près du double d'un Canadair. Le retardant ne sert pas à éteindre mais à barrer la route au feu : déposé en amont du front, il ralentit la propagation et donne aux pompiers le temps d'établir une ligne d'arrêt.
>
> Sa polyvalence est son autre atout. Entre deux largages, un Milan assure des missions de transport de personnel et de matériel, ce qu'un amphibie ne peut pas faire. La Sécurité Civile en aligne 6, aux côtés des 12 Pélican.
>
> Sur la carte, un Milan se reconnaît à sa trajectoire : moins de rotations serrées qu'un Canadair en noria, des allers-retours plus longs entre sa base et le feu, puisqu'il doit se poser pour recharger.

## Bloc commun — à placer après le statut en direct, sur les 18 pages

### h2 : Comment lire le suivi de cet appareil

> Un appareil « au sol » ne signifie pas qu'il est indisponible. Les bombardiers d'eau diffusent leur position par ADS-B, le même signal que les avions de ligne, et ce transpondeur est souvent coupé au parking. Un appareil apparaît donc sur la carte quand il décolle, généralement de jour et en période de feux, et disparaît en fin de mission.
>
> L'historique ci-dessous ne recense pas toutes les missions de l'appareil, seulement celles que kanari a pu observer : un feu est associé à un avion lorsque celui-ci a été détecté à moins de 40 kilomètres d'un foyer archivé pendant que ce foyer était actif. Un vol de convoyage, un entraînement ou une mission hors couverture ADS-B n'y figureront pas. L'archive a commencé le 3 août 2026 et se remplit automatiquement.
>
> Si vous cherchez à savoir si un feu précis est traité par les moyens aériens, la carte en direct est plus parlante qu'une page appareil : plusieurs bombardiers tournant en noria au-dessus d'un même massif, c'est la signature d'un feu en cours de traitement.

## FAQ — Pélican (JSON-LD FAQPage)

> **Combien d'eau emporte ce Canadair ?**
> Environ 6 000 litres, écopés en 12 secondes en frôlant un plan d'eau à 130 km/h, sans se poser. Sur une journée avec un point d'eau proche du feu, un CL-415 peut larguer plus de 100 000 litres.

> **Pourquoi cet appareil n'apparaît-il pas sur la carte ?**
> Parce que son transpondeur ADS-B est coupé, ce qui est le cas au sol la plupart du temps. Les Canadair apparaissent au décollage, essentiellement de jour et en période de feux.

> **Que veut dire « observé sur un feu » ?**
> Que kanari a détecté l'appareil à moins de 40 kilomètres d'un foyer archivé pendant que ce foyer était actif. C'est un indice d'engagement, pas une confirmation officielle de mission.

## FAQ — Milan (JSON-LD FAQPage)

> **Quelle différence entre un Milan et un Canadair ?**
> Le Dash 8 « Milan » se recharge au sol et largue jusqu'à 10 000 litres de retardant, contre 6 000 litres d'eau écopés en vol pour un Canadair CL-415. Le Canadair enchaîne les rotations près d'un plan d'eau ; le Milan barre la route au feu en amont du front et assure aussi des missions de transport.

> **À quoi sert le produit retardant ?**
> Il ne sert pas à éteindre mais à ralentir : déposé en avant du front de flammes, il freine la propagation et donne aux équipes au sol le temps d'établir une ligne d'arrêt.

> **Pourquoi cet appareil n'apparaît-il pas sur la carte ?**
> Parce que son transpondeur ADS-B est coupé, ce qui est le cas au sol la plupart du temps. Les appareils apparaissent au décollage, essentiellement de jour et en période de feux.

---

# EN

## Model block A — the 12 "Pélican" (CL-415)

### h2: What a Pélican does

> The CL-415 is an amphibious aircraft: it never lands to reload. It fills its tanks by skimming a body of water at around 130 km/h with its scoops open, taking on close to 6 000 litres in 12 seconds over 1 500 metres. It needs at least 2 kilometres of usable water, free of boats and cables, which is why scooping zones are closed to navigation during operations.
>
> Its effectiveness comes from the rhythm, not from any single drop. When the water is close to the fire, a Pélican can drop roughly every ten minutes, a rotation known as a noria, adding up to more than 100 000 litres on a good day. The drop itself happens 30 to 50 metres above the ground at close to 200 km/h, in the turbulence the fire generates. Water does not put the fire out: it slows and cools it so the crews on the ground can finish the job.
>
> This aircraft is one of the 12 Canadair CL-415 operated by the French Sécurité Civile, based at Nîmes-Garons and using the radio callsign "Pélican".

## Model block B — the 6 "Milan" (Dash 8-402MR)

### h2: What a Milan does

> The Dash 8-402MR is not a scooper: it is a land-based heavy tanker that reloads on the ground and drops up to 10 000 litres of retardant, close to double a Canadair's load. Retardant is not meant to extinguish but to block: laid ahead of the fire front, it slows the spread and buys crews the time to build a containment line.
>
> Versatility is its other strength. Between drops, a Milan flies personnel and equipment transport missions, which an amphibious aircraft cannot do. The French Sécurité Civile operates 6 of them alongside the 12 Pélican.
>
> On the map a Milan is recognisable by its track: fewer tight turns than a Canadair in a noria, and longer round trips between its base and the fire, since it has to land to reload.

## Shared block — after the live status, on all 18 pages

### h2: How to read this aircraft's tracking

> An aircraft shown as "on the ground" is not necessarily unavailable. Water bombers broadcast their position over ADS-B, the same signal airliners use, and that transponder is often switched off while parked. An aircraft therefore appears on the map when it takes off, usually in daylight during the fire season, and disappears at the end of the mission.
>
> The history below does not list every mission this aircraft has flown, only those kanari was able to observe: a fire is linked to an aircraft when that aircraft was detected within 40 kilometres of an archived hotspot while the hotspot was active. Ferry flights, training sorties and missions outside ADS-B coverage will not appear. The archive began on 3 August 2026 and fills automatically.
>
> If what you want to know is whether a particular fire is being fought from the air, the live map tells you more than an aircraft page: several bombers circling the same massif in a noria is the signature of a fire actively being worked.

## FAQ — Pélican

> **How much water does this Canadair carry?**
> About 6 000 litres, scooped in 12 seconds while skimming a body of water at 130 km/h, without landing. Over a day with water close to the fire, a CL-415 can drop more than 100 000 litres.

> **Why is this aircraft not on the map?**
> Because its ADS-B transponder is off, which is usually the case on the ground. Canadairs appear when they take off, mainly in daylight during the fire season.

> **What does "observed on a fire" mean?**
> That kanari detected the aircraft within 40 kilometres of an archived hotspot while that hotspot was active. It is an indication of engagement, not an official confirmation of a mission.

## FAQ — Milan

> **What is the difference between a Milan and a Canadair?**
> The Dash 8 "Milan" reloads on the ground and drops up to 10 000 litres of retardant, against 6 000 litres of water scooped in flight for a Canadair CL-415. The Canadair works in fast rotations near water; the Milan blocks the fire ahead of the front and also flies transport missions.

> **What is retardant for?**
> Not to extinguish but to slow: laid ahead of the flame front, it holds back the spread and gives ground crews time to build a containment line.

> **Why is this aircraft not on the map?**
> Because its ADS-B transponder is off, which is usually the case on the ground. Aircraft appear when they take off, mainly in daylight during the fire season.

---

# ES

## Bloque modelo A — los 12 «Pélican» (CL-415)

### h2: Qué hace un Pélican

> El CL-415 es un avión anfibio: no aterriza para recargar. Llena sus depósitos rozando una superficie de agua a unos 130 km/h con las cucharas abiertas, y embarca cerca de 6 000 litros en 12 segundos a lo largo de 1 500 metros. Necesita al menos 2 kilómetros de agua utilizable, sin embarcaciones ni cables, y por eso las zonas de carga se cierran a la navegación durante las operaciones.
>
> Su eficacia está en el ritmo, no en una descarga aislada. Cuando el agua está cerca del incendio, un Pélican puede descargar cada diez minutos aproximadamente, una rotación llamada noria, que suma más de 100 000 litros en una buena jornada. La descarga se hace entre 30 y 50 metros del suelo, a casi 200 km/h, en las turbulencias que genera el propio fuego. El agua no apaga el incendio: lo frena y lo enfría para que las brigadas terrestres puedan rematar el trabajo.
>
> Este aparato es uno de los 12 Canadair CL-415 de la Sécurité Civile francesa, con base en Nîmes-Garons e indicativo de radio «Pélican».

## Bloque modelo B — los 6 «Milan» (Dash 8-402MR)

### h2: Qué hace un Milan

> El Dash 8-402MR no es un anfibio: es un gran cisterna terrestre que recarga en tierra y descarga hasta 10 000 litros de retardante, casi el doble que un Canadair. El retardante no busca apagar sino cortar: depositado por delante del frente, frena la propagación y da tiempo a las brigadas para abrir una línea de defensa.
>
> Su polivalencia es la otra ventaja. Entre descargas, un Milan realiza misiones de transporte de personal y material, algo que un anfibio no puede hacer. La Sécurité Civile francesa opera 6, junto a los 12 Pélican.
>
> En el mapa se reconoce por su trayectoria: menos giros cerrados que un Canadair en noria, y trayectos más largos entre su base y el incendio, porque debe aterrizar para recargar.

## Bloque común — tras el estado en directo, en las 18 páginas

### h2: Cómo leer el seguimiento de este aparato

> Un aparato «en tierra» no está necesariamente indisponible. Los hidroaviones emiten su posición por ADS-B, la misma señal que los aviones de línea, y ese transpondedor suele estar apagado en el estacionamiento. El aparato aparece en el mapa al despegar, normalmente de día y en temporada de incendios, y desaparece al terminar la misión.
>
> El historial no recoge todas las misiones del aparato, solo las que kanari ha podido observar: un incendio se asocia a un avión cuando este ha sido detectado a menos de 40 kilómetros de un foco archivado mientras ese foco estaba activo. Los vuelos de traslado, los entrenamientos y las misiones fuera de cobertura ADS-B no aparecen. El archivo comenzó el 3 de agosto de 2026 y se completa automáticamente.
>
> Si lo que quiere saber es si un incendio concreto se está combatiendo desde el aire, el mapa en directo dice más que una página de aparato: varios hidroaviones girando sobre el mismo monte es la firma de un incendio en tratamiento.

## FAQ — Pélican

> **¿Cuánta agua lleva este Canadair?**
> Unos 6 000 litros, cargados en 12 segundos rozando el agua a 130 km/h, sin aterrizar. En una jornada con agua cerca del incendio, un CL-415 puede descargar más de 100 000 litros.

> **¿Por qué no aparece este aparato en el mapa?**
> Porque su transpondedor ADS-B está apagado, lo habitual en tierra. Los Canadair aparecen al despegar, sobre todo de día y en temporada de incendios.

> **¿Qué significa «observado en un incendio»?**
> Que kanari detectó el aparato a menos de 40 kilómetros de un foco archivado mientras ese foco estaba activo. Es un indicio de intervención, no una confirmación oficial de misión.

## FAQ — Milan

> **¿Qué diferencia hay entre un Milan y un Canadair?**
> El Dash 8 «Milan» recarga en tierra y descarga hasta 10 000 litros de retardante, frente a los 6 000 litros de agua que un CL-415 carga en vuelo. El Canadair encadena rotaciones cerca del agua; el Milan corta el avance por delante del frente y además realiza misiones de transporte.

> **¿Para qué sirve el retardante?**
> No para apagar sino para frenar: depositado por delante del frente de llamas, contiene la propagación y da tiempo a abrir una línea de defensa.

> **¿Por qué no aparece este aparato en el mapa?**
> Porque su transpondedor ADS-B está apagado, lo habitual en tierra. Los aparatos aparecen al despegar, sobre todo de día y en temporada de incendios.

---

# PT

## Bloco modelo A — os 12 «Pélican» (CL-415)

### h2: O que faz um Pélican

> O CL-415 é um avião anfíbio: não aterra para recarregar. Enche os depósitos rasando um plano de água a cerca de 130 km/h com as conchas abertas, e embarca perto de 6 000 litros em 12 segundos ao longo de 1 500 metros. Precisa de pelo menos 2 quilómetros de água utilizável, sem embarcações nem cabos, razão pela qual as zonas de recolha são encerradas à navegação durante as operações.
>
> A sua eficácia está na cadência, não numa descarga isolada. Quando a água está perto do incêndio, um Pélican pode descarregar aproximadamente de dez em dez minutos, uma rotação a que se chama noria, somando mais de 100 000 litros num bom dia. A descarga faz-se entre 30 e 50 metros do solo, a quase 200 km/h, na turbulência gerada pelo próprio fogo. A água não apaga o incêndio: trava-o e arrefece-o para que as equipas no terreno possam concluir o trabalho.
>
> Este aparelho é um dos 12 Canadair CL-415 da Sécurité Civile francesa, baseados em Nîmes-Garons e com indicativo de rádio «Pélican».

## Bloco modelo B — os 6 «Milan» (Dash 8-402MR)

### h2: O que faz um Milan

> O Dash 8-402MR não é um anfíbio: é um grande tanque terrestre que recarrega no solo e larga até 10 000 litros de retardante, quase o dobro de um Canadair. O retardante não serve para apagar mas para cortar: colocado à frente da frente de fogo, trava a propagação e dá tempo às equipas para abrirem uma linha de contenção.
>
> A polivalência é a outra vantagem. Entre largadas, um Milan faz missões de transporte de pessoal e material, o que um anfíbio não pode fazer. A Sécurité Civile francesa opera 6, a par dos 12 Pélican.
>
> No mapa reconhece-se pela trajetória: menos voltas apertadas do que um Canadair em noria, e percursos mais longos entre a base e o incêndio, já que tem de aterrar para recarregar.

## Bloco comum — a seguir ao estado em direto, nas 18 páginas

### h2: Como ler o seguimento deste aparelho

> Um aparelho «no solo» não está necessariamente indisponível. Os aviões-tanque emitem a sua posição por ADS-B, o mesmo sinal dos aviões de linha, e esse transponder está muitas vezes desligado no estacionamento. O aparelho aparece no mapa quando descola, normalmente de dia e em época de incêndios, e desaparece no fim da missão.
>
> O histórico não regista todas as missões do aparelho, apenas as que o kanari conseguiu observar: um incêndio é associado a um avião quando este foi detetado a menos de 40 quilómetros de um foco arquivado enquanto esse foco estava ativo. Voos de translado, treinos e missões fora da cobertura ADS-B não aparecem. O arquivo começou a 3 de agosto de 2026 e preenche-se automaticamente.
>
> Se o que quer saber é se um incêndio concreto está a ser combatido do ar, o mapa em direto diz mais do que uma página de aparelho: vários aviões a girar sobre a mesma serra é a assinatura de um incêndio em tratamento.

## FAQ — Pélican

> **Quanta água leva este Canadair?**
> Cerca de 6 000 litros, recolhidos em 12 segundos a rasar a água a 130 km/h, sem aterrar. Num dia com água perto do incêndio, um CL-415 pode largar mais de 100 000 litros.

> **Porque é que este aparelho não aparece no mapa?**
> Porque o seu transponder ADS-B está desligado, o que é habitual no solo. Os Canadair aparecem quando descolam, sobretudo de dia e em época de incêndios.

> **O que significa «observado num incêndio»?**
> Que o kanari detetou o aparelho a menos de 40 quilómetros de um foco arquivado enquanto esse foco estava ativo. É um indício de intervenção, não uma confirmação oficial de missão.

## FAQ — Milan

> **Qual a diferença entre um Milan e um Canadair?**
> O Dash 8 «Milan» recarrega no solo e larga até 10 000 litros de retardante, contra os 6 000 litros de água que um CL-415 recolhe em voo. O Canadair encadeia rotações perto da água; o Milan corta o avanço à frente da frente de fogo e faz também missões de transporte.

> **Para que serve o retardante?**
> Não para apagar mas para travar: colocado à frente da frente de chamas, contém a propagação e dá tempo para abrir uma linha de contenção.

> **Porque é que este aparelho não aparece no mapa?**
> Porque o seu transponder ADS-B está desligado, o que é habitual no solo. Os aparelhos aparecem quando descolam, sobretudo de dia e em época de incêndios.

---

## Demandes techniques

1. **Retirer `export const dynamic = "force-dynamic"`** de
   `src/app/[lang]/canadair/[reg]/page.tsx`. Ces pages n'ont aucune raison d'être
   recalculées à chaque requête : seul le statut en vol est volatil, et il peut se
   charger côté client ou en ISR court. C'est 18 pages × 4 langues qui coûtent
   aujourd'hui du budget de crawl pour rien.
2. **Émettre la FAQ en JSON-LD FAQPage**, comme sur les guides. Le commentaire de
   `src/lib/guides.ts` note lui-même le gain mesuré sur les citations IA.
3. **Ne pas changer les URL** : `/[lang]/canadair/[reg]` est au sitemap.
4. **Titres** : conserver le format actuel, il est bon
   (« F-ZBMG Canadair CL-415 « Pélican » : suivi en direct | kanari »).
