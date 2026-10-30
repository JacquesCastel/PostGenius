import { NextResponse } from "next/server";
import { getFlags } from "@/lib/opsFlags";

// État public minimal (bandeau de maintenance, inscriptions fermées) : aucune donnée sensible.
export async function GET() {
  const f = await getFlags();
  return NextResponse.json(
    { maintenance: f.maintenance, message: f.maintenance ? f.maintenanceMessage || "Maintenance en cours : certaines fonctions peuvent être indisponibles." : "", signupsClosed: f.signupsClosed, aiOff: f.aiOff },
    { headers: { "Cache-Control": "no-store" } }
  );
}
