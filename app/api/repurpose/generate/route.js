import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, checkPostQuota, limitBody } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { generateSeries, RepurposeError } from "@/lib/repurpose";

// Seconde vie d'un contenu, étape 2 : un post par angle choisi, écrit à partir des seuls faits cochés. Rien n'est enregistré ici.
// JSON { title, sourceUrl?, facts: [{ id, text }], angles: [{ title, hook, kind }], mood?, contextId?, target? }

export const maxDuration = 300; // un appel IA par post (et par destination)

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil « Seconde vie d'un contenu »");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  const quota = await checkPostQuota(userId);
  if (!quota.ok) return NextResponse.json(limitBody(quota), { status: 403 });
  if (!rateLimit(`repurpose-generate:${userId}`, { limit: 6, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: "Trop de séries à la suite. Réessayez dans quelques minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const target = body.target ?? "person";
  if (target !== "person" && !/^(both:)?urn:li:organization:\d+$/.test(String(target))) return NextResponse.json({ error: "Compte de publication invalide." }, { status: 400 });
  try {
    const posts = await generateSeries(userId, { title: body.title, sourceUrl: /^https?:\/\//i.test(String(body.sourceUrl ?? "")) ? body.sourceUrl : null, facts: body.facts, angles: body.angles, mood: body.mood, contextId: body.contextId || null, target });
    return NextResponse.json({ posts });
  } catch (e) {
    if (e instanceof RepurposeError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[repurpose] génération :", e);
    return NextResponse.json({ error: "Échec de l'écriture des posts. Réessayez." }, { status: 500 });
  }
}
