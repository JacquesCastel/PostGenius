import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

// Callback OAuth de l'app dédiée "PostGenius Stats" — statistiques du
// profil personnel uniquement (r_member_postAnalytics).

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
    console.error("LinkedIn stats OAuth refusé:", error, errorDescription);
    // invalid_scope_error : LinkedIn refuse le scope r_member_postAnalytics tant que
    // le produit "Community Management API" n'est pas approuvé sur cette app dédiée
    // (revue manuelle LinkedIn — pas un bug côté app). On évite d'exposer le texte
    // brut LinkedIn (en anglais, peu clair) et on redirige vers un statut dédié.
    if (error === "invalid_scope_error") {
      return NextResponse.redirect(`${appUrl}/app?linkedin=stats_pending`);
    }
    const msg = encodeURIComponent(errorDescription || error || "Autorisation refusée");
    return NextResponse.redirect(`${appUrl}/app?linkedin=stats_refused&msg=${msg}`);
  }

  const savedState = req.cookies.get("li_stats_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/app?linkedin=state_mismatch`);
  }

  const clientId = process.env.LINKEDIN_STATS_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_STATS_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_STATS_REDIRECT_URI || `${appUrl}/api/linkedin/callback-stats`;

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("LinkedIn stats token exchange:", tokenRes.status, txt);
      throw new Error("Échange de token échoué: " + txt);
    }
    const { access_token, expires_in } = await tokenRes.json();

    const data = {
      statsToken: encryptToken(access_token),
      statsExpiresAt: new Date(Date.now() + (expires_in ?? 5184000) * 1000),
    };
    await prisma.linkedInAccount.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const res = NextResponse.redirect(`${appUrl}/app?linkedin=stats_connected`);
    res.cookies.delete("li_stats_oauth_state");
    return res;
  } catch (e) {
    console.error("Erreur callback stats:", e.message);
    const msg = encodeURIComponent(e.message.slice(0, 200));
    return NextResponse.redirect(`${appUrl}/app?linkedin=stats_error&msg=${msg}`);
  }
}
