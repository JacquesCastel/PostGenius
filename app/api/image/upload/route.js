import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";
import { checkAccess } from "@/lib/gating";

// Enregistre une image importée/retouchée par le client (import ou édition
// crop/filtre côté navigateur, toujours exportée en PNG). Contrairement à
// /api/image/generate, ne consomme pas le quota d'images IA — pas de coût
// OpenAI ici, juste un stockage.

const MAX_BASE64_LENGTH = 12_000_000; // ~9 Mo décodé

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });

  let image;
  try {
    ({ image } = await req.json());
  } catch {
    return NextResponse.json({ error: "Image illisible (trop lourde pour être envoyée ?). Réduisez-la et réessayez." }, { status: 413 });
  }
  if (typeof image !== "string" || !image.startsWith("data:image/png")) {
    return NextResponse.json({ error: "Image invalide (PNG attendu)." }, { status: 400 });
  }
  const b64 = image.split(",")[1] || "";
  if (!b64 || b64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image trop lourde." }, { status: 413 });
  }

  try {
    const { url } = await saveImage(b64);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Erreur upload image:", e.code ?? "", e.message);
    return NextResponse.json({ error: e.code === "ENOSPC" ? "Le disque du serveur est plein : l'image n'a pas pu être enregistrée. Contactez le support." : ["EACCES", "ENOENT", "ENOTDIR", "EROFS"].includes(e.code) ? "Le stockage des images est indisponible (dossier non accessible en écriture). Contactez le support." : "Échec de l'enregistrement de l'image." }, { status: 500 });
  }
}
