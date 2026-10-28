import { prisma } from "../db";
import { decryptToken } from "../crypto";
import { fetchOrgShareStats } from "../linkedin/orgShareStats";
import { fetchMemberMetrics } from "../linkedin/memberStats";

// Historique de performance réelle des posts publiés sur les pages entreprise — le
// chaînon qui manquait pour un jour relier les recommandations à de vrais résultats
// LinkedIn plutôt qu'au seul accepté/ignoré (voir lib/editorial/learning.js). Ne
// calcule ni ne prédit rien ici : capture seulement des instantanés dans le temps.
// Profils personnels : mesurés via r_member_postAnalytics (token « statistiques », voir lib/linkedin/memberStats.js),
// avec un plafond de posts par compte et par passage pour rester sous le quota d'appels de LinkedIn.

const OFFSETS_HOURS = [24, 168]; // J+1 et J+7
const MAX_DRAFTS_PER_RUN = 30; // borne le travail par exécution (quota API LinkedIn)
const THROTTLE_MS = 3 * 60 * 60 * 1000; // au plus une fois toutes les 3 h
const MAX_PERSONAL_PER_USER = 4; // posts de profil mesurés par compte et par passage (5 appels chacun ; quota LinkedIn par membre)

let lastRun = 0;

export async function capturePerformanceSnapshots() {
  if (Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();

  const now = Date.now();
  const earliestOffsetMs = OFFSETS_HOURS[0] * 3600_000;

  // Posts publiés sur une page entreprise, assez anciens pour au moins un palier dû.
  // Bornée à 200 candidats : filtrée plus finement ci-dessous, palier par palier.
  const candidates = await prisma.draft.findMany({
    where: {
      status: "publié",
      postId: { not: null },
      publishedAt: { lte: new Date(now - earliestOffsetMs) },
      OR: [{ target: { startsWith: "urn:li:organization:" } }, { target: "person" }],
    },
    orderBy: { publishedAt: "asc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      target: true,
      postId: true,
      publishedAt: true,
      performance: { select: { offsetHours: true } },
    },
  });

  const due = [];
  for (const d of candidates) {
    const captured = new Set(d.performance.map((p) => p.offsetHours));
    for (const offset of OFFSETS_HOURS) {
      if (captured.has(offset)) continue;
      if (now - new Date(d.publishedAt).getTime() >= offset * 3600_000) {
        due.push({ ...d, offset });
        break; // un palier par exécution pour ce post ; le suivant viendra à la prochaine
      }
    }
    if (due.length >= MAX_DRAFTS_PER_RUN) break;
  }
  if (!due.length) return { captured: 0 };

  // Posts de profil personnel : un appel par mesure et par post, sous le plafond par compte
  let captured = 0;
  const personalByUser = new Map();
  for (const d of due.filter((x) => x.target === "person")) {
    const list = personalByUser.get(d.userId) ?? [];
    if (list.length < MAX_PERSONAL_PER_USER) list.push(d);
    personalByUser.set(d.userId, list);
  }
  for (const [userId, drafts] of personalByUser) {
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { statsToken: true, statsExpiresAt: true } });
    const token = decryptToken(acc?.statsToken);
    if (!token || (acc.statsExpiresAt && acc.statsExpiresAt < new Date())) continue; // statistiques du profil pas (ou plus) connectées
    for (const d of drafts) {
      const m = await fetchMemberMetrics(token, ["IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS"], { entity: d.postId });
      if (Object.values(m).every((v) => v == null)) continue; // rien de lisible : on retentera au passage suivant
      try {
        await prisma.postPerformance.create({ data: { draftId: d.id, offsetHours: d.offset, impressions: m.IMPRESSION, likes: m.REACTION, comments: m.COMMENT, shares: m.RESHARE, clicks: m.LINK_CLICKS } });
        captured++;
      } catch (e) {
        if (e.code !== "P2002") console.error("[performance] création (profil) :", e.message);
      }
    }
  }

  // Regroupe par (compte, page) pour réutiliser le token et batcher l'appel LinkedIn.
  const groups = new Map();
  for (const d of due.filter((x) => x.target !== "person")) {
    const key = `${d.userId}:${d.target}`;
    if (!groups.has(key)) groups.set(key, { userId: d.userId, org: d.target, drafts: [] });
    groups.get(key).drafts.push(d);
  }

  for (const { userId, org, drafts } of groups.values()) {
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
    const orgToken = decryptToken(acc?.orgToken);
    if (!orgToken) continue; // page déconnectée depuis : on réessaiera au palier suivant

    let statsByUrn;
    try {
      statsByUrn = await fetchOrgShareStats(orgToken, org, drafts.map((d) => d.postId));
    } catch (e) {
      console.error("[performance] fetchOrgShareStats:", e.message);
      continue;
    }

    for (const d of drafts) {
      const s = statsByUrn[d.postId];
      if (!s) continue; // LinkedIn n'a rien renvoyé pour ce post : on retentera au palier suivant
      try {
        await prisma.postPerformance.create({
          data: {
            draftId: d.id,
            offsetHours: d.offset,
            impressions: s.impressionCount ?? null,
            likes: s.likeCount ?? null,
            comments: s.commentCount ?? null,
            shares: s.shareCount ?? null,
            clicks: s.clickCount ?? null,
          },
        });
        captured++;
      } catch (e) {
        // Contrainte unique (draftId, offsetHours) : déjà capturé par une exécution
        // concurrente, rien à faire.
        if (e.code !== "P2002") console.error("[performance] création:", e.message);
      }
    }
  }
  return { captured };
}
