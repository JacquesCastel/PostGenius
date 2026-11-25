import { prisma } from "../db";
import { nextPreferredSlots } from "../campaign";

// Contrôler tous les créneaux candidats, y compris ceux au-delà de 14 jours.
export async function nextFreeAutopilotSlot(db, user) {
  const slots = nextPreferredSlots(user, 20, new Date());
  if (!slots.length) return null;
  const occupied = await db.draft.findMany({
    where: { userId: user.id, status: { in: ["programmé", "à valider"] }, scheduledAt: { in: slots } },
    select: { scheduledAt: true },
  });
  const times = new Set(occupied.map((draft) => draft.scheduledAt.getTime()));
  return slots.find((slot) => !times.has(slot.getTime())) ?? null;
}

// Un ancien échec peut avoir laissé un brouillon sans lien. Le thème ne prouve
// pas sa provenance : bloquer la nouvelle programmation, sans le relier ni le
// supprimer automatiquement. Les campagnes et temps forts restent distincts.
export function findUnlinkedAutopilotDraft(db, userId, topic) {
  return db.draft.findFirst({
    where: { userId, theme: topic.slice(0, 200), auto: true, campaignId: null, campaignPostId: null, eventId: null, editorialReco: null },
    select: { id: true },
  });
}

// L'IA a déjà répondu : aucun appel réseau dans cette transaction courte.
// Une seule opération de programmation : statut, brouillon et lien sont tous
// validés, ou tous annulés. Serializable protège aussi le choix du créneau
// lorsque plusieurs instances du pilote travaillent simultanément.
export async function scheduleAutopilotDraft(userId, expected, { text, inspirationUrl }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // L'opt-in peut avoir été retiré pendant la génération du texte.
        const user = await tx.user.findFirst({
          where: { id: userId, disabled: false, agencyId: null, autoPublishThreshold: { not: null }, expertise: { not: null }, publishDays: { not: null } },
        });
        if (!user) return null;
        const where = { id: expected.id, userId, status: "proposée", draftId: null, topic: expected.topic, angle: expected.angle, postType: expected.postType, pillarId: expected.pillarId ?? null };
        const reco = await tx.editorialRecommendation.findFirst({ where });
        if (!reco || reco.confidence < user.autoPublishThreshold) return null;
        if (await findUnlinkedAutopilotDraft(tx, userId, reco.topic)) {
          throw new Error("Un brouillon automatique sans recommandation porte déjà ce sujet : vérification manuelle requise.");
        }
        // Revérifier après l'IA : le créneau peut avoir été occupé entre-temps.
        const slot = await nextFreeAutopilotSlot(tx, user);
        if (!slot) return null;
        const claimed = await tx.editorialRecommendation.updateMany({
          where,
          data: { status: "planifiée", respondedAt: new Date() },
        });
        if (claimed.count !== 1) return null;

        const draft = await tx.draft.create({
          data: {
            userId,
            type: reco.postType,
            theme: reco.topic.slice(0, 200),
            expertise: user.expertise,
            tone: user.tone || "Professionnel",
            maxChars: user.defaultMaxChars || 1300,
            text,
            generatedText: text,
            status: "programmé",
            scheduledAt: slot,
            target: "person",
            auto: true,
            pillarId: reco.pillarId,
            inspirationUrl,
          },
        });
        await tx.editorialRecommendation.update({ where: { id: reco.id, userId }, data: { draftId: draft.id } });
        return draft;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      // Prisma annule la transaction en conflit : reprendre les lectures et
      // écritures seulement, avec le même texte (aucun nouvel appel à l'IA).
      if (error.code !== "P2034" || attempt === 2) throw error;
    }
  }
}
