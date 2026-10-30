import { NextResponse } from "next/server";
import { getEffectiveUserId } from "./session";
import { checkAccess, checkFeature, limitBody } from "./gating";
import { MediaError } from "./mediaJobs";

// Garde commune des routes de vidéo et d'audio : connecté, accès actif, offre Pro ou Agence (comme « Seconde vie d'un contenu »)
export async function mediaUser(req) {
  const userId = await getEffectiveUserId(req);
  if (!userId) return { res: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  const access = await checkAccess(userId);
  if (!access.ok) return { res: NextResponse.json({ error: access.error, code: access.code }, { status: 403 }) };
  const feat = await checkFeature(userId, "campaigns", "L'outil « Seconde vie d'un contenu »");
  if (!feat.ok) return { res: NextResponse.json(limitBody(feat), { status: 403 }) };
  return { userId };
}

export function mediaFail(e) {
  if (e instanceof MediaError) {
    const body = { error: e.message, ...(e.extra?.receivedBytes !== undefined ? { receivedBytes: e.extra.receivedBytes } : {}) };
    if (e.extra?.quota) Object.assign(body, limitBody(e.extra.quota));
    return NextResponse.json(body, { status: e.status });
  }
  console.error("[media]", e);
  return NextResponse.json({ error: "Une erreur est survenue. Réessayez." }, { status: 500 });
}
