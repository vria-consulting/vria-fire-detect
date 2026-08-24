import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { SiteFooter } from "@/components/SiteFooter";

// Documentation publique de l'API et de l'open data : la transparence comme
// avantage concurrentiel — les acteurs caméras/B2G n'exposent rien en public.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  return {
    title:
      l === "fr"
        ? "API feux de forêt : détections satellite JSON + open data CSV | kanari"
        : "Free wildfire API: satellite detections (JSON) + open data | kanari",
    description:
      l === "fr"
        ? "API gratuite des feux de forêt détectés dans le monde : foyers en temps réel (JSON), signalements vérifiés, archive complète en CSV (CC BY 4.0) et flux RSS. Sans clé, sans compte."
        : "Free worldwide wildfire API: real-time fire clusters (JSON), verified witness signals, full archive as CSV (CC BY 4.0) and RSS feed. No key, no account.",
    alternates: { canonical: `/${l}/api`, languages: { fr: "/fr/api", en: "/en/api" } },
  };
}

const CODE_STYLE = {
  background: "var(--charcoal)",
  color: "#E8E6E1",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 12.5,
  overflowX: "auto" as const,
};

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <li>
      <code style={{ color: "var(--ink)", fontWeight: 600 }}>{name}</code> — {desc}
    </li>
  );
}

