import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ENGAGEMENT_JOBS, recordRun } from "@/lib/engagementEmails";

// POST { job: quota | onboarding | digest | reminders | reports } — lance un envoi tout de suite (administrateur), sans attendre la passe horaire.
// digest et reports ignorent alors le jour et l'heure prévus. Chaque message reste unique : un envoi déjà fait n'est jamais répété.
export async function POST(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { job } = await req.json().catch(() => ({}));
  const fn = ENGAGEMENT_JOBS[job];
  if (!fn) return NextResponse.json({ error: "Envoi inconnu." }, { status: 400 });
  try {
    const result = await fn({ force: true });
    recordRun(job, result);
    return NextResponse.json({ job, result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
