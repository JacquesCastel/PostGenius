// Tests de l'envoi manuel d'e-mails depuis l'Administration. Lancer : node --test scripts/admin-mail.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanCustom, MAX_SUBJECT, MAX_BODY, MAX_PARAGRAPHS, TEMPLATES } from "../lib/adminMailContent.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("message libre : objet et corps nettoyés, paragraphes séparés par une ligne vide", () => {
  const r = cleanCustom({ subject: "  Deux leads   à traiter ", body: "Bonjour\r\nà tous\n\n\nDeuxième paragraphe.\n\n" });
  assert.equal(r.subject, "Deux leads à traiter");
  assert.deepEqual(r.paragraphs, ["Bonjour\nà tous", "Deuxième paragraphe."]);
});

test("message libre : refus clairs (vide, trop long, trop de paragraphes)", () => {
  assert.match(cleanCustom({ subject: "", body: "x" }).error, /objet/i);
  assert.match(cleanCustom({ subject: "x", body: "  " }).error, /vide/i);
  assert.match(cleanCustom({ subject: "x".repeat(MAX_SUBJECT + 1), body: "x" }).error, /objet est trop long/i);
  assert.match(cleanCustom({ subject: "x", body: "x".repeat(MAX_BODY + 1) }).error, /trop long/i);
  assert.match(cleanCustom({ subject: "x", body: Array(MAX_PARAGRAPHS + 1).fill("p").join("\n\n") }).error, /paragraphes/i);
  assert.deepEqual(TEMPLATES, ["leads", "custom"]);
});

test("route d'envoi : administrateur seulement, aperçu sans envoi, confirmation exigée, journal", () => {
  const r = read("app/api/admin/emails/send/route.js");
  assert.ok(r.includes("requireAdmin(req)") && r.indexOf("requireAdmin(req)") < r.indexOf("buildManualMail("), "l'administrateur est vérifié d'abord");
  assert.ok(r.includes("rateLimit(") && r.includes('action === "send" ? 20'), "limite d'envois par heure");
  const iPreview = r.indexOf('if (action === "preview")'), iSend = r.indexOf("sendMail(");
  assert.ok(iPreview > 0 && iSend > iPreview, "l'aperçu répond avant tout envoi");
  assert.ok(r.indexOf("body.confirm !== true") > iPreview && r.indexOf("body.confirm !== true") < iSend, "l'envoi exige confirm: true");
  assert.ok(r.includes('action: "email.manuel"'), "inscrit au journal des actions d'administration");
});

test("destinataires : ceux qui ont coupé les e-mails ou suspendus sont écartés ; texte du message échappé", () => {
  const m = read("lib/adminMail.js");
  assert.ok(m.includes("!u.disabled && !u.emailOptOut"));
  assert.ok(m.includes("agencyRecipients(account.agencyId, account.id)"), "équipe de l'agence du client (cloisonnement respecté)");
  assert.ok(m.includes("esc(p)"), "aucun HTML saisi n'est transmis tel quel");
  assert.ok(m.includes("status: \"new\", level: null") && m.includes("48 * 3600_000"), "leads encore à qualifier et pas encore effacés");
  assert.ok(m.includes("Aucun lead à qualifier"), "pas de message vide si aucun lead");
});

test("interface : aperçu obligatoire, confirmation avant envoi, aperçu caduc dès qu'on modifie", () => {
  const p = read("app/app/page.js");
  const i = p.indexOf("function AdminSendMailCard"), card = p.slice(i, p.indexOf("function AdminEmailsCard", i));
  assert.ok(card.includes("window.confirm(") && card.includes("preview.recipients.map"), "confirmation avec la liste des destinataires");
  assert.ok((card.match(/reset\(\)/g) ?? []).length >= 4, "modèle, compte, objet et message invalident l'aperçu");
  assert.ok(card.includes("{preview && (") && card.indexOf("admin-sendmail-send") > card.indexOf("{preview && ("), "le bouton d'envoi n'existe qu'avec un aperçu");
  assert.ok(p.includes("<AdminSendMailCard showToast={showToast} />"));
  assert.ok(read("lib/emailKinds.js").includes('kind: "equipe-message"'));
});
