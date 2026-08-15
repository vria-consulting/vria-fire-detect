"use client";

import { useEffect, useState } from "react";
import { localize, type Lang } from "@/lib/i18n";

// Invitation discrète à installer kanari sur l'écran d'accueil : le visiteur
// d'un soir de feu devient un utilisateur permanent (le carburant de la
// rétention). Trois états : Android/desktop Chrome (prompt natif via
// beforeinstallprompt), iOS Safari (mini-guide Partager → Sur l'écran
// d'accueil), déjà installé ou refusé (rien).
type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "kanari-install-dismissed";

const T = {
  fr: {
    install: "Installer l'app",
    iosTitle: "Installer kanari sur l'écran d'accueil",
    iosSteps: ["Touchez le bouton Partager", "Choisissez « Sur l'écran d'accueil »"],
    iosNote: "Gratuit, sans app store — kanari s'ouvrira comme une app, alertes comprises.",
    close: "Plus tard",
  },
  en: {
    install: "Install the app",
    iosTitle: "Install kanari on your home screen",
    iosSteps: ["Tap the Share button", "Choose “Add to Home Screen”"],
    iosNote: "Free, no app store — kanari opens like an app, alerts included.",
    close: "Later",
  },
} as const;

export function InstallNudge({ lang }: { lang: Lang }) {
  const t = localize(T, lang);
  const [bip, setBip] = useState<BipEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      // Déjà installé (standalone) ou déjà écarté : on ne montre rien.
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      if (standalone || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setHidden(false);
      return;
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BipEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    setHidden(true);
    setIosOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* stockage indisponible : le chip reviendra, tant pis */
    }
  };

  const onClick = async () => {
    if (ios) {
      setIosOpen(true);
      return;
    }
    if (!bip) return;
    await bip.prompt();
    const choice = await bip.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice.outcome === "accepted") dismiss();
    setBip(null);
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <>
      <button
        onClick={onClick}
        className="pointer-events-auto fixed bottom-[104px] left-3 z-20 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold"
        style={{ background: "var(--white)", color: "var(--ink)", boxShadow: "var(--shadow-m)" }}
        aria-label={t.install}
      >
        <span aria-hidden="true">📲</span> {t.install}
        <span
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="-mr-1 ml-1 rounded-full px-1 text-[13px]"
          style={{ color: "var(--ink-3)" }}
          role="button"
          aria-label={t.close}
        >
          ✕
        </span>
      </button>

      {iosOpen && (
        <div
          className="pointer-events-auto fixed inset-x-3 bottom-[104px] z-30 rounded-[18px] p-5"
          style={{ background: "var(--white)", boxShadow: "var(--shadow-m)", maxWidth: 420 }}
        >
          <p className="mb-2 text-[15px] font-bold" style={{ color: "var(--ink)" }}>{t.iosTitle}</p>
          <ol className="mb-2 list-decimal pl-5 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t.iosSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-3)" }}>{t.iosNote}</p>
          <button
            onClick={dismiss}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={{ background: "var(--canary)", color: "var(--charcoal)" }}
          >
            {t.close}
          </button>
        </div>
      )}
    </>
  );
}
