"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { localize, type Lang } from "@/lib/i18n";

// Garde-fous (miroir client des limites serveur).
const MAX_FILES = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const T = {
  fr: {
    title: "Contribuer à kanari",
    intro:
      "Une idée, un bug, une donnée à ajouter, une API utile ? Dis-le-nous. Chaque contribution rend l'alerte feu plus précoce et plus fiable pour tout le monde.",
    name: "Ton nom",
    email: "Ton email",
    phone: "Téléphone",
    role: "Ta fonction",
    optional: "facultatif",
    message: "Explique ta contribution",
    messagePh:
      "Décris le problème, l'idée ou l'amélioration. Plus c'est concret, mieux c'est.",
    drop: "Glisse tes captures d'écran ou fichiers ici",
    dropSub: "ou clique pour parcourir · images, PDF, Excel/CSV · 4 Mo max",
    dropActive: "Dépose ici",
    send: "Envoyer ma contribution",
    sending: "Envoi…",
    privacy:
      "Tes coordonnées servent uniquement à te recontacter à propos de ta contribution. Rien n'est partagé ni revendu.",
    required: "Le nom, l'email et un message sont nécessaires.",
    badEmail: "Cet email ne semble pas valide.",
    tooMany: `Maximum ${MAX_FILES} fichiers.`,
    tooBig: "Fichier trop lourd (4 Mo max par fichier et au total).",
    badType: "Type de fichier non accepté.",
    failed: "Envoi impossible pour le moment. Réessaie dans un instant.",
    rateLimited: "Trop d'envois d'affilée. Patiente quelques minutes.",
    successTitle: "Merci pour ta contribution 🐤",
    successBody:
      "Ta demande a bien été enregistrée et va être étudiée. kanari est un projet à mission : aider les citoyens, les secours et les autorités à voir les départs de feu le plus tôt possible. Plus on est nombreux à contribuer, plus l'outil devient précis et utile à tous. Merci de faire partie de l'aventure.",
    another: "Faire une autre suggestion",
    backMap: "Retour à la carte",
  },
  en: {
    title: "Contribute to kanari",
    intro:
      "An idea, a bug, data to add, a useful API? Tell us. Every contribution makes the fire alert earlier and more reliable for everyone.",
    name: "Your name",
    email: "Your email",
    phone: "Phone",
    role: "Your role",
    optional: "optional",
    message: "Explain your contribution",
    messagePh: "Describe the problem, idea or improvement. The more concrete, the better.",
    drop: "Drag your screenshots or files here",
    dropSub: "or click to browse · images, PDF, Excel/CSV · 4 MB max",
    dropActive: "Drop here",
    send: "Send my contribution",
    sending: "Sending…",
    privacy:
      "Your details are only used to get back to you about your contribution. Nothing is shared or sold.",
    required: "Name, email and a message are required.",
    badEmail: "This email doesn't look valid.",
    tooMany: `Maximum ${MAX_FILES} files.`,
    tooBig: "File too large (4 MB max per file and in total).",
    badType: "File type not accepted.",
    failed: "Could not send right now. Try again in a moment.",
    rateLimited: "Too many submissions in a row. Wait a few minutes.",
    successTitle: "Thank you for contributing 🐤",
    successBody:
      "Your request has been saved and will be reviewed. kanari is a mission project: helping citizens, emergency services and authorities see wildfires as early as possible. The more people contribute, the more precise and useful the tool becomes for everyone. Thanks for being part of it.",
    another: "Make another suggestion",
    backMap: "Back to the map",
  },
} as const;

