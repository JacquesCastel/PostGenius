import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySignedRequest, SignedRequestError } from "@/lib/instagramSignedRequest";

// Appelée par Meta quand un compte retire l'application (désautorisation).
// La requête est SIGNÉE par Meta (HMAC-SHA256 avec le secret de l'application) : sans signature valide, rien n'est supprimé.
// Avant cette vérification, n'importe qui connaissant l'identifiant Instagram d'un compte pouvait en détruire la liaison.
export async function POST(req) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) {
    console.error("[instagram] désautorisation refusée : INSTAGRAM_APP_SECRET absent, la signature de Meta ne peut pas être vérifiée.");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }
  let payload;
  try {
    const params = new URLSearchParams(await req.text());
    payload = verifySignedRequest(params.get("signed_request"), secret);
  } catch (e) {
    if (!(e instanceof SignedRequestError)) console.error("Erreur deauthorize Instagram:", e?.message);
    return NextResponse.json({ error: "Requête non valide." }, { status: 400 });
  }
  const igUserId = String(payload.user_id ?? payload.instagram_user_id ?? "");
  if (igUserId) {
    try {
      await prisma.instagramAccount.deleteMany({ where: { igUserId } });
    } catch (e) {
      console.error("Erreur deauthorize Instagram:", e.message);
    }
  }
  return NextResponse.json({ ok: true });
}
