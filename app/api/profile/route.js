import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

const STRING_FIELDS = [
  "name",
  "headline",
  "expertise",
  "themes",
  "tone",
  "styleNotes",
  "website",
  "companyName",
  "businessDescription",
  "targetAudience",
  "market",
  "commGoals",
  "publishDays",
  "publishTime",
];
const INT_FIELDS = { defaultMaxChars: [300, 3000], postsPerWeek: [1, 7] };
const BOOL_FIELDS = ["requireValidation", "autoGenerate"];

const SELECT = Object.fromEntries(
  [...STRING_FIELDS, ...Object.keys(INT_FIELDS), ...BOOL_FIELDS, "onboardedAt", "email", "phylloAccountId"].map(
    (k) => [k, true]
  )
);

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const profile = await prisma.user.findUnique({ where: { id: userId }, select: SELECT });
  return NextResponse.json({ profile });
}

export async function PUT(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = await req.json();
  const data = {};

  for (const key of STRING_FIELDS) {
    if (key in body) data[key] = body[key]?.toString().trim() || null;
  }
  for (const [key, [min, max]] of Object.entries(INT_FIELDS)) {
    if (key in body) {
      data[key] = body[key] ? Math.min(max, Math.max(min, Number(body[key]) || min)) : null;
    }
  }
  for (const key of BOOL_FIELDS) {
    if (key in body) data[key] = Boolean(body[key]);
  }
  // Fin de l'onboarding (wizard de première connexion)
  if (body.onboarded === true) data.onboardedAt = new Date();

  const profile = await prisma.user.update({ where: { id: userId }, data, select: SELECT });
  return NextResponse.json({ profile });
}
