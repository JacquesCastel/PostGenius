// Script d'audit de la profondeur des mesures (scripts/audit-profondeur-mesures.sql).
// 1) Garanties statiques (toujours exécutées) : lecture seule, aucune donnée identifiante.
// 2) Vérification sur une base de TEST jetable (seulement si AUDIT_TEST_DATABASE_URL est défini) : jamais la production.
//    Lancer : AUDIT_TEST_DATABASE_URL=postgresql://… node --test scripts/audit-profondeur.test.mjs   (base créée par `prisma db push`)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SQL_PATH = new URL("./audit-profondeur-mesures.sql", import.meta.url);
const SQL = fs.readFileSync(SQL_PATH, "utf8");
const CODE = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").replace(/--.*$/gm, "");

test("statique : transaction en lecture seule, ouverte puis annulée", () => {
  assert.match(CODE, /^\s*BEGIN READ ONLY;/);
  assert.match(CODE.trim(), /ROLLBACK;$/);
  assert.ok(!/\bCOMMIT\b/i.test(CODE));
});

test("statique : aucun ordre d'écriture ni de définition", () => {
  for (const kw of ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE", "COPY", "VACUUM", "CALL", "DO", "SET ROLE"]) {
    assert.ok(!new RegExp(`\\b${kw}\\b`, "i").test(CODE.replace(/'[^']*'/g, "''")), `mot interdit : ${kw}`);
  }
  // un seul « SET » : le délai maximal, local à la transaction
  assert.deepEqual(CODE.match(/\bSET\s+\w+(\s+\w+)?/gi), ["SET LOCAL statement_timeout"]);
});

test("statique : aucune colonne identifiante dans la sortie finale", () => {
  const finalSelect = CODE.slice(CODE.lastIndexOf("SELECT section"));
  for (const col of ["email", "name", "text", "theme", "postId", '"userId"', "id"]) {
    assert.ok(!new RegExp(`(^|[^\\w])${col.replace(/"/g, '"')}([^\\w]|$)`).test(finalSelect.replace(/::text/g, "").replace(/'[^']*'/g, "''")), `colonne en sortie : ${col}`);
  }
  assert.match(finalSelect, /BETWEEN 1 AND 2 THEN '<3'/, "masquage des petits effectifs");
});

test("statique : les fenêtres sont celles du plan (J+1 : 20–72 h ; J+7 : 144–240 h)", () => {
  assert.match(CODE, /BETWEEN 144 AND 240/);
  assert.match(CODE, /BETWEEN 20 AND 72/);
  assert.match(CODE, /capturedAt/, "âge réel, pas l'étiquette");
  assert.ok(!/offsetHours/.test(CODE), "l'étiquette offsetHours n'est pas utilisée");
});

const DB = process.env.AUDIT_TEST_DATABASE_URL;
test("base de test : comptage par POST, âge réel, comptes suspendus exclus, petits effectifs masqués", { skip: !DB && "AUDIT_TEST_DATABASE_URL non défini" }, async () => {
  assert.ok(!/neon\.tech|linkeepost|hetzner/i.test(DB), "refus : ressemble à la production");
  process.env.DATABASE_URL = DB;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.postPerformance.deleteMany(); await prisma.draft.deleteMany(); await prisma.user.deleteMany();
    const H = 3600_000, t0 = Date.parse("2026-09-01T08:00:00Z");
    let seq = 0;
    const mkUser = (tag, extra = {}) => prisma.user.create({ data: { email: `${tag}${seq++}@test.invalid`, password: "x", name: tag, ...extra } });
    const mkPost = async (u, i, measures, extra = {}) => {
      const publishedAt = new Date(t0 + i * 24 * H);
      const d = await prisma.draft.create({ data: { userId: u.id, type: "simple", theme: "t", expertise: "e", tone: "t", maxChars: 1300, text: "texte", status: "publié", postId: `urn:li:share:${seq++}`, publishedAt, target: "person", ...extra } });
      for (const [offsetHours, ageH] of measures) await prisma.postPerformance.create({ data: { draftId: d.id, offsetHours, capturedAt: new Date(publishedAt.getTime() + ageH * H), impressions: 100 } });
    };
    // 3 comptes : 9 posts mesurés à J+1 ET J+7 (deux mesures par post : ne doit compter qu'un post)
    for (let a = 0; a < 3; a++) { const u = await mkUser("A"); for (let i = 0; i < 9; i++) await mkPost(u, i, [[24, 26], [168, 170]], i === 0 ? { pillarId: null } : {}); }
    // 1 administrateur : 8 posts à J+7 seulement
    const admin = await mkUser("E", { role: "admin" }); for (let i = 0; i < 8; i++) await mkPost(admin, i, [[168, 175]]);
    // 3 comptes : 8 posts à J+1 seulement
    for (let b = 0; b < 3; b++) { const u = await mkUser("B"); for (let i = 0; i < 8; i++) await mkPost(u, i, [[24, 30]]); }
    // 1 compte : 6 posts à J+7 (proche du seuil)
    const c = await mkUser("C"); for (let i = 0; i < 6; i++) await mkPost(c, i, [[168, 169]]);
    // 1 compte : 2 posts dont la mesure étiquetée J+7 a été prise à 40 jours (hors fenêtre)
    const f = await mkUser("F"); for (let i = 0; i < 2; i++) await mkPost(f, i, [[168, 960]]);
    // compte suspendu : ne doit pas être compté
    const dis = await mkUser("D", { disabled: true }); for (let i = 0; i < 9; i++) await mkPost(dis, i, [[24, 26], [168, 170]]);
    // brouillon avec mesure : ne doit pas être compté
    const dr = await prisma.draft.create({ data: { userId: c.id, type: "simple", theme: "t", expertise: "e", tone: "t", maxChars: 1300, text: "x", status: "brouillon" } });
    await prisma.postPerformance.create({ data: { draftId: dr.id, offsetHours: 168, impressions: 1 } });

    const out = execFileSync("psql", [DB, "-At", "-F", "|", "-f", SQL_PATH.pathname], { encoding: "utf8" });
    const rows = out.split("\n").filter((l) => l.split("|").length === 4).map((l) => l.split("|"));
    const get = (section, label) => rows.find((r) => r[0] === section && r[1] === label)?.[2];
    const S = "Posts publiés (comptes non suspendus)";
    assert.equal(get(S, "publiés par LinkeePost"), String(27 + 8 + 24 + 6 + 2), "un post = une ligne, comptes suspendus et brouillons exclus");
    assert.equal(get(S, "comparables à J+7"), String(27 + 8 + 6));
    assert.equal(get(S, "comparables à J+1 seulement"), "24");
    assert.equal(get(S, "mesure hors fenêtre (étiquette J+1/J+7 ≠ âge réel)"), "<3", "2 posts : masqué");
    assert.equal(get("Comptes par régime", "tous · 1 analysable à J+7 (8 posts ou plus)"), "4");
    assert.equal(get("Comptes par régime", "tous · 2 analysable à J+1 seulement (8 posts ou plus)"), "3");
    assert.equal(get("Comptes par régime", "tous · 3 proche du seuil (5 à 7 posts)"), "<3");
    assert.equal(get("Comptes analysables à J+7 (périmètre « tous »)", "dont comptes administrateurs"), "<3");
    assert.equal(get("Comptes analysables à J+7 (périmètre « tous »)", "comptes utilisateurs"), "3");
    assert.equal(get("Comptes par tranche de posts mesurés à J+7", "profil · 8-14"), "4");
    assert.ok(!out.includes("@test.invalid"), "aucune adresse en sortie");
    // lecture seule : rien n'a changé, et une écriture tentée dans la transaction est refusée
    assert.equal(await prisma.draft.count(), 27 + 8 + 24 + 6 + 2 + 9 + 1);
    assert.throws(() => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-c", "BEGIN READ ONLY; DELETE FROM \"Draft\";"], { stdio: "pipe" }), /read-only/);
    assert.equal(await prisma.draft.count(), 27 + 8 + 24 + 6 + 2 + 9 + 1);
  } finally {
    await prisma.$disconnect();
  }
});
