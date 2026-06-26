import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

// Instagram Login (Business Login for Instagram) — callback OAuth.
// 1. Échange code → token court (api.instagram.com)
// 2. Échange token court → token long-lived ~60 j (graph.instagram.com)
// 3. Récupère le profil Instagram
// 4. Stocke en base

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const userId = await getUserId(req);
  if (!userId) return NextResponse.redirect(`${appUrl}/app?instagram=not_logged_in`);

  if (error || !code) return NextResponse.redirect(`${appUrl}/app?instagram=refused`);

  const savedState = req.cookies.get("ig_oauth_state")?.value;
  console.log("Instagram callback:", {
    hasCode: !!code,
    state,
    savedState,
    error,
    userId,
    url: req.url,
  });
  if (!savedState || savedState !== state) {
    console.error("Instagram state mismatch:", { state, savedState });
    return NextResponse.redirect(`${appUrl}/app?instagram=state_mismatch`);
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  try {
    // 1. Code → token court (valide 1 h)
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!shortRes.ok) {
      const txt = await shortRes.text();
      throw new Error("Échange de code échoué : " + txt);
    }
    const { access_token: shortToken, user_id: igUserId } = await shortRes.json();

    // 2. Token court → long-lived (~60 j)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?` +
        new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          access_token: shortToken,
        })
    );
    if (!longRes.ok) {
      const txt = await longRes.text();
      throw new Error("Long-lived token échoué : " + txt);
    }
    const { access_token: longToken, expires_in } = await longRes.json();

    // 3. Profil Instagram
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,name,username,profile_picture_url&access_token=${longToken}`
    );
    const profile = profileRes.ok ? await profileRes.json() : {};

    // 4. Stockage en base
    const data = {
      igUserId: String(igUserId),
      igUsername: profile.username ?? null,
      igName: profile.name ?? null,
      igPicture: profile.profile_picture_url ?? null,
      pageToken: encryptToken(longToken),
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
    };

    await prisma.instagramAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const res = NextResponse.redirect(`${appUrl}/app?instagram=connected`);
    res.cookies.delete("ig_oauth_state");
    return res;
  } catch (e) {
    console.error("Erreur callback Instagram:", e.message);
    const msg = encodeURIComponent(e.message.slice(0, 200));
    return NextResponse.redirect(`${appUrl}/app?instagram=error&msg=${msg}`);
  }
}
