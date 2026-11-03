// Tests de l'e-mail « leads à qualifier ». Lancer : node --test scripts/leads-mail.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { leadsMailContent, deadlineText } from "../lib/leadsMail.js";
import { PROFILE_TTL_MS, COMMENT_TTL_MS } from "../lib/leadsText.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-03T12:00:00Z");
const plain = (c) => [c.subject, c.title, ...c.lines].join(" ").replace(/<[^>]+>/g, "");

test("l'e-mail annonce les leads à qualifier et rappelle l'effacement imposé par LinkedIn", () => {
  const c = leadsMailContent({ client: "Smart City Mag", created: 2, waiting: 2, oldestCreatedAt: NOW, now: NOW });
  const t = plain(c);
  assert.match(c.subject, /^2 leads à qualifier · Smart City Mag$/);
  assert.match(c.title, /2 nouveaux leads sur la page de Smart City Mag/);
  assert.ok(/comme les commentaires/i.test(t) && /règles de conservation imposées par LinkedIn/i.test(t), "effacés au même titre que les commentaires, au nom des règles de LinkedIn");
  assert.ok(t.includes(`${PROFILE_TTL_MS / 3600_000} h`) && t.includes(`${COMMENT_TTL_MS / 3600_000} h`), "24 h pour le profil, 48 h pour le lead");
  assert.match(t, /sera effacé dans 48 h/);
  assert.equal(c.ctaLabel, "Qualifier les leads");
});

test("un seul lead, et leads déjà en attente : singulier, total et délai du plus ancien", () => {
  const old = NOW - 30 * 3600_000;
  const c = leadsMailContent({ client: "X", created: 1, waiting: 3, oldestCreatedAt: old, now: NOW });
  const t = plain(c);
  assert.match(c.subject, /^3 leads à qualifier/);
  assert.match(t, /1 nouveau lead sur la page de X/);
  assert.match(t, /Une personne a commenté/);
  assert.match(t, /3 au total en attente/);
  assert.match(t, /sera effacé dans 18 h/);
});

test("délai : moins d'une heure, heures, et jamais de nombre négatif", () => {
  assert.equal(deadlineText(NOW - 46.5 * 3600_000, NOW), "dans 2 h");
  assert.equal(deadlineText(NOW - 47.9 * 3600_000, NOW), "dans moins d'une heure");
  assert.equal(deadlineText(NOW - 60 * 3600_000, NOW), "dans moins d'une heure", "déjà dépassé : on ne promet rien de plus");
  assert.equal(deadlineText(NOW, NOW), "dans 48 h");
});

test("page personnelle : « votre page », sans nom de client", () => {
  const c = leadsMailContent({ client: null, created: 1, waiting: 1, oldestCreatedAt: NOW, now: NOW });
  assert.equal(c.subject, "1 lead à qualifier");
  assert.match(c.title, /sur votre page$/);
});

test("aucune donnée de profil LinkedIn dans le message : seulement des nombres", () => {
  const src = read("lib/leadsMail.js");
  assert.ok(!/\b(name|headline|company|profileUrl|commentText|actor)\b/.test(src.replace(/\/\/.*$/gm, "")), "le contenu ne lit aucun champ de profil");
  const mail = read("lib/teamEmails.js");
  const block = mail.slice(mail.indexOf("export const newLeadsMail"), mail.indexOf("// Envoie le même message"));
  assert.ok(!/\b(name|headline|company|profileUrl|commentText)\b/.test(block.replace(/hello\(u\)/g, "")), "pas de champ de profil dans la construction du message");
});

test("envoi : après la création de leads seulement, un message par passage, erreurs sans conséquence sur la lecture", () => {
  const src = read("lib/pageComments.js");
  const iCap = src.indexOf("const made = await captureLeads(");
  const iNotify = src.indexOf("if (made > 0) await notifyNewLeads(");
  assert.ok(iCap > 0 && iNotify > iCap, "notification juste après la capture, seulement si des leads ont été créés");
  assert.ok(src.slice(iNotify, iNotify + 220).includes(".catch("), "un échec d'envoi ne casse pas le passage");
  assert.ok(src.includes("`new_leads:${startedAt}`"), "page personnelle : une clé par passage (jamais deux fois)");
  assert.ok(src.includes('kind: "new_leads", view: "leads"') && src.includes("email: newLeadsMail("), "client d'agence : cloche et e-mail à l'équipe");
  assert.ok(src.includes('status: "new", level: null'), "le décompte ne retient que les leads encore à qualifier");
  const kinds = read("lib/emailKinds.js");
  assert.ok(kinds.includes('kind: "equipe-leads"'), "type d'e-mail déclaré (journal et Administration)");
});
