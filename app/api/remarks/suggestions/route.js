import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getPendingSuggestions, refreshSuggestions } from "@/lib/remarkSuggestions";

// Suggestions de remarques déduites des modifications de l'utilisateur. L'analyse ne se
// relance que si de nouveaux posts modifiés le justifient ; en cas d'échec on renvoie
// simplement les suggestions déjà connues.
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  try {
    await refreshSuggestions(userId);
  } catch (e) {
    console.error("Suggestions de remarques :", e.message);
  }
  return NextResponse.json({ suggestions: await getPendingSuggestions(userId) });
}
