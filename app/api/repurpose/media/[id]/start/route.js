import { NextResponse } from "next/server";
import { mediaUser, mediaFail } from "@/lib/mediaHttp";
import { startJob } from "@/lib/mediaJobs";

// Le fichier est arrivé en entier : lance l'extraction de l'audio et la transcription, en arrière-plan.
export const maxDuration = 30;
export async function POST(req, { params }) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  const { id } = await params;
  try { return NextResponse.json(await startJob(g.userId, id)); } catch (e) { return mediaFail(e); }
}
