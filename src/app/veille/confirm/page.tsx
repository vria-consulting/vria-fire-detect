"use client";

import { useEffect, useState } from "react";

// Le lien magique Supabase renvoie ici avec la session dans le fragment (#).
// On l'extrait côté client, on la fait valider par le serveur (qui vérifie
// l'adresse et pose notre cookie), puis on entre dans le dashboard.
export default function ConfirmPage() {
  const [msg, setMsg] = useState("Vérification du lien…");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const err = hash.get("error_description") || new URLSearchParams(window.location.search).get("error");
    if (err) {
      setMsg("Lien invalide ou expiré. Redirection…");
      setTimeout(() => (window.location.href = "/veille"), 1500);
      return;
    }
    if (!accessToken) {
      setMsg("Lien incomplet. Redirection…");
      setTimeout(() => (window.location.href = "/veille"), 1500);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/veille/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        });
        // On nettoie le fragment (le token ne doit pas rester dans l'historique).
        window.history.replaceState(null, "", "/veille/confirm");
        if (res.ok) {
          setMsg("Accès confirmé. Ouverture du tableau de bord…");
          window.location.href = "/veille/board";
        } else {
          setMsg("Accès refusé. Redirection…");
          setTimeout(() => (window.location.href = "/veille"), 1500);
        }
      } catch {
        setMsg("Erreur réseau. Redirection…");
        setTimeout(() => (window.location.href = "/veille"), 1500);
      }
    })();
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--ink-2)",
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            border: "2px solid var(--line)",
            borderTopColor: "var(--canary-strong)",
            borderRadius: "50%",
            display: "inline-block",
            animation: "veille-spin 0.7s linear infinite",
          }}
        />
        {msg}
      </div>
      <style>{`@keyframes veille-spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
