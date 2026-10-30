import { NextResponse } from "next/server";
import { OAuthError } from "./oauth";

// Réponses communes des points d'accès OAuth : JSON, jamais mis en cache, ouverts aux appels d'un autre site (les clients lisent ces pages depuis leur serveur ou leur navigateur)
export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version" };
export const jsonOut = (body, status = 200, extra = {}) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...CORS, ...extra } });
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });

export function errorOut(e) {
  if (e instanceof OAuthError) return jsonOut({ error: e.code, error_description: e.message, ...e.extra }, e.status);
  console.error("[oauth]", e);
  return jsonOut({ error: "server_error", error_description: "Erreur interne." }, 500);
}
