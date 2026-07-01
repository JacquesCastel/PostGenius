import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { publishToInstagram } from "@/lib/publish-instagram";

// Publie un post (ou un brouillon existant) sur Instagram.
// Body : { draftId } OU { text, imageUrl }

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let text, imageUrl, draftId;
  try {
    ({ text, imageUrl, draftId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Si on reçoit un draftId, on récupère le post depuis la base
  if (draftId) {
    const draft = await prisma.draft.findUnique({ where: { id: draftId, userId } });
    if (!draft) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
    text = draft.text;
    imageUrl = draft.imageUrl;
  }

  try {
    const { igPostId } = await publishToInstagram(userId, { text, imageUrl });

    // Mise à jour du brouillon si on en avait un
    if (draftId) {
      await prisma.draft.update({
        where: { id: draftId },
        data: { igPostId, igStatus: "published" },
      });
    }

    return NextResponse.json({ ok: true, igPostId });
  } catch (e) {
    console.error("Erreur publication Instagram:", e.message);

    if (draftId) {
      await prisma.draft.update({
        where: { id: draftId },
        data: { igStatus: "error" },
      }).catch(() => {});
    }

    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
