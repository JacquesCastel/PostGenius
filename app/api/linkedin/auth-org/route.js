import { NextResponse } from "next/server";
import crypto from "crypto";

// OAuth pour la 2e app LinkedIn (Community Management API → pages entreprise).
// Cette app ne doit avoir AUCUN autre produit ; elle fournit les scopes
// w_organization_social et rw_organization_admin.

export async function GET() {
  const clientId = process.env.LINKEDIN_ORG_CLIENT_ID;
  const redirectUri =
    process.env.LINKEDIN_ORG_REDIRECT_URI ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/linkedin/callback-org`;

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_ORG_CLIENT_ID manquant dans .env (identifiants de la 2e app LinkedIn)." },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    process.env.LINKEDIN_ORG_SCOPES || "w_organization_social rw_organization_admin"
  );

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("li_org_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
