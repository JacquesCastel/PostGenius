"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Mesure d'audience Umami : sans cookie ni donnée personnelle, donc sans bandeau de consentement.
// Chargée uniquement sur les pages publiques, jamais dans l'application ni sur les pages à lien secret, et seulement si
// UMAMI_SCRIPT_URL et UMAMI_WEBSITE_ID sont définis sur le serveur. Le signal « Do Not Track » du navigateur est respecté.
const PRIVATE = /^\/(app|valider|rapport|reset-password)(\/|$)/;

export default function Analytics() {
  const path = usePathname();
  const isPrivate = PRIVATE.test(path || "");

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
