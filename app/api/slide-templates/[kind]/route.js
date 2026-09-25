import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

const KINDS = ["title", "content", "end", "post"];
const MAX_ELEMENTS = 20;
const TEXT_ROLES = ["title", "subtitle", "body", "quote", "cta", "pageNumber", "custom"];
const IMAGE_ROLES = ["logo", "custom"];

// Nettoie un élément reçu de l'éditeur : bornes numériques (le canevas fait
// 1080×1080), types stricts. Renvoie null si l'élément n'est pas exploitable.
function sanitizeElement(el) {
  if (!el || typeof el !== "object") return null;
  const num = (v, def, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
  const base = {
    id: typeof el.id === "string" ? el.id.slice(0, 40) : randomUUID(),
    x: num(el.x, 0, -200, 1080),
    y: num(el.y, 0, -200, 1080),
    width: num(el.width, 200, 10, 1080),
    height: num(el.height, 60, 10, 1080),
  };
  if (el.type === "text" && TEXT_ROLES.includes(el.role)) {
    return {
      ...base,
      type: "text",
      role: el.role,
      fontSize: num(el.fontSize, 32, 8, 160),
      fontWeight: el.fontWeight === 700 ? 700 : 400,
      color: typeof el.color === "string" && /^#[0-9a-fA-F]{6}$/.test(el.color) ? el.color : "#111111",
      textAlign: ["left", "center", "right"].includes(el.textAlign) ? el.textAlign : "left",
      text: el.role === "custom" && typeof el.text === "string" ? el.text.slice(0, 200) : undefined,
    };
  }
  if (el.type === "image" && IMAGE_ROLES.includes(el.role)) {
    return {
      ...base,
      type: "image",
      role: el.role,
      objectFit: el.objectFit === "cover" ? "cover" : "contain",
      src: el.role === "custom" && typeof el.src === "string" ? el.src.slice(0, 500) : undefined,
    };
  }
  return null;
}

// PUT /api/slide-templates/:kind — enregistre (remplace) le modèle personnalisé
// pour ce type de slide.
export async function PUT(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { kind } = await params;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Type de slide invalide." }, { status: 400 });

  const body = await req.json();
  const elements = (Array.isArray(body.elements) ? body.elements : [])
    .slice(0, MAX_ELEMENTS)
    .map(sanitizeElement)
    .filter(Boolean);

  const row = await prisma.slideTemplate.upsert({
    where: { userId_kind: { userId, kind } },
    update: { data: JSON.stringify({ elements }) },
    create: { userId, kind, data: JSON.stringify({ elements }) },
  });

  return NextResponse.json({ template: { elements: JSON.parse(row.data).elements } });
}

// DELETE /api/slide-templates/:kind — revient à la mise en page par défaut.
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { kind } = await params;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Type de slide invalide." }, { status: 400 });

  await prisma.slideTemplate.deleteMany({ where: { userId, kind } });
  return NextResponse.json({ ok: true });
}
