import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

// Callback OAuth pages entreprise — app dédiée 786qkg73bkqdvj.
// Stocke le token + tente de résoudre l'org URN immédiatement.

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description") || "";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const userId = await getUserId(req);
  if (!userId) return NextResponse.redirect(`${appUrl}/app?linkedin=not_logged_in`);

  if (error || !code) {
    console.error("LinkedIn org OAuth refusé:", error, errorDescription);
    const msg = encodeURIComponent(errorDescription || error || "Autorisation refusée");
    return NextResponse.redirect(`${appUrl}/app?linkedin=org_refused&msg=${msg}`);
  }

  const savedState = req.cookies.get("li_org_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=state_mismatch`);
  }

  const clientId = process.env.LINKEDIN_ORG_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_ORG_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_ORG_REDIRECT_URI || `${appUrl}/api/linkedin/callback-org`;

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("LinkedIn org token exchange:", tokenRes.status, txt);
      throw new Error("Échange de token échoué: " + txt);
    }
    const { access_token, expires_in } = await tokenRes.json();

    const liHeaders = {
      Authorization: `Bearer ${access_token}`,
      "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    // Résolution de l'org URN au moment de la connexion
    let orgUrn = null;
    let orgName = null;
    try {
      const aclRes = await fetch(
        "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
        { headers: liHeaders }
      );
      if (aclRes.ok) {
        const acls = await aclRes.json();
        orgUrn = acls.elements?.[0]?.organization ?? null;
        if (orgUrn) {
          const id = orgUrn.split(":").pop();
          const orgRes = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers: liHeaders });
          if (orgRes.ok) orgName = (await orgRes.json()).localizedName ?? null;
        }
      } else {
        console.warn("organizationAcls:", aclRes.status, await aclRes.text());
      }
    } catch (e) {
      console.warn("Org URN non résolu:", e.message);
    }

    const data = {
      orgToken: encryptToken(access_token),
      orgExpiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
      ...(orgUrn ? { orgUrn, orgName } : {}),
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
    console.error("Erreur callback org:", e.message);
    const msg = encodeURIComponent(e.message.slice(0, 200));
    return NextResponse.redirect(`${appUrl}/app?linkedin=org_error&msg=${msg}`);
  }
}
