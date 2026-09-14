# Optimisation du guide « odeur de fumée » — copie prête à intégrer

Rédigé par la conversation Référencement le 28/08/2026. Le guide existe déjà
(`odeur-de-fumee-que-faire`, présent dans les 4 langues) et il est bon : il n'y a
**rien à réécrire de fond**. Ce document ne contient que les champs à remplacer et
une section à ajouter.

## Pourquoi ce travail

Search Console, 28 jours : `ça sent le feu dehors` 13 impressions position 9,9 ;
`odeur de feu dehors` 9 impressions position 10,6 ; `ça sent la fumée dehors` 6
impressions position 11,8. C'est le deuxième bloc de trafic du site après les
Canadair, et l'intention la plus forte : des gens inquiets qui veulent une réponse
immédiate.

Deux causes au plafonnement en page 1 basse :

1. **Les deux requêtes qui pèsent le plus utilisent le mot « feu », que la page
   n'emploie jamais dans ce sens.** Vérifié : « ça sent le feu » 0 occurrence,
   « odeur de feu » 0, « ça sent le brûlé » 0, « odeur de brûlé » 0. La page ne dit
   que « fumée » et « brûlé » isolément.
2. **Google traite cette requête comme de l'actualité locale.** Le SERP du 28/08 ne
   contient que des articles de presse régionale (France 3 Régions, actu.fr, La
   Dépêche, ici.fr) du type « pourquoi ça sent le brûlé à [ville] ». Un guide
   evergreen seul ne bat pas une actualité fraîche : il faut lui adjoindre ce que la
   presse n'a pas, à savoir la donnée locale en direct.

**Ne pas changer le slug** `odeur-de-fumee-que-faire` : l'URL est indexée.

---

## FR — `src/lib/guides.ts`

**title (H1)**
> Ça sent le feu ou la fumée dehors : y a-t-il un incendie près de chez vous ?

**metaTitle**
> Ça sent le feu dehors ? Vérifier s'il y a un incendie près de chez vous | kanari

**metaDesc**
> Une odeur de feu, de fumée ou de brûlé dehors sans flamme visible ? Les causes possibles, comment vérifier en deux minutes sur la carte satellite gratuite s'il y a un foyer autour de vous, et quand appeler le 18.

**intro**
> « Ça sent le feu dehors », « ça sent le brûlé », « il y a une odeur de fumée » : sans flamme visible, c'est l'une des situations les plus déroutantes, parce que la source peut être à 500 mètres comme à 300 kilomètres. Voici comment lever le doute en quelques minutes, et à partir de quand il faut alerter les secours.

