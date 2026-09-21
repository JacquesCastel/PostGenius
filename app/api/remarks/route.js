import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getRemarks, MAX_REMARKS, MAX_REMARK_LENGTH } from "@/lib/remarks";

// Remarques de l'utilisateur pour ses futurs posts (liste visible, 10 maximum).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  return NextResponse.json({ remarks: await getRemarks(userId), max: MAX_REMARKS });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { text } = await req.json();
  const clean = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!clean) return NextResponse.json({ error: "Remarque vide." }, { status: 400 });
  if (clean.length > MAX_REMARK_LENGTH) {
    return NextResponse.json({ error: `Remarque trop longue (${MAX_REMARK_LENGTH} caractères maximum).` }, { status: 400 });
  }

  const existing = await getRemarks(userId);
  if (existing.some((r) => r.text.toLowerCase() === clean.toLowerCase())) {
    return NextResponse.json({ error: "Cette remarque est déjà enregistrée.", code: "duplicate" }, { status: 409 });
  }
  if (existing.length >= MAX_REMARKS) {
    return NextResponse.json(
      { error: `${MAX_REMARKS} remarques maximum : supprimez-en une dans Profil pour en ajouter une nouvelle.`, code: "limit" },
      { status: 409 }
    );
  }

  const remark = await prisma.postRemark.create({
    data: { userId, text: clean },
    select: { id: true, text: true, createdAt: true },
  });
  return NextResponse.json({ remark });
}
