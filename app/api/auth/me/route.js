import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { isAdminUser } from "@/lib/admin";

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true, disabled: true },
  });
  if (!user || user.disabled) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { email: user.email, name: user.name, isAdmin: isAdminUser(user) },
  });
}
