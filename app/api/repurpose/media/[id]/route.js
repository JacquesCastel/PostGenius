import { NextResponse } from "next/server";
import { mediaUser, mediaFail } from "@/lib/mediaHttp";
import { getJob, deleteJob } from "@/lib/mediaJobs";

// GET : avancement (et transcription une fois terminée). DELETE : annule et efface le fichier et la transcription.
export async function GET(req, { params }) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  const { id } = await params;
  try { return NextResponse.json(await getJob(g.userId, id)); } catch (e) { return mediaFail(e); }
}

export async function DELETE(req, { params }) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  const { id } = await params;
  try { await deleteJob(g.userId, id); return NextResponse.json({ ok: true }); } catch (e) { return mediaFail(e); }
}
