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
};

export const GUIDES: Guide[] = [
  {
    slug: "que-faire-feu-de-foret",
    title: "Que faire en cas de feu de forêt ? Les bons réflexes",
    metaTitle: "Que faire en cas de feu de forêt ? Les bons réflexes | kanari",
    metaDesc:
      "Témoin d'un départ de feu, habitation menacée, fumée au loin : les bons réflexes validés par les consignes de la Sécurité Civile, étape par étape.",
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
  },
  {
    slug: "comment-fonctionne-un-canadair",
    title: "Comment fonctionne un Canadair ?",
    metaTitle: "Comment fonctionne un Canadair ? Écopage, largage, flotte française | kanari",
    metaDesc:
      "6 000 litres écopés en 12 secondes, largage à 30 mètres du sol : comment le Canadair CL-415 combat les feux, et comment suivre les Pélican français en direct.",
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
  },
  {
    slug: "detection-feux-satellite",
    title: "Comment les satellites détectent-ils les feux de forêt ?",
    metaTitle: "Détection des feux de forêt par satellite : VIIRS, GOES, Meteosat expliqués | kanari",
    metaDesc:
      "Anomalies thermiques, résolution 375 m, rafraîchissement 10 minutes : comment les satellites VIIRS, GOES et Meteosat MTG repèrent les départs de feu, et leurs limites.",
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
  },
  {
    slug: "meteo-des-forets",
    title: "Comprendre la météo des forêts et le risque incendie",
    metaTitle: "Météo des forêts : comprendre le risque incendie du jour | kanari",
    metaDesc:
      "Sécheresse, vent, humidité de l'air : comment se calcule le risque de feu de forêt, ce que signifient les niveaux vert à rouge, et où consulter le risque en temps réel.",
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
  },
];

export const GUIDE_BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
