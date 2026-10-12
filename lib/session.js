import { getSessionData, SESSION_MAX_AGE, SUPPORT_MAX_AGE } from "./sessionToken";
import { prisma } from "./db";

// Les sessions (jeton signé, lecture du cookie) vivent dans sessionToken.js, sans accès base : le middleware (edge) en dépend.
export * from "./sessionToken";

export async function getUserId(req) {
  const data = await getSessionData(req);
  return data?.userId ?? null;
}

// Renvoie l'id effectif pour les opérations de contenu :
// → le client impersonné si en mode agence, sinon l'utilisateur réel
export async function getEffectiveUserId(req) {
  const data = await getSessionData(req);
  if (!data) return null;
  if (data.clientId && !(await clientAccessible(data))) return null;
  return data.clientId ?? data.userId;
}

// Le client visé par la session est-il toujours un client de l'agence de l'utilisateur ? (un membre retiré de l'agence perd
// aussitôt l'accès, même avec un jeton encore valide). La vue support (admin) n'est pas liée à une agence.
export async function clientAccessible(data) {
  if (!data?.clientId) return true;
  if (data.support) return true;
  const client = await prisma.user.findFirst({
    where: { id: data.clientId, agency: { members: { some: { userId: data.userId } } } },
    select: {
      agency: { select: { restrictClients: true, members: { where: { userId: data.userId }, select: { role: true } } } },
      accessAsClient: { where: { memberId: data.userId }, select: { id: true } },
    },
  });
  if (!client) return false;
  // Agence qui cloisonne : un collaborateur n'ouvre que les clients qui lui sont affectés (le propriétaire voit tout)
  const owner = client.agency?.members?.[0]?.role === "owner";
  return !client.agency?.restrictClients || owner || client.accessAsClient.length > 0;
}

export function sessionCookieOptions({ support = false } = {}) {
  return {
    httpOnly: true,
    path: "/",
    maxAge: support ? SUPPORT_MAX_AGE : SESSION_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
