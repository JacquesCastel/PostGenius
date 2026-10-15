import { prisma } from "@/lib/db";
import { validClientUnsubscribe, CLIENT_KINDS } from "@/lib/emailPrefs";
import { emailHtml } from "@/lib/emailLayout";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Client d'une agence : GET ?l=<lien>&k=reminders|report&t=<jeton signé> coupe cet envoi automatique pour ce client (sans connexion).
// POST : même effet, pour la désinscription en un clic des messageries (en-tête List-Unsubscribe-Post).
const LABEL = { reminders: "les relances de validation", report: "le rapport mensuel" };
const page = (title, text, status = 200) =>
  new Response(emailHtml({ title, paragraphs: [text] }), { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

async function handle(req) {
  if (!rateLimit(`unsubc:${clientIp(req)}`, { limit: 20, windowMs: 60_000 })) return page("Trop de requêtes", "Réessayez dans une minute.", 429);
  const sp = new URL(req.url).searchParams;
  const l = sp.get("l"), k = sp.get("k");
  if (!l || !validClientUnsubscribe(l, k, sp.get("t"))) return page("Lien invalide", "Ce lien de désinscription n'est pas valide.", 400);
  const r = await prisma.approvalLink.updateMany({ where: { id: l }, data: { [CLIENT_KINDS[k]]: false } });
  if (!r.count) return page("Lien introuvable", "Ce lien n'existe plus.", 404);
  return page("C'est noté", `Vous ne recevrez plus ${LABEL[k]} par e-mail. Vous pouvez toujours consulter vos posts et votre rapport depuis les liens que votre agence vous a transmis.`);
}

export const GET = handle;
export const POST = handle;