**Nouvelle section, à insérer en deuxième position** (juste après « D'où peut venir cette odeur »)

> ### h2 : À quelle distance peut-on sentir un feu ?
>
> C'est la question qui angoisse, et la réponse rassure plus souvent qu'elle n'inquiète. Une odeur de feu de végétation se perçoit couramment à 10 ou 20 kilomètres sous le vent, et un grand incendie se sent à plus de 100 kilomètres : les panaches des feux canadiens de 2023 ont été sentis jusqu'en Europe de l'Ouest. Sentir le brûlé ne signifie donc pas que le feu est proche.
>
> Le bon réflexe n'est pas d'estimer la distance au nez, mais de regarder la carte. Si aucun foyer n'apparaît dans un rayon de 50 kilomètres autour de vous, l'odeur vient presque certainement d'ailleurs : un brûlage de déchets verts dans le voisinage, un feu de cheminée, ou une fumée transportée de loin. Si un foyer apparaît au vent de votre position, vous avez votre explication, et vous pouvez suivre son évolution en direct.

**FAQ — remplacer la première question et ajouter la quatrième**

> **Q.** Pourquoi ça sent le feu ou le brûlé dehors sans rien voir ?
> **R.** Quatre causes couvrent la plupart des cas : un feu de végétation proche, la fumée d'un incendie lointain transportée par le vent, parfois sur plus de 100 kilomètres, un brûlage agricole ou de déchets verts, ou un feu urbain ponctuel. La nuit, l'inversion de température plaque en plus les fumées au sol, ce qui renforce l'odeur sans que le feu se soit rapproché.

> **Q.** À quelle distance sent-on un incendie de forêt ?
> **R.** Couramment 10 à 20 kilomètres sous le vent pour un feu de végétation ordinaire, et plus de 100 kilomètres pour un grand incendie. Une odeur de brûlé n'indique donc pas un feu proche. Le seul moyen fiable de lever le doute est de regarder une carte de détection en temps réel et le sens du vent : si aucun foyer n'apparaît dans un rayon de 50 kilomètres, la source est ailleurs.

---

## EN — `src/lib/guides-en.ts`

Requêtes visées : `why does it smell like smoke outside`, `smells like fire outside`, `why does it smell like burning`.

**title (H1)**
> It smells like smoke or fire outside: is there a wildfire near you?

**metaTitle**
> Smells like fire outside? Check for a wildfire near you | kanari

**metaDesc**
> A smell of smoke or burning outside with no flames in sight? The likely causes, how to check in two minutes on a free satellite map whether a fire is burning near you, and when to call emergency services.

**intro**
> "It smells like smoke outside", "it smells like something is burning": with no flames in sight, this is one of the most unsettling situations, because the source can be 500 metres away or 300 kilometres away. Here is how to settle the question in a few minutes, and when to call emergency services.

**Nouvelle section**
> ### h2: How far away can you smell a wildfire?
>
> This is the question that worries people, and the answer is usually reassuring. The smell of burning vegetation commonly carries 10 to 20 kilometres downwind, and a large wildfire can be smelled more than 100 kilometres away: the plumes from the 2023 Canadian fires were smelled as far as Western Europe. Smelling smoke does not mean the fire is close.
>
> The right reflex is not to guess the distance, but to look at the map. If no hotspot appears within 50 kilometres of you, the smell almost certainly comes from somewhere else: garden waste burning nearby, a wood fire, or smoke carried from far away. If a hotspot appears upwind of your position, you have your answer, and you can follow it live.

---

## ES — `src/lib/guides-es.ts`

Requêtes visées : `huele a humo en la calle`, `por qué huele a quemado`, `huele a quemado y no veo fuego`.

**title (H1)**
> Huele a humo o a quemado en la calle: ¿hay un incendio cerca de ti?

**metaTitle**
> ¿Huele a quemado? Comprueba si hay un incendio cerca | kanari

**metaDesc**
> ¿Olor a humo o a quemado en la calle sin ver llamas? Las causas posibles, cómo comprobar en dos minutos en el mapa satelital gratuito si hay un foco cerca de ti, y cuándo llamar al 112.

**intro**
> «Huele a humo», «huele a quemado y no veo nada»: sin llamas a la vista, es una de las situaciones más desconcertantes, porque el origen puede estar a 500 metros o a 300 kilómetros. Así puedes salir de dudas en unos minutos, y saber cuándo hay que avisar a los servicios de emergencia.

**Nueva sección**
> ### h2: ¿A qué distancia se huele un incendio?
>
> Es la pregunta que angustia, y la respuesta tranquiliza más veces de las que preocupa. El olor a vegetación quemada se percibe habitualmente a 10 o 20 kilómetros a favor del viento, y un gran incendio se huele a más de 100 kilómetros: las columnas de los incendios canadienses de 2023 se olieron hasta en Europa occidental. Oler a quemado no significa que el fuego esté cerca.
>
> El reflejo correcto no es calcular la distancia a ojo, sino mirar el mapa. Si no aparece ningún foco en un radio de 50 kilómetros, el olor viene casi con seguridad de otro sitio: una quema de restos vegetales en el vecindario, una chimenea, o humo transportado desde lejos. Si aparece un foco en la dirección de donde sopla el viento, ya tienes la explicación y puedes seguirlo en directo.

---

## PT — `src/lib/guides-pt.ts`

Requêtes visées : `cheiro a queimado na rua`, `porque cheira a fumo`, `cheiro de queimado sem ver fogo`.

**title (H1)**
> Cheiro a fumo ou a queimado na rua: há um incêndio perto de si?

**metaTitle**
> Cheiro a queimado? Veja se há um incêndio perto de si | kanari

**metaDesc**
> Cheiro a fumo ou a queimado na rua sem ver chamas? As causas possíveis, como verificar em dois minutos no mapa de satélite gratuito se há um foco perto de si, e quando ligar para o 112.

**intro**
> «Cheira a fumo», «cheira a queimado e não vejo nada»: sem chamas à vista, é uma das situações mais desconcertantes, porque a origem pode estar a 500 metros ou a 300 quilómetros. Eis como esclarecer a dúvida em poucos minutos, e a partir de quando é preciso avisar os bombeiros.

**Nova secção**
> ### h2: A que distância se sente o cheiro de um incêndio?
>
> É a pergunta que inquieta, e a resposta tranquiliza mais vezes do que preocupa. O cheiro a vegetação queimada sente-se habitualmente a 10 ou 20 quilómetros a favor do vento, e um grande incêndio sente-se a mais de 100 quilómetros: as colunas dos incêndios canadianos de 2023 foram sentidas até à Europa ocidental. Sentir cheiro a queimado não significa que o fogo esteja perto.
>
> O reflexo certo não é calcular a distância pelo olfato, mas olhar para o mapa. Se não aparecer nenhum foco num raio de 50 quilómetros, o cheiro vem quase de certeza de outro lado: uma queima de restos vegetais na vizinhança, uma lareira, ou fumo transportado de longe. Se aparecer um foco na direção de onde sopra o vento, tem a explicação e pode acompanhá-lo em direto.

---

## Deux demandes techniques

1. **Mettre à jour le champ `updated`** des quatre versions à la date d'intégration :
   la fraîcheur compte sur une requête que Google traite comme de l'actualité.
2. **Placer le formulaire d'alerte par e-mail en fin de guide**, pas seulement le
   bouton de notification push : c'est la page la mieux qualifiée du site pour la
   capture, l'intention y est maximale. Le bloc « Suivre l'évolution sans y penser »
   est l'emplacement naturel.
