import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getRemarks, addRemark, MAX_REMARKS } from "@/lib/remarks";

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
  const result = await addRemark(userId, text);
  if (result.error) {
    return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  }
  return NextResponse.json({ remark: result.remark });
}
