import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

// Callback OAuth app 2 (pages entreprise — Community Management API).
// Token stocké en base, rattaché au compte client connecté.

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const userId = await getUserId(req);
  if (!userId) return NextResponse.redirect(`${appUrl}/app?linkedin=not_logged_in`);

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=org_refused`);
  }

  const savedState = req.cookies.get("li_org_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=state_mismatch`);
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_ORG_CLIENT_ID,
        client_secret: process.env.LINKEDIN_ORG_CLIENT_SECRET,
        redirect_uri:
          process.env.LINKEDIN_ORG_REDIRECT_URI || `${appUrl}/api/linkedin/callback-org`,
      }),
    });
    if (!tokenRes.ok) throw new Error("Échange de token échoué: " + (await tokenRes.text()));
    const { access_token, expires_in } = await tokenRes.json();

    const data = {
      orgToken: encryptToken(access_token),
      orgExpiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
    };
    await prisma.linkedInAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const res = NextResponse.redirect(`${appUrl}/app?linkedin=org_connected`);
    res.cookies.delete("li_org_oauth_state");
    return res;
  } catch (e) {
    console.error("Erreur callback org:", e);
    return NextResponse.redirect(`${appUrl}/app?linkedin=org_error`);
  }
}
