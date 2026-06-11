import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

// Callback OAuth app 1 (profil personnel).
// Le token est stocké en base, rattaché au compte client connecté.

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const userId = await getUserId(req);
  if (!userId) return NextResponse.redirect(`${appUrl}?linkedin=not_logged_in`);

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}?linkedin=refused`);
  }

  const savedState = req.cookies.get("li_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}?linkedin=state_mismatch`);
  }

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
    if (!tokenRes.ok) throw new Error("Échange de token échoué: " + (await tokenRes.text()));
    const { access_token, expires_in } = await tokenRes.json();

    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error("userinfo échoué: " + (await meRes.text()));
    const me = await meRes.json(); // { sub, name, ... }

    const data = {
      personToken: encryptToken(access_token),
      personSub: me.sub,
      personName: me.name ?? null,
      personExpiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
    };
    await prisma.linkedInAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const res = NextResponse.redirect(`${appUrl}?linkedin=connected`);
    res.cookies.delete("li_oauth_state");
    return res;
  } catch (e) {
    console.error("Erreur callback LinkedIn:", e);
    return NextResponse.redirect(`${appUrl}?linkedin=error`);
  }
}
