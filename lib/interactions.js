// Journal des interactions LinkedIn envoyées depuis LinkeePost (voir InteractionLog).

// Écrit une ligne ; ne fait JAMAIS échouer l'action déjà réussie côté LinkedIn.
export async function logInteraction(prisma, { userId, action, urn, reactionType = null, text = null, draftId = null }) {
  try {
    let linkedDraftId = draftId;
    if (!linkedDraftId) {
      const d = await prisma.draft.findFirst({ where: { userId, postId: urn }, select: { id: true } });
      linkedDraftId = d?.id ?? null;
    }
    await prisma.interactionLog.create({
      data: {
        userId,
        action,
        urn,
        reactionType,
        text: text ? String(text).trim().slice(0, 300) : null,
        draftId: linkedDraftId,
      },
    });
  } catch (e) {
    console.error("[interactions] journal non écrit :", e.message);
  }
}

// Résumé pour l'écran Statistiques : totaux sur 30 jours, par brouillon, récentes.
export function summarizeInteractions(rows, now = Date.now()) {
  const since = now - 30 * 86400000;
  const recent30 = rows.filter((r) => new Date(r.createdAt).getTime() >= since);
  const byDraft = {};
  for (const r of rows) {
    if (!r.draftId) continue;
    const b = (byDraft[r.draftId] ??= { comments: 0, reactions: 0 });
    if (r.action === "comment") b.comments++;
    else b.reactions++;
  }
  const byReaction = {};
  for (const r of recent30) if (r.action === "react") byReaction[r.reactionType ?? "LIKE"] = (byReaction[r.reactionType ?? "LIKE"] ?? 0) + 1;
  return {
    totals: {
      comments30: recent30.filter((r) => r.action === "comment").length,
      reactions30: recent30.filter((r) => r.action === "react").length,
      posts30: new Set(recent30.map((r) => r.urn)).size,
      total: rows.length,
      byReaction,
    },
    byDraft,
    recent: rows.slice(0, 25).map((r) => ({
      id: r.id,
      action: r.action,
      urn: r.urn,
      reactionType: r.reactionType,
      text: r.text,
      draftId: r.draftId,
      createdAt: r.createdAt,
    })),
  };
}
