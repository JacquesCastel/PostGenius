import { NextResponse } from "next/server";
import crypto from "crypto";
import { oauthTarget, bindOauthTarget, READ_ONLY_MESSAGE } from "@/lib/oauthTarget";

// Connexion du PROFIL par l'application des pages (LINKEDIN_ORG_CLIENT_ID), en plus de la connexion habituelle du profil.
// Pourquoi : les identifiants de membre sont propres à chaque application LinkedIn. La recherche d'une personne à mentionner passe par l'application
// des pages ; pour que la mention soit reconnue, le post de profil doit être publié par cette même application (jeton memberToken).
// Même adresse de retour que la page entreprise (callback-org) : le cookie li_org_member indique le mode.
export async function GET(req) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const target = await oauthTarget(req);
  if (target.error === "read_only") return NextResponse.redirect(`${appUrl}/app?linkedin=org_error&msg=${encodeURIComponent(READ_ONLY_MESSAGE)}`);
  if (target.error) return NextResponse.redirect(`${appUrl}/app?linkedin=not_logged_in`);
  const clientId = process.env.LINKEDIN_ORG_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_ORG_REDIRECT_URI || `${appUrl}/api/linkedin/callback-org`;
  if (!clientId) return NextResponse.redirect(`${appUrl}/app?linkedin=member_error&msg=LINKEDIN_ORG_CLIENT_ID+manquant`);

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", process.env.LINKEDIN_MEMBER_SCOPES || "w_member_social r_basicprofile");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("li_org_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  res.cookies.set("li_org_member", "1", { httpOnly: true, maxAge: 600, path: "/" });
  bindOauthTarget(res, target.userId);
  return res;
}
