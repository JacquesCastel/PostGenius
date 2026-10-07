import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { logUsage } from "@/lib/usage";
import { companionTurn, STAGE_FIELDS, MAX_ANSWER_CHARS } from "@/lib/profileCompanion";

export const maxDuration = 60;

// Compagnon du profil : une réponse du client → la question suivante et des valeurs PROPOSÉES pour les
// champs de l'étape. Rien n'est enregistré ici : le client applique les propositions à son formulaire
// et décide d'enregistrer. Sans état côté serveur : l'historique de l'interview voyage avec la requête.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Compagnon indisponible : clé IA manquante sur le serveur." }, { status: 500 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`profile-companion:${userId}`, { limit: 40, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de messages pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const fields = STAGE_FIELDS[body.stage];
  if (!fields) return NextResponse.json({ error: "Étape inconnue." }, { status: 400 });

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.replace(/\s+/g, " ").trim() }));
  const last = history[history.length - 1];
  if (!last || last.role !== "user") return NextResponse.json({ error: "Message requis." }, { status: 400 });
  if (last.content.length > MAX_ANSWER_CHARS) return NextResponse.json({ error: `Réponse trop longue (${MAX_ANSWER_CHARS} caractères maximum).` }, { status: 400 });

  // Valeurs actuelles du formulaire (non enregistrées comprises), limitées aux champs de l'étape
  const values = {};
  for (const k of Object.keys(fields)) if (typeof body.values?.[k] === "string") values[k] = body.values[k].slice(0, 600);

  try {
    const out = await companionTurn({ stage: body.stage, history, values });
    logUsage(userId, { context: "compagnon du profil", inputTokens: out.usage?.input_tokens ?? 0, outputTokens: out.usage?.output_tokens ?? 0 });
    return NextResponse.json({ reply: out.reply, proposals: out.proposals, done: out.done });
  } catch (e) {
    console.error("Erreur compagnon du profil:", e.message);
    return NextResponse.json({ error: "Le compagnon n'a pas pu répondre. Réessayez dans un instant." }, { status: 502 });
  }
}
