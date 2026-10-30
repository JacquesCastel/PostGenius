import { NextResponse } from "next/server";
import { authenticateKey } from "@/lib/apiKeys";
import { authenticateOAuth, APP } from "@/lib/oauth";
import { handleMessage } from "@/lib/mcp";
import { checkFeature } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";

// Serveur MCP de LinkeePost (transport « HTTP en flux », réponses JSON, sans état). Authentification : « Authorization: Bearer lkp_… »
// (clé personnelle, voir Mon profil). Réservé aux offres Pro et Agence. Aucune session côté serveur : chaque appel est indépendant.

export const maxDuration = 120;

const json = (body, status = 200, headers = {}) => NextResponse.json(body, { status, headers });

export async function POST(req) {
  // Un navigateur ne doit pas pouvoir appeler cette adresse : on refuse toute origine qui n'est pas la nôtre
  const origin = req.headers.get("origin");
  if (origin) {
    let own = null;
    try { own = new URL(process.env.APP_URL || "http://localhost:3000").origin; } catch {}
    if (origin !== own) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Origine refusée." } }, 403);
  }
  const auth = (await authenticateKey(req)) ?? (await authenticateOAuth(req));
  if (!auth) {
    // resource_metadata indique à l'assistant où se connecter (OAuth) ; invalid_token lui dit de renouveler son jeton
    const hasToken = /^Bearer\s+\S+/.test(req.headers.get("authorization") ?? "");
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Accès invalide ou révoqué. Reconnectez l'assistant, ou créez une clé dans Mon profil." } }, 401, { "WWW-Authenticate": `Bearer realm="linkeepost", resource_metadata="${APP()}/.well-known/oauth-protected-resource"${hasToken ? ', error="invalid_token"' : ""}` });
  }
  if (!rateLimit(`mcp:${auth.keyId}`, { limit: Number(process.env.MCP_RATE_LIMIT) || 60, windowMs: 60_000 })) return json({ jsonrpc: "2.0", id: null, error: { code: -32002, message: "Trop d'appels : réessayez dans une minute." } }, 429, { "Retry-After": "60" });
  const feat = await checkFeature(auth.actorId ?? auth.userId, "campaigns", "L'accès par assistant (MCP)");
  if (!feat.ok) return json({ jsonrpc: "2.0", id: null, error: { code: -32003, message: feat.error } }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide." } }, 400); }
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]).slice(0, 20);
  const out = (await Promise.all(messages.map((m) => handleMessage(auth, m)))).filter(Boolean);
  if (out.length === 0) return new NextResponse(null, { status: 202 }); // notifications seules
  return json(batch ? out : out[0]);
}

// Pas de flux serveur → client : le client doit se contenter des réponses POST
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
