// Sauvegarde lisible des campagnes (plan, posts programmés, brouillons) dans un fichier JSON. Lecture seule : ne modifie rien.
// Lancer sur le serveur :  node --env-file=.env scripts/export-campagnes.mjs [dossier]
// Le fichier est écrit dans /opt/postgenius-backups (ou le dossier donné), hors du dépôt : un déploiement n'y touche jamais.
// Pour la base entière, la vraie sauvegarde reste un instantané Neon (voir DEPLOY.md) ; ceci est une copie de secours des campagnes.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const dir = process.argv[2] || "/opt/postgenius-backups";
fs.mkdirSync(dir, { recursive: true });

const campaigns = await prisma.campaign.findMany({
  orderBy: { createdAt: "asc" },
  include: { plan: { orderBy: { position: "asc" } }, drafts: { orderBy: { createdAt: "asc" } }, user: { select: { email: true } } },
});
// Posts programmés ou en attente qui ne dépendent d'aucune campagne
const loose = await prisma.draft.findMany({
  where: { campaignId: null, OR: [{ scheduledAt: { not: null } }, { status: { in: ["programmé", "planifié"] } }] },
  orderBy: { createdAt: "asc" },
  include: { user: { select: { email: true } } },
});

const out = {
  exportedAt: new Date().toISOString(),
  campaigns: campaigns.map((c) => ({ ...c, user: undefined, owner: c.user.email, drafts: c.drafts.map(({ ...d }) => d) })),
  looseScheduledDrafts: loose.map((d) => ({ ...d, user: undefined, owner: d.user.email })),
};
const file = path.join(dir, `campagnes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });

const posts = campaigns.reduce((n, c) => n + c.plan.length, 0);
const drafts = campaigns.reduce((n, c) => n + c.drafts.length, 0);
console.log(`✅ ${campaigns.length} campagne(s), ${posts} post(s) prévus, ${drafts} brouillon(s) liés, ${loose.length} post(s) programmé(s) hors campagne`);
console.log(`   Fichier : ${file}`);
for (const c of campaigns) console.log(`   - ${c.name} [${c.status}] · ${c.plan.length} post(s) · ${c.user.email}`);
await prisma.$disconnect();
