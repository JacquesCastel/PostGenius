import { prisma } from "./db";
import { decryptToken } from "./crypto";
import { checkAccess } from "./gating";
import { notifyAgency, clientLabel } from "./agencyNotify";
import { pageCommentMail, ownPageCommentMail } from "./teamEmails";
import { sendOnce } from "./lifecycleEmails";
import { getCommentText } from "./linkedinSocial";
import { normalizeCommentUrn } from "./linkedinPost";
import { sendPushToUser } from "./push";
import { captureLeads } from "./leads";

// Commentaires et mentions des pages entreprise des clients d'agence → cloche et e-mail de l'équipe.
// Consultation régulière de l'API « Organization Social Action Notifications » (Community Management API) : une requête par page,
// toutes les 10 minutes, avec le jeton de la page déjà connectée. Aucun abonnement ni adresse à déclarer chez LinkedIn.
// La documentation recommande l'envoi automatique (webhook) en production ; la consultation convient à notre volume et reste valable
// comme filet de sécurité (les notifications sont conservées 60 jours côté LinkedIn).
// https://learn.microsoft.com/linkedin/marketing/community-management/organizations/organization-social-action-notifications

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
// Le palier « Development » de LinkedIn limite les appels par jour (100 par membre, 500 par application) et répond 429 une fois la limite atteinte.
// Une lecture par page toutes les 30 minutes fait 48 appels par jour : de quoi rester sous la limite d'un membre, avec de la marge pour les
// textes de commentaires. Sur un 429, on s'arrête pour ce compte jusqu'à minuit UTC (remise à zéro des compteurs).
const MIN_INTERVAL_MS = 30 * 60 * 1000;
const DAILY_CALL_BUDGET = 400; // sur les 500 appels par jour de l'application : le reste sert aux textes de commentaires et aux usages manuels
let intervalMs = MIN_INTERVAL_MS; // recalculé à chaque passage selon le nombre de pages lues : N pages × (24 h / intervalle) ≤ budget
const MAX_TEXTS = 10; // textes de commentaires lus par passage et par page (e-mail et leads)
const pausedUntil = new Map(); // userId → ms
const nextMidnightUtc = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
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
async function pull({ token, urn, since, actions = "COMMENT,SHARE_MENTION" }) {
  const items = [];
  let withRange = since != null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = `q=criteria&actions=List(${actions})&organizationalEntity=${encodeURIComponent(urn)}${withRange ? `&timeRange=(start:${since})` : ""}&count=${PAGE_SIZE}&start=${page * PAGE_SIZE}`;
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
  if (!force && Date.now() - lastRun < intervalMs) return { skipped: true };
  lastRun = Date.now();
  const startedAt = Date.now();

  const accounts = await prisma.linkedInAccount.findMany({
    where: { orgToken: { not: null }, user: { disabled: false } },
    select: { userId: true, personSub: true, orgToken: true, orgExpiresAt: true, orgUrn: true, orgAccounts: true, commentsCursor: true, user: { select: { id: true, name: true, email: true, companyName: true, agencyId: true, emailOptOut: true } } },
    take: 500,
  });

  let pagesRead = 0;
  const diag = {}; // passage manuel : tout ce que LinkedIn renvoie pour la page (60 j), sans rien notifier, pour comprendre un silence
  let diagLatest = 0;
  const out = { clients: 0, pages: 0, notified: 0, comments: 0, mentions: 0, forbidden: 0, expired: 0, errors: 0, limited: 0, leads: 0 };
  for (const acc of accounts) {
    const token = decryptToken(acc.orgToken);
    if (!token || (acc.orgExpiresAt && acc.orgExpiresAt < new Date())) { out.expired++; continue; } // à reconnecter : l'écran Connexions le signale déjà
    if (!(await checkAccess(acc.userId)).ok) continue; // agence sans accès actif : on n'interroge pas LinkedIn pour rien
    // Hors agence (offre Pro) : une seule page entreprise est lue, la première ; l'agence lit la page de chaque client
    const all = pagesOf(acc);
    const pages = acc.user.agencyId ? all : all.slice(0, 1);
    if (!pages.length) continue;
    pagesRead += pages.length;
    if (!force && (pausedUntil.get(acc.userId) ?? 0) > Date.now()) { out.limited++; continue; } // quota LinkedIn du jour atteint
    out.clients++;

    const cursor = acc.commentsCursor && typeof acc.commentsCursor === "object" ? { ...acc.commentsCursor } : {};
    let comments = 0, mentions = 0, changed = false, postUrn = null, postAt = 0;
    const fresh = []; // commentaires de ce passage : { urn, at }
    for (const urn of pages) {
      out.pages++;
      // Première lecture d'une page : on part de maintenant, sans remonter l'historique (jusqu'à 60 jours) d'un coup
      if (force) {
        const d = await pull({ token, urn, since: null, actions: "LIKE,COMMENT,SHARE,SHARE_MENTION,ADMIN_COMMENT,COMMENT_EDIT,COMMENT_DELETE" }).catch(() => ({ status: "réseau" }));
        if (d.status) { diag.statut = d.status; if (d.status === 429) pausedUntil.set(acc.userId, nextMidnightUtc()); }
        else for (const e of d.items) { diag[e.action] = (diag[e.action] ?? 0) + 1; diagLatest = Math.max(diagLatest, Number(e.lastModifiedAt ?? 0)); }
      }
      if (!(urn in cursor)) { cursor[urn] = startedAt; changed = true; continue; }
      try {
        const r = await pull({ token, urn, since: cursor[urn] });
        if (r.status) {
          if (r.status === 401) out.expired++;
          else if (r.status === 429) {
            out.limited++;
            pausedUntil.set(acc.userId, nextMidnightUtc());
            console.warn("[comments] LinkedIn a répondu 429 : quota d'appels du jour atteint, reprise à minuit UTC");
          }
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
          if (/^urn:li:(activity|share|ugcPost):\d+$/.test(String(e.sourcePost)) && at >= postAt) { postUrn = e.sourcePost; postAt = at; } // post du commentaire le plus récent
          if (e.action === "COMMENT") { comments++; { const cu = normalizeCommentUrn(e.generatedActivity); if (cu) fresh.push({ urn: cu, at }); } }
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
    // Textes des commentaires les plus récents : lus une seule fois, pour l'e-mail (les trois premiers) et pour la base de leads
    fresh.sort((a, b) => b.at - a.at);
    const read = await Promise.all(fresh.slice(0, MAX_TEXTS).map(async (c) => ({ ...c, info: await getCommentText({ token, commentUrn: c.urn }) })));
    if (read.some((c) => c.info?.status === 429)) { out.limited++; pausedUntil.set(acc.userId, nextMidnightUtc()); }
    // Base de leads : les auteurs des commentaires deviennent des leads (hors la page elle-même et son administrateur connecté)
    out.leads += await captureLeads({ userId: acc.userId, token, comments: read, skipActors: [...pages, acc.personSub ? `urn:li:person:${acc.personSub}` : null].filter(Boolean) }).catch((e) => { console.warn("[leads]", e.message); return 0; });
    if (!comments && !mentions) continue;

    const client = acc.user;
    // Les trois commentaires les plus récents, avec leur texte, pour l'e-mail ; le plus récent est aussi proposé en réponse dans « Interagir »
    const commentUrn = fresh[0]?.urn ?? null;
    const commentText = read[0]?.urn === commentUrn && read[0]?.info?.text ? read[0].info.text : null; // texte du commentaire proposé en réponse
    const quotes = read.slice(0, 3).map((c) => c.info).filter((q) => q?.text).map((q) => q.text.slice(0, 400));
    const postUrl = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : null;
    // Page de l'utilisateur lui-même : notification push et e-mail (au plus un par heure), sans cloche d'équipe
    if (!client.agencyId) {
      const parts = [comments && `${comments} commentaire${comments > 1 ? "s" : ""}`, mentions && `${mentions} mention${mentions > 1 ? "s" : ""}`].filter(Boolean).join(" et ");
      await sendPushToUser(client.id, { title: `Nouveau sur votre page : ${parts}`, body: "Répondez-y depuis « Interagir ».", url: `/app?view=engage${postUrl ? `&post=${encodeURIComponent(postUrl)}` : ""}${commentUrn ? `&comment=${encodeURIComponent(commentUrn)}` : ""}${commentUrn && commentText ? `&q=${encodeURIComponent(commentText.slice(0, 400))}` : ""}`, tag: "page-comments" }).catch(() => {});
      // Un e-mail par passage qui trouve du nouveau (toutes les 10 minutes au plus) : le repère avance, rien n'est notifié deux fois
      if (!client.emailOptOut) await sendOnce(client, `page_comment:${startedAt}`, ownPageCommentMail({ comments, mentions, user: client, postUrl, commentUrn, quotes, commentText }));
      out.notified++;
      out.comments += comments;
      out.mentions += mentions;
      continue;
    }
    const name = clientLabel(client);
    const parts = [comments && `${comments} nouveau${comments > 1 ? "x" : ""} commentaire${comments > 1 ? "s" : ""}`, mentions && `${mentions} mention${mentions > 1 ? "s" : ""}`].filter(Boolean);
    out.notified += await notifyAgency({
      agencyId: client.agencyId, clientId: client.id, kind: "page_comment", view: "engage", postUrl, commentUrn,
      title: `${parts.join(" et ")} sur la page de ${name}`,
      body: "Répondez-y depuis « Interagir ».",
      email: pageCommentMail({ client: name, clientId: client.id, comments, mentions, postUrl, commentUrn, quotes, commentText }),
    });
    out.comments += comments;
    out.mentions += mentions;
  }

  // Plus il y a de pages, plus l'intervalle s'allonge, pour rester sous le quota de LinkedIn (palier Development)
  intervalMs = Math.max(MIN_INTERVAL_MS, Math.ceil((pagesRead * 24 * 60 * 60 * 1000) / DAILY_CALL_BUDGET));
  const result = { ...out, sent: out.notified, note: `${out.pages} page${out.pages > 1 ? "s" : ""} lue${out.pages > 1 ? "s" : ""}${out.forbidden ? ` · ${out.forbidden} refus de LinkedIn (accès)` : ""}${out.expired ? ` · ${out.expired} connexion(s) expirée(s)` : ""}${out.errors ? ` · ${out.errors} erreur(s)` : ""}${out.limited ? " · quota LinkedIn du jour atteint (reprise à minuit UTC)" : ""}${out.leads ? ` · ${out.leads} lead(s) créé(s)` : ""}${force ? ` · LinkedIn renvoie (60 j) : ${Object.keys(diag).length ? Object.entries(diag).map(([k, v]) => `${k} ${v}`).join(", ") : "rien"}${diagLatest ? `, dernier ${new Date(diagLatest).toISOString()}` : ""}` : ""}` };
  (globalThis.__emailRuns ??= {}).comments = { at: new Date().toISOString(), result };
  return result;
}
