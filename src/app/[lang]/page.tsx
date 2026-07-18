import { isValidLang } from "@/lib/i18n";
import { notFound } from "next/navigation";
import FireMap from "@/components/FireMap";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  return (
    <>
      {/* H1 sémantique pour les moteurs et les LLM — l'app est visuelle. */}
      <h1 className="sr-only">
        {lang === "fr"
          ? "kanari — carte mondiale des feux de forêt en temps quasi réel et alertes de départs de feu"
          : "kanari — near real-time world wildfire map and fire start alerts"}
      </h1>
      <FireMap lang={lang} />
    </>
  );
}
