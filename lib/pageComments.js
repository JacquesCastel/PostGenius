import { prisma } from "./db";
import { decryptToken } from "./crypto";
import { checkAccess } from "./gating";
import { notifyAgency, clientLabel } from "./agencyNotify";
import { pageCommentMail } from "./teamEmails";

// Commentaires et mentions des pages entreprise des clients d'agence → cloche et e-mail de l'équipe.
// Consultation régulière de l'API « Organization Social Action Notifications » (Community Management API) : une requête par page,
// toutes les 10 minutes, avec le jeton de la page déjà connectée. Aucun abonnement ni adresse à déclarer chez LinkedIn.
// La documentation recommande l'envoi automatique (webhook) en production ; la consultation convient à notre volume et reste valable
// comme filet de sécurité (les notifications sont conservées 60 jours côté LinkedIn).
// https://learn.microsoft.com/linkedin/marketing/community-management/organizations/organization-social-action-notifications

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
const INTERVAL_MS = 10 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 60 * 60 * 1000; // un e-mail par client et par heure au plus (la cloche, elle, est mise à jour à chaque passage)
const PAGE_SIZE = 50;
const MAX_PAGES = 5;
const ORG_URN = /^urn:li:organization:\d+$/;

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
  "X-Restli-Protocol-Version": "2.0.0",
});

// Pages entreprise connectées pour ce compte : toutes celles dont l'utilisateur est administrateur, sinon la première
function pagesOf(acc) {
  try {
    const list = JSON.parse(acc.orgAccounts ?? "[]").map((o) => o?.urn).filter((u) => ORG_URN.test(String(u)));
    if (list.length) return list;
  } catch {}
  return ORG_URN.test(String(acc.orgUrn)) ? [acc.orgUrn] : [];
}

// Notifications COMMENT et SHARE_MENTION d'une page depuis `since` (ms). Renvoie { items } ou { status } si LinkedIn refuse.
async function pull({ token, urn, since }) {
  const items = [];
  let withRange = true;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = `q=criteria&actions=List(COMMENT,SHARE_MENTION)&organizationalEntity=${encodeURIComponent(urn)}${withRange ? `&timeRange=(start:${since})` : ""}&count=${PAGE_SIZE}&start=${page * PAGE_SIZE}`;
    let res = await fetch(`${LI_API}/rest/organizationalEntityNotifications?${q}`, { headers: headers(token), signal: AbortSignal.timeout(15000) });
    // Si LinkedIn rejette l'intervalle de dates (format), on relit sans lui : le filtre par date est refait ici de toute façon
    if (res.status === 400 && withRange) {
      withRange = false;
      res = await fetch(`${LI_API}/rest/organizationalEntityNotifications?${q.replace(/&timeRange=\(start:\d+\)/, "")}`, { headers: headers(token), signal: AbortSignal.timeout(15000) });
    }
    if (!res.ok) return { status: res.status };
    const data = await res.json().catch(() => ({}));
    const els = Array.isArray(data.elements) ? data.elements : [];
    items.push(...els);
    if (els.length < PAGE_SIZE) break;
  }
  return { items };
}

let lastRun = 0;
let lastForbiddenLog = 0;

