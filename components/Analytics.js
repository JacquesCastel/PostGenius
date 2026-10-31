"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Mesure d'audience Umami : sans cookie ni donnée personnelle, donc sans bandeau de consentement.
// Chargée uniquement sur les pages publiques, jamais dans l'application ni sur les pages à lien secret, et seulement si
// UMAMI_SCRIPT_URL et UMAMI_WEBSITE_ID sont définis sur le serveur. Le signal « Do Not Track » du navigateur est respecté.
const PRIVATE = /^\/(app|valider|rapport|reset-password)(\/|$)/;

export default function Analytics() {
  const path = usePathname();
  const isPrivate = PRIVATE.test(path || "");
  const first = useRef(true); // la première page de la visite porte l'origine (document.referrer) ; les suivantes sont des navigations internes

  // Mesure d'audience faite par LinkeePost (en plus d'Umami) : une page vue par page publique affichée. Rien n'est stocké côté navigateur.
  useEffect(() => {
    if (isPrivate) return;
    const internal = !first.current;
    first.current = false;
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
    fetch("/api/site/visit", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, ref: internal ? "" : document.referrer, internal }) }).catch(() => {});
  }, [path, isPrivate]);

  useEffect(() => {
    if (isPrivate || document.querySelector("script[data-umami]")) return;
    let cancelled = false;
    fetch("/api/analytics-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (cancelled || !c?.src || !c?.id || document.querySelector("script[data-umami]")) return;
        const s = document.createElement("script");
        s.defer = true;
        s.src = c.src;
        s.dataset.websiteId = c.id;
        s.dataset.doNotTrack = "true";
        s.dataset.umami = "1";
        document.head.appendChild(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPrivate]);

  return null;
}
