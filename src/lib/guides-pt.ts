// Guias em português (brasileiro) : mesmos slugs que os originais franceses
// (URLs compartilhadas com hreflang), conteúdo adaptado ao Brasil e a
// Portugal — números de emergência, órgãos e exemplos regionalizados.
// Só os guias de maior busca estão traduzidos; o resto é servido em inglês
// com canonical /en (zero conteúdo duplicado).

import type { Guide } from "./guides";

export const GUIDES_PT: Guide[] = [
  {
    slug: "que-faire-feu-de-foret",
    title: "O que fazer diante de um incêndio florestal: os reflexos que salvam vidas",
    metaTitle: "O que fazer diante de um incêndio florestal? Os reflexos certos | kanari",
    metaDesc:
      "Ver um foco começar, casa ameaçada, fumaça ao longe: os reflexos certos, passo a passo, segundo as orientações da defesa civil e dos bombeiros.",
    imageAlt:
      "Esquema dos três reflexos diante de um incêndio florestal: ligar para a emergência, abrigar-se em construção sólida fechada, seguir as instruções oficiais e o mapa em tempo real",
    intro:
      "Num incêndio florestal, os primeiros minutos contam em dobro: um foco atacado em 10 minutos é uma clareira enegrecida; o mesmo fogo duas horas depois pode passar de 1 000 hectares. Estes são os reflexos que salvam vidas, em ordem.",
    updated: "2026-08-16",
    sections: [
      {
        h2: "Você presencia um foco começando",
        paras: [
          "Ligue imediatamente para a emergência: 193 (Corpo de Bombeiros) no Brasil, 112 em Portugal e na Europa — ligação gratuita. Dê a localização mais precisa possível: município, ponto de referência, estrada mais próxima, e o que você vê — fumaça branca ou preta, chamas visíveis ou não, largura da frente de fogo. Só desligue quando o atendente mandar.",
          "Só tente apagar um foco você mesmo se ele for muito pequeno (menos de um metro), com terra, areia ou água, e sempre com uma rota de fuga. Na menor dúvida, afaste-se: um fogo de vegetação pode avançar mais rápido do que uma pessoa corre.",
          "Com o socorro já acionado, você pode registrar o foco no kanari (botão « Reportar um incêndio »): seu relato geolocalizado e com horário ajuda os vizinhos a verem o perigo o quanto antes.",
        ],
      },
      {
        h2: "Sua casa está ameaçada",
        paras: [
          "Por mais contraintuitivo que pareça, uma casa sólida e bem preparada costuma ser o abrigo mais seguro: feche janelas, persianas e entradas de ar, molhe os arredores se der tempo, afaste botijões de gás e veículos, vista roupas de algodão que cubram o corpo. Só saia de carro se as autoridades mandarem: a maioria das vítimas de incêndios florestais é surpreendida nas estradas, dentro da fumaça.",
          "Siga as instruções oficiais: alertas da Defesa Civil no celular, prefeitura, bombeiros, rádio local. Elas têm prioridade sobre qualquer outra informação, inclusive o kanari.",
        ],
      },
      {
        h2: "Antes da estação seca: preparar sua casa e seu terreno",
        paras: [
          "Manter a vegetação sob controle é A medida que salva casas: faça aceiros e um perímetro limpo de dezenas de metros ao redor das construções, pode as árvores perto do telhado, afaste lenha e cercas-vivas inflamáveis das paredes, limpe calhas e arredores.",
          "Nove em cada dez incêndios têm origem humana: uma bituca de cigarro, uma churrasqueira, trabalhos que soltam faíscas, queima de lixo ou de restos vegetais. Em tempo seco e com vento, cada uma dessas ações é proibida — ou deveria ser.",
        ],
      },
      {
        h2: "Vigiar o risco em tempo real",
        paras: [
          "O mapa kanari mostra os focos detectados por satélite e os relatos de testemunhas verificados, de forma contínua e gratuita, no mundo inteiro. Em períodos de risco alto, uma olhada de manhã e outra à noite bastam para saber o que acontece ao seu redor.",
        ],
      },
    ],
    faq: [
      {
        q: "Para que número ligo se vejo um incêndio florestal?",
        a: "193 (Corpo de Bombeiros) no Brasil, 112 em Portugal e na Europa — ligação gratuita. Informe o município, um ponto de referência ou a estrada mais próxima, descreva o que vê e só desligue quando o atendente mandar.",
      },
      {
        q: "Devo evacuar minha casa quando um incêndio se aproxima?",
        a: "Não por iniciativa própria: uma casa sólida com janelas e entradas de ar fechadas costuma ser o abrigo mais seguro, e a maioria das vítimas é surpreendida nas estradas, dentro da fumaça. Evacue somente quando as autoridades mandarem (alerta da Defesa Civil, prefeitura, polícia).",
      },
      {
        q: "Posso apagar um foco sozinho?",
        a: "Somente um foco incipiente de menos de um metro, com terra, areia ou água, e sempre com uma rota de fuga. Na menor dúvida, afaste-se: um fogo de vegetação pode avançar mais rápido do que uma pessoa corre.",
      },
    ],
  },
  {
    slug: "detection-feux-satellite",
    title: "Como os satélites detectam incêndios florestais?",
    metaTitle: "Detecção de incêndios do espaço: VIIRS, GOES, Meteosat | kanari",
    metaDesc:
      "Anomalias térmicas, resolução de 375 m, atualização a cada 10 minutos: como os satélites VIIRS, GOES e Meteosat MTG flagram focos novos, e seus limites.",
    imageAlt:
      "Esquema das duas famílias de satélites para detectar incêndios: os polares VIIRS a 830 km (pixel de 375 m, 2 passagens por dia) e os geoestacionários GOES/Meteosat a 36 000 km (nova varredura a cada 10 minutos)",
    intro:
      "Um incêndio emite radiação infravermelha muito diferente da do entorno. Da órbita, sensores especializados flagram essas « anomalias térmicas », a espinha dorsal de todo mapa de incêndios em tempo real — o kanari incluído.",
    updated: "2026-08-16",
    sections: [
      {
        h2: "Duas famílias de satélites complementares",
        paras: [
          "Os satélites polares (VIIRS a bordo dos NOAA-20/21, historicamente o MODIS) giram em volta da Terra a 830 km e veem cada ponto do globo cerca de duas vezes por dia por satélite, com um detalhe notável: um pixel VIIRS mede 375 metros, o bastante para revelar um fogo estabelecido de algumas centenas de metros quadrados.",
          "Os satélites geoestacionários (GOES sobre as Américas, Meteosat MTG sobre Europa e África) ficam fixos a 36 000 km sobre o mesmo ponto e revarrem sua zona a cada 10 minutos. Menos precisos (pixels de 2 a 4 km), são imbatíveis para flagrar cedo os fogos de crescimento rápido — essencial na Amazônia, no Pantanal e no cerrado.",
        ],
      },
      {
        h2: "Do pixel quente ao alerta",
        paras: [
          "Os algoritmos comparam cada pixel com os vizinhos e com o histórico: um ponto anormalmente quente no infravermelho médio, à noite ou por contraste com o entorno, vira uma « detecção ativa ». Cada detecção carrega uma posição, uma potência radiativa (em megawatts) e um nível de confiança.",
          "O kanari agrega essas detecções (NASA FIRMS, GOES lido direto do fluxo bruto, Meteosat MTG), agrupa-as em eventos de incêndio, cruza-as com relatos de testemunhas verificados por IA e as exibe em minutos. O cruzamento satélite-humano é a chave: o satélite confirma a testemunha, e a testemunha às vezes chega antes do satélite.",
        ],
      },
      {
        h2: "O que os satélites não conseguem ver",
        paras: [
          "Um fogo muito pequeno ou recém-começado pode escapar entre duas passagens de um satélite polar (até 12 horas de intervalo em latitudes médias). Nuvens espessas, fumaça densa ou a copa das árvores podem mascarar o sinal. E um pixel quente nem sempre é incêndio florestal: flares industriais, queimadas agrícolas e até telhados metálicos superaquecidos geram falsos positivos, que os algoritmos filtram em parte.",
          "Por isso os relatos humanos importam: no kanari, um relato de testemunha geolocalizado pode revelar um foco antes da primeira detecção por satélite.",
        ],
      },
    ],
    faq: [
      {
        q: "Em quanto tempo um satélite consegue detectar um incêndio?",
        a: "Os satélites geoestacionários (GOES, Meteosat MTG) revarrem sua zona a cada 10 minutos com pixels de 2 a 4 km. Os polares (VIIRS, resolução de 375 m) passam cerca de duas vezes por dia por satélite. O kanari exibe as detecções publicadas em questão de minutos.",
      },
      {
        q: "Qual o menor incêndio que um satélite consegue ver?",
        a: "Um pixel VIIRS de 375 metros pode revelar um fogo estabelecido de algumas centenas de metros quadrados. Um fogo muito pequeno ou recém-começado pode escapar entre duas passagens, ou ficar mascarado por nuvens, fumaça densa ou pela copa das árvores.",
      },
      {
        q: "As detecções por satélite podem ser falsos positivos?",
        a: "Sim: flares industriais, queimadas agrícolas ou telhados metálicos superaquecidos geram pixels quentes sem nenhum incêndio florestal. Os algoritmos filtram uma parte, e o kanari cruza as detecções com relatos humanos verificados por IA para consolidar a confiança.",
      },
    ],
  },
  {
    slug: "odeur-de-fumee-que-faire",
    title: "Cheiro de fumaça lá fora: como saber se há um incêndio por perto",
    metaTitle: "Cheiro de fumaça lá fora? Como saber se há incêndio perto | kanari",
    metaDesc:
      "Está com cheiro de fumaça ou de queimado lá fora? As causas possíveis, como verificar em 2 minutos se há um incêndio ao redor (mapa de satélite gratuito) e quando ligar para os bombeiros.",
    imageAlt:
      "Esquema mostrando que o cheiro de fumaça chega da direção de onde sopra o vento: a fonte, às vezes a 100 km, está contra o vento no mapa",
    intro:
      "Cheiro de fumaça ou de queimado lá fora, sem chama à vista, é uma das situações mais desconcertantes: o perigo pode estar a 500 metros ou a 300 quilômetros. Veja como identificar a causa em minutos — e quando acionar os bombeiros.",
    updated: "2026-08-16",
    sections: [
      {
        h2: "De onde pode vir esse cheiro de fumaça?",
        paras: [
          "Quatro causas cobrem a imensa maioria dos casos. Um fogo de vegetação próximo, primeiro: o mais urgente de descartar, sobretudo na estação seca com vento firme. Um incêndio distante, depois: a fumaça de uma grande queimada viaja com o vento por dezenas e até centenas de quilômetros — a fumaça das queimadas da Amazônia já escureceu o céu de São Paulo em pleno dia, em 2019, vinda de mais de 2 000 km. Depois, as queimadas agrícolas ou de lixo (muitas vezes de manhã), e os incêndios urbanos pontuais: um prédio, um veículo, caçambas.",
          "De noite e de madrugada, um fenômeno amplifica tudo: a inversão térmica prende a fumaça perto do chão em vez de deixá-la subir. Um cheiro forte ao amanhecer não significa necessariamente que o fogo se aproximou, mas sempre merece uma verificação.",
        ],
      },
      {
        h2: "Verifique em dois minutos se há um incêndio ao seu redor",
        paras: [
          "Abra o mapa kanari (gratuito, sem cadastro) e centralize na sua posição: os focos detectados por satélite (atualizados a cada 10 minutos sobre as Américas, a Europa e a África) e os relatos de moradores verificados aparecem continuamente.",
          "Depois olhe a direção do vento, visível no mapa: um cheiro de fumaça chega SEMPRE da direção de onde o vento sopra. Se o vento vem do sudoeste, a fonte está a sudoeste. Procure incêndios naquela direção, inclusive longe: um fogo potente a 100 km contra o vento tem cheiro nítido.",
          "Cruze com outros sinais: sirenes, rotações de aviões ou helicópteros (o mapa acompanha os aviões-tanque ao vivo), publicações da prefeitura, da Defesa Civil ou dos bombeiros, e o índice de qualidade do ar da sua região, que sobe quando uma pluma de fumaça passa.",
        ],
      },
      {
        h2: "Quando ligar para os bombeiros",
        paras: [
          "Ligue para o 193 (Brasil) ou o 112 (Portugal e Europa) sem hesitar se você vê chamas ou uma coluna de fumaça subindo de um ponto preciso, se o cheiro vem acompanhado de queda de cinzas, ou se a fumaça fica densa a ponto de atrapalhar a respiração. Melhor uma ligação a mais do que um incêndio com vantagem: os bombeiros preferem dez avisos redundantes a um aviso que falta.",
          "Só o cheiro, sem fonte visível e sem incêndio próximo no mapa? O mais provável é fumaça trazida de longe ou uma queima controlada. Não precisa acionar a emergência, mas feche janelas e entradas de ar se o cheiro for forte, principalmente para pessoas vulneráveis (asma, doenças respiratórias, bebês).",
        ],
      },
      {
        h2: "Acompanhar a situação sem pensar nela",
        paras: [
          "No mapa kanari, toque em « Alertar-me nesta zona »: você recebe uma notificação se um novo incêndio significativo for detectado ao seu redor. Gratuito, sem cadastro, funciona no celular e no computador. O jeito mais simples de dormir tranquilo nas noites em que « está com cheiro de fumaça ».",
        ],
      },
    ],
    faq: [
      {
        q: "Por que está com cheiro de fumaça lá fora sem nenhum fogo à vista?",
        a: "Quatro causas cobrem a maioria dos casos: um fogo de vegetação próximo, fumaça de um incêndio distante trazida pelo vento (às vezes centenas de quilômetros, como a fumaça da Amazônia que já escureceu São Paulo), uma queimada agrícola, ou um incêndio urbano pontual. De noite, a inversão térmica ainda prende a fumaça perto do chão e amplifica o cheiro sem que o fogo esteja mais perto.",
      },
      {
        q: "Como verifico se há um incêndio perto de mim agora?",
        a: "Abra um mapa de detecção em tempo real como o kanari.io (satélites atualizados a cada 10 minutos sobre as Américas, a Europa e a África, relatos de testemunhas verificados por IA) e olhe a direção do vento: o cheiro de fumaça chega sempre de contra o vento. Cruze com sirenes, rotações de aeronaves e o índice de qualidade do ar.",
      },
      {
        q: "Quando ligo para os bombeiros por causa de um cheiro de fumaça?",
        a: "Assim que vir chamas ou uma coluna de fumaça subindo de um ponto preciso, se estiver caindo cinza, ou se a fumaça atrapalhar a respiração: ligue para o 193 no Brasil ou o 112 em Portugal. Só o cheiro, sem fonte visível e sem incêndio próximo no mapa, é muito provavelmente fumaça trazida de longe: feche as janelas se estiver forte.",
      },
    ],
  },
];

export const GUIDE_PT_BY_SLUG = new Map(GUIDES_PT.map((g) => [g.slug, g]));
