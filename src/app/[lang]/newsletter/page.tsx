import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { listIssues, periodLabel, ISSUE_LOCALE } from "@/lib/newsletter";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { SiteFooter } from "@/components/SiteFooter";

// Archive publique de la newsletter : chaque numéro est une page indexable —
// c'est la raison stratégique du choix « archive sur kanari.io » (52 numéros
// par an finissent par compter en SEO, même avec peu d'abonnés).

const D: Record<Lang, {
  title: string;
  metaTitle: string;
  metaDesc: string;
  intro: string;
  cadence: string;
  archive: string;
  empty: string;
  confirmed: string;
  expired: string;
  cerror: string;
  cfull: string;
  fires: string;
  seeMap: string;
}> = {
  fr: {
    title: "La newsletter kanari",
    metaTitle: "Newsletter des feux de forêt — kanari",
    metaDesc: "Le bilan kanari des départs de feu par e-mail : hebdomadaire en saison, mensuel l'hiver. Chiffres de la période, feu marquant, précocité mesurée. Gratuit, archive publique.",
    intro: "Le bilan des départs de feu détectés par satellite et témoins vérifiés, directement par e-mail : les chiffres de la période, le feu marquant, et ce que les satellites ont vu avant la presse.",
    cadence: "Hebdomadaire de mai à octobre, mensuelle de novembre à avril. Envoyée le lundi matin.",
    archive: "Les numéros",
    empty: "Le premier numéro paraîtra lundi prochain. Inscrivez-vous pour le recevoir.",
    confirmed: "Inscription confirmée : vous recevrez le prochain bilan. Bienvenue !",
    expired: "Ce lien de confirmation a expiré. Réinscrivez-vous ci-dessous : un nouveau lien partira aussitôt.",
    cerror: "La confirmation a échoué. Réessayez dans un instant ou écrivez à contact@kanari.io.",
    cfull: "La liste est complète pour le moment. Réessayez bientôt.",
    fires: "départs de feu",
    seeMap: "Voir la carte en direct",
  },
  en: {
    title: "The kanari newsletter",
    metaTitle: "Wildfire newsletter — kanari",
    metaDesc: "The kanari wildfire digest by e-mail: weekly in season, monthly in winter. Period figures, standout fire, measured earliness. Free, public archive.",
    intro: "The digest of wildfire starts detected by satellite and verified witnesses, straight to your inbox: the period's figures, the standout fire, and what satellites saw before the press.",
    cadence: "Weekly from May to October, monthly from November to April. Sent on Monday morning.",
    archive: "Issues",
    empty: "The first issue ships next Monday. Subscribe to receive it.",
    confirmed: "Subscription confirmed: you will receive the next digest. Welcome!",
    expired: "This confirmation link has expired. Subscribe again below: a fresh link will be sent right away.",
    cerror: "Confirmation failed. Try again in a moment or write to contact@kanari.io.",
    cfull: "The list is full for now. Please try again soon.",
    fires: "fire starts",
    seeMap: "View the live map",
  },
  es: {
    title: "La newsletter de kanari",
    metaTitle: "Newsletter de incendios — kanari",
    metaDesc: "El resumen de incendios de kanari por correo: semanal en temporada, mensual en invierno. Cifras del período, incendio destacado, precocidad medida. Gratis, archivo público.",
    intro: "El resumen de los incendios detectados por satélite y testigos verificados, directo a tu correo: las cifras del período, el incendio destacado y lo que los satélites vieron antes que la prensa.",
    cadence: "Semanal de mayo a octubre, mensual de noviembre a abril. Se envía el lunes por la mañana.",
    archive: "Números",
    empty: "El primer número sale el próximo lunes. Suscríbete para recibirlo.",
    confirmed: "Suscripción confirmada: recibirás el próximo resumen. ¡Bienvenido!",
    expired: "Este enlace de confirmación caducó. Suscríbete de nuevo abajo: enviaremos un enlace nuevo al instante.",
    cerror: "La confirmación falló. Inténtalo de nuevo o escribe a contact@kanari.io.",
    cfull: "La lista está completa por ahora. Inténtalo pronto.",
    fires: "incendios",
    seeMap: "Ver el mapa en vivo",
  },
  pt: {
    title: "A newsletter kanari",
    metaTitle: "Newsletter de incêndios — kanari",
    metaDesc: "O resumo kanari de incêndios por e-mail: semanal na temporada, mensal no inverno. Números do período, incêndio marcante, precocidade medida. Grátis, arquivo público.",
    intro: "O resumo dos incêndios detectados por satélite e testemunhas verificadas, direto no seu e-mail: os números do período, o incêndio marcante e o que os satélites viram antes da imprensa.",
    cadence: "Semanal de maio a outubro, mensal de novembro a abril. Enviada na segunda-feira de manhã.",
    archive: "Edições",
    empty: "A primeira edição sai na próxima segunda-feira. Inscreva-se para recebê-la.",
    confirmed: "Inscrição confirmada: você receberá o próximo resumo. Bem-vindo!",
    expired: "Este link de confirmação expirou. Inscreva-se novamente abaixo: um novo link será enviado na hora.",
    cerror: "A confirmação falhou. Tente novamente ou escreva para contact@kanari.io.",
    cfull: "A lista está cheia no momento. Tente novamente em breve.",
    fires: "incêndios",
    seeMap: "Ver o mapa ao vivo",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const t = D[l];
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l}/newsletter`,
      languages: {
        fr: "/fr/newsletter",
        en: "/en/newsletter",
        es: "/es/newsletter",
        pt: "/pt/newsletter",
      },
    },
  };
}

export default async function NewsletterPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { lang } = await params;
  const { confirmed } = await searchParams;
  if (!isValidLang(lang)) notFound();
  const t = D[lang];
  const issues = await listIssues();

  const banner =
    confirmed === "1"
      ? { text: t.confirmed, bg: "var(--safe-soft, #DFF0E7)", fg: "#22684A" }
      : confirmed === "expired"
        ? { text: t.expired, bg: "var(--canary-soft, #FFF1C9)", fg: "#7A5A00" }
        : confirmed === "full"
          ? { text: t.cfull, bg: "var(--canary-soft, #FFF1C9)", fg: "#7A5A00" }
          : confirmed === "error"
            ? { text: t.cerror, bg: "var(--danger-soft, #F9E0E0)", fg: "#9C2B2B" }
            : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12" style={{ color: "var(--ink-2)" }}>
        <h1 className="mb-4" style={{ fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.title}
        </h1>
        {banner && (
          <p className="mb-5 rounded-[14px] px-4 py-3 text-[14px] font-medium" style={{ background: banner.bg, color: banner.fg }}>
            {banner.text}
          </p>
        )}
        <p className="mb-2 text-[15px] leading-relaxed">{t.intro}</p>
        <p className="mb-6 text-[13.5px]" style={{ color: "var(--ink-3)" }}>
          {t.cadence}
        </p>
        <NewsletterSignup lang={lang} variant="page" />

        <h2 className="mt-10 pt-2" style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>
          {t.archive}
        </h2>
        {issues.length === 0 ? (
          <p className="mt-3 text-[14px]" style={{ color: "var(--ink-3)" }}>
            {t.empty}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {issues.map((i) => (
              <li key={i.slug}>
                <Link
                  href={`/${lang}/newsletter/${i.slug}`}
                  className="flex items-baseline justify-between gap-3 rounded-[14px] px-4 py-3"
                  style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                >
                  <span className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {periodLabel(i, lang)}
                  </span>
                  <span className="whitespace-nowrap text-[13px]" style={{ color: "var(--ink-3)" }}>
                    {i.total.toLocaleString(ISSUE_LOCALE[lang])} {t.fires}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/${lang}`}
          className="mt-10 inline-flex h-[42px] items-center rounded-full px-6 text-sm font-medium"
          style={{ background: "var(--charcoal)", color: "var(--paper)" }}
        >
          {t.seeMap}
        </Link>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
