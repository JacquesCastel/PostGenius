import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkPostQuota, checkAccess } from "@/lib/gating";
import { renderPostTemplate } from "@/lib/templates";
import { saveImage } from "@/lib/image";

const DEFAULT_KIT = {
  primaryColor:   "#0a66c2",
  secondaryColor: "#ffffff",
  accentColor:    "#ff5a5f",
  logoUrl:        null,
  fontFamily:     "Inter",
  bgStyle:        "solid",
  tagline:        null,
};

/**
 * Génère un visuel de gabarit et l'attache au draft — en arrière-plan (fire & forget).
 * Appelé uniquement si l'utilisateur a une BrandKit configurée.
 */
async function attachTemplateImage(draftId, userId, text) {
  try {
    const kitRow = await prisma.brandKit.findUnique({ where: { userId } });
    if (!kitRow) return; // Pas de charte → pas de génération auto

    const kit = { ...DEFAULT_KIT, ...kitRow };
    if (kit.logoUrl?.startsWith("/")) {
      const base = process.env.APP_URL ?? "http://localhost:3000";
      kit.logoUrl = `${base}${kit.logoUrl}`;
    }

    const png = await renderPostTemplate({ text, brandKit: kit });
    const { url } = await saveImage(png.toString("base64"));

    await prisma.draft.update({
      where: { id: draftId },
      data: { imageUrl: url },
    });
  } catch {
    // Non bloquant — on ne remonte pas l'erreur
  }
}

// Brouillons de l'utilisateur connecté

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const drafts = await prisma.draft.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    drafts: drafts.map((d) => ({ ...d, extra: d.extra ? JSON.parse(d.extra) : null })),
  });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { type, theme, expertise, tone, maxChars, text, extra, inspirationUrl, imageUrl, imagePrompt } =
    await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });

  const quota = await checkPostQuota(userId);
  if (!quota.ok) return NextResponse.json({ error: quota.error }, { status: 403 });

  const draft = await prisma.draft.create({
    data: {
      userId,
      type: type ?? "simple",
      theme: theme ?? "",
      expertise: expertise ?? "",
      tone: tone ?? "",
      maxChars: maxChars ?? 3000,
      text,
      extra: extra ? JSON.stringify(extra) : null,
      inspirationUrl: inspirationUrl || null,
      imageUrl: imageUrl || null,
      imagePrompt: imagePrompt || null,
    },
  });

  // Génération auto du visuel de gabarit (fire & forget — uniquement si imageUrl non fournie et BrandKit existe)
  if (!imageUrl && (type === "simple" || !type)) {
    attachTemplateImage(draft.id, userId, text).catch(() => {});
  }

  return NextResponse.json({ draft: { ...draft, extra: extra ?? null } });
}
