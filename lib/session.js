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

export async function createSessionToken(userId) {
  return await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

// Renvoie l'id utilisateur de la session, ou null
export async function getUserId(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.uid ?? null;
  } catch {
    return null;
  }
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
