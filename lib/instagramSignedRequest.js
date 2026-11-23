import crypto from "node:crypto";

// Requête signée de Meta (désautorisation de l'application, suppression de données) : « <signature>.<charge utile> », les deux en base64url.
// Procédure officielle : la signature est le HMAC-SHA256 de la charge utile (telle qu'encodée) avec le secret de l'application ; on la compare en temps constant.
// Doc : https://developers.facebook.com/docs/games/gamesonfacebook/login#parsingsr
export class SignedRequestError extends Error {}

const b64urlToBuffer = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

// Renvoie la charge utile (objet) si la signature est valide ; lève une SignedRequestError sinon. Un secret absent est un refus, jamais un passe-droit.
export function verifySignedRequest(signedRequest, secret) {
  if (!secret) throw new SignedRequestError("Secret de l'application absent.");
  const parts = String(signedRequest ?? "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new SignedRequestError("Requête signée mal formée.");
  const [sigPart, payloadPart] = parts;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(sigPart) || !/^[A-Za-z0-9_-]+={0,2}$/.test(payloadPart)) throw new SignedRequestError("Requête signée mal formée.");
  const given = b64urlToBuffer(sigPart);
  const expected = crypto.createHmac("sha256", secret).update(payloadPart).digest();
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new SignedRequestError("Signature invalide.");
  let payload;
  try { payload = JSON.parse(b64urlToBuffer(payloadPart).toString("utf8")); } catch { throw new SignedRequestError("Charge utile illisible."); }
  if (!payload || typeof payload !== "object") throw new SignedRequestError("Charge utile illisible.");
  if (payload.algorithm && String(payload.algorithm).toUpperCase() !== "HMAC-SHA256") throw new SignedRequestError("Algorithme non pris en charge.");
  return payload;
}
