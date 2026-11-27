// Suivi des inscriptions : fonctions pures et garde-fous du script (lecture seule, adresses masquées). Lancer : node --test scripts/suivi-inscriptions.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.__IMPORT_ONLY__ = true;
const { suivre, etapes, agreger } = await import("../scripts/suivi-inscriptions.mjs");

const NOW = new Date("2026-12-01T12:00:00Z");
const u = (id, o = {}) => ({ email: `${id}@exemple.fr`, createdAt: "2026-11-30T08:00:00Z", onboardedAt: null, role: "user", disabled: false, agencyId: null, agencyMembership: null, subscriptionStatus: null, linkedin: null, _count: { drafts: 0 }, lifecycleEmails: [], ...o });

test("comptes suivis : ni administrateurs, ni désactivés, ni agences, ni domaines de test", () => {
  assert.equal(suivre(u("a")), true);
  assert.equal(suivre(u("a", { role: "admin" })), false);
  assert.equal(suivre(u("a", { disabled: true })), false);
  assert.equal(suivre(u("a", { agencyId: "x" })), false);
  assert.equal(suivre(u("a", { agencyMembership: { id: "m" } })), false);
  assert.equal(suivre({ ...u("a"), email: "demo@linkeepost.app" }), false);
  assert.equal(suivre({ ...u("a"), email: "cl@managed.postgenius.internal" }), false);
  assert.equal(suivre({ ...u("a"), email: "moi@bywharf.com" }, ["bywharf.com"]), false, "domaine exclu sur demande");
});

test("étapes franchies : parcours, LinkedIn, brouillon, abonnement, bienvenue", () => {
  const e = etapes(u("a", { onboardedAt: "2026-11-30T09:00:00Z", linkedin: { personSub: "abc" }, _count: { drafts: 2 }, subscriptionStatus: "active", lifecycleEmails: [{ key: "welcome" }] }));
  assert.deepEqual(e, { cree: true, termine: true, linkedin: true, brouillon: true, abonne: true, bienvenue: true });
  const v = etapes(u("b", { linkedin: { personSub: null } }));
  assert.deepEqual(v, { cree: true, termine: false, linkedin: false, brouillon: false, abonne: false, bienvenue: false });
  assert.equal(etapes(u("c", { subscriptionStatus: "past_due" })).abonne, true, "en retard de paiement = encore abonné");
  assert.equal(etapes(u("d", { subscriptionStatus: "canceled" })).abonne, false);
});

test("tableau par jour, totaux, taux et comptes bloqués (adresses masquées)", () => {
  const r = agreger([
    u("a", { onboardedAt: "2026-11-30T09:00:00Z", linkedin: { personSub: "x" }, _count: { drafts: 1 }, subscriptionStatus: "active" }),
    u("b", { onboardedAt: "2026-11-30T10:00:00Z" }),
    u("c"),
    u("d", { createdAt: "2026-12-01T11:30:00Z" }),
    u("e", { role: "admin" }),
  ], { maintenant: NOW });
  assert.equal(r.gardes, 4);
  assert.equal(r.total.cree, 4); assert.equal(r.total.termine, 2); assert.equal(r.total.linkedin, 1); assert.equal(r.total.brouillon, 1); assert.equal(r.total.abonne, 1);
  assert.equal(r.parJour["2026-11-30"].cree, 3);
  assert.equal(r.taux.termine, "50 %");
  assert.equal(r.taux.linkedin, "50 %");
  assert.equal(r.bloques.length, 1, "« d » a moins d'une heure : pas encore bloqué ; « c » l'est");
  assert.match(r.bloques[0].email, /^c\*\*\*@/);
  assert.equal(agreger([], { maintenant: NOW }).taux.termine, "—");
});

test("le script est en LECTURE SEULE et n'affiche aucune adresse complète", () => {
  const s = readFileSync(new URL("../scripts/suivi-inscriptions.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(s, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$queryRawUnsafe/);
  assert.match(s, /findMany/);
  assert.match(s, /email: masque\(u\.email\)/);
  const brutes = s.split("\n").filter((l) => l.includes("console.log") && /\b(u|user)\.email\b/.test(l));
  assert.deepEqual(brutes, [], "aucune adresse brute (u.email) affichée : seuls les comptes bloqués passent par masque()");
  assert.match(s, /jours < 1 \|\| jours > 365/);
  assert.doesNotMatch(s, /personToken|password/i, "ne lit ni jeton ni mot de passe");
});
