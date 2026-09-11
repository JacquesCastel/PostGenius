import { NextResponse } from "next/server";
import crypto from "crypto";

// OAuth app dédiée "PostGenius Stats" (Community Management API).
// Cette app ne sert qu'à obtenir r_member_postAnalytics pour les
// statistiques du profil personnel — Community Management API doit être
// l'unique produit de son app LinkedIn (incompatible avec Share on
// LinkedIn / Sign In with LinkedIn, déjà présents sur l'app "PostGenius"),
// et distincte de l'app "Post" (pages entreprise) pour ne pas confondre
// les deux connexions côté utilisateur.
// Redirect URI : LINKEDIN_STATS_REDIRECT_URI → /api/linkedin/callback-stats
//   (doit être déclarée dans l'app LinkedIn 77ts3h3ef7m9kq, onglet Auth)

export async function GET() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const clientId = process.env.LINKEDIN_STATS_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_STATS_REDIRECT_URI || `${appUrl}/api/linkedin/callback-stats`;

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=stats_error&msg=LINKEDIN_STATS_CLIENT_ID+manquant`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", process.env.LINKEDIN_STATS_SCOPES || "r_member_postAnalytics");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("li_stats_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
