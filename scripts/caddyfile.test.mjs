// Caddyfile : jamais de redirection vers un domaine que le serveur ne sert pas (cause d'une panne possible au redémarrage de Caddy).
// Lancer : node --test scripts/caddyfile.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../Caddyfile", import.meta.url), "utf8");
const sansCommentaires = src.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

// blocs « adresse1, adresse2 { … } »
function blocs(texte) {
  const out = [];
  const re = /^([^\s{][^{\n]*?)\s*\{\n([\s\S]*?)^\}/gm;
  for (const m of texte.matchAll(re)) out.push({ hotes: m[1].split(",").map((s) => s.trim()), corps: m[2] });
  return out;
}
const B = blocs(sansCommentaires);
const serv = new Set(B.filter((b) => /reverse_proxy/.test(b.corps)).flatMap((b) => b.hotes));

test("les blocs sont lus", () => assert.ok(B.length >= 3, `${B.length} blocs`));

test("toute redirection vise un domaine servi par ce même fichier (reverse_proxy)", () => {
  for (const b of B) {
    for (const m of b.corps.matchAll(/redir\s+(?:@\w+\s+)?https:\/\/([^/{\s]+)/g)) {
      assert.ok(serv.has(m[1]), `${b.hotes.join(", ")} redirige vers ${m[1]}, que ce fichier ne sert pas`);
    }
  }
});

test("vercea.app est servi directement, sans redirection ; www.vercea.app redirige vers l'apex", () => {
  const prod = B.find((b) => b.hotes.includes("vercea.app"));
  assert.ok(prod && /reverse_proxy app:3000/.test(prod.corps) && !/redir/.test(prod.corps));
  const www = B.find((b) => b.hotes.includes("www.vercea.app"));
  assert.match(www.corps, /redir https:\/\/vercea\.app\{uri\} permanent/);
});

test("l'ancien domaine redirige les PAGES (GET, HEAD) vers vercea.app, et reste servi pour le reste", () => {
  const vieux = B.find((b) => b.hotes.includes("postgenius.network"));
  assert.ok(vieux.hotes.includes("www.postgenius.network"));
  assert.match(vieux.corps, /method GET HEAD/, "pages seulement : jamais un POST");
  assert.match(vieux.corps, /redir @pages https:\/\/vercea\.app\{uri\} permanent/, "301, chemin et requête conservés");
  assert.match(vieux.corps, /reverse_proxy app:3000/, "tout le reste reste servi directement");
});

test("jamais de redirection pour les retours OAuth, les webhooks, le serveur MCP ni les assistants IA ; la privacy policy est redirigée depuis que LinkedIn pointe vers vercea.app", () => {
  const vieux = B.find((b) => b.hotes.includes("postgenius.network"));
  const exclus = vieux.corps.match(/not path ([^\n]+)/)[1].split(/\s+/);
  assert.deepEqual(exclus, ["/api/*", "/oauth/*", "/.well-known/*"], "seuls ces chemins restent servis sans redirection");
  for (const chemin of ["/privacy-policy", "/privacy"]) assert.ok(!exclus.includes(chemin), `${chemin} est redirigée vers vercea.app`);
});

test("linkeepost.app n'a pas de bloc : son DNS ne pointe pas vers ce serveur (aucun certificat possible)", () => {
  assert.doesNotMatch(sansCommentaires, /linkeepost\.app/);
});
