import { exchangeCode, refreshTokens, OAuthError } from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { jsonOut, preflight, errorOut } from "@/lib/oauthHttp";

// Échange du code d'autorisation contre des jetons, et renouvellement (clients publics : PKCE, pas de secret)
export const OPTIONS = preflight;
export async function POST(req) {
  if (!rateLimit(`oauth-token:${clientIp(req)}`, { limit: Number(process.env.OAUTH_TOKEN_LIMIT) || 60, windowMs: 60_000 })) return jsonOut({ error: "temporarily_unavailable", error_description: "Trop de demandes." }, 429);
  try {
    const type = req.headers.get("content-type") ?? "";
    const p = type.includes("json") ? await req.json().catch(() => ({})) : Object.fromEntries(new URLSearchParams(await req.text()));
    const clientId = String(p.client_id ?? "");
    if (p.grant_type === "authorization_code") return jsonOut(await exchangeCode({ code: p.code, verifier: p.code_verifier, redirectUri: p.redirect_uri, clientId }));
    if (p.grant_type === "refresh_token") return jsonOut(await refreshTokens({ refreshToken: p.refresh_token, clientId }));
    throw new OAuthError("unsupported_grant_type", "grant_type : authorization_code ou refresh_token.");
  } catch (e) { return errorOut(e); }
}
