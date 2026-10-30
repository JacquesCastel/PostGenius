import { registerClient } from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { jsonOut, preflight, errorOut } from "@/lib/oauthHttp";

// Enregistrement dynamique d'un client (RFC 7591) : l'assistant se déclare tout seul, sans compte
export const OPTIONS = preflight;
export async function POST(req) {
  if (!rateLimit(`oauth-register:${clientIp(req)}`, { limit: Number(process.env.OAUTH_REGISTER_LIMIT) || 20, windowMs: 3600_000 })) return jsonOut({ error: "temporarily_unavailable", error_description: "Trop d'enregistrements : réessayez plus tard." }, 429);
  try {
    const body = await req.json().catch(() => ({}));
    return jsonOut(await registerClient(body), 201);
  } catch (e) { return errorOut(e); }
}
