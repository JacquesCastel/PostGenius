import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isMailerConfigured } from "@/lib/mailer";
import { previewMonthlyReports } from "@/lib/reportsPreview";

// GET — prévisualisation des rapports mensuels des clients d'agence : qui recevra quoi, et pourquoi certains ne recevront rien (administrateur).
// N'envoie rien.
export async function GET(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  try {
    return NextResponse.json({ smtp: isMailerConfigured(), ...(await previewMonthlyReports()) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
