// Script de réouverture de l'essai des testeurs : choix des comptes (fonction pure). Lancer : node --test scripts/essai-testeurs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.__IMPORT_ONLY__ = true;
const { choisir } = await import("../scripts/rouvrir-essai-testeurs.mjs");

const NOW = new Date("2026-12-01T10:00:00Z");
const base = { role: "user", disabled: false, agencyId: null, agencyMembership: null, subscriptionStatus: null, trialEndsAt: new Date("2026-11-01T00:00:00Z") };
const c = (id, o = {}) => ({ id, email: `${id}@exemple.fr`, ...base, ...o });
const ids = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);

test("un testeur dont l'essai a expiré repart sur 14 jours", () => {
  const { aMettreAJour } = choisir([c("a")], ids, { maintenant: NOW });
  assert.equal(aMettreAJour.length, 1);
  assert.equal(aMettreAJour[0].nouvelleFin.toISOString(), "2026-12-15T10:00:00.000Z");
});

test("jamais raccourci : un essai qui finit plus tard est laissé tel quel", () => {
  const { aMettreAJour, ignores } = choisir([c("a", { trialEndsAt: new Date("2026-12-20T00:00:00Z") })], ids, { maintenant: NOW });
  assert.equal(aMettreAJour.length, 0);
  assert.equal(ignores[0].raison, "essai déjà plus long");
});

test("exclus : désactivé, administrateur, agence, abonnement vivant ; un abonnement résilié ne protège pas", () => {
  const r = choisir([
    c("a", { disabled: true }), c("b", { role: "admin" }), c("c", { agencyId: "x" }), c("d", { agencyMembership: { id: "m" } }),
    c("e", { subscriptionStatus: "active" }), c("f", { subscriptionStatus: "past_due" }), c("g", { subscriptionStatus: "canceled" }),
  ], ids, { maintenant: NOW });
  assert.deepEqual(r.aMettreAJour.map((x) => x.id), ["g"]);
  assert.equal(r.ignores.length, 6);
});

test("sans date de fin d'essai : ignoré par défaut, inclus avec --sans-date", () => {
  const sansDate = c("h", { trialEndsAt: null });
  assert.equal(choisir([sansDate], ids, { maintenant: NOW }).aMettreAJour.length, 0);
  assert.equal(choisir([sansDate], ids, { maintenant: NOW, sansDate: true }).aMettreAJour.length, 1);
});

test("seuls les comptes qui ont accepté une invitation sont concernés, et ne sont pas listés comme ignorés sinon", () => {
  const r = choisir([c("z")], ids, { maintenant: NOW });
  assert.equal(r.aMettreAJour.length, 0);
  assert.equal(r.ignores.length, 0);
});

test("le script : simulation par défaut, écriture seulement avec --apply, adresses masquées, durée bornée", () => {
  const s = readFileSync(new URL("../scripts/rouvrir-essai-testeurs.mjs", import.meta.url), "utf8");
  assert.match(s, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(s, /if \(apply && aMettreAJour\.length\)/);
  assert.match(s, /masque\(c\.email\)/);
  const nues = s.split("\n").filter((l) => l.includes("console.log") && l.includes("c.email") && !l.includes("masque(c.email)"));
  assert.deepEqual(nues, [], "aucune adresse affichée sans masque");
  assert.match(s, /jours < 1 \|\| jours > 60/);
  assert.match(s, /data: \{ trialEndsAt: c\.nouvelleFin \}/, "seule la date de fin d'essai est écrite");
});
