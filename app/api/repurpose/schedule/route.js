import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, checkPostQuota, limitBody } from "@/lib/gating";
import { scheduleSeries, RepurposeError } from "@/lib/repurpose";

// Seconde vie d'un contenu, étape 3 : crée la campagne et ses posts (à valider ou programmés) sur le rythme de l'auteur.
// JSON { name, theme?, factsText?, mood?, contextId?, needsValidation?, firstComment?, rights, credit?, sourceUrl?, posts: [{ angleTitle, texts: [{ target, text, original }] }] }

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil « Seconde vie d'un contenu »");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  const quota = await checkPostQuota(userId);
  if (!quota.ok) return NextResponse.json(limitBody(quota), { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await scheduleSeries(userId, { name: body.name, theme: body.theme, factsText: body.factsText, mood: body.mood, contextId: body.contextId || null, posts: body.posts, needsValidation: body.needsValidation !== false, firstComment: body.firstComment, rights: body.rights, credit: body.credit, sourceUrl: body.sourceUrl });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof RepurposeError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[repurpose] programmation :", e);
    return NextResponse.json({ error: "Échec de la création de la série." }, { status: 500 });
  }
}
