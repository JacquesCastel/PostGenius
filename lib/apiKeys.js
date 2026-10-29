import crypto from "crypto";
import { prisma } from "./db";

// Clés personnelles (MCP) : « lkp_ » + 40 caractères aléatoires. Seule l'empreinte SHA-256 est conservée.

export const KEY_PREFIX = "lkp_";
export const MAX_KEYS = 5; // clés actives par compte
const hashOf = (key) => crypto.createHash("sha256").update(key).digest("hex");

export class KeyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function createApiKey(userId, { name, write = false }) {
  const label = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (label.length < 2) throw new KeyError("Donnez un nom à la clé (par exemple « Claude Code sur mon ordinateur »).");
  const active = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_KEYS) throw new KeyError(`Vous avez déjà ${MAX_KEYS} clés actives : révoquez-en une avant d'en créer une autre.`);
  const key = KEY_PREFIX + crypto.randomBytes(30).toString("base64url").slice(0, 40);
  const row = await prisma.apiKey.create({ data: { userId, name: label, prefix: key.slice(0, 8), hash: hashOf(key), write: Boolean(write) } });
  return { key, ...view(row) }; // la clé complète n'est renvoyée qu'ici
}

const view = (k) => ({ id: k.id, name: k.name, prefix: k.prefix, write: k.write, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt, revokedAt: k.revokedAt });

export async function listApiKeys(userId) {
  const rows = await prisma.apiKey.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return rows.map(view);
}

export async function revokeApiKey(userId, id) {
  const r = await prisma.apiKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}

// Authentifie « Authorization: Bearer lkp_… » → { userId, keyId, write } ou null
export async function authenticateKey(req) {
  const m = /^Bearer\s+(lkp_[A-Za-z0-9_-]{20,80})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const row = await prisma.apiKey.findUnique({ where: { hash: hashOf(m[1]) }, include: { user: { select: { id: true, disabled: true } } } });
  if (!row || row.revokedAt || row.user?.disabled) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: row.userId, keyId: row.id, write: row.write };
}
