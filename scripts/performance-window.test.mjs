// Mesures des posts de PAGE (lib/editorial/performance.js) : T4 — les nouveaux posts ne sont plus bloqués derrière les 200 plus anciens ;
// un palier n'est pris que dans sa fenêtre d'âge. Lancer : node --test scripts/performance-window.test.mjs (base et LinkedIn simulés)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = fs.readFileSync(new URL("../lib/editorial/performance.js", import.meta.url), "utf8");
const H = 3600_000, DAY = 24 * H;
const NOW = Date.parse("2026-11-20T09:00:00Z");
const ORG = "urn:li:organization:1";
const url = (rel) => pathToFileURL(path.resolve(rel)).href;

async function run(drafts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pw-"));
  const f = path.join(tmp, `pw-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, SRC
    .replace('import { prisma } from "../db";', "const prisma = globalThis.__P;")
    .replace('import { decryptToken } from "../crypto";', "const decryptToken = (t) => t;")
    .replace('import { fetchOrgShareStats } from "../linkedin/orgShareStats";', "const fetchOrgShareStats = globalThis.__F;")
    .replace('from "../measures"', `from "${url("lib/measures.js")}"`));
  const created = [];
  let asked = [];
  globalThis.__P = {
    draft: {
      // imite la requête : filtres de date, tri, limite
      findMany: async (q) => {
        const w = q.where, t = (d) => d.publishedAt.getTime();
        let list = drafts.filter((d) => d.status === "publié" && d.postId && d.target.startsWith("urn:li:organization:"));
        if (w.publishedAt?.lte) list = list.filter((d) => t(d) <= w.publishedAt.lte.getTime());
        if (w.publishedAt?.gte) list = list.filter((d) => t(d) >= w.publishedAt.gte.getTime());
        list.sort((a, b) => (q.orderBy?.publishedAt === "desc" ? t(b) - t(a) : t(a) - t(b)));
        return list.slice(0, q.take ?? list.length).map((d) => ({ id: d.id, userId: d.userId, target: d.target, postId: d.postId, publishedAt: d.publishedAt, performance: d.performance }));
      },
    },
    linkedInAccount: { findUnique: async () => ({ orgToken: "tok" }) },
    postPerformance: { create: async ({ data }) => { created.push(data); return data; } },
  };
  globalThis.__F = async (_t, _o, urns) => { asked.push(...urns); return Object.fromEntries(urns.map((u) => [u, { impressionCount: 100, likeCount: 5, commentCount: 1, shareCount: 0, clickCount: 3 }])); };
  const realNow = Date.now; Date.now = () => NOW;
  try { const m = await import(pathToFileURL(f).href); const r = await m.capturePerformanceSnapshots(); return { r, created, asked }; } finally { Date.now = realNow; }
}
const post = (id, daysAgo, offs = []) => ({ id, userId: "u1", target: ORG, postId: `urn:li:share:${id}`, status: "publié", publishedAt: new Date(NOW - daysAgo * DAY), performance: offs.map((o) => ({ offsetHours: o })) });

test("T4 : 240 vieux posts déjà mesurés ne bloquent plus les nouveaux posts de la page", async () => {
  const old = Array.from({ length: 240 }, (_, i) => post(`old${i}`, 30 + i, [24, 168]));
  const fresh = [post("new1", 1.5), post("new2", 8)]; // J+1 dû ; J+7 dû
  const { created } = await run([...old, ...fresh]);
  const byDraft = Object.fromEntries(created.map((c) => [c.draftId, c.offsetHours]));
  assert.equal(byDraft.new1, 24);
  assert.equal(byDraft.new2, 168);
  assert.equal(created.length, 2, "aucune relecture des vieux posts");
});

test("un palier manqué depuis longtemps n'est plus rattrapé (mesure hors fenêtre) et ne consomme pas d'appel", async () => {
  const { created, asked } = await run([post("stale", 20)]); // 20 jours : fenêtre J+7 fermée
  assert.equal(created.length, 0);
  assert.equal(asked.length, 0, "aucun appel LinkedIn pour un post hors fenêtre");
});

test("à 200 h, un post sans mesure reçoit le palier J+7, jamais J+1", async () => {
  const { created } = await run([post("mid", 200 / 24)]);
  assert.deepEqual(created.map((c) => c.offsetHours), [168]);
});

test("un post de moins de 24 h n'est pas encore mesuré", async () => {
  const { created, asked } = await run([post("young", 0.5)]);
  assert.equal(created.length, 0);
  assert.equal(asked.length, 0);
});

test("limitation : au plus 30 posts par exécution (quota LinkedIn)", async () => {
  const many = Array.from({ length: 45 }, (_, i) => post(`m${i}`, 1.2 + i * 0.01));
  const { created } = await run(many);
  assert.equal(created.length, 30);
});
