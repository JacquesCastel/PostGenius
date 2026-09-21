import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { respondToSuggestion } from "@/lib/remarkSuggestions";

// body : { action: "accept" | "dismiss" }
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { action } = await req.json();
  const result = await respondToSuggestion(userId, id, action);
  if (result.error) {
    return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  }
  return NextResponse.json(result);
}
