import { NextResponse } from "next/server";
import { advisorEnabled } from "@/lib/advisorFlag";

// Le conseiller éditorial est-il actif sur ce serveur ? (interrupteur de développement : EDITORIAL_ADVISOR=1)
export async function GET() {
  return NextResponse.json({ enabled: advisorEnabled() }, { headers: { "cache-control": "no-store" } });
}
