/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build autonome pour Docker (copie minimale dans l'image finale)
  output: "standalone",

  // Packages avec addons natifs (.node) — exclus du bundle webpack, chargés par Node à l'exécution
  // Le middleware (/api/*) fait tamponner les corps de requêtes : au-delà de 10 Mo par défaut ils sont tronqués, et un envoi d'image
  // (PNG exporté par l'éditeur, import de la médiathèque) échoue en erreur 500. 25 Mo couvre les plafonds des routes d'image (12 Mo base64, 10 Mo).
  experimental: { middlewareClientMaxBodySize: "25mb" },

  serverExternalPackages: ["@resvg/resvg-js", "satori", "sharp"],

  // Les fonts @fontsource sont lues via fs.readFileSync (chemin dynamique) :
  // le tracing du build standalone ne les détecte pas. On les inclut explicitement
  // pour toutes les routes, sinon ENOENT en prod.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/@fontsource/**/files/*-latin-*-normal.woff"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
