const SITE = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");

// Pages publiques indexables ; l'application, l'API et les pages à lien secret restent hors des moteurs de recherche
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api/", "/valider/", "/rapport/", "/reset-password"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
