"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import type { Lang } from "@/lib/i18n";

// Sélecteur FR/EN : pose un cookie de préférence (respecté par le middleware
// pour toutes les visites suivantes) et bascule l'URL en conservant page et
// query.
function Switch({ current }: { current: Lang }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  const go = (lang: Lang) => {
    if (lang === current) return;
    document.cookie = `kanari-lang=${lang};path=/;max-age=31536000;samesite=lax`;
    const rest = pathname.replace(/^\/(fr|en)/, "");
    const qs = search.toString();
    router.push(`/${lang}${rest}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div
      className="flex gap-[2px] rounded-full p-[2px] text-[12px] font-medium"
      style={{ background: "var(--paper-2)" }}
      role="group"
      aria-label="Language"
    >
      {(["fr", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => go(lang)}
          className="rounded-full px-2 py-[3px] uppercase transition-colors"
          style={
            current === lang
              ? { background: "var(--charcoal)", color: "var(--paper)" }
              : { background: "transparent", color: "var(--ink-2)" }
          }
          aria-current={current === lang ? "true" : undefined}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export function LangSwitch({ current }: { current: Lang }) {
  return (
    <Suspense fallback={null}>
      <Switch current={current} />
    </Suspense>
  );
}
