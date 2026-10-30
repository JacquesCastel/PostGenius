import { logActivity } from "./activity";
import crypto from "crypto";
import { prisma } from "./db";
import { checkFeature } from "./gating";
import { clientAccessible } from "./session";
import { clientScope } from "./agency";

// Connexion d'un assistant (claude.ai, Cursor…) au MCP par OAuth 2.1 : enregistrement dynamique du client (RFC 7591), code d'autorisation
// avec PKCE (S256 obligatoire), jeton d'accès d'une heure, jeton de renouvellement de 90 jours glissants, renouvelé à chaque usage.
// Seules les empreintes (SHA-256) des codes et des jetons sont conservées.

export const APP = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const SCOPES = ["mcp:read", "mcp:write"];
const ACCESS_TTL = 60 * 60; // secondes
const REFRESH_TTL = 90 * 86400_000;
const CODE_TTL = 10 * 60_000;
export const MAX_GRANTS = 10; // assistants branchés en même temps, par personne
const MAX_REDIRECTS = 10;
const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"]);

const hashOf = (v) => crypto.createHash("sha256").update(v).digest("hex");
const random = (prefix, bytes) => prefix + crypto.randomBytes(bytes).toString("base64url");
const cleanName = (n) => String(n ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export class OAuthError extends Error {
  constructor(code, description, status = 400, extra = {}) { super(description); this.code = code; this.status = status; this.extra = extra; }
}

// https, boucle locale en http (outils sur l'ordinateur), ou schéma propre à une application ; jamais d'adresse avec fragment
export function validRedirectUri(u) {
  if (typeof u !== "string" || u.length > 500) return false;
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.hash || DANGEROUS_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol);
}

export async function registerClient(body) {
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (uris.length < 1 || uris.length > MAX_REDIRECTS || !uris.every(validRedirectUri)) throw new OAuthError("invalid_redirect_uri", "redirect_uris : 1 à 10 adresses valides (https, ou boucle locale).");
  const name = cleanName(body?.client_name) || "Assistant";
  // Les enregistrements jamais utilisés ne s'accumulent pas
  prisma.oAuthClient.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) }, grants: { none: {} } } }).catch(() => {});
  const id = random("lkc_", 18);
  await prisma.oAuthClient.create({ data: { id, name, redirectUris: uris } });
  return { client_id: id, client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
}

// Client et adresse de retour du lien d'autorisation : on ne redirige jamais vers une adresse qui n'est pas enregistrée à l'identique
export async function findClient(clientId, redirectUri) {
  const client = clientId ? await prisma.oAuthClient.findUnique({ where: { id: String(clientId) } }) : null;
  if (!client) throw new OAuthError("invalid_client", "Application inconnue.");
  const uris = Array.isArray(client.redirectUris) ? client.redirectUris : [];
  if (!uris.includes(redirectUri)) throw new OAuthError("invalid_request", "Adresse de retour non enregistrée pour cette application.");
  return client;
}

// Comptes sur lesquels cette personne peut brancher un assistant : le sien et, en agence, les clients qu'elle peut ouvrir
export async function subjectsFor(userId) {
  const label = (u) => u.companyName || u.name || u.email;
  const self = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, companyName: true, email: true } });
  if (!self) return [];
  const out = [{ id: self.id, label: label(self), self: true }];
  const m = await prisma.agencyMember.findUnique({ where: { userId }, select: { agencyId: true, role: true, agency: { select: { restrictClients: true } } } });
  if (m) {
    const restricted = Boolean(m.agency?.restrictClients) && m.role !== "owner";
    const clients = await prisma.user.findMany({ where: clientScope({ agencyId: m.agencyId, restricted, userId }), select: { id: true, name: true, companyName: true, email: true }, orderBy: { createdAt: "asc" }, take: 100 });
    for (const c of clients) if (c.id !== userId) out.push({ id: c.id, label: label(c), self: false });
  }
  return out;
}

// Étape finale de l'écran d'autorisation : crée l'autorisation et renvoie le code à remettre à l'assistant
export async function approve(userId, { clientId, redirectUri, codeChallenge, codeChallengeMethod, subjectId, write }) {
  const client = await findClient(clientId, redirectUri);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(String(codeChallenge ?? "")) || codeChallengeMethod !== "S256") throw new OAuthError("invalid_request", "PKCE (S256) requis.");
  const feat = await checkFeature(userId, "campaigns", "L'accès par assistant (MCP)");
  if (!feat.ok) throw new OAuthError("access_denied", feat.error, 403);
  const subjects = await subjectsFor(userId);
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) throw new OAuthError("access_denied", "Ce compte n'est pas accessible.", 403);
  const active = await prisma.oAuthGrant.findMany({ where: { userId, revokedAt: null }, select: { id: true, clientId: true, subjectId: true } });
  const same = active.filter((g) => g.clientId === client.id && g.subjectId === subject.id).map((g) => g.id);
  if (active.length - same.length >= MAX_GRANTS) throw new OAuthError("access_denied", `Vous avez déjà ${MAX_GRANTS} assistants connectés : retirez-en un dans Mon profil.`, 403);
  if (same.length) await revokeMany(same); // une reconnexion remplace l'ancienne autorisation
  const grant = await prisma.oAuthGrant.create({ data: { userId, subjectId: subject.id, clientId: client.id, clientName: client.name, write: write === true } });
  const code = random("lkcode_", 32);
  await prisma.oAuthCode.create({ data: { hash: hashOf(code), grantId: grant.id, redirectUri, codeChallenge, expiresAt: new Date(Date.now() + CODE_TTL) } });
  void logActivity(userId, "assistant_connected", { client: client.name });
  return { code, grant, subject };
}

