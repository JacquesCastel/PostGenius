import { prisma } from "./db";
import { memo, memoClear } from "./memoCache";

// Interrupteurs globaux du super-admin, stockés dans SiteContent (clé « ops-flags »).
//  - signupsClosed : plus d'inscription ouverte (les invitations de test et d'équipe continuent de fonctionner)
//  - aiOff         : aucun appel aux fournisseurs d'IA (Anthropic, OpenAI) : coupe-circuit en cas de dérive des coûts
//  - maintenance   : bandeau d'information dans l'application et sur l'inscription
const KEY = "ops-flags";
export const DEFAULT_FLAGS = { signupsClosed: false, aiOff: false, maintenance: false, maintenanceMessage: "" };
const TTL = 10_000; // lecture en mémoire : la bascule se voit en moins de 10 s partout (et tout de suite sur ce processus)

export async function getFlags() {
  return memo(
    "ops-flags",
    TTL,
    async () => {
      const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
      let v = {};
      try { v = row ? JSON.parse(row.value) : {}; } catch {}
      return { ...DEFAULT_FLAGS, ...v };
    },
    DEFAULT_FLAGS
  );
}

export async function setFlags(patch) {
  const cur = await getFlags();
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_FLAGS)) if (patch[k] !== undefined) next[k] = typeof DEFAULT_FLAGS[k] === "boolean" ? Boolean(patch[k]) : String(patch[k]).slice(0, 300);
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  memoClear();
  return next;
}
