import { prisma } from "./db";
import { sendTeamMails } from "./teamEmails";

// Notifications d'équipe (cloche de l'app). Jamais bloquantes : une notification qui échoue ne casse pas l'action qui l'a déclenchée.

// Qui est concerné par un client : le propriétaire, plus — si l'agence cloisonne — les équipiers affectés à ce client,
// sinon tous les membres. Sans client (événement d'équipe), tous les membres.
export async function agencyRecipients(agencyId, clientId = null) {
  const [ag, members] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { restrictClients: true } }),
    prisma.agencyMember.findMany({ where: { agencyId }, select: { userId: true, role: true } }),
  ]);
  if (!clientId || !ag?.restrictClients) return members.map((m) => m.userId);
  const assigned = new Set((await prisma.clientAccess.findMany({ where: { agencyId, clientId }, select: { memberId: true } })).map((a) => a.memberId));
  return members.filter((m) => m.role === "owner" || assigned.has(m.userId)).map((m) => m.userId);
}

// Crée une notification par destinataire (`userIds` pour viser quelqu'un en particulier). Renvoie le nombre créé.
// `email` (voir lib/teamEmails.js) : en plus de la cloche, le même événement part par e-mail aux mêmes personnes.
export async function notifyAgency({ agencyId, clientId = null, kind, title, body = null, view = null, postUrl = null, commentUrn = null, userIds = null, createdAt = undefined, email = null }) {
  try {
    const to = [...new Set(userIds ?? (await agencyRecipients(agencyId, clientId)))];
    if (!to.length) return 0;
    const { count } = await prisma.agencyNotification.createMany({
      data: to.map((userId) => ({ agencyId, userId, kind, title, body, clientId, view, postUrl, commentUrn, ...(createdAt ? { createdAt } : {}) })),
    });
    if (email) sendTeamMails(to, email); // en tâche de fond : la réponse à l'utilisateur n'attend pas le serveur d'e-mails (n'échoue jamais)
    return count;
  } catch (e) {
    console.error("[notifications] échec :", e.message);
    return 0;
  }
}

const clientLabel = (c) => c?.companyName || c?.name || "un client";

// Planificateur : prévient l'équipe des posts arrivés « à valider » depuis la dernière notification de ce type pour le client.
// Une notification par client et par passage (pas une par post). La date de la dernière notification sert de repère, donc
// rien n'est notifié deux fois ; au tout premier passage, on ne remonte pas plus de 2 jours en arrière.
let lastRun = 0;
export async function runToValidateNotifications() {
  if (Date.now() - lastRun < 5 * 60 * 1000) return { skipped: true };
  lastRun = Date.now();
  const startedAt = new Date();
  const horizon = new Date(startedAt.getTime() - 2 * 86400000);

  const pending = await prisma.draft.findMany({
    where: { status: "à valider", createdAt: { gte: horizon }, user: { agencyId: { not: null } } },
    select: { id: true, createdAt: true, user: { select: { id: true, name: true, companyName: true, agencyId: true } } },
    take: 500,
  });
  const byClient = new Map();
  for (const d of pending) {
    if (!byClient.has(d.user.id)) byClient.set(d.user.id, { client: d.user, drafts: [] });
    byClient.get(d.user.id).drafts.push(d);
  }
  let notified = 0;
  for (const { client, drafts } of byClient.values()) {
    const last = await prisma.agencyNotification.findFirst({ where: { agencyId: client.agencyId, clientId: client.id, kind: "tovalidate" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const fresh = drafts.filter((d) => !last || d.createdAt > last.createdAt);
    if (!fresh.length) continue;
    notified += await notifyAgency({
      agencyId: client.agencyId, clientId: client.id, kind: "tovalidate", view: "queue", createdAt: startedAt,
      title: `${fresh.length} post${fresh.length > 1 ? "s" : ""} à valider pour ${clientLabel(client)}`,
      body: "Relisez-les et validez-les dans « À traiter ».",
    });
  }
  return { clients: byClient.size, notified };
}

export { clientLabel };
