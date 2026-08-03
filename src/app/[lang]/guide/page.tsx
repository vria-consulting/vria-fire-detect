import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { GUIDES } from "@/lib/guides";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Guides feux de forêt : réflexes, Canadair, satellites, risque météo | kanari",
    description:
      "Les guides kanari pour tout comprendre des feux de forêt : bons réflexes en cas de départ de feu, fonctionnement des Canadair, détection satellite, météo des forêts.",
    alternates: { canonical: "/fr/guide" },
  };
}

export default async function GuideHub({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/guide");

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Guides feux de forêt
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Comprendre les feux de forêt pour mieux s'en protéger : les réflexes qui sauvent, les
          coulisses de la lutte aérienne et de la détection satellite.
        </p>
        <div className="flex flex-col gap-3">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/fr/guide/${g.slug}`}
              className="rounded-[18px] p-5"
              style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
            >
              <h2 className="mb-1 text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                {g.title}
              </h2>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {g.metaDesc}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-[14px]">
          <Link href="/fr" style={{ color: "var(--link)" }}>← Carte des feux en direct</Link>
          {" · "}
          <Link href="/fr/faq" style={{ color: "var(--link)" }}>FAQ</Link>
        </p>
      </div>
    </div>
  );
}
