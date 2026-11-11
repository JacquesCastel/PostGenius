import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getRemarks } from "@/lib/remarks";
import { elementsFor } from "@/lib/languageStore";
import { getContextFor } from "@/lib/contexts";
import { overlayProfile } from "@/lib/contextOverlay";
import { normalizeLanguage } from "@/lib/languages";
import { deriveConsigneRules } from "@/lib/consigneRules";

// Consignes de l'utilisateur que le code sait contrôler sur un post libre (zéro émoji, nombre maximal de hashtags, mots à éviter,
// longueur maximale, tutoiement ou vouvoiement). Lecture seule, aucun appel à l'IA. Route distincte de /api/generate : le moteur d'écriture
// n'est pas touché. Le navigateur applique ces règles au texte affiché (lib/consigneRules.js) ; rien n'est modifié ni régénéré.
// Corps : { contextId?, language?, maxChars?, publishAs? } (mêmes valeurs que la génération ; publishAs : { kind: "person" | "org" }).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  let params = {};
  try { params = await req.json(); } catch {}

  let profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      headline: true, styleNotes: true, companyName: true, brandVoice: true, editorialLine: true, businessDescription: true,
      targetAudience: true, market: true, commGoals: true, postLanguage: true,
    },
  });
  let ctx = null;
  if (typeof params.contextId === "string" && params.contextId) {
    ctx = await getContextFor(userId, params.contextId);
    if (!ctx) return NextResponse.json({ error: "Thématique introuvable." }, { status: 400 });
    profile = overlayProfile(profile, ctx);
  }
  const [remarks, elements] = await Promise.all([getRemarks(userId), elementsFor(userId, ctx?.id ?? null)]);
  const language = normalizeLanguage(params.language ?? profile?.postLanguage);
  // Post publié sur une page entreprise : la voix de la marque est lue AVANT les consignes personnelles et l'emporte pour le tutoiement ou
  // le vouvoiement (le prompt la transmet « à respecter impérativement », lib/publishVoice.js). Pour un post de profil, elle n'est pas lue.
  const org = params.publishAs?.kind === "org";
  const rules = deriveConsigneRules({
    orgVoice: org,
    sources: [
      ...(org ? [{ origin: "Voix de la marque", text: profile?.brandVoice, authority: true }] : []),
      { origin: "Consignes de style", text: profile?.styleNotes },
      { origin: "Ligne éditoriale", text: profile?.editorialLine },
      ...(remarks ?? []).map((r) => ({ origin: "Remarque", text: r.text })),
    ],
    avoid: elements.filter((e) => e.kind === "avoid").map((e) => e.text),
    maxChars: params.maxChars,
    language,
  });
  return NextResponse.json({ rules });
}
