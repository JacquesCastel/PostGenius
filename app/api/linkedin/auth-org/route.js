import { NextResponse } from "next/server";
import crypto from "crypto";

// OAuth app dédiée pages entreprise (Community Management API).
// App ID : LINKEDIN_ORG_CLIENT_ID — distincte de l'app personnelle
// (Community Management API doit être seul produit sur son app LinkedIn)
// et de l'app "PostGenius Stats" (statistiques du profil perso, auth-stats).
// Scopes : w_organization_social rw_organization_admin
//   + r_organization_social_feed / w_organization_social_feed (lecture et
//   réponse aux commentaires des posts de page entreprise — Comments API,
//   même produit Community Management API). Le profil personnel n'a pas
//   cet accès : r_member_social_feed est réservé par LinkedIn à une liste
//   fermée de développeurs (non auto-servisable).
// Redirect URI : LINKEDIN_ORG_REDIRECT_URI → /api/linkedin/callback-org
//   (doit être déclarée dans l'app LinkedIn 786qkg73bkqdvj, onglet Auth)

export async function GET() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const clientId = process.env.LINKEDIN_ORG_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_ORG_REDIRECT_URI || `${appUrl}/api/linkedin/callback-org`;

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=org_error&msg=LINKEDIN_ORG_CLIENT_ID+manquant`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    process.env.LINKEDIN_ORG_SCOPES ||
      "w_organization_social rw_organization_admin r_organization_social_feed w_organization_social_feed"
  );

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("li_org_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
