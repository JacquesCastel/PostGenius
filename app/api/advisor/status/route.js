import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/session";
import { advisorAccessFor } from "@/lib/advisorAccess";

// Le conseiller éditorial est-il disponible pour CE compte ? (interrupteur serveur EDITORIAL_ADVISOR=1, puis périmètre choisi dans l'Administration)
export async function GET(req) {
  let enabled = false;
  try {
    const userId = await getEffectiveUserId(req);
    enabled = userId ? await advisorAccessFor(userId) : false;
  } catch {}
  return NextResponse.json({ enabled }, { headers: { "cache-control": "no-store" } });
}
