import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { publishForUser } from "@/lib/publish";

// Publication manuelle immédiate (bouton « Publier sur LinkedIn »).
// La logique LinkedIn est dans lib/publish.js, partagée avec le cron.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const { text, author, imageUrl } = await req.json();

  try {
    const { postId } = await publishForUser(userId, { text, author, imageUrl });
    return NextResponse.json({ ok: true, postId });
  } catch (e) {
    const msg = e.message || "Échec de la publication.";
    const status = /non connecté|expiré|reconnectez/i.test(msg) ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
