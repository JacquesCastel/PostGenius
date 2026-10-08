import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { deleteElement } from "@/lib/languageStore";
import { KnowledgeError } from "@/lib/knowledge";

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  try {
    await deleteElement(userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
