import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { ContributeForm } from "@/components/ContributeForm";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  return {
    title: l === "fr" ? "Contribuer — kanari" : "Contribute — kanari",
    description:
      l === "fr"
        ? "Aide kanari à voir les feux plus tôt : signale un bug, propose une idée, une donnée ou une API. Chaque contribution compte."
        : "Help kanari see fires earlier: report a bug, suggest an idea, data or an API. Every contribution counts.",
    alternates: {
      canonical: `/${l}/contribuer`,
      languages: { fr: "/fr/contribuer", en: "/en/contribuer" },
    },
  };
}

export default async function Contribuer({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto w-full px-5 py-10 sm:py-14">
        <ContributeForm lang={lang} />
      </div>
    </div>
  );
}
