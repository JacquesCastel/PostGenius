import { NextResponse } from "next/server";
import { getSessionData } from "@/lib/sessionToken";

// Empêche le cache HTTP du navigateur sur les routes API dépendantes de la
// session (données par utilisateur/client impersonné) — sans ça, après un
// changement de compte (mode agence) suivi d'un window.location.reload(),
// le navigateur pouvait réutiliser une réponse mise en cache de l'ancien
// compte pour des GET identiques (/api/auth/me, /api/drafts, /api/profile...),
// laissant afficher des données périmées (ex. liste de posts non actualisée).
// Exclut les routes qui servent des fichiers binaires immuables (images,
// logos, fonds, médias) : elles gèrent volontairement leur propre cache long.
const ASSET_ROUTES = /^\/api\/(images|logos|backgrounds|media)\//;

// Vue support (admin qui regarde un compte client) : lecture seule. Toute
// requête qui modifie quelque chose est refusée ici, pour toutes les routes API
// d'un coup — sauf la sortie du mode et la déconnexion.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SUPPORT_EXIT = /^\/api\/(agency\/impersonate|auth\/logout)$/;

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  // Page d'accueil du site : une personne connectée retrouve toujours son tableau de bord (logo, retour arrière, lien enregistré).
  // La vue support (administrateur sur un compte client) garde l'accès au site.
  if (pathname === "/") {
    const session = await getSessionData(req);
    if (session?.userId && !session.support) {
      // Adresse absolue construite avec l'adresse que le navigateur a demandée (Host, X-Forwarded-Proto transmis par Caddy) : celle de
      // req.nextUrl reprendrait le nom d'hôte interne du serveur dans Docker, donc une mauvaise adresse et un cookie de session perdu.
      const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
      if (/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
        const proto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "http" ? "http" : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
        return NextResponse.redirect(new URL("/app", `${proto}://${host}`), { headers: { "Cache-Control": "no-store" } });
      }
    }
    return NextResponse.next();
  }
  const isExit = SUPPORT_EXIT.test(pathname) && (req.method === "DELETE" || pathname.endsWith("/logout"));
  if (!SAFE_METHODS.has(req.method) && !isExit) {
    const session = await getSessionData(req);
    if (session?.support) {
      return NextResponse.json(
        { error: "Vue support : lecture seule. Quittez ce mode pour modifier." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
  }
  const res = NextResponse.next();
  if (!ASSET_ROUTES.test(pathname)) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
