import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserId } from "@/lib/session";

// Étape 1 : redirection vers Instagram Login (Business Login for Instagram).
// L'utilisateur se connecte avec ses identifiants Instagram directement —
// aucune Page Facebook requise. Compte Business ou Créateur suffisant.
//
// Variables .env requises :
//   INSTAGRAM_APP_ID        → Instagram App ID (section "API setup with Instagram login"
//                             dans Meta App Dashboard, ≠ Facebook App ID)
//   INSTAGRAM_APP_SECRET    → Instagram App Secret (même section)
//   INSTAGRAM_REDIRECT_URI  → https://postgenius.network/api/instagram/callback

export async function GET(req) {
  const userId = await getUserId(req);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  if (!userId) return NextResponse.redirect(`${appUrl}/app?instagram=not_logged_in`);

  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID / INSTAGRAM_REDIRECT_URI manquants dans .env" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // Scopes Instagram Login (Business Login for Instagram)
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
  url.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  console.log("Instagram auth: state=", state, "redirectUri=", redirectUri, "appId=", appId);
  return res;
}
