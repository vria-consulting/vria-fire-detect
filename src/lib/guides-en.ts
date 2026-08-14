// English guides: same slugs as the French originals (shared URLs with
// hreflang), content adapted for an international audience rather than
// word-for-word translated — emergency numbers, agencies and examples are
// globalized, with France kept as a factual example where relevant.

import type { Guide } from "./guides";

export const GUIDES_EN: Guide[] = [
  {
    slug: "que-faire-feu-de-foret",
    title: "What to do during a wildfire: the reflexes that save lives",
    metaTitle: "What to do during a wildfire? The right reflexes | kanari",
    metaDesc:
      "Witnessing an ignition, home under threat, smoke in the distance: the right reflexes, step by step, based on civil protection guidance.",
    imageAlt:
      "Diagram of the three wildfire reflexes: call the emergency number, shelter in a closed solid building, follow official instructions and the live map",
    intro:
      "In a wildfire, the first minutes count double: a fire caught within 10 minutes is a blackened clearing, the same fire two hours later can exceed 1,000 hectares. Here are the reflexes that save lives, in order.",
    updated: "2026-08-14",
    sections: [
      {
        h2: "You witness an ignition",
        paras: [
          "Call the emergency number immediately: 112 anywhere in Europe (free, works even without your own carrier's network), 911 in North America, 000 in Australia. Give the most precise location you can: town, landmark, nearest road, and what you see, white or black smoke, visible flames or not, width of the fire front. Only hang up when the operator tells you to.",
          "Only attempt to put out a nascent fire yourself if it is very small (under one metre), using soil, sand or water, and always keep an escape route. At the slightest doubt, move away: a vegetation fire can advance faster than a person can run.",
          "Once emergency services are alerted, you can report the ignition on kanari (the “Report a fire” button): your timestamped, geolocated report helps people nearby see the danger as early as possible.",
        ],
      },
      {
        h2: "Your home is under threat",
        paras: [
          "Counterintuitively, a well-prepared solid house is often the safest shelter: close shutters, windows and vents, wet the surroundings if you have time, move gas bottles and vehicles away, wear covering cotton clothes. Only leave by car if the authorities order it: most wildfire victims are caught on the roads, in the smoke.",
          "Follow official instructions: cell broadcast alerts (FR-Alert in France, Wireless Emergency Alerts in the US), your municipality, the local prefecture or sheriff, local radio. They take precedence over any other information, including kanari.",
        ],
      },
      {
        h2: "Before summer: preparing your home and land",
        paras: [
          "Clearing brush is THE measure that saves houses, and it is mandatory in many exposed areas (in France: 50 metres around buildings, often more; in parts of the US and Australia, defensible space rules apply). Prune trees near the roof, move firewood and flammable hedges away from walls, clean gutters and surroundings.",
          "Nine out of ten fires are human-caused: a cigarette butt, a barbecue, spark-generating work, burning garden waste. In dry, windy weather, every one of these is banned or should be.",
        ],
      },
      {
        h2: "Watching the risk in real time",
        paras: [
          "The kanari map shows satellite-detected ignitions and verified citizen reports, continuously and for free, worldwide. During high-risk periods, a glance in the morning and evening is enough to know what is happening around you.",
        ],
      },
    ],
    faq: [
      {
        q: "What number should I call when I see a wildfire?",
        a: "112 anywhere in Europe (free, works even without your carrier's network), 911 in North America, 000 in Australia. Give the town, landmark or nearest road, describe what you see, and only hang up when the operator tells you to.",
      },
      {
        q: "Should I evacuate my house when a wildfire approaches?",
        a: "Not on your own initiative: a solid house with shutters and vents closed is often the safest shelter, and most wildfire victims are caught on the roads, in the smoke. Evacuate only when authorities order it (cell broadcast alert, municipality, police).",
      },
      {
        q: "Can I put out an ignition myself?",
        a: "Only a nascent fire under one metre, with soil, sand or water, always keeping an escape route. At the slightest doubt, move away: a vegetation fire can advance faster than a person can run.",
      },
    ],
  },
  {
    slug: "comment-fonctionne-un-canadair",
    title: "How does a Canadair water bomber work?",
    metaTitle: "How does a Canadair work? Scooping, drops, the French fleet | kanari",
    metaDesc:
      "6,000 litres scooped in 12 seconds, drops from 30 metres above ground: how the CL-415 fights wildfires, and how to track water bombers live.",
    imageAlt:
      "Diagram of a Canadair's cycle: scooping 6,000 litres from a water body, dropping from 30-50 metres above the fire, rotating every 10 minutes",
    intro:
      "The Canadair has become the symbol of aerial firefighting. Behind the yellow and red aircraft lies precision mechanics: scooping, rotation loops, and drops in support of crews on the ground.",
    updated: "2026-08-14",
    sections: [
      {
        h2: "Scooping: 6,000 litres in 12 seconds",
        paras: [
          "The Canadair CL-415 is an amphibious aircraft: it fills its tanks by skimming a body of water (sea, lake, large river) at about 130 km/h with its scoops open. In 12 seconds and 1,500 metres of glide, it takes on about 6,000 litres of water. That is what makes it unique: no landing needed to reload.",
          "The pilot needs at least 2 usable kilometres of water without obstacles (boats, cables, swimmers), which is why scooping zones are closed to navigation during operations.",
        ],
      },
      {
        h2: "The rotation loop that makes the difference",
        paras: [
          "A water bomber's effectiveness is not measured by one drop but by cadence: if the scooping point is close to the fire, a Canadair can chain a drop every 10 minutes, meaning dozens of rotations and more than 100,000 litres in a day.",
          "Drops happen 30 to 50 metres above ground, at about 200 km/h, often in strong turbulence generated by the fire itself. Water alone does not extinguish the fire: it slows and cools it so ground crews can finish the job.",
        ],
      },
      {
        h2: "The fleets: France, Italy, and rescEU",
        paras: [
          "France's Sécurité Civile operates 12 Canadair CL-415s based at Nîmes-Garons, radio callsign “Pélican”, plus 6 Dash 8-402MR “Milan” heavy tankers able to drop 10,000 litres of retardant.",
          "Italy fields Europe's largest Canadair fleet (about fifteen CL-415s of the Protezione Civile), followed by Spain, Greece and Croatia. The European Union additionally funds a reserve fleet (rescEU) that can deploy anywhere in Europe. North America relies more on land-based air tankers (DC-10, BAe 146) and helicopters.",
        ],
      },
      {
        h2: "Tracking water bombers live",
        paras: [
          "Like airliners, most water bombers broadcast their position via ADS-B transponders. kanari aggregates these signals and shows in real time the Canadairs, Fire Bosses, heavy tankers and firefighting helicopters flying worldwide, overlaid on the fire map. An aircraft looping over a forest is the visible signature of a fire being fought.",
        ],
      },
    ],
    faq: [
      {
        q: "How much water does a Canadair carry?",
        a: "The Canadair CL-415 scoops about 6,000 litres in 12 seconds by skimming a body of water, without landing. France's Dash 8 “Milan” tankers drop up to 10,000 litres of retardant.",
      },
      {
        q: "Where do Canadairs scoop water?",
        a: "From a body of water with at least 2 usable kilometres and no obstacles (sea, lake, large river), at about 130 km/h with scoops open. Scooping zones are closed to navigation during operations.",
      },
      {
        q: "How many Canadairs does France have?",
        a: "France's Sécurité Civile operates 12 Canadair CL-415s based at Nîmes-Garons (callsign “Pélican”) plus 6 Dash 8 “Milan” tankers. Italy fields Europe's largest Canadair fleet, ahead of Spain, Greece and Croatia.",
      },
    ],
  },
  {
    slug: "detection-feux-satellite",
    title: "How do satellites detect wildfires?",
    metaTitle: "Wildfire detection from space: VIIRS, GOES, Meteosat explained | kanari",
    metaDesc:
      "Thermal anomalies, 375 m resolution, 10-minute refresh: how VIIRS, GOES and Meteosat MTG satellites spot new fires, and their limits.",
    imageAlt:
      "Diagram of the two satellite families for fire detection: polar-orbiting VIIRS at 830 km (375 m pixel, 2 passes per day) and geostationary GOES/Meteosat at 36,000 km (rescan every 10 minutes)",
    intro:
      "A fire emits infrared radiation very different from its surroundings. From orbit, specialized sensors spot these “thermal anomalies”, the backbone of every real-time fire map, kanari included.",
    updated: "2026-08-14",
    sections: [
      {
        h2: "Two complementary satellite families",
        paras: [
          "Polar-orbiting satellites (VIIRS on NOAA-20/21, historically MODIS) circle the Earth at 830 km and see every point of the globe about twice a day per satellite, with remarkable detail: a VIIRS pixel is 375 metres, enough to spot an established fire of a few hundred square metres.",
          "Geostationary satellites (GOES over the Americas, Meteosat MTG over Europe and Africa) stay fixed 36,000 km above the same point and rescan their zone every 10 minutes. Less precise (2 to 4 km pixels), they excel at catching fast-growing fires early.",
        ],
      },
      {
        h2: "From hot pixel to alert",
        paras: [
          "Algorithms compare each pixel to its neighbours and its history: a point abnormally hot in mid-infrared, at night or by contrast with its surroundings, becomes an “active detection”. Each detection carries a position, a radiative power (in megawatts) and a confidence level.",
          "kanari aggregates these detections (NASA FIRMS, GOES read directly from the raw feed, Meteosat MTG), clusters them into fire events, cross-checks them with AI-verified witness reports, and displays them within minutes. The satellite-plus-human cross-check is key: the satellite confirms the witness, the witness sometimes beats the satellite.",
        ],
      },
      {
        h2: "What satellites cannot see",
        paras: [
          "A very small or nascent fire can slip between two polar satellite passes (up to 12 hours apart at mid-latitudes). Thick clouds, dense smoke or canopy can mask the signal. A hot pixel is not always a wildfire: industrial flares, agricultural burns and even overheated metal roofs generate false positives, which algorithms partially filter.",
          "That is why human reports matter: on kanari, a geolocated witness report can surface an ignition before the first satellite detection.",
        ],
      },
    ],
    faq: [
      {
        q: "How fast can a satellite detect a wildfire?",
        a: "Geostationary satellites (GOES, Meteosat MTG) rescan their zone every 10 minutes with 2 to 4 km pixels. Polar-orbiting satellites (VIIRS, 375 m resolution) pass about twice a day per satellite. kanari displays published detections within minutes.",
      },
      {
        q: "How small a fire can a satellite spot?",
        a: "A 375-metre VIIRS pixel can reveal an established fire of a few hundred square metres. A very small or nascent fire can slip between two passes, or be masked by clouds, dense smoke or canopy.",
      },
      {
        q: "Can satellite detections be false positives?",
        a: "Yes: industrial flares, agricultural burns or overheated metal roofs generate hot pixels without any wildfire. Algorithms filter part of them, and kanari cross-checks detections with AI-verified human reports to consolidate confidence.",
      },
    ],
  },
  {
    slug: "meteo-des-forets",
    title: "Fire weather: understanding wildfire risk",
    metaTitle: "Fire weather: understanding the day's wildfire risk | kanari",
    metaDesc:
      "Drought, wind, air humidity: how wildfire risk is computed, what the 30/30/30 rule means, and where to check the risk in real time.",
    imageAlt:
      "Diagram of the 30/30/30 rule: above 30 °C, below 30% humidity and above 30 km/h of wind together create maximum fire danger",
    intro:
      "The “fire triangle” has three sides: dry fuel, oxygen, a heat source. Weather drives the first two, which is why a few weather indicators estimate the day's danger remarkably well.",
    updated: "2026-08-14",
    sections: [
      {
        h2: "The three factors that make the danger",
        paras: [
          "Vegetation dryness first: after weeks without rain, grass and brush become fuel ready to ignite at the slightest spark. Air relative humidity next: below 30%, fine vegetation dries out in hours. Wind finally: it feeds oxygen, lays flames forward and throws embers sometimes hundreds of metres ahead. Wind is what turns an ignition into a disaster.",
          "The most feared combination fits in three numbers: above 30 °C, below 30% humidity, above 30 km/h of wind, the “30/30/30 rule”.",
        ],
      },
      {
        h2: "Official fire danger ratings",
        paras: [
          "Most fire-prone countries publish a daily fire danger rating: Météo-France's “météo des forêts” map (green to red, per department, since 2023), the US National Fire Danger Rating System, Canada's Fire Weather Index (FWI), which has become the international reference formula. At the highest levels, access to some forests is legally restricted.",
          "kanari shows an estimated weather risk on each French department page, computed continuously from the same ingredients (temperature, humidity, wind, recent rain). It gives the real-time trend without replacing the official maps, which carry legal force.",
        ],
      },
      {
        h2: "What the risk changes in practice",
        paras: [
          "On high-risk days, mundane actions become dangerous: outdoor work with spark-generating tools, barbecues, cigarette butts, parking on dry grass (a catalytic converter can ignite it). Firefighters pre-position resources and water bombers fly armed patrols: attacking a nascent fire within 10 minutes multiplies the chances of stopping it before the first hectare.",
          "The right reflex: check the day's risk in the morning, avoid any flame or spark, and keep an eye on the real-time map when the wind picks up.",
        ],
      },
    ],
    faq: [
      {
        q: "What is the 30/30/30 rule?",
        a: "The most dangerous weather combination for wildfires: above 30 °C, below 30% relative humidity and above 30 km/h of wind. Together, these three conditions turn the slightest ignition into a fast-moving fire.",
      },
      {
        q: "Where can I check today's fire risk?",
        a: "National services publish daily ratings: Météo-France's forest weather map in France, the National Fire Danger Rating System in the US, the Fire Weather Index in Canada. kanari also shows a continuously computed estimated risk on each French department page.",
      },
      {
        q: "What is banned on very high risk days?",
        a: "At the highest ratings, access to some forests is legally restricted. Barbecues, cigarette butts, burns and spark-generating work must be avoided, and simply parking on dry grass can start a fire (catalytic converter).",
      },
    ],
  },
  {
    slug: "odeur-de-fumee-que-faire",
    title: "Smelling smoke outside: how to check if there is a fire near you",
    metaTitle: "Smelling smoke outside: is there a fire near me? | kanari",
    metaDesc:
      "It smells like smoke or burning outside? The possible causes, how to check in 2 minutes whether a fire is burning around you (free satellite map), and when to call emergency services.",
    imageAlt:
      "Diagram showing that a smoke smell arrives from the direction the wind blows from: the source, sometimes 100 km away, is upwind on the map",
    intro:
      "A smell of smoke or burning outside, with no visible flame, is one of the most puzzling situations: the danger could be 500 metres away or 300 kilometres. Here is how to identify the cause in minutes, and when to alert emergency services.",
    updated: "2026-08-14",
    sections: [
      {
        h2: "Where can that smoke smell come from?",
        paras: [
          "Four causes cover the vast majority of cases. A nearby vegetation fire, first: the most urgent to rule out, especially in summer with sustained wind. A distant fire next: smoke from a large wildfire travels with the wind over tens, sometimes hundreds of kilometres. The plumes of Canada's 2023 fires crossed the Atlantic to Europe. Then agricultural or garden-waste burns (often in the morning), and one-off urban fires: a building, a vehicle, bins.",
          "At night and in early morning, one phenomenon amplifies everything: temperature inversion traps smoke near the ground instead of letting it rise. A strong smell at dawn does not necessarily mean the fire got closer, but it always deserves a check.",
        ],
      },
      {
        h2: "Check in two minutes whether a fire is burning around you",
        paras: [
          "Open the kanari map (free, no account) and centre it on your position: satellite-detected ignitions (refreshed every 10 minutes over Europe and the Americas) and verified citizen reports appear continuously.",
          "Then look at the wind direction, shown on the map: a smoke smell ALWAYS arrives from the direction the wind blows from. If the wind comes from the southwest, the source is to the southwest. Search for fires in that direction, including far away: a powerful fire 100 km upwind smells distinctly.",
          "Cross-check with other signals: sirens, aircraft or helicopter rotations (the map tracks water bombers live), posts from local authorities or fire services, and your region's air quality index, which climbs when a plume passes.",
        ],
      },
      {
        h2: "When to call emergency services",
        paras: [
          "Call 112 (Europe), 911 (North America) or 000 (Australia) without hesitation if you see flames or a smoke column rising from a precise point, if the smell comes with ash fallout, or if the smoke becomes dense enough to hinder breathing. Better one call too many than a fire getting a head start: firefighters prefer ten redundant reports to one missing report.",
          "Smell alone, with no visible source and no nearby fire on the map? It is most likely smoke carried from far away or a controlled burn. No need to call emergency services, but close windows and vents if the smell is strong, especially for vulnerable people (asthma, respiratory conditions, infants).",
        ],
      },
      {
        h2: "Follow the situation without thinking about it",
        paras: [
          "On the kanari map, tap “Alert me on this area”: you will receive a notification if a new significant fire is detected around you. Free, no account, works on phone and desktop. The simplest way to sleep soundly on evenings when “it smells like smoke”.",
        ],
      },
    ],
    faq: [
      {
        q: "Why does it smell like smoke outside with no visible fire?",
        a: "Four causes cover most cases: a nearby vegetation fire, smoke from a distant wildfire carried by the wind (sometimes over hundreds of kilometres), an agricultural burn, or a one-off urban fire. At night, temperature inversion also traps smoke near the ground, amplifying the smell without the fire being closer.",
      },
      {
        q: "How can I check if there is a fire near me right now?",
        a: "Open a real-time detection map like kanari.io (satellites refreshed every 10 minutes over Europe and the Americas, AI-verified witness reports) and look at the wind direction: a smoke smell always arrives from upwind. Cross-check with sirens, aircraft rotations and the air quality index.",
      },
      {
        q: "When should I call emergency services about a smoke smell?",
        a: "As soon as you see flames or a smoke column rising from a precise point, if ash is falling, or if the smoke hinders breathing: call 112, 911 or 000 depending on your region. A smell alone, with no visible source and no nearby fire on the map, is most likely smoke carried from far away: close the windows if it is strong.",
      },
    ],
  },
];

export const GUIDE_EN_BY_SLUG = new Map(GUIDES_EN.map((g) => [g.slug, g]));
