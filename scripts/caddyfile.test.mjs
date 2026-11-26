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

test("les blocs sont lus", () => assert.ok(B.length >= 4, `${B.length} blocs`));

test("toute redirection vise un domaine servi par ce même fichier (reverse_proxy)", () => {
  for (const b of B) {
    for (const m of b.corps.matchAll(/redir\s+(?:@\w+\s+)?https:\/\/([^/{\s]+)/g)) {
      assert.ok(serv.has(m[1]), `${b.hotes.join(", ")} redirige vers ${m[1]}, que ce fichier ne sert pas`);
    }
  }
});

test("le domaine de production actuel est servi directement, sans redirection", () => {
  const prod = B.find((b) => b.hotes.includes("postgenius.network"));
  assert.ok(prod && /reverse_proxy app:3000/.test(prod.corps) && !/redir/.test(prod.corps));
});

test("le nouveau domaine est servi en parallèle, sans redirection vers ou depuis l'ancien", () => {
  const nouveau = B.find((b) => b.hotes.includes("vercea.app"));
  assert.ok(nouveau && /reverse_proxy app:3000/.test(nouveau.corps) && !/redir/.test(nouveau.corps));
  assert.doesNotMatch(sansCommentaires, /redir[^\n]*vercea\.app\{uri\}[\s\S]*postgenius/, "pas de 301 de domaine à cette étape");
});

test("linkeepost.app n'a pas de bloc : son DNS ne pointe pas vers ce serveur (aucun certificat possible)", () => {
  assert.doesNotMatch(sansCommentaires, /linkeepost\.app/);
});
