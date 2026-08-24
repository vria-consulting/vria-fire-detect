"use client";

// Encart d'inscription au bilan kanari (double opt-in via /api/newsletter).
// Volontairement discret : un titre, une ligne, un champ. Jamais en pop-up
// (décision du 24/08/2026 : l'usage de la carte prime). Le honeypot `website`
// est un champ caché que seuls les robots remplissent.

import { useState } from "react";
import type { Lang } from "@/lib/i18n";

type Variant = "canadair" | "fire" | "dept" | "page" | "map";

const T: Record<Lang, {
  title: Record<Variant, string>;
  text: string;
  placeholder: string;
  cta: string;
  busy: string;
  done: string;
  error: string;
  full: string;
  privacy: string;
}> = {
  fr: {
    title: {
      canadair: "Canadair engagés, feux marquants : le bilan kanari par e-mail",
      fire: "Suivre les départs de feu : le bilan kanari par e-mail",
      dept: "Les feux près de chez vous : le bilan kanari par e-mail",
      page: "Recevoir le bilan des feux par e-mail",
      map: "Recevez aussi le bilan par e-mail",
    },
    text: "Hebdomadaire en saison des feux, mensuel l'hiver : les chiffres de la période, le feu marquant et ce que les satellites ont vu en premier.",
    placeholder: "votre@email.fr",
    cta: "M'inscrire",
    busy: "Envoi…",
    done: "Presque fini : ouvrez votre boîte mail et cliquez le lien de confirmation.",
    error: "Échec de l'envoi. Réessayez dans un instant.",
    full: "Complet pour le moment : réessayez bientôt.",
    privacy: "Gratuit, sans publicité, désinscription en un clic. Jamais de partage de votre adresse.",
  },
  en: {
    title: {
      canadair: "Water bombers at work, standout fires: the kanari digest by e-mail",
      fire: "Follow wildfire starts: the kanari digest by e-mail",
      dept: "Fires near you: the kanari digest by e-mail",
      page: "Get the wildfire digest by e-mail",
      map: "Also get the digest by e-mail",
    },
    text: "Weekly in fire season, monthly in winter: the period's figures, the standout fire, and what satellites saw first.",
    placeholder: "you@email.com",
    cta: "Subscribe",
    busy: "Sending…",
    done: "Almost done: open your inbox and click the confirmation link.",
    error: "Sending failed. Please try again in a moment.",
    full: "Full for now: please try again soon.",
    privacy: "Free, no ads, one-click unsubscribe. Your address is never shared.",
  },
  es: {
    title: {
      canadair: "Aviones anfibios en acción: el resumen kanari por correo",
      fire: "Sigue los incendios: el resumen kanari por correo",
      dept: "Incendios cerca de ti: el resumen kanari por correo",
      page: "Recibe el resumen de incendios por correo",
      map: "Recibe también el resumen por correo",
    },
    text: "Semanal en temporada de incendios, mensual en invierno: las cifras del período, el incendio destacado y lo que los satélites vieron primero.",
    placeholder: "tu@email.com",
    cta: "Suscribirme",
    busy: "Enviando…",
    done: "Casi listo: abre tu correo y haz clic en el enlace de confirmación.",
    error: "Fallo al enviar. Inténtalo de nuevo en un momento.",
    full: "Completo por ahora: inténtalo pronto.",
    privacy: "Gratis, sin publicidad, baja en un clic. Tu dirección nunca se comparte.",
  },
  pt: {
    title: {
      canadair: "Aviões-tanque em ação: o resumo kanari por e-mail",
      fire: "Acompanhe os incêndios: o resumo kanari por e-mail",
      dept: "Incêndios perto de você: o resumo kanari por e-mail",
      page: "Receba o resumo de incêndios por e-mail",
      map: "Receba também o resumo por e-mail",
    },
    text: "Semanal na temporada de incêndios, mensal no inverno: os números do período, o incêndio marcante e o que os satélites viram primeiro.",
    placeholder: "voce@email.com",
    cta: "Inscrever-me",
    busy: "Enviando…",
    done: "Quase pronto: abra seu e-mail e clique no link de confirmação.",
    error: "Falha no envio. Tente novamente em instantes.",
    full: "Lotado por enquanto: tente novamente em breve.",
    privacy: "Grátis, sem anúncios, cancelamento em um clique. Seu endereço nunca é compartilhado.",
  },
};

export function NewsletterSignup({
  lang,
  variant = "page",
  label,
  bbox,
  compact = false,
}: {
  lang: Lang;
  variant?: Variant;
  label?: string;
  bbox?: [number, number, number, number];
  compact?: boolean;
}) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error" | "full">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "busy" || state === "done") return;
    setState("busy");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, lang, label, bbox, website: hp }),
      });
      if (res.ok) setState("done");
      else if (res.status === 503) setState("full");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <section
      className={compact ? "rounded-[14px] px-4 py-3.5" : "rounded-[18px] px-5 py-4.5 sm:px-6"}
      style={{ background: "var(--canary-tint, #FFF7DF)", border: "1px solid var(--line)" }}
    >
      <h2
        className={compact ? "text-[14.5px] font-semibold" : "text-[16.5px] font-semibold"}
        style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
      >
        {t.title[variant]}
      </h2>
      {!compact && (
        <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.text}
        </p>
      )}
      {state === "done" ? (
        <p className="mt-2.5 text-[13.5px] font-medium" style={{ color: "#22684A" }}>
          {t.done}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            className="h-[40px] min-w-0 flex-1 basis-[210px] rounded-full border px-4 text-[14px] outline-none"
            style={{ background: "var(--white)", borderColor: "var(--line)", color: "var(--ink)" }}
          />
          {/* Honeypot : caché aux humains, irrésistible pour les robots. */}
          <input
            type="text"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />
          <button
            type="submit"
            disabled={state === "busy"}
            className="h-[40px] rounded-full px-5 text-[13.5px] font-semibold"
            style={{ background: "var(--charcoal)", color: "var(--paper)", opacity: state === "busy" ? 0.7 : 1 }}
          >
            {state === "busy" ? t.busy : t.cta}
          </button>
          {(state === "error" || state === "full") && (
            <span className="basis-full text-[12.5px]" style={{ color: "#9C2B2B" }}>
              {state === "full" ? t.full : t.error}
            </span>
          )}
        </form>
      )}
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
        {t.privacy}
      </p>
    </section>
  );
}