export async function runPageCommentNotifications({ force = false } = {}) {
  if (!force && Date.now() - lastRun < INTERVAL_MS) return { skipped: true };
  lastRun = Date.now();
  const startedAt = Date.now();

  const accounts = await prisma.linkedInAccount.findMany({
    where: { orgToken: { not: null }, user: { agencyId: { not: null }, disabled: false } },
    select: { userId: true, orgToken: true, orgExpiresAt: true, orgUrn: true, orgAccounts: true, commentsCursor: true, user: { select: { id: true, name: true, companyName: true, agencyId: true } } },
    take: 500,
  });

  const out = { clients: 0, pages: 0, notified: 0, comments: 0, mentions: 0, forbidden: 0, expired: 0, errors: 0 };
  for (const acc of accounts) {
    const token = decryptToken(acc.orgToken);
    if (!token || (acc.orgExpiresAt && acc.orgExpiresAt < new Date())) { out.expired++; continue; } // à reconnecter : l'écran Connexions le signale déjà
    if (!(await checkAccess(acc.userId)).ok) continue; // agence sans accès actif : on n'interroge pas LinkedIn pour rien
    const pages = pagesOf(acc);
    if (!pages.length) continue;
    out.clients++;

    const cursor = acc.commentsCursor && typeof acc.commentsCursor === "object" ? { ...acc.commentsCursor } : {};
    let comments = 0, mentions = 0, changed = false;
    for (const urn of pages) {
      out.pages++;
      // Première lecture d'une page : on part de maintenant, sans remonter l'historique (jusqu'à 60 jours) d'un coup
      if (!(urn in cursor)) { cursor[urn] = startedAt; changed = true; continue; }
      try {
        const r = await pull({ token, urn, since: cursor[urn] });
        if (r.status) {
          if (r.status === 401) out.expired++;
          else if (r.status === 403) {
            out.forbidden++;
            // Probable : accès « Standard » pas encore accordé, ou la personne connectée n'administre plus la page. Un message par heure.
            if (Date.now() - lastForbiddenLog > 3600_000) { lastForbiddenLog = Date.now(); console.warn("[comments] LinkedIn refuse (403) la lecture des notifications d'une page : accès pas encore accordé, ou administrateur de page manquant"); }
          } else { out.errors++; console.warn(`[comments] LinkedIn a répondu ${r.status} pour une page`); }
          continue; // le repère n'avance pas : rien n'est perdu au prochain passage
        }
        const seen = new Set();
        let latest = cursor[urn];
        for (const e of r.items) {
          const at = Number(e.lastModifiedAt ?? 0);
          if (!e.notificationId || seen.has(e.notificationId) || at < cursor[urn]) continue; // déjà vu, ou antérieur au repère
          seen.add(e.notificationId);
          if (e.action === "COMMENT") comments++;
          else if (e.action === "SHARE_MENTION") mentions++;
          latest = Math.max(latest, at + 1);
        }
        if (latest !== cursor[urn]) { cursor[urn] = latest; changed = true; }
      } catch (e) {
        out.errors++;
        console.warn("[comments] lecture impossible :", e.message);
      }
    }

    // Le repère est enregistré AVANT la notification : en cas d'incident, on préfère en manquer une que de la répéter toutes les 10 minutes
    if (changed) await prisma.linkedInAccount.update({ where: { userId: acc.userId }, data: { commentsCursor: cursor } });
    if (!comments && !mentions) continue;

    const client = acc.user;
    const name = clientLabel(client);
    const parts = [comments && `${comments} nouveau${comments > 1 ? "x" : ""} commentaire${comments > 1 ? "s" : ""}`, mentions && `${mentions} mention${mentions > 1 ? "s" : ""}`].filter(Boolean);
    const recent = await prisma.agencyNotification.findFirst({ where: { agencyId: client.agencyId, clientId: client.id, kind: "page_comment", createdAt: { gte: new Date(Date.now() - EMAIL_COOLDOWN_MS) } }, select: { id: true } });
    out.notified += await notifyAgency({
      agencyId: client.agencyId, clientId: client.id, kind: "page_comment", view: "engage",
      title: `${parts.join(" et ")} sur la page de ${name}`,
      body: "Répondez-y depuis « Interagir ».",
      email: recent ? null : pageCommentMail({ client: name, clientId: client.id, comments, mentions }),
    });
    out.comments += comments;
    out.mentions += mentions;
  }

  const result = { ...out, sent: out.notified, note: `${out.pages} page${out.pages > 1 ? "s" : ""} lue${out.pages > 1 ? "s" : ""}${out.forbidden ? ` · ${out.forbidden} refus de LinkedIn (accès)` : ""}${out.expired ? ` · ${out.expired} connexion(s) expirée(s)` : ""}${out.errors ? ` · ${out.errors} erreur(s)` : ""}` };
  (globalThis.__emailRuns ??= {}).comments = { at: new Date().toISOString(), result };
  return result;
}
