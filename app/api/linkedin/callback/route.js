import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { oauthTarget, oauthTargetMatches, clearOauthTarget, READ_ONLY_MESSAGE } from "@/lib/oauthTarget";
import { encryptToken } from "@/lib/crypto";

// Callback OAuth LinkedIn — flux personnel uniquement.
// Les pages entreprise utilisent /api/linkedin/callback-org (app dédiée 786qkg73bkqdvj).

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description") || "";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // Compte visé : le client géré en mode agence (jamais l'agence), refusé en vue support
  const target = await oauthTarget(req);
  if (target.error === "read_only") return NextResponse.redirect(`${appUrl}/app?linkedin=error&msg=${encodeURIComponent(READ_ONLY_MESSAGE)}`);
  if (target.error) return NextResponse.redirect(`${appUrl}/app?linkedin=not_logged_in`);
  const userId = target.userId;

  if (error || !code) {
    console.error("LinkedIn OAuth refusé:", error, errorDesc);
    const msg = encodeURIComponent(errorDesc || error || "Autorisation refusée");
    return NextResponse.redirect(`${appUrl}/app?linkedin=refused&msg=${msg}`);
  }

  const savedState = req.cookies.get("li_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=state_mismatch`);
  }
  if (!oauthTargetMatches(req, userId)) return NextResponse.redirect(`${appUrl}/app?linkedin=target_mismatch`);

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("LinkedIn token exchange:", tokenRes.status, txt);
      throw new Error("Échange de token échoué: " + txt);
    }
    const { access_token, expires_in, scope } = await tokenRes.json();
    console.log(`[linkedin] connexion du profil : permissions accordées = ${scope ?? "(non communiquées)"}`);
    const expiresAt = new Date(Date.now() + (expires_in ?? 5184000) * 1000);

    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error("userinfo échoué");
    const me = await meRes.json();
    if (!me.sub) throw new Error("Identité LinkedIn non retournée");

    const data = {
      personToken: encryptToken(access_token),
      personSub: me.sub,
      personName: me.name ?? null,
      personExpiresAt: expiresAt,
      personScope: scope ?? null,
    };
    await prisma.linkedInAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const res = NextResponse.redirect(`${appUrl}/app?linkedin=connected`);
    res.cookies.delete("li_oauth_state");
    clearOauthTarget(res);
    return res;
  } catch (e) {
    console.error("Erreur callback LinkedIn:", e.message);
    const msg = encodeURIComponent(e.message.slice(0, 200));
    return NextResponse.redirect(`${appUrl}/app?linkedin=error&msg=${msg}`);
  }
}
