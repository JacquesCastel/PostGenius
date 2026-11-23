import net from "node:net";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";

// Téléchargement sécurisé d'une adresse fournie par un utilisateur (anti-SSRF : un client ne doit jamais faire lire au serveur une adresse interne).
//
// Mécanismes du noyau de Node.js, sans dépendance : `net.BlockList` (liste d'adresses interdites, IPv4 et IPv6), `dns.lookup` et l'option `lookup` de
// `http(s).request`. Le contrôle se fait AU MOMENT DE LA CONNEXION : l'adresse validée est celle à laquelle on se connecte (pas de nouvelle résolution
// entre le contrôle et l'envoi : pas de « DNS rebinding »), et chaque redirection repasse par le même contrôle. Un nom qui pointe vers une adresse privée
// est donc refusé comme une adresse privée écrite telle quelle. Rien n'est lu au-delà de `maxBytes`.

export class SafeFetchError extends Error {
  constructor(code, message) { super(message); this.name = "SafeFetchError"; this.code = code; }
}
// Codes : "blocked" (adresse interdite) · "invalid" (adresse mal formée, protocole ou port interdit) · "redirects" · "timeout" · "network" · "too_large"

// Adresses non publiques : boucle locale, réseaux privés, lien local (dont le service de métadonnées du cloud 169.254.169.254), partage d'adresses d'opérateur,
// documentation, multidiffusion, réservées. Les adresses IPv6 « mappées » en IPv4 sont ramenées à leur IPv4 avant contrôle.
const V4 = [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]];
const V6 = [["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8]];
const BLOCK = new net.BlockList();
for (const [a, p] of V4) BLOCK.addSubnet(a, p, "ipv4");
for (const [a, p] of V6) BLOCK.addSubnet(a, p, "ipv6");

// ::ffff:a.b.c.d ou ::ffff:xxxx:xxxx → a.b.c.d (sinon null)
function mappedV4(ip) {
  const m = ip.toLowerCase().match(/^(?:0{0,4}:){0,5}:?ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/) || ip.toLowerCase().match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16), lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

// true si l'adresse n'est pas une adresse publique routable (ou n'est pas une adresse IP valide)
export function isBlockedAddress(address) {
  const ip = String(address ?? "").trim().replace(/^\[|\]$/g, "").split("%")[0];
  const kind = net.isIP(ip);
  if (!kind) return true;
  if (kind === 4) return BLOCK.check(ip, "ipv4");
  const v4 = mappedV4(ip);
  if (v4) return BLOCK.check(v4, "ipv4");
  return BLOCK.check(ip, "ipv6");
}

const DEFAULTS = { maxBytes: 2_000_000, timeoutMs: 12_000, maxRedirects: 5, ports: [80, 443] };

// Fabrique configurable (les tests y branchent un faux serveur de noms et une autre liste d'interdits ; la production utilise `safeGet`)
export function createSafeGet({ lookup = dns.lookup, isBlocked = isBlockedAddress, ports = DEFAULTS.ports } = {}) {
  const safeLookup = (hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    const opts = typeof options === "function" ? {} : options ?? {};
    lookup(hostname, { ...opts, all: true }, (err, list) => {
      if (err) return cb(err);
      const found = Array.isArray(list) ? list : [{ address: list, family: net.isIP(list) }];
      if (!found.length) return cb(new SafeFetchError("network", "Adresse introuvable."));
      if (found.some((a) => isBlocked(a.address))) return cb(new SafeFetchError("blocked", "Adresse non autorisée."));
      return opts.all ? cb(null, found) : cb(null, found[0].address, found[0].family);
    });
  };

  function once(url, { headers, timeoutMs, maxBytes }) {
    return new Promise((resolve, reject) => {
      let u;
      try { u = new URL(url); } catch { return reject(new SafeFetchError("invalid", "Adresse invalide.")); }
      if (u.protocol !== "http:" && u.protocol !== "https:") return reject(new SafeFetchError("invalid", "Seules les adresses http et https sont autorisées."));
      if (u.username || u.password) return reject(new SafeFetchError("invalid", "Adresse avec identifiants non autorisée."));
      const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
      if (ports && !ports.includes(port)) return reject(new SafeFetchError("invalid", "Port non autorisé."));
      const host = u.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(host) && isBlocked(host)) return reject(new SafeFetchError("blocked", "Adresse non autorisée."));
      const mod = u.protocol === "https:" ? https : http;
      let done = false;
      const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
      const req = mod.request(u, { method: "GET", headers: { "Accept-Encoding": "identity", ...headers }, lookup: safeLookup, agent: false }, (res) => {
        const chunks = [];
        let size = 0, truncated = false;
        res.on("data", (c) => {
          size += c.length;
          if (size > maxBytes) { truncated = true; chunks.push(c.subarray(0, c.length - (size - maxBytes))); res.destroy(); return; }
          chunks.push(c);
        });
        const end = () => finish(resolve, { status: res.statusCode, url: u.href, headers: res.headers, body: Buffer.concat(chunks), truncated });
        res.on("end", end);
        res.on("close", end);
        res.on("error", (e) => finish(reject, e instanceof SafeFetchError ? e : new SafeFetchError("network", "Lecture interrompue.")));
      });
      const timer = setTimeout(() => { req.destroy(); finish(reject, new SafeFetchError("timeout", "Délai dépassé.")); }, timeoutMs);
      req.on("error", (e) => finish(reject, e instanceof SafeFetchError ? e : e?.cause instanceof SafeFetchError ? e.cause : new SafeFetchError("network", "Impossible de joindre cette adresse.")));
      req.end();
    });
  }

  // GET sécurisé → { status, ok, url (finale), headers, body (Buffer, au plus maxBytes), truncated }. Lève une SafeFetchError.
  return async function safeGet(url, opts = {}) {
    const o = { ...DEFAULTS, ...opts, headers: opts.headers ?? {} };
    let current = String(url);
    for (let hop = 0; hop <= o.maxRedirects; hop++) {
      const r = await once(current, o);
      if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.location) {
        try { current = new URL(r.headers.location, r.url).href; } catch { throw new SafeFetchError("invalid", "Redirection invalide."); }
        continue; // la nouvelle adresse repasse par TOUS les contrôles
      }
      return { ...r, ok: r.status >= 200 && r.status < 300 };
    }
    throw new SafeFetchError("redirects", "Trop de redirections.");
  };
}

export const safeGet = createSafeGet();