export default async function ApiPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const fr = lang === "fr";

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: `https://kanari.io/${lang}` },
      { "@type": "ListItem", position: 2, name: fr ? "API publique" : "Public API", item: `https://kanari.io/${lang}/api` },
    ],
  };
  const apiLd = {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    name: fr ? "API kanari — feux de forêt en temps réel" : "kanari API — real-time wildfires",
    description: fr
      ? "Foyers détectés par satellite dans le monde, signalements vérifiés et archive open data."
      : "Worldwide satellite-detected fire clusters, verified witness signals and open-data archive.",
    documentation: `https://kanari.io/${lang}/api`,
    termsOfService: `https://kanari.io/${lang}/api`,
    provider: { "@id": "https://kanari.io/#org" },
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(apiLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14" style={{ color: "var(--ink-2)" }}>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {fr ? "API publique et open data" : "Public API and open data"}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed">
          {fr
            ? "Toutes les données de kanari sont accessibles gratuitement, sans clé et sans compte : foyers détectés par satellite dans le monde entier, signalements citoyens vérifiés, archive historique et flux RSS. Seule condition : créditer « kanari.io » avec un lien."
            : "All kanari data is freely accessible, no key, no account: worldwide satellite-detected fire clusters, verified witness signals, historical archive and RSS feed. Only requirement: credit “kanari.io” with a link."}
        </p>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {fr ? "Foyers en temps réel" : "Real-time fire clusters"}
          </h2>
          <pre style={CODE_STYLE}>GET https://kanari.io/api/events?hours=24</pre>
          <p className="mt-2 mb-2">
            {fr
              ? "Foyers agrégés (clusters de détections satellite VIIRS, GOES et Meteosat MTG) sur la fenêtre demandée. hours ∈ 6, 12, 24, 48, 72. Réponse : { events, meta }. Par défaut la réponse est allégée (les 2 000 foyers les plus pertinents, meta.truncated l'indique) ; ajoutez full=1 pour l'intégralité."
              : "Aggregated fire clusters (VIIRS, GOES and Meteosat MTG satellite detections) over the requested window. hours ∈ 6, 12, 24, 48, 72. Response: { events, meta }. By default the response is lightened (the 2,000 most relevant clusters, flagged by meta.truncated); add full=1 for the complete set."}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
            <Field name="id" desc={fr ? "identifiant du foyer (heure + cellule)" : "cluster id (hour + cell)"} />
            <Field name="centroid" desc={fr ? "[longitude, latitude] du foyer" : "[longitude, latitude] of the cluster"} />
            <Field name="count / viirsCount / goesCount / mtgCount" desc={fr ? "détections cumulées, par capteur" : "cumulative detections, per sensor"} />
            <Field name="firstSeen / lastSeen" desc={fr ? "premier et dernier passage satellite (UTC)" : "first and last satellite pass (UTC)"} />
            <Field name="maxFrp" desc={fr ? "puissance radiative max mesurée (MW)" : "max fire radiative power (MW)"} />
            <Field name="confidence" desc={fr ? "possible | probable | corrobore (croisé avec des témoins)" : "possible | probable | corrobore (cross-checked with witnesses)"} />
          </ul>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {fr ? "Signalements vérifiés" : "Verified witness signals"}
          </h2>
          <pre style={CODE_STYLE}>GET https://kanari.io/api/signals?hours=24</pre>
          <p className="mt-2 mb-2">
            {fr
              ? "Lieux où des témoignages publics de feu ont été vérifiés deux fois par IA (réseaux sociaux, presse). Réponse : { signals, meta }."
              : "Places with public fire testimonies verified twice by AI (social networks, press). Response: { signals, meta }."}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
            <Field name="place / countryCode / lat / lon" desc={fr ? "lieu géoparsé du signalement" : "geoparsed place of the signal"} />
            <Field name="postCount / posts[]" desc={fr ? "témoignages retenus (url, source, date)" : "retained testimonies (url, source, date)"} />
            <Field name="firstPost / lastPost / firstPress" desc={fr ? "horodatages (UTC), dont premier article de presse" : "timestamps (UTC), incl. first press article"} />
            <Field name="newFire" desc={fr ? "true = premières mentions récentes (candidat départ de feu)" : "true = very recent first mentions (new-fire candidate)"} />
          </ul>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {fr ? "Archive complète (CSV)" : "Full archive (CSV)"}
          </h2>
          <pre style={CODE_STYLE}>GET https://kanari.io/opendata/feux.csv</pre>
          <p className="mt-2">
            {fr ? (
              <>
                Tous les feux significatifs archivés depuis le 3 août 2026, un par ligne :
                position, horodatages, détections par capteur, puissance max, témoignages,
                moyens aériens observés et URL de la page permanente. Licence{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" style={{ color: "var(--link)" }}>CC BY 4.0</a>.
                Le flux RSS des derniers feux est sur <code>/feed.xml</code>.
              </>
            ) : (
              <>
                Every significant fire archived since August 3, 2026, one per row: position,
                timestamps, per-sensor detections, peak power, testimonies, observed aircraft and
                permanent page URL. Licensed{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/" style={{ color: "var(--link)" }}>CC BY 4.0</a>.
                The RSS feed of latest fires is at <code>/feed.xml</code>.
              </>
            )}
          </p>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed" id="mcp">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {fr ? "Serveur MCP pour les assistants IA" : "MCP server for AI assistants"}
          </h2>
          <pre style={CODE_STYLE}>https://kanari.io/api/mcp</pre>
          <p className="mt-2 mb-2">
            {fr
              ? "kanari est aussi un serveur MCP (Model Context Protocol, Streamable HTTP, sans clé) : branchez cette URL dans Claude, ChatGPT, Cursor ou n'importe quel agent, et il pourra interroger les feux en direct, l'archive, les statistiques, les moyens aériens et la précocité mesurée — en citant kanari.io. Outils exposés :"
              : "kanari is also an MCP server (Model Context Protocol, Streamable HTTP, no key): add this URL to Claude, ChatGPT, Cursor or any agent and it can query live fires, the archive, statistics, firefighting aircraft and measured earliness — citing kanari.io. Exposed tools:"}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
            <Field name="active_fires" desc={fr ? "foyers des 6 à 72 dernières heures, filtrables par pays, emprise ou rayon autour d'un point" : "clusters of the last 6 to 72 hours, filterable by country, bounding box or radius around a point"} />
            <Field name="fire_archive_search / fire_details" desc={fr ? "recherche dans l'archive (pays, dates, mois, seuils) et fiche complète d'un feu" : "archive search (country, dates, month, thresholds) and full record of one fire"} />
            <Field name="wildfire_stats" desc={fr ? "chiffres citables par période et par pays, avec phrase de citation et source" : "citable figures per period and country, with a ready-to-cite sentence and source"} />
            <Field name="firefighting_aircraft" desc={fr ? "bombardiers d'eau et hélicoptères en vol (ADS-B)" : "water bombers and helicopters in flight (ADS-B)"} />
            <Field name="earliness_cases" desc={fr ? "cas mesurés d'avance sur la presse (72 h glissantes)" : "measured cases of lead over press coverage (rolling 72 h)"} />
          </ul>
          <p className="mt-2 mb-2">{fr ? "Exemple de configuration client :" : "Client configuration example:"}</p>
          <pre style={CODE_STYLE}>{`{ "mcpServers": { "kanari": { "url": "https://kanari.io/api/mcp" } } }`}</pre>
          <p className="mt-2">
            {fr
              ? "Clients stdio uniquement : npx -y mcp-remote https://kanari.io/api/mcp. Lecture seule, mêmes données que l'API REST, même licence (CC BY 4.0, citer « kanari.io »)."
              : "Stdio-only clients: npx -y mcp-remote https://kanari.io/api/mcp. Read-only, same data as the REST API, same licence (CC BY 4.0, cite “kanari.io”)."}
          </p>
          <p className="mt-2">
            {fr ? "Développeurs JavaScript : un client sans dépendance est publié sur npm (licence MIT) : " : "JavaScript developers: a dependency-free client is published on npm (MIT licence): "}
            <a href="https://www.npmjs.com/package/kanari-fires" style={{ color: "var(--link)", fontWeight: 600 }}>kanari-fires</a>
            {" "}(<code>npm install kanari-fires</code>).
          </p>
        </section>

        <section className="mb-8 text-[14.5px] leading-relaxed">
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {fr ? "Conditions d'utilisation" : "Terms of use"}
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              {fr
                ? "Attribution obligatoire : « Source : kanari.io » avec un lien, sur toute réutilisation publique."
                : "Attribution required: “Source: kanari.io” with a link, on any public reuse."}
            </li>
            <li>
              {fr
                ? "Usage raisonnable : les données temps réel sont recalculées toutes les 2 à 5 minutes — inutile d'interroger plus d'une fois par minute. Mettez les réponses en cache."
                : "Fair use: real-time data is recomputed every 2–5 minutes — no point polling more than once a minute. Cache responses."}
            </li>
            <li>
              {fr
                ? "Les détections proviennent de la NASA (FIRMS), de la NOAA (GOES) et d'EUMETSAT (Meteosat MTG) ; les horodatages sont les leurs. kanari fournit l'agrégation, la vérification et l'archive."
                : "Detections come from NASA (FIRMS), NOAA (GOES) and EUMETSAT (Meteosat MTG); timestamps are theirs. kanari provides aggregation, verification and archiving."}
            </li>
            <li>
              {fr
                ? "Service d'information, pas un canal d'alerte officiel : ne fondez aucune décision de sécurité uniquement sur ces données. En urgence : 112."
                : "Information service, not an official alert channel: never base safety decisions on this data alone. In an emergency call 112 or 911."}
            </li>
          </ul>
          <p className="mt-3">
            {fr ? (
              <>
                Une question, un besoin (webhooks, formats, volumes) ? Écrivez à{" "}
                <a href="mailto:contact@kanari.io" style={{ color: "var(--link)", fontWeight: 600 }}>contact@kanari.io</a>{" "}
                ou ouvrez un ticket sur{" "}
                <a href="https://github.com/vria-consulting/vria-fire-detect/issues" style={{ color: "var(--link)" }}>GitHub</a>.
                Pour intégrer la carte elle-même, le plus simple reste le{" "}
                <Link href="/fr/widget" style={{ color: "var(--link)" }}>widget gratuit</Link>.
              </>
            ) : (
              <>
                Questions or needs (webhooks, formats, volumes)? Write to{" "}
                <a href="mailto:contact@kanari.io" style={{ color: "var(--link)", fontWeight: 600 }}>contact@kanari.io</a>{" "}
                or open a ticket on{" "}
                <a href="https://github.com/vria-consulting/vria-fire-detect/issues" style={{ color: "var(--link)" }}>GitHub</a>.
                To embed the map itself, use the free{" "}
                <Link href="/fr/widget" style={{ color: "var(--link)" }}>widget</Link>.
              </>
            )}
          </p>
        </section>

        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
