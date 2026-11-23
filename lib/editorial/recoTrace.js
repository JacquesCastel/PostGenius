import { prisma } from "../db";
import { logActivity } from "../activity";

// Traçabilité « proposition de Que publier ? → brouillon → publication → mesure », et appartenance des objets associés.
// RIEN ici ne modifie ce que le moteur apprend : lib/editorial/learning.js lit toujours le statut de la proposition, exactement comme avant.
// Les relations existantes suffisent (EditorialRecommendation.draftId, unique) : aucun changement de schéma.

// Étape atteinte par une proposition, d'après ce qu'on peut lire (fonction pure, testable).
//   reco : { status } ; draft : { status } ou null (brouillon relié, s'il existe encore) ; measureCount : nombre de mesures du brouillon
//   draftDeleted : une trace de suppression existe (journal d'exploitation « reco_draft_deleted »)
export function recoStage({ reco, draft = null, measureCount = 0, draftDeleted = false } = {}) {
  const status = reco?.status;
  if (status === "ignorée" || status === "rejetée") return "declined";
  if (status === "remplacée") return "replaced";
  if (draft) {
    if (measureCount > 0) return "measured";
    if (draft.status === "publié") return "published";
    if (draft.status === "programmé" || draft.status === "à valider") return "scheduled";
    return "draft_created"; // brouillon, erreur…
  }
  if (draftDeleted) return "draft_deleted";
  if (status === "planifiée") return "link_lost"; // planifiée par le pilote automatique, brouillon plus relié : supprimé (cause inconnue sans trace) ou lien perdu
  if (status === "générée") return "generation_requested"; // simple clic : aucun brouillon relié
  if (status === "proposée") return "proposed";
  return "unknown";
}

// Pilier et proposition fournis par le navigateur à la création d'un brouillon : chacun doit appartenir au compte (jamais un identifiant d'un autre compte).
// Sans proposition ni pilier : aucune lecture, comportement historique.
export async function resolveDraftAssociations(userId, { pillarId, recoId } = {}) {
  let pillar = pillarId ? String(pillarId) : null;
  let reco = null;
  if (pillar) {
    const own = await prisma.editorialPillar.findFirst({ where: { id: pillar, userId }, select: { id: true } });
    if (!own) return { error: "Pilier introuvable." };
  }
  if (recoId) {
    reco = await prisma.editorialRecommendation.findFirst({ where: { id: String(recoId), userId }, select: { id: true, pillarId: true } });
    if (!reco) return { error: "Proposition introuvable." };
    if (!pillar && reco.pillarId) pillar = reco.pillarId; // le pilier de la proposition : même valeur que celle envoyée par le navigateur, mais lue côté serveur
  }
  return { pillarId: pillar, recoId: reco?.id ?? null };
}

// Relie la proposition au brouillon qui vient d'être créé. Atomique : ne s'applique qu'à une proposition du compte, encore sans brouillon.
// Ne modifie NI le statut NI la date de réponse de la proposition. Lève une erreur en cas de panne : l'appelant ne doit jamais bloquer la création du post.
export async function linkRecoToDraft(userId, recoId, draftId) {
  const draft = await prisma.draft.findFirst({ where: { id: draftId, userId }, select: { id: true } });
  if (!draft) return { linked: false, reason: "draft" };
  const r = await prisma.editorialRecommendation.updateMany({ where: { id: recoId, userId, draftId: null }, data: { draftId } });
  return { linked: r.count === 1, reason: r.count === 1 ? null : "already" };
}

// Avant la suppression d'un brouillon relié à une proposition : le lien passera à « null » (onDelete: SetNull) et la suppression ne serait plus visible.
// On en garde la trace dans le journal d'exploitation (ActivityEvent, sans schéma ni texte), SANS toucher à la proposition : aucun effet sur l'apprentissage.
export async function recordRecoDraftDeletion(userId, draftId) {
  try {
    const reco = await prisma.editorialRecommendation.findFirst({ where: { draftId, userId }, select: { id: true, status: true } });
    if (!reco) return;
    const d = await prisma.draft.findFirst({ where: { id: draftId, userId }, select: { status: true, auto: true, createdAt: true, publishedAt: true } });
    await logActivity(userId, "reco_draft_deleted", {
      recoId: reco.id,
      recoStatus: reco.status,
      draftStatus: d?.status ?? null,
      auto: d?.auto ?? null,
      published: Boolean(d?.publishedAt),
      draftAgeHours: d?.createdAt ? Math.round((Date.now() - new Date(d.createdAt).getTime()) / 3600_000) : null,
    });
  } catch (e) {
    console.error("[reco-trace] suppression non tracée :", e?.message);
  }
}
