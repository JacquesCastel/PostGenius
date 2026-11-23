// Téléchargement sécurisé (lib/safeFetch.js) : adresses interdites, contrôle au moment de la connexion (DNS rebinding), redirections, limites.
// Lancer : node --test scripts/safe-fetch.test.mjs (serveurs locaux, aucun accès à Internet)
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { isBlockedAddress, createSafeGet, safeGet, SafeFetchError } from "../lib/safeFetch.js";

test("adresses interdites : boucle locale, réseaux privés, lien local (métadonnées du cloud), partage d'opérateur, multidiffusion, IPv6 spéciales", () => {
  for (const ip of ["127.0.0.1", "127.255.255.254", "0.0.0.0", "0.1.2.3", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "100.127.255.255", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1", "2002:7f00:1::1", "64:ff9b::7f00:1"]) assert.equal(isBlockedAddress(ip), true, ip);
});
test("IPv6 « mappées » en IPv4 : ramenées à l'IPv4 avant contrôle", () => {
  for (const ip of ["::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "0:0:0:0:0:ffff:127.0.0.1"]) assert.equal(isBlockedAddress(ip), true, ip);
  assert.equal(isBlockedAddress("::ffff:8.8.8.8"), false);
});
test("adresses publiques acceptées ; une valeur qui n'est pas une adresse est refusée", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4007::200e"]) assert.equal(isBlockedAddress(ip), false, ip);
  for (const bad of ["", "abc", "999.1.1.1", null, undefined, "example.com"]) assert.equal(isBlockedAddress(bad), true, String(bad));
});

const code = async (p) => { try { await p; return "ok"; } catch (e) { return e instanceof SafeFetchError ? e.code : `autre:${e.message}`; } };

test("par défaut : adresses internes refusées AVANT toute connexion (littérales, formes numériques, noms locaux)", async () => {
  for (const u of ["http://127.0.0.1/", "http://0.0.0.0:80/", "http://2130706433/", "http://0x7f.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.1/", "http://localhost/", "http://100.64.0.1/"]) assert.equal(await code(safeGet(u)), "blocked", u);
});
test("par défaut : protocoles, identifiants et ports non autorisés", async () => {
  assert.equal(await code(safeGet("file:///etc/passwd")), "invalid");
  assert.equal(await code(safeGet("ftp://example.com/")), "invalid");
  assert.equal(await code(safeGet("http://user:pass@example.com/")), "invalid");
  for (const p of [22, 25, 3000, 5432, 6379, 8080]) assert.equal(await code(safeGet(`http://example.com:${p}/`)), "invalid", `port ${p}`);
  assert.equal(await code(safeGet("pas une adresse")), "invalid");
});

// --- serveurs locaux et faux serveur de noms ---
function serve(handler) { return new Promise((r) => { const hits = []; const s = http.createServer((req, res) => { hits.push({ url: req.url, headers: req.headers }); handler(req, res, s.address().port); }); s.listen(0, "127.0.0.1", () => r({ s, port: s.address().port, hits })); }); }
const DNS = (table, counter = {}) => (host, opts, cb) => { counter[host] = (counter[host] ?? 0) + 1; const v = typeof table[host] === "function" ? table[host](counter[host]) : table[host]; if (!v) return cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" })); cb(null, v.map((a) => ({ address: a, family: a.includes(":") ? 6 : 4 }))); };
const BLOCK_PRIVATE = (ip) => /^(10\.|169\.254\.)/.test(ip); // politique de test : 127.0.0.1 joue le rôle d'un site public
const make = (table, counter) => createSafeGet({ lookup: DNS(table, counter), isBlocked: BLOCK_PRIVATE, ports: null });

test("un nom qui pointe vers une adresse publique est lu ; un nom qui pointe vers une adresse privée est refusé sans connexion", async () => {
  const pub = await serve((_, res) => res.end("bonjour"));
  const get = make({ "public.test": ["127.0.0.1"], "interne.test": ["10.0.0.5"] });
  const r = await get(`http://public.test:${pub.port}/x`);
  assert.equal(r.status, 200); assert.equal(r.ok, true); assert.equal(r.body.toString(), "bonjour");
  assert.equal(await code(get(`http://interne.test:${pub.port}/x`)), "blocked");
  assert.equal(pub.hits.length, 1, "le serveur n'a été contacté que par la première demande");
  pub.s.close();
});
test("une réponse DNS qui mélange adresse publique et privée est refusée en bloc", async () => {
  const pub = await serve((_, res) => res.end("x"));
  assert.equal(await code(make({ "mixte.test": ["127.0.0.1", "10.0.0.5"] })(`http://mixte.test:${pub.port}/`)), "blocked");
  assert.equal(pub.hits.length, 0);
  pub.s.close();
});
test("DNS rebinding : l'adresse contrôlée est celle utilisée pour se connecter (une seule résolution par adresse)", async () => {
  const pub = await serve((_, res) => res.end("ok"));
  const counter = {};
  // première réponse publique, seconde privée : un contrôle séparé de la connexion serait contourné ; ici une seule résolution sert aux deux
  const get = make({ "rebind.test": (n) => (n === 1 ? ["127.0.0.1"] : ["10.0.0.5"]) }, counter);
  const r = await get(`http://rebind.test:${pub.port}/`);
  assert.equal(r.status, 200);
  assert.equal(counter["rebind.test"], 1);
  pub.s.close();
});
test("redirections : chaque étape repasse par le contrôle ; une redirection vers l'interne est refusée avant d'y aller", async () => {
  const inner = await serve((_, res) => res.end("SECRET INTERNE"));
  const pub = await serve((req, res, port) => { res.writeHead(302, { Location: `http://interne.test:${port}/secret` }); res.end(); });
  const get = make({ "public.test": ["127.0.0.1"], "interne.test": ["10.0.0.5"] });
  assert.equal(await code(get(`http://public.test:${pub.port}/`)), "blocked");
  assert.equal(inner.hits.length, 0);
  inner.s.close(); pub.s.close();
});
test("redirections : relatives suivies, boucle limitée", async () => {
  const pub = await serve((req, res) => { if (req.url === "/a") { res.writeHead(301, { Location: "/b" }); return res.end(); } if (req.url === "/b") return res.end("fin"); res.writeHead(302, { Location: "/loop" }); res.end(); });
  const get = make({ "public.test": ["127.0.0.1"] });
  const r = await get(`http://public.test:${pub.port}/a`);
  assert.equal(r.body.toString(), "fin");
  assert.ok(r.url.endsWith("/b"), "adresse finale");
  assert.equal(await code(get(`http://public.test:${pub.port}/loop`, { maxRedirects: 3 })), "redirects");
  pub.s.close();
});
test("limites : taille lue plafonnée, délai, en-tête sans compression", async () => {
  const big = await serve((_, res) => res.end("x".repeat(5_000_000)));
  const get = make({ "public.test": ["127.0.0.1"] });
  const r = await get(`http://public.test:${big.port}/`, { maxBytes: 1000 });
  assert.ok(r.body.length <= 1000, `${r.body.length} octets`); assert.equal(r.truncated, true);
  assert.equal(big.hits[0].headers["accept-encoding"], "identity");
  const slow = await serve(() => {});
  assert.equal(await code(get(`http://public.test:${slow.port}/`, { timeoutMs: 200 })), "timeout");
  big.s.close(); slow.s.close(); slow.s.closeAllConnections?.();
});
test("politique par défaut : un serveur en boucle locale est refusé même avec un nom ou un port ouvert", async () => {
  const s = await serve((_, res) => res.end("interne"));
  assert.equal(await code(createSafeGet({ ports: null })(`http://127.0.0.1:${s.port}/`)), "blocked");
  assert.equal(await code(createSafeGet({ ports: null })(`http://localhost:${s.port}/`)), "blocked");
  assert.equal(s.hits.length, 0, "aucune connexion");
  s.s.close();
});
