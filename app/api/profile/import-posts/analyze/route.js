import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { extractPosts, styleStats, MAX_INPUT_CHARS } from "@/lib/postImport";
import { analyzeStyle } from "@/lib/styleAnalysis";

// Analyse des anciens posts de l'utilisateur (export LinkedIn Shares.csv ou posts collés).
// Rien n'est enregistré : la proposition est renvoyée pour validation (voir ../route.js).

const MIN_POSTS = 3;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Analyse indisponible : clé IA manquante sur le serveur." }, { status: 500 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`import-posts:${userId}`, { limit: 5, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'analyses pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  // Les posts sont traités par une IA : le consentement est exigé côté serveur, pas seulement dans l'interface
  if (body.consent !== true) {
    return NextResponse.json({ error: "Confirmez que ces posts sont les vôtres et qu'ils peuvent être analysés par l'IA." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content : "";
  if (content.length > MAX_INPUT_CHARS * 2) return NextResponse.json({ error: "Fichier trop volumineux." }, { status: 413 });

  const posts = extractPosts(content);
  if (posts.length < MIN_POSTS) {
    return NextResponse.json(
      {
        error:
          posts.length === 0
            ? "Aucun post lisible. Importez le fichier Shares.csv de votre export LinkedIn, ou collez vos posts en les séparant par une ligne « --- »."
            : `Seulement ${posts.length} post(s) lisible(s) : il en faut au moins ${MIN_POSTS} pour dégager un style.`,
      },
      { status: 400 }
    );
  }

  try {
    const stats = styleStats(posts);
    const analysis = await analyzeStyle({ userId, posts, stats });
    return NextResponse.json({ count: posts.length, stats, analysis });
  } catch (e) {
    console.error("Erreur analyse de style:", e.message);
    return NextResponse.json({ error: "L'analyse a échoué. Réessayez dans un instant." }, { status: 502 });
  }
}
