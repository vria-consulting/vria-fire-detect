// Guías en español (neutro latino) : mismos slugs que los originales
// (URLs compartidas con hreflang), contenido adaptado a América Latina y
// España — números de emergencia, organismos y ejemplos regionalizados.
// Solo los guías de mayor búsqueda están traducidos; el resto se sirve en
// inglés con canonical /en (cero contenido duplicado).

import type { Guide } from "./guides";

export const GUIDES_ES: Guide[] = [
  {
    slug: "que-faire-feu-de-foret",
    title: "Qué hacer ante un incendio forestal: los reflejos que salvan vidas",
    metaTitle: "¿Qué hacer ante un incendio forestal? Los reflejos correctos | kanari",
    metaDesc:
      "Ver un foco iniciarse, casa amenazada, humo a lo lejos: los reflejos correctos, paso a paso, según las recomendaciones de protección civil.",
    imageAlt:
      "Esquema de los tres reflejos ante un incendio forestal: llamar al número de emergencias, refugiarse en una construcción sólida cerrada, seguir las instrucciones oficiales y el mapa en tiempo real",
    intro:
      "En un incendio forestal, los primeros minutos cuentan doble: un foco atacado en 10 minutos es un claro ennegrecido; el mismo fuego dos horas después puede superar las 1 000 hectáreas. Estos son los reflejos que salvan vidas, en orden.",
    updated: "2026-08-16",
    published: "2026-08-16",
    sections: [
      {
        h2: "Eres testigo de un foco que se inicia",
        paras: [
          "Llama de inmediato a emergencias: 911 en la mayor parte de América, 112 en España y Europa (gratuito, funciona incluso sin la red de tu operador). Da la ubicación más precisa posible: localidad, punto de referencia, camino más cercano, y lo que ves — humo blanco o negro, llamas visibles o no, ancho del frente. Cuelga solo cuando el operador te lo indique.",
          "Intenta apagar un foco incipiente tú mismo solo si es muy pequeño (menos de un metro), con tierra, arena o agua, y siempre con una vía de escape. Ante la menor duda, aléjate: un fuego de vegetación puede avanzar más rápido de lo que una persona corre.",
          "Con los servicios de emergencia ya alertados, puedes reportar el foco en kanari (botón « Reportar un incendio »): tu reporte geolocalizado y con hora ayuda a que los vecinos vean el peligro lo antes posible.",
        ],
      },
      {
        h2: "Tu casa está amenazada",
        paras: [
          "Aunque parezca contraintuitivo, una casa sólida y bien preparada suele ser el refugio más seguro: cierra persianas, ventanas y ventilaciones, moja los alrededores si hay tiempo, aleja garrafas de gas y vehículos, ponte ropa de algodón que cubra la piel. Sal en auto solo si las autoridades lo ordenan: la mayoría de las víctimas de incendios forestales son sorprendidas en las rutas, dentro del humo.",
          "Sigue las instrucciones oficiales: alertas a celulares, municipalidad, protección civil o defensa civil, bomberos, radio local. Tienen prioridad sobre cualquier otra información, incluida kanari.",
        ],
      },
      {
        h2: "Antes de la temporada: preparar tu casa y tu terreno",
        paras: [
          "Despejar la vegetación es LA medida que salva casas, y es obligatoria en muchas zonas expuestas: mantén un perímetro de seguridad de decenas de metros alrededor de las construcciones, poda los árboles cerca del techo, aleja la leña y los setos inflamables de las paredes, limpia canaletas y alrededores.",
          "Nueve de cada diez incendios son de origen humano: una colilla, un asado, trabajos que generan chispas, quema de residuos vegetales. Con tiempo seco y viento, cada una de esas acciones está prohibida — o debería estarlo.",
        ],
      },
      {
        h2: "Vigilar el riesgo en tiempo real",
        paras: [
          "El mapa kanari muestra los focos detectados por satélite y los reportes ciudadanos verificados, de forma continua y gratuita, en todo el mundo. En períodos de riesgo alto, un vistazo por la mañana y otro por la tarde bastan para saber qué pasa a tu alrededor.",
        ],
      },
    ],
    faq: [
      {
        q: "¿A qué número llamo si veo un incendio forestal?",
        a: "911 en la mayor parte de América, 112 en España y Europa (gratuito, funciona incluso sin la red de tu operador). Indica la localidad, un punto de referencia o el camino más cercano, describe lo que ves y cuelga solo cuando el operador te lo indique.",
      },
      {
        q: "¿Debo evacuar mi casa cuando se acerca un incendio forestal?",
        a: "No por iniciativa propia: una casa sólida con persianas y ventilaciones cerradas suele ser el refugio más seguro, y la mayoría de las víctimas son sorprendidas en las rutas, dentro del humo. Evacúa solo cuando las autoridades lo ordenen (alerta oficial, municipalidad, policía).",
      },
      {
        q: "¿Puedo apagar un foco yo mismo?",
        a: "Solo un foco incipiente de menos de un metro, con tierra, arena o agua, y siempre con una vía de escape. Ante la menor duda, aléjate: un fuego de vegetación puede avanzar más rápido de lo que una persona corre.",
      },
    ],
  },
  {
    slug: "detection-feux-satellite",
    title: "¿Cómo detectan los satélites los incendios forestales?",
    metaTitle: "Detección de incendios desde el espacio: VIIRS, GOES, MTG | kanari",
    metaDesc:
      "Anomalías térmicas, resolución de 375 m, refresco cada 10 minutos: cómo los satélites VIIRS, GOES y Meteosat MTG detectan los focos nuevos, y sus límites.",
    imageAlt:
      "Esquema de las dos familias de satélites para detectar incendios: los polares VIIRS a 830 km (píxel de 375 m, 2 pasadas al día) y los geoestacionarios GOES/Meteosat a 36 000 km (reescaneo cada 10 minutos)",
    intro:
      "Un incendio emite radiación infrarroja muy distinta de la de su entorno. Desde la órbita, sensores especializados detectan esas « anomalías térmicas », la columna vertebral de todo mapa de incendios en tiempo real, kanari incluido.",
    updated: "2026-08-16",
    published: "2026-08-16",
    sections: [
      {
        h2: "Dos familias de satélites complementarias",
        paras: [
          "Los satélites polares (VIIRS a bordo de NOAA-20/21, históricamente MODIS) giran alrededor de la Tierra a 830 km y ven cada punto del globo unas dos veces al día por satélite, con un detalle notable: un píxel VIIRS mide 375 metros, suficiente para revelar un fuego establecido de unos cientos de metros cuadrados.",
          "Los satélites geoestacionarios (GOES sobre las Américas, Meteosat MTG sobre Europa y África) permanecen fijos a 36 000 km sobre el mismo punto y reescanean su zona cada 10 minutos. Menos precisos (píxeles de 2 a 4 km), destacan en atrapar temprano los fuegos de crecimiento rápido — clave en la Amazonía, el Chaco o el matorral chileno.",
        ],
      },
      {
        h2: "Del píxel caliente a la alerta",
        paras: [
          "Los algoritmos comparan cada píxel con sus vecinos y su historial: un punto anormalmente caliente en infrarrojo medio, de noche o por contraste con su entorno, se convierte en una « detección activa ». Cada detección lleva una posición, una potencia radiativa (en megavatios) y un nivel de confianza.",
          "kanari agrega esas detecciones (NASA FIRMS, GOES leído directamente del flujo bruto, Meteosat MTG), las agrupa en eventos de incendio, las cruza con reportes de testigos verificados por IA y las muestra en minutos. El cruce satélite-humano es la clave: el satélite confirma al testigo, y el testigo a veces le gana al satélite.",
        ],
      },
      {
        h2: "Lo que los satélites no pueden ver",
        paras: [
          "Un fuego muy pequeño o incipiente puede escaparse entre dos pasadas de un satélite polar (hasta 12 horas de intervalo en latitudes medias). Las nubes espesas, el humo denso o el dosel forestal pueden enmascarar la señal. Y un píxel caliente no siempre es un incendio forestal: antorchas industriales, quemas agrícolas e incluso techos metálicos recalentados generan falsos positivos, que los algoritmos filtran en parte.",
          "Por eso importan los reportes humanos: en kanari, un reporte de testigo geolocalizado puede revelar un foco antes de la primera detección satelital.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Qué tan rápido puede un satélite detectar un incendio forestal?",
        a: "Los satélites geoestacionarios (GOES, Meteosat MTG) reescanean su zona cada 10 minutos con píxeles de 2 a 4 km. Los polares (VIIRS, resolución de 375 m) pasan unas dos veces al día por satélite. kanari muestra las detecciones publicadas en cuestión de minutos.",
      },
      {
        q: "¿Qué tamaño mínimo de incendio puede ver un satélite?",
        a: "Un píxel VIIRS de 375 metros puede revelar un fuego establecido de unos cientos de metros cuadrados. Un fuego muy pequeño o incipiente puede escaparse entre dos pasadas, o quedar enmascarado por nubes, humo denso o el dosel forestal.",
      },
      {
        q: "¿Las detecciones satelitales pueden ser falsos positivos?",
        a: "Sí: antorchas industriales, quemas agrícolas o techos metálicos recalentados generan píxeles calientes sin ningún incendio forestal. Los algoritmos filtran una parte, y kanari cruza las detecciones con reportes humanos verificados por IA para consolidar la confianza.",
      },
    ],
  },
  {
    slug: "odeur-de-fumee-que-faire",
    title: "Olor a humo afuera: cómo saber si hay un incendio cerca",
    metaTitle: "¿Olor a humo afuera? Cómo saber si hay un incendio cerca | kanari",
    metaDesc:
      "¿Huele a humo o a quemado afuera? Las causas posibles, cómo verificar en 2 minutos si hay un incendio alrededor (mapa satelital gratuito) y cuándo llamar a emergencias.",
    imageAlt:
      "Esquema que muestra que el olor a humo llega desde la dirección de donde sopla el viento: la fuente, a veces a 100 km, está viento arriba en el mapa",
    intro:
      "Un olor a humo o a quemado afuera, sin llama visible, es una de las situaciones más desconcertantes: el peligro puede estar a 500 metros o a 300 kilómetros. Así se identifica la causa en minutos, y así se sabe cuándo alertar a emergencias.",
    updated: "2026-08-16",
    published: "2026-08-16",
    sections: [
      {
        h2: "¿De dónde puede venir ese olor a humo?",
        paras: [
          "Cuatro causas cubren la gran mayoría de los casos. Un fuego de vegetación cercano, primero: el más urgente de descartar, sobre todo en temporada seca con viento sostenido. Un incendio lejano, después: el humo de un gran incendio viaja con el viento decenas y hasta cientos de kilómetros — el humo de las quemas amazónicas oscurece regularmente el cielo de ciudades a más de 1 000 km, como pasó en São Paulo en 2019. Luego las quemas agrícolas o de residuos (a menudo por la mañana), y los fuegos urbanos puntuales: un edificio, un vehículo, contenedores.",
          "De noche y al amanecer, un fenómeno lo amplifica todo: la inversión térmica atrapa el humo cerca del suelo en lugar de dejarlo subir. Un olor fuerte al alba no significa necesariamente que el fuego se acercó, pero siempre merece una verificación.",
        ],
      },
      {
        h2: "Verifica en dos minutos si hay un incendio a tu alrededor",
        paras: [
          "Abre el mapa kanari (gratuito, sin cuenta) y céntralo en tu posición: los focos detectados por satélite (refrescados cada 10 minutos sobre América, Europa y África) y los reportes ciudadanos verificados aparecen de forma continua.",
          "Después mira la dirección del viento, visible en el mapa: un olor a humo llega SIEMPRE desde donde sopla el viento. Si el viento viene del suroeste, la fuente está al suroeste. Busca incendios en esa dirección, incluso lejos: un fuego potente a 100 km viento arriba se huele con claridad.",
          "Cruza con otras señales: sirenas, rotaciones de aviones o helicópteros (el mapa sigue los aviones cisterna en vivo), publicaciones de las autoridades locales o de bomberos, y el índice de calidad del aire de tu región, que sube cuando pasa una pluma de humo.",
        ],
      },
      {
        h2: "Cuándo llamar a emergencias",
        paras: [
          "Llama al 911 (América) o al 112 (España y Europa) sin dudar si ves llamas o una columna de humo que sube desde un punto preciso, si el olor viene acompañado de caída de cenizas, o si el humo se vuelve tan denso que dificulta respirar. Mejor una llamada de más que un incendio con ventaja: los bomberos prefieren diez reportes redundantes a un reporte que falta.",
          "¿Solo olor, sin fuente visible y sin incendio cercano en el mapa? Lo más probable es humo transportado desde lejos o una quema controlada. No hace falta llamar a emergencias, pero cierra ventanas y ventilaciones si el olor es fuerte, sobre todo para personas vulnerables (asma, afecciones respiratorias, bebés).",
        ],
      },
      {
        h2: "Seguir la situación sin pensar en ella",
        paras: [
          "En el mapa kanari, toca « Alertarme en esta zona »: recibirás una notificación si se detecta un nuevo incendio significativo a tu alrededor. Gratuito, sin cuenta, funciona en celular y computadora. La forma más simple de dormir tranquilo las noches en que « huele a humo ».",
        ],
      },
    ],
    faq: [
      {
        q: "¿Por qué huele a humo afuera sin ningún fuego visible?",
        a: "Cuatro causas cubren la mayoría de los casos: un fuego de vegetación cercano, humo de un incendio lejano transportado por el viento (a veces cientos de kilómetros), una quema agrícola, o un fuego urbano puntual. De noche, la inversión térmica también atrapa el humo cerca del suelo y amplifica el olor sin que el fuego esté más cerca.",
      },
      {
        q: "¿Cómo verifico si hay un incendio cerca de mí ahora mismo?",
        a: "Abre un mapa de detección en tiempo real como kanari.io (satélites refrescados cada 10 minutos sobre América, Europa y África, reportes de testigos verificados por IA) y mira la dirección del viento: el olor a humo llega siempre desde viento arriba. Cruza con sirenas, rotaciones de aeronaves y el índice de calidad del aire.",
      },
      {
        q: "¿Cuándo llamo a emergencias por un olor a humo?",
        a: "En cuanto veas llamas o una columna de humo desde un punto preciso, si caen cenizas, o si el humo dificulta respirar: llama al 911 o al 112 según tu región. Un olor solo, sin fuente visible y sin incendio cercano en el mapa, es muy probablemente humo transportado desde lejos: cierra las ventanas si es fuerte.",
      },
    ],
  },
];

export const GUIDE_ES_BY_SLUG = new Map(GUIDES_ES.map((g) => [g.slug, g]));
