import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sendMail, isMailerConfigured } from "@/lib/mailer";
import { EMAIL_TESTS, LIVE_TESTS, buildLiveTest } from "@/lib/emailTests";
import { rateLimit } from "@/lib/ratelimit";

// POST { id } — envoie un message d'exemple À L'ADRESSE DE L'ADMINISTRATEUR UNIQUEMENT (jamais à un autre compte, rien n'est enregistré).
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (!rateLimit(`email-test:${admin.id}`, { limit: 30, windowMs: 3600_000 })) return NextResponse.json({ error: "Trop d'envois de test sur la dernière heure." }, { status: 429 });
  const { id, userId } = await req.json().catch(() => ({}));
  const live = LIVE_TESTS.some((t) => t.id === id);
  const test = EMAIL_TESTS.find((t) => t.id === id);
  if (!test && !live) return NextResponse.json({ error: "Message inconnu." }, { status: 400 });
  if (!isMailerConfigured()) return NextResponse.json({ error: "L'envoi d'e-mails n'est pas configuré sur le serveur (SMTP_HOST absent).", code: "smtp" }, { status: 503 });
  let mail, note = null;
  if (live) {
    if (!userId && !LIVE_TESTS.find((t) => t.id === id)?.needs?.startsWith("aucun")) return NextResponse.json({ error: "Choisissez un compte." }, { status: 400 });
    const r = await buildLiveTest(id, userId ? String(userId) : null, admin);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 422 });
    ({ mail, note } = r);
  } else {
    mail = test.build({ id: admin.id, email: admin.email, name: admin.name });
  }
  try {
    const ok = await sendMail({ kind: "test", to: admin.email, ...mail, subject: `[TEST] ${mail.subject}` });
    if (!ok) return NextResponse.json({ error: "Message non envoyé." }, { status: 502 });
    return NextResponse.json({ ok: true, to: admin.email, note });
  } catch (e) {
    // La cause exacte (authentification, expéditeur non vérifié…) aide à corriger la configuration
    console.error("[admin] envoi de test :", e.message);
    return NextResponse.json({ error: `Échec de l'envoi : ${e.message}` }, { status: 502 });
  }
}
