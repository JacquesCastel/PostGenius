import { getSessionData, clientAccessible } from "./session";

// Compte réellement concerné par une connexion OAuth (LinkedIn profil / page entreprise / statistiques, Instagram).
// En mode agence, la session porte l'agence (uid) ET le client géré (cid) : la connexion doit s'enregistrer sur le
// CLIENT, jamais sur l'agence. Le client visé est mémorisé au départ dans un cookie court (OAUTH_TARGET_COOKIE) et
// revérifié au retour : si le compte géré a changé entre-temps (autre onglet, retour à l'agence), la connexion
// est refusée plutôt que d'être rattachée au mauvais compte. La vue support (lecture seule) ne peut rien connecter.

export const OAUTH_TARGET_COOKIE = "oauth_target";

export async function oauthTarget(req) {
  const d = await getSessionData(req);
  if (!d?.userId) return { error: "not_logged_in" };
  if (d.support) return { error: "read_only" };
  if (d.clientId && !(await clientAccessible(d))) return { error: "not_logged_in" };
  return { userId: d.clientId ?? d.userId };
}

export function bindOauthTarget(res, userId) {
  res.cookies.set(OAUTH_TARGET_COOKIE, userId, { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export function oauthTargetMatches(req, userId) {
  const v = req.cookies.get(OAUTH_TARGET_COOKIE)?.value;
  return Boolean(v) && v === userId;
}

export function clearOauthTarget(res) {
  res.cookies.delete(OAUTH_TARGET_COOKIE);
}

export const READ_ONLY_MESSAGE = "Vue support en lecture seule : aucune connexion possible.";
