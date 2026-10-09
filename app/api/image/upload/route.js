import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";
import { checkAccess } from "@/lib/gating";

// Enregistre une image importée/retouchée par le client (import ou édition
// crop/filtre côté navigateur, toujours exportée en PNG). Contrairement à
// /api/image/generate, ne consomme pas le quota d'images IA — pas de coût
// OpenAI ici, juste un stockage.

// Plafond de la requête (le serveur réduit ensuite l'image) : 22 M de caractères base64 ≈ 16 Mo décodés, sous les 25 Mo de corps acceptés.
const MAX_BASE64_LENGTH = 22_000_000;
const MAX_SIDE = 2048; // plus grand côté conservé ; au-delà l'image est réduite
const MAX_KEEP_BYTES = 4_000_000; // une image plus lourde est ré-encodée même si elle est petite en pixels

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
    // Une photo exportée en PNG pèse très vite plusieurs Mo : on la réduit ici (plus grand côté 2048 px), quelle que soit la version de la page ouverte
    let data = Buffer.from(b64, "base64");
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(data).metadata();
      if ((meta.width ?? 0) > MAX_SIDE || (meta.height ?? 0) > MAX_SIDE || data.length > MAX_KEEP_BYTES) {
        data = await sharp(data).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9, palette: false }).toBuffer();
      }
    } catch (e) {
      // sharp indisponible ou image non décodable : on enregistre telle quelle (sous la limite ci-dessus)
      console.error("Réduction de l'image impossible :", e.message);
    }
    const { url } = await saveImage(data);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Erreur upload image:", e.code ?? "", e.message);
    return NextResponse.json({ error: e.code === "ENOSPC" ? "Le disque du serveur est plein : l'image n'a pas pu être enregistrée. Contactez le support." : ["EACCES", "ENOENT", "ENOTDIR", "EROFS"].includes(e.code) ? "Le stockage des images est indisponible (dossier non accessible en écriture). Contactez le support." : "Échec de l'enregistrement de l'image." }, { status: 500 });
  }
}
