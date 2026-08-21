// Guides évergreens (contenu FR, URL canonique unique) : captent le trafic
// informationnel hors-crise et nourrissent les réponses des LLM. Chaque
// section est rédigée pour être citable telle quelle.

export type GuideSection = { h2: string; paras: string[] };
export type Guide = {
  slug: string;
  title: string; // H1
  metaTitle: string;
  metaDesc: string;
  intro: string;
  sections: GuideSection[];
  updated: string; // ISO date (affichée + JSON-LD)
  // Questions fréquentes : affichées en bas de guide ET émises en FAQPage
  // JSON-LD — le format que les moteurs de réponse IA citent le plus
  // (mesuré : +40 % ChatGPT, +73 % AI Overviews sur les pages avec FAQ).
  faq?: { q: string; a: string }[];
  // Alt du schéma illustratif (public/guides/[slug].svg + .png pour l'OG).
  imageAlt?: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "que-faire-feu-de-foret",
    title: "Que faire en cas de feu de forêt ? Les bons réflexes",
    metaTitle: "Que faire en cas de feu de forêt ? Les bons réflexes | kanari",
    metaDesc:
      "Témoin d'un départ de feu, habitation menacée, fumée au loin : les bons réflexes validés par les consignes de la Sécurité Civile, étape par étape.",
    imageAlt:
      "Schéma des trois réflexes en cas de feu de forêt : alerter le 18 ou le 112, s'abriter dans une maison fermée, suivre les consignes et la carte en temps réel",
    intro:
      "Face à un feu de forêt, les premières minutes comptent double : un feu attrapé à 10 minutes est une clairière noircie, le même feu deux heures plus tard peut dépasser 1 000 hectares. Voici les réflexes qui sauvent, dans l'ordre.",
    updated: "2026-08-03",
    sections: [
      {
        h2: "Vous êtes témoin d'un départ de feu",
        paras: [
          "Appelez immédiatement le 18 ou le 112 (numéro d'urgence européen, gratuit, qui fonctionne même sans réseau de votre opérateur). Donnez la localisation la plus précise possible : commune, lieu-dit, route la plus proche, et ce que vous voyez — fumée blanche ou noire, flammes visibles ou non, largeur du front. Ne raccrochez que quand l'opérateur vous le dit.",
          "N'essayez d'éteindre vous-même qu'un feu naissant de très petite taille (moins d'un mètre), avec de la terre, du sable ou de l'eau, et toujours en gardant une voie de repli. Au moindre doute, éloignez-vous : un feu de végétation peut avancer plus vite qu'un homme qui court.",
          "Une fois les secours prévenus, vous pouvez signaler le départ sur kanari (bouton « Signaler un feu ») : votre signalement, horodaté et géolocalisé, aide les habitants du secteur à voir le danger au plus tôt.",
        ],
      },
      {
        h2: "Votre habitation est menacée",
        paras: [
          "Contrairement à l'intuition, une maison en dur bien préparée est souvent l'abri le plus sûr : fermez volets, fenêtres et aérations, arrosez les abords si vous en avez le temps, rentrez les bouteilles de gaz et véhicules, habillez-vous en coton couvrant. Ne partez en voiture que si les autorités l'ordonnent — la majorité des victimes de feux de forêt sont surprises sur les routes, dans la fumée.",
          "Écoutez les consignes officielles : FR-Alert (notification sur votre téléphone), la mairie, la préfecture, France Bleu. Elles priment sur toute autre information, y compris kanari.",
        ],
      },
      {
        h2: "Avant l'été : préparer sa maison et son terrain",
        paras: [
          "Le débroussaillement est obligatoire dans la plupart des communes exposées (50 mètres autour des constructions, souvent plus) : c'est LA mesure qui sauve les maisons. Élaguez les arbres près du toit, éloignez le bois de chauffage et les haies inflammables des façades, nettoyez gouttières et abords.",
          "Neuf feux sur dix sont d'origine humaine : mégot, barbecue, travaux qui font des étincelles, brûlage de déchets verts. Par temps sec et venté, chacun de ces gestes est interdit ou à proscrire.",
        ],
      },
      {
        h2: "Surveiller le risque en temps réel",
        paras: [
          "La carte kanari affiche les départs de feu détectés par satellite et les signalements citoyens vérifiés, en continu et gratuitement. Les pages par département indiquent aussi le risque météo du jour. En période à risque, un coup d'œil le matin et le soir suffit pour savoir ce qui se passe autour de chez vous.",
        ],
      },
    ],
    faq: [
      {
        q: "Quel numéro appeler quand on voit un feu de forêt ?",
        a: "Le 18 (pompiers) ou le 112, numéro d'urgence européen gratuit qui fonctionne même sans le réseau de votre opérateur. Donnez la commune, le lieu-dit ou la route la plus proche, décrivez ce que vous voyez, et ne raccrochez que quand l'opérateur vous le dit.",
      },
      {
        q: "Faut-il évacuer sa maison quand un feu de forêt approche ?",
        a: "Pas de votre propre initiative : une maison en dur, volets et aérations fermés, est souvent l'abri le plus sûr, et la majorité des victimes de feux de forêt sont surprises sur les routes, dans la fumée. On n'évacue que sur ordre des autorités (FR-Alert, mairie, préfecture).",
      },
      {
        q: "Peut-on éteindre soi-même un départ de feu ?",
        a: "Seulement un foyer naissant de moins d'un mètre, avec de la terre, du sable ou de l'eau, en gardant toujours une voie de repli. Au moindre doute, éloignez-vous : un feu de végétation peut avancer plus vite qu'un homme qui court.",
      },
    ],
  },
  {
    slug: "comment-fonctionne-un-canadair",
    title: "Comment fonctionne un Canadair ?",
    metaTitle: "Comment fonctionne un Canadair ? Écopage, largage, flotte | kanari",
    metaDesc:
      "6 000 litres écopés en 12 secondes, largage à 30 mètres du sol : comment le Canadair CL-415 combat les feux, et comment suivre les Pélican français en direct.",
    imageAlt:
      "Schéma du cycle d'un Canadair : écopage de 6 000 litres sur un plan d'eau, largage à 30-50 mètres au-dessus du feu, rotation en noria toutes les 10 minutes",
    intro:
      "Le Canadair est devenu le symbole de la lutte aérienne contre les feux de forêt. Derrière l'avion jaune et rouge, une mécanique de précision : écopage, noria, largage en appui des pompiers au sol.",
    updated: "2026-08-03",
    sections: [
      {
        h2: "L'écopage : 6 000 litres en 12 secondes",
        paras: [
          "Le Canadair CL-415 est un avion amphibie : il remplit ses soutes en frôlant un plan d'eau (mer, lac, grand fleuve) à environ 130 km/h, écopes ouvertes. En 12 secondes et 1 500 mètres de glissade, il embarque environ 6 000 litres d'eau. C'est ce qui le rend unique : pas besoin de se poser pour recharger.",
          "Le pilote doit trouver un plan d'eau d'au moins 2 kilomètres exploitables, sans obstacle (bateaux, câbles, baigneurs) — c'est pourquoi les zones d'écopage sont fermées à la navigation pendant les opérations.",
        ],
      },
      {
        h2: "La noria : la rotation qui fait la différence",
        paras: [
          "L'efficacité d'un bombardier d'eau ne se mesure pas à un largage mais à la cadence : si le point d'écopage est proche du feu, un Canadair peut enchaîner un largage toutes les 10 minutes, soit des dizaines de rotations et plus de 100 000 litres dans une journée. Cette rotation continue s'appelle la noria.",
          "Le largage se fait entre 30 et 50 mètres du sol, à environ 200 km/h, souvent dans des turbulences fortes générées par le feu lui-même. L'eau n'éteint pas le feu à elle seule : elle le ralentit et le refroidit pour permettre aux équipes au sol de finir le travail.",
        ],
      },
      {
        h2: "La flotte française : Pélican, Milan, Dash",
        paras: [
          "La Sécurité Civile française opère 12 Canadair CL-415 basés à Nîmes-Garons, indicatif radio « Pélican », ainsi que 6 Dash 8-402MR « Milan » — des gros porteurs capables de larguer 10 000 litres de produit retardant, en plus de missions de transport.",
          "L'Italie aligne la plus grande flotte de Canadair d'Europe (une quinzaine de CL-415 de la Protezione Civile), suivie de l'Espagne, de la Grèce et de la Croatie. L'Union européenne finance en plus une flotte de réserve (rescEU) mobilisable dans toute l'Europe.",
        ],
      },
      {
        h2: "Suivre les Canadair en direct",
        paras: [
          "Comme les avions de ligne, la plupart des bombardiers d'eau diffusent leur position par transpondeur ADS-B. kanari agrège ces signaux et affiche en temps réel les Canadair, Fire Boss, tankers lourds et hélicoptères bombardiers en vol dans le monde, superposés à la carte des feux. Un appareil qui tourne en noria au-dessus d'un massif, c'est la signature visible d'un feu en cours de traitement.",
        ],
      },
    ],
    faq: [
      {
        q: "Combien de litres d'eau transporte un Canadair ?",
        a: "Le Canadair CL-415 écope environ 6 000 litres en 12 secondes en frôlant un plan d'eau, sans se poser. Les Dash 8 « Milan » de la Sécurité Civile larguent jusqu'à 10 000 litres de produit retardant.",
      },
      {
        q: "Où les Canadair écopent-ils ?",
        a: "Sur un plan d'eau d'au moins 2 kilomètres exploitables sans obstacle (mer, lac, grand fleuve), à environ 130 km/h, écopes ouvertes. Les zones d'écopage sont fermées à la navigation pendant les opérations.",
      },
      {
        q: "Combien de Canadair possède la France ?",
        a: "La Sécurité Civile opère 12 Canadair CL-415 basés à Nîmes-Garons, indicatif « Pélican », plus 6 Dash 8 « Milan ». L'Italie aligne la plus grande flotte de Canadair d'Europe, devant l'Espagne, la Grèce et la Croatie.",
      },
    ],
  },
  {
    slug: "detection-feux-satellite",
    title: "Comment les satellites détectent-ils les feux de forêt ?",
    metaTitle: "Détecter les feux de forêt par satellite : VIIRS, GOES, MTG | kanari",
    metaDesc:
      "Anomalies thermiques, résolution 375 m, rafraîchissement 10 minutes : comment les satellites VIIRS, GOES et Meteosat MTG repèrent les départs de feu, et leurs limites.",
    imageAlt:
      "Schéma des deux familles de satellites de détection des feux : défilant VIIRS à 830 km (pixel 375 m, 2 passages par jour) et géostationnaire GOES/Meteosat à 36 000 km (re-scan toutes les 10 minutes)",
    intro:
      "Un feu émet un rayonnement infrarouge très différent de son environnement. Depuis l'orbite, des capteurs spécialisés repèrent ces « anomalies thermiques » — c'est la colonne vertébrale de toute carte de feux en temps réel, kanari compris.",
    updated: "2026-08-03",
    sections: [
      {
        h2: "Deux familles de satellites complémentaires",
        paras: [
          "Les satellites défilants (VIIRS sur NOAA-20/21, MODIS historiquement) tournent autour de la Terre à 830 km d'altitude et voient chaque point du globe environ deux fois par jour et par satellite, avec une finesse remarquable : un pixel VIIRS fait 375 mètres, assez pour repérer un feu de quelques centaines de mètres carrés bien établi.",
          "Les satellites géostationnaires (GOES pour les Amériques, Meteosat MTG pour l'Europe et l'Afrique) restent fixes à 36 000 km au-dessus d'un même point et re-scannent leur zone toutes les 10 minutes. Moins précis (pixels de 2 à 4 km), ils excellent à attraper tôt les feux qui grossissent vite.",
        ],
      },
      {
        h2: "Du pixel chaud à l'alerte",
        paras: [
          "Les algorithmes comparent chaque pixel à ses voisins et à son historique : un point anormalement chaud en infrarouge moyen, de nuit ou par contraste avec son environnement, devient une « détection active ». Chaque détection porte une position, une puissance radiative (en mégawatts) et un niveau de confiance.",
          "kanari agrège ces détections (NASA FIRMS, GOES, MTG), les regroupe en foyers, les croise avec les témoignages citoyens vérifiés par IA, et les affiche en 2 à 3 minutes. Le croisement satellite + témoin humain est la clé : le satellite confirme le témoin, le témoin devance parfois le satellite.",
        ],
      },
      {
        h2: "Ce que les satellites ne voient pas",
        paras: [
          "Un feu très petit ou naissant peut passer entre deux passages de satellite défilant (jusqu'à 12 heures d'écart aux latitudes moyennes). Les nuages épais, la fumée dense ou la canopée peuvent masquer le signal. Un pixel chaud n'est pas toujours un feu de forêt : torchères industrielles, brûlages agricoles et même toits métalliques surchauffés génèrent des faux positifs, que les algorithmes filtrent en partie.",
          "C'est pour combler ces angles morts que le signalement humain compte : sur kanari, un témoignage géolocalisé publié en ligne peut faire apparaître un départ de feu avant la première détection satellite.",
        ],
      },
    ],
    faq: [
      {
        q: "En combien de temps un satellite détecte-t-il un feu de forêt ?",
        a: "Les satellites géostationnaires (GOES, Meteosat MTG) re-scannent leur zone toutes les 10 minutes avec des pixels de 2 à 4 km. Les satellites défilants (VIIRS, 375 m de résolution) passent environ deux fois par jour et par satellite. kanari affiche les détections publiées en 2 à 3 minutes.",
      },
      {
        q: "Quelle taille de feu un satellite peut-il repérer ?",
        a: "Un pixel VIIRS de 375 mètres permet de repérer un feu de quelques centaines de mètres carrés bien établi. Un feu très petit ou naissant peut passer entre deux passages, être masqué par les nuages, la fumée dense ou la canopée.",
      },
      {
        q: "Les détections satellite peuvent-elles être de faux positifs ?",
        a: "Oui : torchères industrielles, brûlages agricoles ou toits métalliques surchauffés génèrent des pixels chauds sans feu de forêt. Les algorithmes en filtrent une partie, et kanari croise les détections avec des témoignages humains vérifiés par IA pour consolider la confiance.",
      },
    ],
  },
  {
    slug: "meteo-des-forets",
    title: "Comprendre la météo des forêts et le risque incendie",
    metaTitle: "Météo des forêts : comprendre le risque incendie du jour | kanari",
    metaDesc:
      "Sécheresse, vent, humidité de l'air : comment se calcule le risque de feu de forêt, ce que signifient les niveaux vert à rouge, et où consulter le risque en temps réel.",
    imageAlt:
      "Schéma de la règle des trois 30 : plus de 30 °C, moins de 30 % d'humidité et plus de 30 km/h de vent réunis créent un danger d'incendie maximal",
    intro:
      "Le « triangle du feu » a trois côtés : un combustible sec, de l'oxygène, une source de chaleur. La météo pilote les deux premiers — c'est pourquoi quelques indicateurs météo suffisent à estimer remarquablement bien le danger du jour.",
    updated: "2026-08-03",
    sections: [
      {
        h2: "Les trois facteurs qui font le danger",
        paras: [
          "La sécheresse de la végétation, d'abord : après des semaines sans pluie, l'herbe et les broussailles deviennent un combustible prêt à s'embraser à la moindre étincelle. L'humidité relative de l'air, ensuite : sous 30 %, la végétation fine sèche en quelques heures. Le vent, enfin : il apporte l'oxygène, couche les flammes vers l'avant et projette des brandons parfois à des centaines de mètres — c'est lui qui transforme un départ en catastrophe.",
          "La combinaison la plus redoutée en Méditerranée tient en trois chiffres : plus de 30 °C, moins de 30 % d'humidité, plus de 30 km/h de vent — la « règle des trois 30 ».",
        ],
      },
      {
        h2: "La météo des forêts officielle",
        paras: [
          "Depuis 2023, Météo-France publie chaque jour en été la « météo des forêts » : une carte par département, du vert (risque faible) au rouge (risque très élevé), calculée à partir de l'indice forêt-météo (IFM), qui intègre pluie récente, température, humidité et vent. En risque rouge, l'accès à certains massifs est interdit par arrêté préfectoral.",
          "kanari affiche sur chaque page départementale un risque météo estimé, calculé en continu à partir des mêmes ingrédients (indice de Chandler : température, humidité, vent, pluie récente). Il donne la tendance en temps réel, sans remplacer la carte officielle qui fait foi réglementairement.",
        ],
      },
      {
        h2: "Ce que le risque change concrètement",
        paras: [
          "Les jours à risque élevé, les gestes anodins deviennent dangereux : travaux à l'extérieur avec outils à étincelles, barbecue, mégot, stationnement sur herbe sèche (le pot catalytique peut l'enflammer). Les pompiers pré-positionnent leurs moyens et les bombardiers d'eau font des vols de guet aérien armé : attaquer un feu naissant dans les 10 minutes multiplie les chances de l'arrêter avant le premier hectare.",
          "Le bon réflexe citoyen : consulter le risque du jour le matin, éviter tout geste à flamme ou étincelle, et garder un œil sur la carte en temps réel quand le vent se lève.",
        ],
      },
    ],
    faq: [
      {
        q: "Qu'est-ce que la règle des trois 30 ?",
        a: "La combinaison météo la plus dangereuse pour les feux de forêt en Méditerranée : plus de 30 °C, moins de 30 % d'humidité relative et plus de 30 km/h de vent. Réunies, ces trois conditions transforment le moindre départ en incendie rapide.",
      },
      {
        q: "Où consulter le risque incendie du jour ?",
        a: "Météo-France publie chaque jour en été la « météo des forêts », carte officielle par département du vert au rouge. kanari affiche en complément un risque estimé en continu sur chaque page départementale, calculé à partir des mêmes ingrédients (température, humidité, vent, pluie récente).",
      },
      {
        q: "Qu'est-ce qui est interdit les jours à risque très élevé ?",
        a: "En risque rouge, l'accès à certains massifs est interdit par arrêté préfectoral. Barbecues, mégots, brûlages et travaux générant des étincelles sont à proscrire, et le simple stationnement sur herbe sèche peut suffire à démarrer un feu (pot catalytique).",
      },
    ],
  },
  {
    slug: "odeur-de-fumee-que-faire",
    title: "Odeur de fumée dehors : comment savoir s'il y a un feu près de chez vous ?",
    metaTitle: "Odeur de fumée dehors : y a-t-il un feu près de chez moi ? | kanari",
    metaDesc:
      "Ça sent la fumée ou le brûlé dehors ? Les causes possibles, comment vérifier en 2 minutes s'il y a un feu autour de vous (carte satellite gratuite), et quand appeler le 18.",
    imageAlt:
      "Schéma montrant que l'odeur de fumée arrive du côté d'où souffle le vent : la source, parfois à 100 km, se cherche au vent sur la carte",
    intro:
      "Une odeur de fumée ou de brûlé dehors, sans flamme visible, est l'une des situations les plus déroutantes : le danger peut être à 500 mètres comme à 300 kilomètres. Voici comment identifier la cause en quelques minutes, et quand il faut alerter les secours.",
    updated: "2026-08-13",
    sections: [
      {
        h2: "D'où peut venir cette odeur de fumée ?",
        paras: [
          "Quatre causes couvrent l'immense majorité des cas. Un feu de végétation proche, d'abord : c'est le plus urgent à écarter, surtout l'été par vent soutenu. Un feu lointain ensuite : la fumée d'un grand incendie voyage avec le vent sur des dizaines, parfois des centaines de kilomètres — les panaches des feux canadiens de 2023 ont traversé l'Atlantique jusqu'en Europe. Viennent enfin les brûlages agricoles ou de déchets verts (souvent en matinée, hors période d'interdiction) et les feux urbains ponctuels : bâtiment, véhicule, poubelles.",
          "La nuit et tôt le matin, un phénomène amplifie tout : l'inversion de température plaque les fumées au sol au lieu de les laisser monter. Une odeur forte au lever du jour ne signifie donc pas forcément que le feu s'est rapproché — mais elle mérite toujours une vérification.",
        ],
      },
      {
        h2: "Vérifier en deux minutes s'il y a un feu autour de vous",
        paras: [
          "Ouvrez la carte kanari (gratuite, sans compte) et centrez-la sur votre position : les départs de feu détectés par satellite (mise à jour toutes les 10 minutes en Europe) et les signalements citoyens vérifiés y apparaissent en continu. La liste nationale des incendies en cours en France est aussi consultable d'un coup d'œil.",
          "Regardez ensuite le sens du vent, affiché sur la carte : une odeur de fumée arrive TOUJOURS du côté d'où souffle le vent. Si le vent vient du sud-ouest, la source est au sud-ouest — cherchez les foyers dans cette direction, y compris loin : un feu puissant à 100 km sous le vent se sent parfaitement.",
          "Croisez avec les autres signaux : sirènes, rotations d'avions ou d'hélicoptères (la carte suit les Canadair en direct), publications de la préfecture ou des pompiers sur les réseaux sociaux, et l'indice de qualité de l'air de votre région (ATMO) qui grimpe quand un panache passe.",
        ],
      },
      {
        h2: "Quand appeler les secours",
        paras: [
          "Appelez le 18 ou le 112 sans hésiter si vous voyez des flammes ou une colonne de fumée qui monte d'un point précis, si l'odeur s'accompagne de cendres ou de retombées, ou si la fumée devient dense au point de gêner la respiration. Mieux vaut un appel pour rien qu'un feu qui prend de l'avance : les pompiers préfèrent dix signalements redondants à un signalement manquant.",
          "Odeur seule, sans source visible et sans foyer proche sur la carte ? C'est très probablement une fumée transportée de loin ou un brûlage. Inutile d'appeler les secours, mais fermez fenêtres et aérations si l'odeur est forte, surtout pour les personnes fragiles (asthme, insuffisance respiratoire, nourrissons).",
        ],
      },
      {
        h2: "Suivre l'évolution sans y penser",
        paras: [
          "Sur la carte kanari, touchez « M'alerter sur cette zone » : vous recevrez une notification si un nouveau foyer significatif est détecté autour de chez vous. C'est gratuit, sans compte, et cela fonctionne sur téléphone comme sur ordinateur — le moyen le plus simple de dormir tranquille les soirs où « ça sent la fumée ».",
        ],
      },
    ],
    faq: [
      {
        q: "Pourquoi ça sent la fumée dehors sans feu visible ?",
        a: "Quatre causes couvrent la plupart des cas : un feu de végétation proche, la fumée d'un incendie lointain transportée par le vent (parfois sur des centaines de kilomètres), un brûlage agricole, ou un feu urbain ponctuel. La nuit, l'inversion de température plaque en plus les fumées au sol, ce qui amplifie l'odeur sans que le feu soit plus proche.",
      },
      {
        q: "Comment vérifier s'il y a un feu près de chez moi en ce moment ?",
        a: "Ouvrez une carte de détection en temps réel comme kanari.io (satellites rafraîchis toutes les 10 minutes en Europe, témoignages vérifiés par IA) et regardez le sens du vent : une odeur de fumée arrive toujours du côté d'où souffle le vent. Croisez avec les sirènes, les rotations d'avions et l'indice de qualité de l'air.",
      },
      {
        q: "Quand appeler les pompiers pour une odeur de fumée ?",
        a: "Dès que vous voyez des flammes ou une colonne de fumée qui monte d'un point précis, si des cendres retombent, ou si la fumée gêne la respiration : appelez le 18 ou le 112. Une odeur seule, sans source visible ni foyer proche sur la carte, est très probablement une fumée transportée de loin : fermez les fenêtres si elle est forte.",
      },
    ],
  },
];

export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
