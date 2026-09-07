// Donnees structurees des hubs (pages qui listent d'autres pages) : un
// CollectionPage dont l'entite principale est un ItemList, plus le fil
// d'Ariane. Les moteurs et les assistants comprennent ainsi qu'il s'agit d'une
// page de collection reliee au site (#website) et a l'editeur (#org).
import type { Lang } from "@/lib/i18n";

const SITE = "https://kanari.io";
const HOME_NAME: Record<Lang, string> = { fr: "Accueil", en: "Home", es: "Inicio", pt: "Início" };

export type HubItem = { name: string; url: string; description?: string };

export function hubJsonLd(opts: {
  lang: Lang;
  path: string; // ex. "/fr/feux"
  name: string;
  description?: string;
  items: HubItem[];
}) {
  const url = `${SITE}${opts.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url,
    inLanguage: opts.lang,
    isPartOf: { "@id": `${SITE}/#website` },
    publisher: { "@id": `${SITE}/#org` },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: it.url.startsWith("http") ? it.url : `${SITE}${it.url}`,
        ...(it.description ? { description: it.description } : {}),
      })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: HOME_NAME[opts.lang], item: `${SITE}/${opts.lang}` },
        { "@type": "ListItem", position: 2, name: opts.name, item: url },
      ],
    },
  };
}

// Balise <script> prete a inserer dans un composant serveur.
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data);
}
