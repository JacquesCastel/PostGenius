import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/ratelimit";
import { setFlags } from "@/lib/opsFlags";
import { memoClear } from "@/lib/memoCache";
import { runDuePublications } from "@/lib/scheduler";

// Actions du super-admin. Liste blanche : rien d'autre n'est exécutable. Chaque action est tracée dans AdminAction (réussie ou refusée).
// « password: true » = l'action change le comportement du service pour tout le monde (ou verrouille un compte) : le mot de passe est redemandé.
const ACTIONS = {
  "flag.signups": { password: true, label: "Inscriptions", run: (b) => setFlags({ signupsClosed: b.value === true }) },
  "flag.ai": { password: true, label: "IA", run: (b) => setFlags({ aiOff: b.value === true }) },
  "flag.maintenance": { password: true, label: "Maintenance", run: (b) => setFlags({ maintenance: b.value === true, maintenanceMessage: b.message ?? "" }) },
  "account.suspend": { password: true, label: "Suspension", run: (b, admin) => setDisabled(b.email, true, admin) },
  "account.reactivate": { password: true, label: "Réactivation", run: (b, admin) => setDisabled(b.email, false, admin) },
  "cache.clear": { password: false, label: "Cache vidé", run: async () => { memoClear(); return { cleared: true }; } },
  "scheduler.run": { password: false, label: "Planificateur lancé", run: async () => runDuePublications() },
};

async function setDisabled(email, disabled, admin) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e.includes("@")) throw new Error("Adresse e-mail invalide.");
  const user = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
  if (!user) throw new Error("Aucun compte avec cette adresse.");
  if (user.id === admin.id) throw new Error("Impossible de suspendre votre propre compte.");
  await prisma.user.update({ where: { id: user.id }, data: { disabled } });
  return { email: e, disabled };
}

export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (!rateLimit(`tech-action:${admin.id}`, { limit: Number(process.env.TECH_ACTION_LIMIT) || 10, windowMs: 60_000 })) return NextResponse.json({ error: "Trop d'actions à la suite. Réessayez dans une minute." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const def = ACTIONS[body.action];
  if (!def) return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  const audit = (ok, detail) => prisma.adminAction.create({ data: { adminId: admin.id, adminEmail: admin.email, action: body.action, ok, detail } }).catch(() => {});

  if (def.password) {
    // Mots de passe essayés au hasard : 5 essais par minute au plus
    if (!rateLimit(`tech-pw:${admin.id}`, { limit: Number(process.env.TECH_PW_LIMIT) || 5, windowMs: 60_000 })) return NextResponse.json({ error: "Trop d'essais. Réessayez dans une minute." }, { status: 429 });
    if (!(await bcrypt.compare(String(body.password ?? ""), admin.password))) {
      await audit(false, { reason: "mot de passe incorrect" });
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }
  }
  try {
    const result = await def.run(body, admin);
    await audit(true, { params: { value: body.value, email: body.email, message: body.message }, result: typeof result === "object" ? result : undefined });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    await audit(false, { error: String(e?.message ?? e).slice(0, 200) });
    return NextResponse.json({ error: e?.message ?? "Action impossible." }, { status: 400 });
  }
}
