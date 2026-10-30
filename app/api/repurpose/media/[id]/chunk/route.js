import { NextResponse } from "next/server";
import { mediaUser, mediaFail } from "@/lib/mediaHttp";
import { appendChunk } from "@/lib/mediaJobs";
import { rateLimit } from "@/lib/ratelimit";

// Un morceau du fichier (corps brut, 8 Mo au plus), à l'emplacement `?offset=` ; reçus dans l'ordre.
export async function POST(req, { params }) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  if (!rateLimit(`repurpose-media-chunk:${g.userId}`, { limit: Number(process.env.MEDIA_CHUNK_LIMIT) || 300, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'envois : réessayez dans quelques minutes." }, { status: 429 });
  }
  const { id } = await params;
  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    return NextResponse.json(await appendChunk(g.userId, id, new URL(req.url).searchParams.get("offset"), buffer));
  } catch (e) { return mediaFail(e); }
}
