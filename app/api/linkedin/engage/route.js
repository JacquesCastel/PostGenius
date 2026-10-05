import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { withDetail } from "@/lib/linkedinError";
import { sendComment, sendReaction } from "@/lib/linkedinSocial";
import { logInteraction } from "@/lib/interactions";
import { rateLimit } from "@/lib/ratelimit";
import { parsePostUrn, REACTION_TYPES } from "@/lib/linkedinPost";

// Réagir ou commenter sur N'IMPORTE QUEL post LinkedIn (le vôtre ou celui d'un autre),
// au nom du profil personnel connecté. Écriture seule (w_member_social) : l'outil ne
// peut pas LIRE le post ni ses commentaires. Chaque action est déclenchée par
// l'utilisateur ; plafonds horaires pour ne pas faire signaler le compte comme spam.
//   POST { post, action: "comment", text }  |  { post, action: "react", reactionType }
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/reactions-api

const HOUR = 3600_000;
const LIMITS = { comment: 15, react: 40 };

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { post, action, text, reactionType } = await req.json().catch(() => ({}));
  if (action !== "comment" && action !== "react") {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
  const parsed = parsePostUrn(post);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const urn = parsed.urn;

  if (action === "comment") {
    if (!text?.trim()) return NextResponse.json({ error: "Écrivez le commentaire." }, { status: 400 });
    if (text.trim().length > 1250) return NextResponse.json({ error: "Commentaire trop long (1250 caractères maximum)." }, { status: 400 });
  } else if (!REACTION_TYPES.includes(reactionType)) {
    return NextResponse.json({ error: "Type de réaction inconnu." }, { status: 400 });
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.personToken);
  if (!token || !acc?.personSub) return NextResponse.json({ error: "Compte LinkedIn non connecté." }, { status: 401 });
  if (acc.personExpiresAt && acc.personExpiresAt < new Date()) {
    return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez votre compte (onglet Profil)." }, { status: 401 });
  }
  const actor = `urn:li:person:${acc.personSub}`;

  if (!rateLimit(`engage:${action}:${userId}`, { limit: LIMITS[action], windowMs: HOUR })) {
    return NextResponse.json(
      {
        error:
          action === "comment"
            ? `Limite atteinte : ${LIMITS.comment} commentaires par heure, pour éviter que LinkedIn ne signale votre compte. Réessayez plus tard.`
            : `Limite atteinte : ${LIMITS.react} réactions par heure, pour éviter que LinkedIn ne signale votre compte. Réessayez plus tard.`,
      },
      { status: 429 }
    );
  }

  try {
    const { res, via, unsupported } =
      action === "comment"
        ? await sendComment({ token, actor, urn, text: text.trim() })
        : await sendReaction({ token, actor, urn, reactionType });
    if (via === "v2" && res.ok) console.log(`[linkedin] ${action} envoyé par l'ancienne API v2 (l'API versionnée exige la Community Management API)`);

    if (!res.ok) {
      const raw = await res.text();
      console.error(`LinkedIn ${action} (${via}):`, res.status, raw);
      if (unsupported) {
        return NextResponse.json(
          { error: withDetail("Avec cette application LinkedIn, seule la réaction « J'aime » est disponible (les autres réactions exigent la Community Management API).", raw) },
          { status: 403 }
        );
      }
      if (res.status === 401) return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez votre compte." }, { status: 401 });
      if (res.status === 403) return NextResponse.json({ error: withDetail("LinkedIn refuse cette action (403) : post privé ou inaccessible, ou permission manquante.", raw) }, { status: 403 });
      if (res.status === 404) return NextResponse.json({ error: withDetail("Post introuvable (404). Vérifiez l'adresse, ou que le post est public.", raw) }, { status: 404 });
      if (res.status === 429) return NextResponse.json({ error: "LinkedIn demande de ralentir. Réessayez dans quelques minutes." }, { status: 429 });
      if (res.status === 409 || res.status === 422) return NextResponse.json({ error: withDetail(action === "react" ? `Vous avez déjà réagi à ce post, ou LinkedIn refuse cette réaction (${res.status}).` : `LinkedIn a refusé ce commentaire (${res.status}) : doublon ou contenu non accepté.`, raw) }, { status: 409 });
      return NextResponse.json({ error: withDetail(`LinkedIn a refusé la demande (${res.status}).`, raw) }, { status: 502 });
    }
    await logInteraction(prisma, {
      userId,
      action,
      urn,
      reactionType: action === "react" ? reactionType : null,
      text: action === "comment" ? text : null,
    });
    return NextResponse.json({ ok: true, urn });
  } catch (e) {
    console.error("Erreur interaction LinkedIn:", e);
    return NextResponse.json({ error: "Échec de l'envoi à LinkedIn." }, { status: 500 });
  }
}
