import { NextResponse } from "next/server";

// Empêche le cache HTTP du navigateur sur les routes API dépendantes de la
// session (données par utilisateur/client impersonné) — sans ça, après un
// changement de compte (mode agence) suivi d'un window.location.reload(),
// le navigateur pouvait réutiliser une réponse mise en cache de l'ancien
// compte pour des GET identiques (/api/auth/me, /api/drafts, /api/profile...),
// laissant afficher des données périmées (ex. liste de posts non actualisée).
// Exclut les routes qui servent des fichiers binaires immuables (images,
// logos, fonds, médias) : elles gèrent volontairement leur propre cache long.
const ASSET_ROUTES = /^\/api\/(images|logos|backgrounds|media)\//;

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  if (!ASSET_ROUTES.test(pathname)) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
