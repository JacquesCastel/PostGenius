import { prisma } from "./db";
import { memo, memoClear } from "./memoCache";
import { advisorEnabled, ADVISOR_MODES, decideAdvisorAccess } from "./advisorFlag";
import { isAdminUser } from "./admin";

// Conseiller éditorial : qui y a accès ?
//  - EDITORIAL_ADVISOR=1 sur le serveur reste l'interrupteur général (absent ou autre valeur : le conseiller est coupé pour tous) ;
//  - l'Administration choisit ensuite le périmètre (SiteContent « advisor-mode ») :
//      all      tous les comptes (défaut : le comportement d'avant l'activation par compte)
//      accounts seulement les comptes cochés dans l'Administration (champ User.advisorAccess) et les administrateurs
//      off      personne, sans toucher au serveur
const KEY = "advisor-mode";
const TTL = 10_000;

export async function getAdvisorMode() {
  return memo(
    "advisor-mode",
    TTL,
    async () => {
      const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
      let v = {};
      try { v = row ? JSON.parse(row.value) : {}; } catch {}
      return ADVISOR_MODES.includes(v.mode) ? v.mode : "all";
    },
    "all"
  );
}

export async function setAdvisorMode(mode) {
  if (!ADVISOR_MODES.includes(mode)) throw new Error("Mode invalide.");
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify({ mode }) }, update: { value: JSON.stringify({ mode }) } });
  memoClear();
  return mode;
}

// Ce compte (l'identifiant effectif de la session, donc le client observé en « Voir comme ») a-t-il le conseiller ?
export async function advisorAccessFor(userId, env = process.env) {
  if (!advisorEnabled(env) || !userId) return false;
  const mode = await getAdvisorMode();
  if (mode === "off") return false;
  if (mode === "all") return true;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { advisorAccess: true, role: true, email: true } });
  return decideAdvisorAccess({ envOn: true, mode, userAllowed: u?.advisorAccess, isAdmin: isAdminUser(u) });
}
