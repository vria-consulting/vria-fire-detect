import FireMap from "@/components/FireMap";
import { isValidLang, type Lang } from "@/lib/i18n";

// Widget intégrable : /embed (fr) ou /embed?lang=en. Badge kanari cliquable
// (nouvel onglet) = l'attribution demandée aux intégrateurs.
export const dynamic = "force-dynamic";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const l: Lang = isValidLang(lang ?? "") ? (lang as Lang) : "fr";
  return (
    <div className="relative h-full w-full">
      <FireMap lang={l} />
      <a
        href={`https://kanari.io/${l}?utm_source=embed&utm_medium=widget`}
        target="_blank"
        rel="noreferrer"
        className="absolute left-1/2 top-2 z-40 flex h-[30px] -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold"
        style={{ background: "rgba(251,249,244,.95)", color: "var(--ink)", boxShadow: "var(--shadow-m)" }}
      >
        🐤 kanari.io — {l === "fr" ? "carte des feux en direct" : "live fire map"}
      </a>
    </div>
  );
}
