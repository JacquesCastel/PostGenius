import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { parseOrgRef } from "@/lib/mentions";

// Pages LinkedIn mentionnables dans un post : les siennes, celles déjà utilisées (GET), et ajout d'une page par son adresse,
// son nom court ou son identifiant (POST). Les personnes ne sont pas mentionnables par l'application (voir lib/mentions.js).

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
const MAX_SAVED = 100;

async function ownPages(userId) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgAccounts: true } }).catch(() => null);
  try {
    return JSON.parse(acc?.orgAccounts ?? "[]").filter((o) => /^urn:li:organization:\d+$/.test(o.urn) && o.name).map((o) => ({ name: o.name, urn: o.urn }));
  } catch {
    return [];
  }
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const [own, saved] = await Promise.all([ownPages(userId), prisma.savedMention.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: MAX_SAVED, select: { id: true, name: true, urn: true } })]);
  const ownUrns = new Set(own.map((o) => o.urn));
  return NextResponse.json({ own, saved: saved.filter((s) => !ownUrns.has(s.urn)) });
}

async function lookup(userId, ref) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken) || decryptToken(acc?.personToken);
  if (!token) return { error: "no_token" };
  const headers = { Authorization: `Bearer ${token}`, "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604", "X-Restli-Protocol-Version": "2.0.0" };
  try {
    const url = ref.id ? `${LI_API}/rest/organizations/${ref.id}` : `${LI_API}/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(ref.vanity)}`;
    const res = await fetch(url, { headers });
    if (res.status === 401 || res.status === 403) return { error: "forbidden" };
    if (res.status === 404) return { error: "not_found" };
    if (!res.ok) return { error: "failed" };
    const d = await res.json();
    const org = ref.id ? d : d.elements?.[0];
    if (!org?.id || !(org.localizedName || org.name)) return { error: "not_found" };
    return { id: String(org.id), name: String(org.localizedName ?? org.name) };
  } catch {
    return { error: "failed" };
  }
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ref = parseOrgRef(body.input);
  if (!ref && /linkedin\.com\/(in|pub)\//i.test(String(body.input ?? ""))) return NextResponse.json({ error: "Les personnes ne peuvent pas être mentionnées depuis LinkeePost : seules les pages (linkedin.com/company/…) le peuvent. Taguez la personne à la main après publication." }, { status: 400 });
  if (!ref) return NextResponse.json({ error: "Collez l'adresse de la page LinkedIn (https://www.linkedin.com/company/…), son nom court ou son identifiant." }, { status: 400 });
  const typedName = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

  let id = ref.id ?? null;
  let name = typedName;
  // Identifiant + nom fournis : rien à chercher chez LinkedIn
  if (!(id && name)) {
    const found = await lookup(userId, ref);
    if (found.error) {
      const msg = found.error === "not_found" ? "Page LinkedIn introuvable : vérifiez l'adresse."
        : found.error === "no_token" ? "Connectez d'abord votre compte LinkedIn pour retrouver une page."
        : "LinkedIn ne permet pas à l'application de retrouver cette page automatiquement. Indiquez son identifiant numérique (le nombre dans l'adresse d'administration de la page : linkedin.com/company/NOMBRE/admin) et son nom exact.";
      return NextResponse.json({ error: msg, code: found.error === "not_found" ? "not_found" : "manual" }, { status: found.error === "not_found" ? 404 : 422 });
    }
    id = found.id;
    name = typedName || found.name;
  }
  const urn = `urn:li:organization:${id}`;
  if ((await prisma.savedMention.count({ where: { userId } })) >= MAX_SAVED) return NextResponse.json({ error: "Trop de pages enregistrées : supprimez-en." }, { status: 400 });
  const saved = await prisma.savedMention.upsert({ where: { userId_urn: { userId, urn } }, create: { userId, urn, name }, update: { name }, select: { id: true, name: true, urn: true } });
  return NextResponse.json({ mention: saved });
}