async function revokeMany(ids) {
  await prisma.oAuthGrant.updateMany({ where: { id: { in: ids } }, data: { revokedAt: new Date() } });
  await prisma.oAuthToken.deleteMany({ where: { grantId: { in: ids } } });
}

async function issueTokens(grant) {
  prisma.oAuthToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } } }).catch(() => {});
  await prisma.oAuthToken.deleteMany({ where: { grantId: grant.id } }); // un seul couple de jetons valide par autorisation
  const access = random("lko_", 30), refresh = random("lkr_", 36);
  await prisma.oAuthToken.createMany({ data: [
    { hash: hashOf(access), kind: "access", grantId: grant.id, expiresAt: new Date(Date.now() + ACCESS_TTL * 1000) },
    { hash: hashOf(refresh), kind: "refresh", grantId: grant.id, expiresAt: new Date(Date.now() + REFRESH_TTL) },
  ] });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope: grant.write ? "mcp:read mcp:write" : "mcp:read" };
}

const invalidGrant = () => new OAuthError("invalid_grant", "Code ou jeton invalide, expiré ou déjà utilisé.");

export async function exchangeCode({ code, verifier, redirectUri, clientId }) {
  const row = code ? await prisma.oAuthCode.findUnique({ where: { hash: hashOf(String(code)) }, include: { grant: true } }) : null;
  if (!row || row.grant.clientId !== clientId || row.redirectUri !== redirectUri) throw invalidGrant();
  if (row.usedAt) { await revokeMany([row.grantId]); throw invalidGrant(); } // code rejoué : on coupe l'autorisation
  if (row.expiresAt < new Date() || row.grant.revokedAt) throw invalidGrant();
  const expected = Buffer.from(row.codeChallenge), got = Buffer.from(crypto.createHash("sha256").update(String(verifier ?? "")).digest("base64url"));
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) throw invalidGrant();
  const used = await prisma.oAuthCode.updateMany({ where: { hash: row.hash, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) throw invalidGrant();
  return issueTokens(row.grant);
}

export async function refreshTokens({ refreshToken, clientId }) {
  const hash = hashOf(String(refreshToken ?? ""));
  const row = await prisma.oAuthToken.findUnique({ where: { hash }, include: { grant: { include: { user: { select: { disabled: true } } } } } });
  if (!row || row.kind !== "refresh" || row.expiresAt < new Date() || row.grant.revokedAt || row.grant.clientId !== clientId || row.grant.user?.disabled) throw invalidGrant();
  const taken = await prisma.oAuthToken.deleteMany({ where: { hash } }); // utilisable une seule fois
  if (taken.count !== 1) throw invalidGrant();
  return issueTokens(row.grant);
}

// « Authorization: Bearer lko_… » → { userId (compte visé), actorId (personne qui a autorisé), keyId, write } ou null
export async function authenticateOAuth(req) {
  const m = /^Bearer\s+(lko_[A-Za-z0-9_-]{20,80})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const row = await prisma.oAuthToken.findUnique({ where: { hash: hashOf(m[1]) }, include: { grant: { include: { user: { select: { disabled: true } } } } } });
  const g = row?.grant;
  if (!row || row.kind !== "access" || row.expiresAt < new Date() || g.revokedAt || g.user?.disabled) return null;
  // Un accès à un client de l'agence suit les droits actuels de la personne (membre retiré, client désaffecté…)
  if (g.subjectId !== g.userId && !(await clientAccessible({ userId: g.userId, clientId: g.subjectId }))) return null;
  if (!g.lastUsedAt || Date.now() - g.lastUsedAt.getTime() > 60_000) prisma.oAuthGrant.update({ where: { id: g.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: g.subjectId, actorId: g.userId, keyId: `g:${g.id}`, write: g.write };
}

export async function listGrants(userId) {
  const rows = await prisma.oAuthGrant.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  const ids = [...new Set(rows.map((r) => r.subjectId).filter((id) => id !== userId))];
  const subs = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, companyName: true, email: true } }) : [];
  const nameOf = new Map(subs.map((s) => [s.id, s.companyName || s.name || s.email]));
  return rows.map((g) => ({ id: g.id, name: g.clientName, write: g.write, createdAt: g.createdAt, lastUsedAt: g.lastUsedAt, subject: g.subjectId === userId ? null : nameOf.get(g.subjectId) ?? "Client supprimé" }));
}

export async function revokeGrant(userId, id) {
  const g = await prisma.oAuthGrant.findFirst({ where: { id, userId, revokedAt: null }, select: { id: true } });
  if (!g) return false;
  await revokeMany([g.id]);
  return true;
}
