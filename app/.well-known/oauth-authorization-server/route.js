import { APP, SCOPES } from "@/lib/oauth";
import { jsonOut, preflight } from "@/lib/oauthHttp";

// Métadonnées du serveur d'autorisation (RFC 8414)
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export const GET = () => jsonOut({
  issuer: APP(),
  authorization_endpoint: `${APP()}/oauth/authorize`,
  token_endpoint: `${APP()}/api/oauth/token`,
  registration_endpoint: `${APP()}/api/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: SCOPES,
});
