import { SignJWT, jwtVerify } from "jose";

// Sessions : JWT signé, stocké en cookie httpOnly "session".
// AUTH_SECRET doit être défini en production (openssl rand -hex 32).

// Vérification paresseuse : on ne bloque qu'à l'utilisation réelle (runtime),
// pas au build (où les secrets ne sont pas encore injectés, ex. Docker).
let _secret = null;
function secret() {
  if (_secret) return _secret;
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET manquant (obligatoire en production) — générer avec : openssl rand -hex 32");
  }
  _secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-a-changer-en-production");
  return _secret;
}

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// clientId : si défini, l'agence impersonne ce client
export async function createSessionToken(userId, clientId = null) {
  const payload = { uid: userId };
  if (clientId) payload.cid = clientId;
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

// Renvoie { userId, clientId } — userId = compte réel, clientId = client impersonné (ou null)
export async function getSessionData(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.uid ?? null, clientId: payload.cid ?? null };
  } catch {
    return null;
  }
}

// Renvoie l'id utilisateur réel (agence ou utilisateur solo), ou null
export async function getUserId(req) {
  const data = await getSessionData(req);
  return data?.userId ?? null;
}

// Renvoie l'id effectif pour les opérations de contenu :
// → le client impersonné si en mode agence, sinon l'utilisateur réel
export async function getEffectiveUserId(req) {
  const data = await getSessionData(req);
  if (!data) return null;
  return data.clientId ?? data.userId;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
