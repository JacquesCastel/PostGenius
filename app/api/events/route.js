import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { checkFeature } from "@/lib/gating";

// Événements (salons, forums…) du client

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    include: { drafts: { select: { status: true } } },
  });

  return NextResponse.json({
    events: events.map((e) => {
      const published = e.drafts.filter((d) => d.status === "publié").length;
      return {
        id: e.id,
        name: e.name,
        location: e.location,
        url: e.url,
        imageUrl: e.imageUrl,
        details: e.details,
        startDate: e.startDate,
        endDate: e.endDate,
        postCount: e.drafts.length,
        published,
      };
    }),
  });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "events", "Le module Événements");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { name, location, url, imageUrl, details, startDate, endDate } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom de l'événement requis." }, { status: 400 });
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : start;
  if (!start || isNaN(start)) return NextResponse.json({ error: "Date de début requise." }, { status: 400 });
  if (end && end < start) return NextResponse.json({ error: "La date de fin précède le début." }, { status: 400 });

  const event = await prisma.event.create({
    data: {
      userId,
      name: name.trim(),
      location: location?.trim() || null,
      url: url?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      details: details?.trim() || null,
      startDate: start,
      endDate: end || start,
    },
  });

  return NextResponse.json({ event });
}
