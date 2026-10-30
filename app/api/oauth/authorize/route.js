import { NextResponse } from "next/server";
import { getSessionData } from "@/lib/session";
import { prisma } from "@/lib/db";
import { checkFeature } from "@/lib/gating";
import { findClient, approve, subjectsFor, OAuthError, APP } from "@/lib/oauth";
import { sendMail } from "@/lib/mailer";
import { assistantConnectedMail } from "@/lib/authEmails";
import { rateLimit } from "@/lib/ratelimit";

// Écran d'autorisation : GET = ce qu'il faut afficher (application, compte connecté, comptes possibles) ; POST = « Autoriser ».
// Les deux exigent que l'adresse de retour soit enregistrée à l'identique. La vue support (lecture seule) ne peut pas autoriser.

const out = (body, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (e) => (e instanceof OAuthError ? out({ error: e.code, message: e.message }, e.status) : (console.error("[oauth/authorize]", e), out({ error: "server_error", message: "Erreur interne." }, 500)));

async function sessionUser(req) {
  const s = await getSessionData(req);
  if (!s?.userId || s.support) return null;
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, name: true, disabled: true } });
  return u && !u.disabled ? u : null;
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  try {
    const client = await findClient(q.get("client_id"), q.get("redirect_uri"));
    const host = (() => { const u = new URL(q.get("redirect_uri")); return u.host || u.protocol; })();
    const base = { client: { name: client.name, host } };
    const user = await sessionUser(req);
    if (!user) return out({ ...base, needLogin: true });
    const feat = await checkFeature(user.id, "campaigns", "L'accès par assistant (MCP)");
    return out({ ...base, user: { email: user.email, name: user.name }, allowed: feat.ok, lockedMessage: feat.ok ? null : feat.error, subjects: feat.ok ? await subjectsFor(user.id) : [] });
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    const origin = req.headers.get("origin");
    if (origin !== new URL(APP()).origin) throw new OAuthError("invalid_request", "Origine refusée.", 403);
    const user = await sessionUser(req);
    if (!user) throw new OAuthError("login_required", "Connectez-vous pour autoriser l'accès.", 401);
    if (!rateLimit(`oauth-approve:${user.id}`, { limit: 20, windowMs: 600_000 })) throw new OAuthError("temporarily_unavailable", "Trop de demandes : réessayez dans quelques minutes.", 429);
    const b = await req.json().catch(() => ({}));
    const { code, grant, subject } = await approve(user.id, { clientId: b.client_id, redirectUri: b.redirect_uri, codeChallenge: b.code_challenge, codeChallengeMethod: b.code_challenge_method, subjectId: b.subject_id, write: b.write === true });
    const to = new URL(b.redirect_uri);
    to.searchParams.set("code", code);
    if (b.state) to.searchParams.set("state", String(b.state).slice(0, 500));
    sendMail({ kind: "assistant-connecte", to: user.email, ...assistantConnectedMail({ assistant: grant.clientName, account: subject.self ? null : subject.label, write: grant.write, when: new Date() }) }).catch(() => {});
    return out({ redirect: to.toString() });
  } catch (e) { return fail(e); }
}
