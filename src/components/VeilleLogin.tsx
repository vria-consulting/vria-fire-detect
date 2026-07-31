"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error" | "rate";

export function VeilleLogin() {
  const [status, setStatus] = useState<Status>("idle");

  async function requestLink() {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/veille/link", { method: "POST" });
      if (res.ok) setStatus("sent");
      else if (res.status === 429) setStatus("rate");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24, fontFamily: "var(--font-body)" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface-card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-m)",
          padding: "34px 30px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>🐤</div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 600,
            color: "var(--ink)",
            margin: "14px 0 6px",
            letterSpacing: "-0.4px",
          }}
        >
          Veille kanari
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
          Espace privé. Reçois un lien d&apos;accès à usage unique par e-mail.
        </p>

        {status === "sent" ? (
          <div
            style={{
              background: "var(--canary-tint)",
              border: "1px solid var(--canary-soft)",
              borderRadius: "var(--radius-m)",
              padding: "16px 18px",
              color: "var(--ink)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            <strong>Lien envoyé ✉️</strong>
            <br />
            Ouvre ta boîte mail et clique sur le lien pour accéder au tableau de bord. Il expire dans 15 minutes.
          </div>
        ) : (
          <>
            <button
              onClick={requestLink}
              disabled={status === "sending"}
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: "var(--radius-pill)",
                border: "none",
                background: "var(--canary-strong)",
                color: "var(--text-on-canary, #3a2c00)",
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 15,
                cursor: status === "sending" ? "wait" : "pointer",
                opacity: status === "sending" ? 0.7 : 1,
                transition: "opacity .2s",
              }}
            >
              {status === "sending" ? "Envoi…" : "Recevoir mon lien d'accès"}
            </button>
            {status === "rate" && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 14 }}>
                Trop de demandes. Réessaie dans quelques minutes.
              </p>
            )}
            {status === "error" && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 14 }}>
                Envoi impossible pour le moment. Réessaie.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
