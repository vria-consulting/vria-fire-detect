import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";

// Page « intégrer la carte » pour médias, mairies, sites météo : le widget
// gratuit contre un lien d'attribution — la machine à backlinks.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Intégrer la carte des feux kanari sur votre site (widget gratuit)",
    description:
      "Médias, mairies, sites météo : intégrez gratuitement la carte des feux en temps réel de kanari sur votre site avec une simple iframe. Données satellites + témoins vérifiés, mise à jour continue.",
    alternates: { canonical: "/fr/widget" },
  };
}

const SNIPPET = `<iframe
  src="https://kanari.io/embed"
  width="100%" height="480" frameborder="0"
  title="Carte des feux en temps réel — kanari.io"
  loading="lazy" allow="geolocation"></iframe>
<p>Carte : <a href="https://kanari.io">kanari.io — l'alerte feu de forêt</a></p>`;

export default async function WidgetPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/widget");

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Intégrez la carte des feux sur votre site
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Média, mairie, site météo, blog : la carte kanari (feux en temps réel + Canadair en
          direct) est intégrable gratuitement. Une seule condition : conserver le lien
          d'attribution vers kanari.io.
        </p>

        <div className="mb-6 overflow-hidden rounded-[18px]" style={{ boxShadow: "var(--shadow-m)" }}>
          <iframe
            src="/embed"
            width="100%"
            height="380"
            title="Aperçu du widget kanari"
            style={{ border: 0, display: "block" }}
          />
        </div>

        <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          Le code à copier
        </h2>
        <pre
          className="mb-6 overflow-x-auto rounded-[14px] p-4 text-[12.5px] leading-relaxed"
          style={{ background: "var(--charcoal)", color: "#F5F2EA" }}
        >
          {SNIPPET}
        </pre>

        <ul className="mb-8 flex flex-col gap-2 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <li>• Version anglaise : <code style={{ background: "var(--paper-2)", padding: "1px 6px", borderRadius: 6 }}>src=&quot;https://kanari.io/embed?lang=en&quot;</code></li>
          <li>• La carte s&apos;ouvre sur la région du visiteur et se met à jour toute seule (~2 min).</li>
          <li>• Gratuit, sans clé, sans limite raisonnable d&apos;usage. Données : NASA FIRMS, GOES, MTG, témoins vérifiés.</li>
          <li>• Besoin d&apos;un centrage précis, d&apos;un flux de données ou d&apos;autre chose ? <Link href="/fr/contribuer" style={{ color: "var(--link)" }}>Écrivez-nous</Link>.</li>
        </ul>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari est un service d&apos;information indépendant et gratuit, pas un canal d&apos;alerte
          officiel. En cas d&apos;urgence : 18 ou 112.
        </p>
      </div>
    </div>
  );
}
