import { APP, SCOPES } from "@/lib/oauth";
import { jsonOut, preflight } from "@/lib/oauthHttp";

// Métadonnées de la ressource protégée (RFC 9728) : indiquent à l'assistant où se connecter pour utiliser /api/mcp
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export const GET = () => jsonOut({ resource: `${APP()}/api/mcp`, authorization_servers: [APP()], bearer_methods_supported: ["header"], scopes_supported: SCOPES, resource_name: "LinkeePost" });