function fmtSize(b: number): string {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1)} Mo`;
}

export function ContributeForm({ lang }: { lang: Lang }) {
  const t = localize(T, lang);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setErr(null);
      const list = [...incoming];
      setFiles((prev) => {
        let next = [...prev];
        for (const f of list) {
          if (!ALLOWED.includes(f.type)) {
            setErr(t.badType);
            continue;
          }
          if (f.size > MAX_FILE_BYTES) {
            setErr(t.tooBig);
            continue;
          }
          if (next.length >= MAX_FILES) {
            setErr(t.tooMany);
            break;
          }
          if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
          next = [...next, f];
        }
        if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) {
          setErr(t.tooBig);
          return prev;
        }
        return next;
      });
    },
    [t]
  );

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSend = name.trim().length > 0 && emailValid && message.trim().length >= 5;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) {
      setErr(!emailValid && email ? t.badEmail : t.required);
      return;
    }
    setStatus("sending");
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("email", email.trim());
      if (phone.trim()) fd.set("phone", phone.trim());
      if (role.trim()) fd.set("role", role.trim());
      fd.set("message", message.trim());
      fd.set("lang", lang);
      // Provenance (premier contact de la session) pour la veille.
      try {
        const src = JSON.parse(sessionStorage.getItem("kanari_src") || "{}");
        if (src.referrer || document.referrer) fd.set("referrer", src.referrer || document.referrer);
        if (src.utm_source) fd.set("utm_source", src.utm_source);
        if (src.utm_medium) fd.set("utm_medium", src.utm_medium);
        if (src.utm_campaign) fd.set("utm_campaign", src.utm_campaign);
      } catch {
        /* provenance indisponible : sans conséquence */
      }
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/contribute", { method: "POST", body: fd });
      if (res.status === 429) {
        setStatus("idle");
        setErr(t.rateLimited);
        return;
      }
      if (!res.ok) {
        setStatus("idle");
        setErr(t.failed);
        return;
      }
      setStatus("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("idle");
      setErr(t.failed);
    }
  }

  if (status === "success") {
    return (
      <div
        className="k-rise mx-auto max-w-lg rounded-[24px] p-8 text-center sm:p-10"
        style={{ background: "var(--white)", boxShadow: "var(--shadow-l)" }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--safe-soft)" }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6 9 17l-5-5"
              stroke="#22684A"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1
          className="mb-3"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h3)", color: "var(--ink)" }}
        >
          {t.successTitle}
        </h1>
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.successBody}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button
            onClick={() => {
              setName("");
              setEmail("");
              setPhone("");
              setRole("");
              setMessage("");
              setFiles([]);
              setStatus("idle");
            }}
            className="h-[46px] rounded-full px-6 text-sm font-medium"
            style={{ background: "var(--canary)", color: "var(--charcoal)" }}
          >
            {t.another}
          </button>
          <Link
            href={`/${lang}`}
            className="flex h-[46px] items-center justify-center rounded-full border px-6 text-sm font-medium"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            {t.backMap}
          </Link>
        </div>
      </div>
    );
  }

  const field =
    "h-[46px] w-full rounded-[14px] border bg-transparent px-3.5 text-[15px] outline-none transition-colors focus:border-[var(--canary-strong)]";
  const fieldStyle = { borderColor: "var(--line)", color: "var(--ink)" } as const;
  const labelCls = "mb-1.5 block text-[13px] font-medium";
  const labelStyle = { color: "var(--ink-2)" } as const;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1
          className="mb-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}
        >
          {t.title}
        </h1>
        <p className="mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-[24px] p-6 sm:p-7"
        style={{ background: "var(--white)", boxShadow: "var(--shadow-m)" }}
      >
        <div className="mb-4">
          <label className={labelCls} style={labelStyle}>
            {t.name} <span style={{ color: "var(--ember)" }}>*</span>
          </label>
          <input className={field} style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>

        <div className="mb-4">
          <label className={labelCls} style={labelStyle}>
            {t.email} <span style={{ color: "var(--ember)" }}>*</span>
          </label>
          <input
            type="email"
            className={field}
            style={fieldStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} style={labelStyle}>
              {t.phone} <span style={{ color: "var(--ink-3)" }}>· {t.optional}</span>
            </label>
            <input className={field} style={fieldStyle} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              {t.role} <span style={{ color: "var(--ink-3)" }}>· {t.optional}</span>
            </label>
            <input className={field} style={fieldStyle} value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls} style={labelStyle}>
            {t.message} <span style={{ color: "var(--ember)" }}>*</span>
          </label>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-[14px] border bg-transparent p-3.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--canary-strong)]"
            style={fieldStyle}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePh}
            maxLength={5000}
          />
        </div>

        {/* Zone drag & drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-4 py-7 text-center transition-colors"
          style={{
            borderColor: dragOver ? "var(--canary-strong)" : "var(--line)",
            background: dragOver ? "var(--canary-tint)" : "var(--paper-2)",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-2">
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              stroke="var(--ink-3)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
            {dragOver ? t.dropActive : t.drop}
          </span>
          <span className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {t.dropSub}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Fichiers ajoutés */}
        {files.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${i}`}
                className="flex items-center gap-3 rounded-[12px] px-3 py-2"
                style={{ background: "var(--paper-2)" }}
              >
                {f.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-[8px] object-cover"
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold"
                    style={{ background: "var(--white)", color: "var(--ink-3)" }}
                  >
                    {(f.name.split(".").pop() ?? "").slice(0, 4).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]" style={{ color: "var(--ink)" }}>
                    {f.name}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {fmtSize(f.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
                  style={{ background: "var(--white)", color: "var(--ink-2)" }}
                  aria-label="Retirer"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {err && (
          <p
            className="mb-4 rounded-[12px] px-3.5 py-2.5 text-[13px]"
            style={{ background: "var(--danger-soft)", color: "#9C2B2B" }}
          >
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSend || status === "sending"}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--canary)", color: "var(--charcoal)" }}
        >
          {status === "sending" ? (
            <>
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--charcoal)", borderTopColor: "transparent" }}
              />
              {t.sending}
            </>
          ) : (
            t.send
          )}
        </button>

        <p className="mt-3.5 text-center text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          {t.privacy}
        </p>
      </form>
    </div>
  );
}
