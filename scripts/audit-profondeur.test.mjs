// Script d'audit de la profondeur des mesures (scripts/audit-profondeur-mesures.sql).
// 1) Garanties statiques (toujours exécutées) : lecture seule, aucune donnée identifiante.
// 2) Vérification sur une base de TEST jetable (seulement si AUDIT_TEST_DATABASE_URL est défini) : jamais la production.
//    Lancer : AUDIT_TEST_DATABASE_URL=postgresql://… node --test scripts/audit-profondeur.test.mjs   (base créée par `prisma db push`)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const FILES = ["audit-profondeur-mesures.sql", "audit-ages-mesures.sql", "audit-pilote-auto.sql"].map((f) => new URL(`./${f}`, import.meta.url));
const SQL_PATH = FILES[0];
const read = (u) => fs.readFileSync(u, "utf8");
const codeOf = (u) => read(u).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").replace(/--.*$/gm, "");

for (const u of FILES) {
  const name = path.basename(u.pathname);
  const CODE = codeOf(u);
  test(`statique (${name}) : transaction en lecture seule, ouverte puis annulée`, () => {
    assert.match(CODE, /^\s*BEGIN READ ONLY;/);
    assert.match(CODE.trim(), /ROLLBACK;$/);
    assert.ok(!/\bCOMMIT\b/i.test(CODE));
  });
  test(`statique (${name}) : aucun ordre d'écriture ni de définition`, () => {
    for (const kw of ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE", "COPY", "VACUUM", "CALL", "DO", "SET ROLE"]) {
      assert.ok(!new RegExp(`\\b${kw}\\b`, "i").test(CODE.replace(/'[^']*'/g, "''")), `mot interdit : ${kw}`);
    }
    assert.deepEqual(CODE.match(/\bSET\s+\w+(\s+\w+)?/gi), ["SET LOCAL statement_timeout"]);
  });
  test(`statique (${name}) : aucune colonne identifiante dans la sortie finale, petits effectifs masqués`, () => {
    const finalSelect = CODE.slice(CODE.lastIndexOf("SELECT section"));
    for (const col of ["email", "name", "text", "theme", "postId", '"userId"', "id"]) {
      assert.ok(!new RegExp(`(^|[^\\w])${col}([^\\w]|$)`).test(finalSelect.replace(/::text/g, "").replace(/'[^']*'/g, "''")), `colonne en sortie : ${col}`);
    }
    assert.match(finalSelect, /BETWEEN 1 AND 2 THEN '<3'/);
  });
}

test("statique : les fenêtres du premier audit sont celles du plan (J+1 : 20–72 h ; J+7 : 144–240 h), âge réel", () => {
  const CODE = codeOf(FILES[0]);
  assert.match(CODE, /BETWEEN 144 AND 240/);
  assert.match(CODE, /BETWEEN 20 AND 72/);
  assert.match(CODE, /capturedAt/);
  assert.ok(!/offsetHours/.test(CODE), "l'étiquette offsetHours n'est pas utilisée pour classer");
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

test("audit n° 2, base de test : âges réels, posts sans mesure, traçabilité « Que publier ? », origine campagne", { skip: !DB && "AUDIT_TEST_DATABASE_URL non défini" }, async () => {
  assert.ok(!/neon\.tech|linkeepost|hetzner/i.test(DB), "refus : ressemble à la production");
  process.env.DATABASE_URL = DB;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const m of ["postPerformance", "campaignPost", "editorialRecommendation", "draft", "campaign", "linkedInAccount", "user"]) await prisma[m].deleteMany();
    const H = 3600_000, DAY = 24 * H, now = Date.now();
    let seq = 0;
    const mkUser = (tag, extra = {}) => prisma.user.create({ data: { email: `${tag}${seq++}@test.invalid`, password: "x", name: tag, ...extra } });
    const mkPost = async (u, ageH, measures = [], extra = {}) => {
      const publishedAt = new Date(now - ageH * H);
      const d = await prisma.draft.create({ data: { userId: u.id, type: "simple", theme: "t", expertise: "e", tone: "t", maxChars: 1300, text: "texte", status: "publié", postId: `urn:li:share:${seq++}`, publishedAt, target: "person", ...extra } });
      for (const [offsetHours, a] of measures) await prisma.postPerformance.create({ data: { draftId: d.id, offsetHours, capturedAt: new Date(publishedAt.getTime() + a * H), impressions: 10 } });
      return d;
    };
    const conn = await mkUser("conn"); await prisma.linkedInAccount.create({ data: { userId: conn.id, statsToken: "enc:x" } });
    await prisma.statSnapshot.create({ data: { userId: conn.id, day: "2026-01-01", createdAt: new Date(now - 20 * DAY) } }); // premier relevé il y a 20 jours
    const noconn = await mkUser("noconn");
    // posts sans aucune mesure : 3 trop récents (5 h), 3 d'âge normal (100 h), 3 anciens (30 jours), compte connecté ; 3 d'âge normal, compte non connecté
    for (let i = 0; i < 3; i++) { await mkPost(conn, 5); await mkPost(conn, 100); await mkPost(conn, 30 * 24); await mkPost(noconn, 100); }
    // mesures : 3 étiquetées 24 prises à 26 h ; 3 étiquetées 168 prises à 175 h ; 3 étiquetées 168 prises à 400 h
    const meas = await mkUser("meas");
    for (let i = 0; i < 3; i++) { await mkPost(meas, 700 + i, [[24, 26]]); await mkPost(meas, 900 + i, [[168, 175]]); await mkPost(meas, 1500 + i, [[168, 400]]); }
    // « Que publier ? » : 5 propositions « générée » dont le thème est repris par 5 brouillons (aucun relié), 3 publiés et mesurés avec pilier
    const r = await mkUser("reco");
    const pillar = await prisma.editorialPillar.create({ data: { userId: r.id, name: "Expertise" } });
    for (let i = 0; i < 5; i++) {
      await prisma.editorialRecommendation.create({ data: { userId: r.id, topic: `Sujet ${i}`, angle: "angle", rationale: "r", status: "générée" } });
    }
    for (let i = 0; i < 5; i++) {
      const pub = i < 3;
      await prisma.draft.create({ data: { userId: r.id, type: "simple", theme: `Sujet ${i} — angle`, expertise: "e", tone: "t", maxChars: 1300, text: "x", status: pub ? "publié" : "brouillon", postId: pub ? `urn:li:share:${seq++}` : null, publishedAt: pub ? new Date(now - 300 * H) : null, pillarId: pub ? pillar.id : null } })
        .then(async (d) => { if (pub) await prisma.postPerformance.create({ data: { draftId: d.id, offsetHours: 168, capturedAt: new Date(now - 300 * H + 170 * H), impressions: 5 } }); });
    }
    // campagnes : 4 posts mesurés d'un plan (objectif, angle, format renseignés ; pas d'appel à l'action) ; 3 d'une campagne automatique
    const c = await mkUser("camp");
    const camp = await prisma.campaign.create({ data: { userId: c.id, name: "C1", theme: "t" } });
    for (let i = 0; i < 4; i++) {
      const cp = await prisma.campaignPost.create({ data: { campaignId: camp.id, userId: c.id, ref: `P0${i}`, account: "A", objective: "leads", angle: i < 3 ? "cas client" : "", format: "texte" } });
      await mkPost(c, 400 + i, [[168, 170]], { campaignId: camp.id, campaignPostId: cp.id });
    }
    for (let i = 0; i < 3; i++) await mkPost(c, 500 + i, [[168, 170]], { campaignId: camp.id, auto: true });

    const out = execFileSync("psql", [DB, "-At", "-F", "|", "-f", FILES[1].pathname], { encoding: "utf8" });
    const rows = out.split("\n").filter((l) => l.split("|").length === 4).map((l) => l.split("|"));
    const get = (section, label) => rows.find((x) => x[0] === section && x[1] === label)?.[2];
    assert.equal(get("Âge réel des mesures étiquetées J+1 (24)", "profil · 03 24 à 30 h"), "3");
    assert.equal(get("Âge réel des mesures étiquetées J+7 (168)", "profil · 09 168 à 180 h"), String(3 + 3 + 7), "175 h (3) + 170 h (3 proposition + 7 campagne)");
    assert.equal(get("Âge réel des mesures étiquetées J+7 (168)", "profil · 12 plus de 240 h"), "3", "mesure étiquetée J+7 prise à 400 h");
    const U = "Posts publiés sans aucune mesure";
    assert.equal(get(U, "profil · 1 trop récent (moins de 20 h) · canal de mesure connecté"), "3");
    assert.equal(get(U, "profil · 2 âge normal (20 h à 10 jours), non mesuré · canal de mesure connecté"), "3");
    assert.equal(get(U, "profil · 3 ancien (plus de 10 jours), non mesuré · canal de mesure connecté"), "3");
    assert.equal(get(U, "profil · 2 âge normal (20 h à 10 jours), non mesuré · canal de mesure NON connecté"), "3");
    const F = "Posts publiés sans aucune mesure : avant ou après la première lecture du canal";
    assert.equal(get(F, "profil · publié avant la première lecture du canal (non mesurable)"), "3", "les 3 posts de 30 jours précèdent le premier relevé");
    assert.equal(get(F, "profil · publié après la première lecture du canal (mesure manquante)"), "6", "5 h et 100 h : après le premier relevé");
    assert.equal(get(F, "profil · aucune lecture du canal pour ce compte"), "3", "compte sans relevé");
    const Q = "« Que publier ? » : propositions";
    assert.equal(get(Q, "passées au statut « générée » (clic sur Générer)"), "5");
    assert.equal(get(Q, "avec un brouillon relié (recommendation.draftId renseigné)"), "0", "aucune liaison technique");
    const P = "Provenance probable « Que publier ? » (thème « sujet — angle »)";
    assert.equal(get(P, "brouillons dont le thème reprend une proposition"), "5");
    assert.equal(get(P, "dont reliés à la proposition (draftId)"), "0");
    assert.equal(get(P, "dont avec un pilier"), "3");
    assert.equal(get(P, "dont publiés"), "3");
    assert.equal(get(P, "dont mesurés"), "3");
    const M = "Posts mesurés selon leur rattachement";
    assert.equal(get(M, "plan de campagne (campaignPostId)"), "4");
    assert.equal(get(M, "campagne automatique (campaignId, sans plan)"), "3");
    const K = "Posts mesurés d'un plan de campagne : qualification disponible";
    assert.equal(get(K, "avec objectif renseigné"), "4");
    assert.equal(get(K, "avec angle renseigné"), "3");
    assert.equal(get(K, "avec appel à l'action renseigné"), "0");
    assert.equal(get("Campagnes", "campagnes avec au moins 2 posts mesurés"), "<3", "une seule campagne : masqué");
    assert.ok(!out.includes("@test.invalid") && !/Sujet \d|cas client/.test(out), "aucun texte ni adresse en sortie");
  } finally {
    await prisma.$disconnect();
  }
});

const SH = new URL("./audit-profondeur.sh", import.meta.url);
test("script de relance : syntaxe valide, deux audits, n'affiche jamais l'adresse de la base, aucun ordre d'écriture", () => {
  execFileSync("bash", ["-n", SH.pathname]);
  const sh = fs.readFileSync(SH, "utf8");
  assert.ok(sh.includes("audit-profondeur-mesures.sql") && sh.includes("audit-ages-mesures.sql") && sh.includes("audit-pilote-auto.sql"));
  assert.ok(!/echo[^\n]*\$DATABASE_URL|echo[^\n]*\$\{DATABASE_URL/.test(sh), "l'adresse de la base n'est jamais affichée");
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/.test(sh.replace(/^#.*$/gm, "")));
  assert.ok(fs.statSync(SH).mode & 0o111, "exécutable");
});
test("script de relance, base de test : produit un fichier daté, sans modifier la base", { skip: !DB && "AUDIT_TEST_DATABASE_URL non défini" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audits-"));
  const out = execFileSync(SH.pathname, [], { encoding: "utf8", env: { ...process.env, DATABASE_URL: DB, AUDIT_OUT_DIR: dir } });
  const files = fs.readdirSync(dir).filter((f) => /^audit-\d{4}-\d{2}-\d{2}_\d{4}\.txt$/.test(f));
  assert.equal(files.length, 1);
  const body = fs.readFileSync(path.join(dir, files[0]), "utf8");
  assert.match(body, /=== 1\. Profondeur/);
  assert.match(body, /=== 2\. Âges réels/);
  assert.ok(!body.includes(DB) && !out.includes("audit:audit@"), "aucune adresse de base dans la sortie");
});

test("audit n° 3, base de test : pilote automatique — brouillons retrouvés, délais, comptes, traces de suppression", { skip: !DB && "AUDIT_TEST_DATABASE_URL non défini" }, async () => {
  assert.ok(!/neon\.tech|linkeepost|hetzner/i.test(DB), "refus : ressemble à la production");
  process.env.DATABASE_URL = DB;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const m of ["postPerformance", "editorialRecommendation", "draft", "activityEvent", "user"]) await prisma[m].deleteMany();
    const now = Date.now(); let seq = 0;
    const mk = (tag, extra = {}) => prisma.user.create({ data: { email: `${tag}${seq++}@test.invalid`, password: "x", name: tag, ...extra } });
    const accounts = [];
    for (let i = 0; i < 3; i++) accounts.push(await mk("auto", { autoPublishThreshold: 70, expertise: "e", publishDays: "1,3" }));
    await mk("plain");
    // 3 comptes × 2 propositions « planifiées » (créées puis traitées dans la même minute) : 6 au total, aucune reliée
    for (const u of accounts) for (let i = 0; i < 2; i++) {
      await prisma.editorialRecommendation.create({ data: { userId: u.id, topic: `Sujet ${u.id}-${i}`, angle: "a", rationale: "r", status: "planifiée", createdAt: new Date(now - 90 * 60000), respondedAt: new Date(now - 89 * 60000) } });
    }
    // 3 d'entre elles ont encore un brouillon « pilote automatique » (thème = sujet) mais le lien est perdu : 2 programmés, 1 publié
    const survivors = [["programmé"], ["programmé"], ["publié"]];
    for (let i = 0; i < 3; i++) await prisma.draft.create({ data: { userId: accounts[i].id, type: "simple", theme: `Sujet ${accounts[i].id}-0`, expertise: "e", tone: "t", maxChars: 1300, text: "x", status: survivors[i][0], auto: true, publishedAt: survivors[i][0] === "publié" ? new Date() : null } });
    // 3 traces de suppression (deux du pilote automatique, une publiée)
    for (const meta of [{ auto: true, published: false }, { auto: true, published: false }, { auto: false, published: true }]) await prisma.activityEvent.create({ data: { userId: accounts[0].id, kind: "reco_draft_deleted", meta } });

    const out = execFileSync("psql", [DB, "-At", "-F", "|", "-f", FILES[2].pathname], { encoding: "utf8" });
    const rows = out.split("\n").filter((l) => l.split("|").length === 4).map((l) => l.split("|"));
    const get = (section, label) => rows.find((r) => r[0] === section && r[1] === label)?.[2];
    assert.equal(get("Comptes avec la publication autonome activée", "seuil de confiance renseigné (comptes non suspendus)"), "3");
    assert.equal(get("Propositions « planifiées »", "au total (comptes non suspendus)"), "6");
    assert.equal(get("Propositions « planifiées »", "sans brouillon relié"), "6");
    assert.equal(get("Propositions « planifiées »", "avec un brouillon encore relié"), "0");
    assert.equal(get("Propositions « planifiées »", "comptes concernés"), "3");
    assert.equal(get("Délai entre création et réponse (indice d'origine)", "moins de 10 minutes"), "6");
    assert.equal(get("Brouillons « pilote automatique » retrouvés par leur thème", "brouillons existants (auto, thème = sujet d'une proposition planifiée)"), "3");
    assert.equal(get("Brouillons « pilote automatique » retrouvés par leur thème", "dont publiés"), "<3", "1 publié : masqué");
    assert.equal(get("Brouillons « pilote automatique » retrouvés par leur thème", "dont programmés ou à valider"), "<3", "2 : masqué");
    assert.equal(get("Suppressions tracées d'un brouillon relié à une proposition", "au total"), "3");
    assert.equal(get("Suppressions tracées d'un brouillon relié à une proposition", "dont brouillons créés par le pilote automatique"), "<3");
    assert.ok(!out.includes("@test.invalid") && !/Sujet /.test(out), "aucun texte ni adresse en sortie");
  } finally { await prisma.$disconnect(); }
});
