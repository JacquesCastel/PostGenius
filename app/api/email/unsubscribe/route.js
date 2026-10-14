import { prisma } from "@/lib/db";
import { validUnsubscribe, unsubscribeUrl } from "@/lib/emailPrefs";
import { emailHtml, escHtml } from "@/lib/emailLayout";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// GET ?u=<compte>&t=<jeton signé> : désinscrit des e-mails d'accompagnement (&resub=1 : réinscrit). Page de confirmation en HTML.
const page = (title, text, status = 200) =>
  new Response(emailHtml({ title, paragraphs: [text] }), { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req) {
  if (!rateLimit(`unsub:${clientIp(req)}`, { limit: 20, windowMs: 60_000 })) return page("Trop de requêtes", "Réessayez dans une minute.", 429);
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u");
  if (!u || !validUnsubscribe(u, sp.get("t"))) return page("Lien invalide", "Ce lien de désinscription n'est pas valide.", 400);
  const resub = sp.get("resub") === "1";
  const r = await prisma.user.updateMany({ where: { id: u }, data: { emailOptOut: !resub } });
  if (!r.count) return page("Compte introuvable", "Ce compte n'existe plus.", 404);
  return resub
    ? page("Vous êtes de nouveau inscrit", "Vous recevrez à nouveau les e-mails d'accompagnement de LinkeePost.")
    : page("Vous êtes désinscrit", `Vous ne recevrez plus les e-mails d'accompagnement (accueil, récapitulatif hebdomadaire). Les e-mails de service restent envoyés : alertes de quota, validations, mot de passe.<br><br><a href="${escHtml(unsubscribeUrl(u))}&resub=1" style="color:#0a66c2">Vous vous êtes trompé ? Se réinscrire</a>`);
}
