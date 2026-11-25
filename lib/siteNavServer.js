import { connection } from "next/server";
import { pagesOuvertes } from "./siteNav.js";
import { getFooterPage } from "./footer-pages.js";

// Lit l'état d'ouverture des pages (variables du serveur ; les textes légaux seulement si SITE_LEGAL=1, avec le cache habituel).
// `connection()` rend la page dynamique : sans lui, une page sans autre donnée dynamique serait figée au build avec les interrupteurs de ce moment-là.
export async function chargerOuvertures() {
  await connection();
  let legalTextes = [];
  if (process.env.SITE_LEGAL === "1") {
    try {
      const pages = await Promise.all(["mentions-legales", "cgu", "confidentialite"].map((k) => getFooterPage(k)));
      legalTextes = pages.flatMap((p) => p.sections.flatMap((s) => [s.heading, s.body]));
    } catch {
      legalTextes = ["[À COMPLÉTER : lecture impossible]"]; // en cas de doute, le lien n'apparaît pas
    }
  }
  return pagesOuvertes({ legalTextes });
}
