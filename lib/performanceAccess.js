import { prisma } from "./db";
import { isAdminUser } from "./admin";

// Constats de performance (version d'essai) : qui y a accès ?
//  - PERFORMANCE_INSIGHTS=1 sur le serveur est l'interrupteur général : absent ou autre valeur, personne n'y a accès (comportement d'avant, strictement inchangé) ;
//  - ensuite : les administrateurs, et les comptes dont l'adresse figure dans PERFORMANCE_INSIGHTS_ACCOUNTS (adresses séparées par des virgules).
// Aucune table, aucune interface : la liste se règle dans le .env du serveur, par la personne qui décide des comptes autorisés.
export function decidePerformanceAccess({ env = process.env, user } = {}) {
  if (env?.PERFORMANCE_INSIGHTS !== "1" || !user) return false;
  if (isAdminUser(user)) return true;
  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email) return false;
  const list = String(env.PERFORMANCE_INSIGHTS_ACCOUNTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email);
}

// Ce compte (l'identifiant effectif de la session, donc le client observé en « Voir comme ») voit-il les constats ?
export async function performanceAccessFor(userId, env = process.env) {
  if (!userId || env?.PERFORMANCE_INSIGHTS !== "1") return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } }).catch(() => null);
  return decidePerformanceAccess({ env, user });
}
