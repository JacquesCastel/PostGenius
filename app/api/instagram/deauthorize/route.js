import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Callback de déauthorisation Instagram (Business Login for Instagram).
// Meta appelle cette URL quand un utilisateur retire les permissions de l'app.
// Payload signé HMAC-SHA256 avec l'App Secret.

export async function POST(req) {
  try {
    const body = await req.text();
    // On supprime simplement le compte Instagram associé (si trouvé par igUserId)
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");
    if (signedRequest) {
      const [, payloadB64] = signedRequest.split(".");
      const payload = JSON.parse(
        Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );
      const igUserId = String(payload.user_id ?? payload.instagram_user_id ?? "");
      if (igUserId) {
        await prisma.instagramAccount.deleteMany({ where: { igUserId } });
      }
    }
  } catch (e) {
    console.error("Erreur deauthorize Instagram:", e.message);
  }
  return NextResponse.json({ ok: true });
}
