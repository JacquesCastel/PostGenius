import { prisma } from "./db";
import { getUserId } from "./session";

// Super admin : rôle en base OU email listé dans ADMIN_EMAILS (.env)

export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const envAdmins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return envAdmins.includes(user.email?.toLowerCase());
}

// Renvoie l'utilisateur admin de la session, ou null
export async function requireAdmin(req) {
  const userId = await getUserId(req);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return isAdminUser(user) ? user : null;
}
