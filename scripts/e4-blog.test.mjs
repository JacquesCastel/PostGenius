// Contrôle de la version « site » du compte rendu : format de saisie de l'admin, rendu par le vrai moteur Markdown du site, cohérence des chiffres.
// Lancer : node --test scripts/e4-blog.test.mjs     (E4_BLOG_FINAL=1 : exige en plus que le lien d'annexe soit renseigné)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FILE = "outputs/blog-10-chiffres-inventes-posts-linkedin-ia-test.md";
const md = read(FILE);
const body = md.split("## CONTENU (Markdown)\n")[1];

// Le moteur de rendu du site, chargé tel quel (seule l'importation de la lecture YouTube est neutralisée)
async function renderer() {
  const src = read("lib/markdown.js").replace(/import \{[^}]*\} from "\.\/youtube";/, "const parseYouTubeId = () => null, youtubeEmbedUrl = () => '';");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mdsite-")), "markdown.mjs");
  fs.writeFileSync(f, src);
  return (await import(f)).markdownToHtml;
}

test("format de saisie de l'admin : titre, résumé de longueur raisonnable, contenu", () => {
  const m = md.match(/^# Article 10 .*\n\n## TITRE\n(.+)\n\n## RÉSUMÉ \(méta description\)\n(.+)\n\n## CONTENU \(Markdown\)\n/);
  assert.ok(m, "en-têtes attendus");
  assert.ok(m[1].length <= 100, `titre : ${m[1].length} caractères`);
  assert.ok(m[2].length >= 100 && m[2].length <= 170, `résumé : ${m[2].length} caractères`);
  assert.ok(body.length > 8000);
});

test("rien que le rendu du site ne sait pas afficher : tableaux, blocs de code, séparateurs, titres de niveau 1, texte de travail", async () => {
  assert.ok(!/^\s*\|/m.test(body), "tableau");
  assert.ok(!/^```/m.test(body), "bloc de code");
  assert.ok(!/^\s*(---|\*\*\*|___)\s*$/m.test(body), "séparateur");
  assert.ok(!/^# /m.test(body), "titre de niveau 1 (le titre est dans TITRE)");
  assert.ok(!/À vérifier avant publication|à retirer|TODO|à compléter/i.test(body));
});

test("rendu par le moteur du site : aucun marqueur Markdown brut ne subsiste", async () => {
  const html = (await renderer())(body);
  const text = html.replace(/<[^>]+>/g, "");
  assert.ok(!text.includes("**"), "gras non rendu : " + (text.match(/.{20}\*\*.{20}/) || [""])[0]);
  assert.ok(!/`/.test(text), "code inline non rendu");
  assert.ok(!/\[[^\]]+\]\(/.test(text.replace(/\(URL_ANNEXE\)/, "")), "lien non rendu");
  assert.equal((html.match(/<h2/g) || []).length, (body.match(/^## /gm) || []).length);
  assert.equal((html.match(/<h3/g) || []).length, (body.match(/^### /gm) || []).length);
  assert.equal((html.match(/href="https:\/\/gist\.github\.com\/JacquesCastel\/[0-9a-f]{32}"/g) || []).length, 4);
});

const fr = (x) => Number(String(x).replace(",", "."));
test("les chiffres de la version site = résultats calculés", () => {
  const main = read("docs/e4-chiffres/resultats/resultats.md"), sens = read("docs/e4-chiffres/resultats/resultats-sensibilite.md");
  const rows = (t) => t.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/\*/g, "").trim()));
  const cond = (t) => Object.fromEntries(rows(t).filter((r) => /^(A|B|C|D|AN|BN|CN)$/.test(r[0]) && r.length >= 7).map((r) => [r[0], { moy: fr(r[2]), total: Number(r[3]) }]));
  const M = cond(main), S = cond(sens);
  for (const c of ["A", "B", "C", "D", "AN", "BN", "CN"]) {
    const line = body.split("\n").find((l) => new RegExp(`^- \\*\\*${c}, `).test(l) && l.includes(" par post.**"));
    assert.ok(line, `ligne de la condition ${c}`);
    const m = line.match(/: ([\d,]+) par post\.\*\* (\d+) élément/);
    assert.ok(m, `format de la ligne ${c}`);
    assert.ok(Math.abs(fr(m[1]) - M[c].moy) < 0.051, `moyenne ${c}`);
    assert.equal(Number(m[2]), M[c].total, `total ${c}`);
  }
  const sensLine = body.split("\n").find((l) => l.startsWith("- **A** : 5,9"));
  assert.ok(sensLine);
  const sv = Object.fromEntries([...body.matchAll(/\*\*(A|B|C|D|AN|BN|CN)(?: \(LinkeePost\))?\*\* : ([\d,]+)/g)].filter((m) => body.indexOf(m[0]) > body.indexOf("Analyse de sensibilité")).map((m) => [m[1], fr(m[2])]));
  for (const c of ["A", "B", "C", "D", "AN", "BN", "CN"]) assert.ok(Math.abs(sv[c] - S[c].moy) < 0.051, `sensibilité ${c} : ${sv[c]} / ${S[c].moy}`);
  // par sujet
  const ref = rows(main).filter((r) => /^S\d\d$/.test(r[0]) && r.length === 8).map((r) => r.slice(1).join(","));
  const mine = body.split("\n").filter((l) => /^- \*\*Sujet \d+ /.test(l)).map((l) => [...l.matchAll(/\b(?:AN|BN|CN|A|B|C|D) (\d+)/g)].map((m) => m[1]).join(","));
  assert.deepEqual(mine, ref);
});

test("lien d'annexe : placeholder toléré en préparation, refusé en version finale", () => {
  const n = (body.match(/\(URL_ANNEXE\)/g) || []).length;
  assert.equal(n, 1);
  if (process.env.E4_BLOG_FINAL === "1") assert.fail("URL_ANNEXE doit être remplacé par l'adresse des annexes avant publication");
});
