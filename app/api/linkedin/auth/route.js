import { NextResponse } from "next/server";
import crypto from "crypto";

// Étape 1 OAuth : redirection vers la page d'autorisation LinkedIn.
// Scopes : openid + profile (identité) et w_member_social (publication).

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID / LINKEDIN_REDIRECT_URI manquants dans .env" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // Scopes configurables : ajouter "w_organization_social rw_organization_admin"
  // dans LINKEDIN_SCOPES (.env) une fois le produit "Community Management API"
  // approuvé sur votre app LinkedIn — sinon l'OAuth échoue (unauthorized_scope).
  url.searchParams.set("scope", process.env.LINKEDIN_SCOPES || "openid profile w_member_social");

  const res = NextResponse.redirect(url.toString());
  // Le state est vérifié au callback pour éviter les attaques CSRF
  res.cookies.set("li_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
