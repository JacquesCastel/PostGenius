// Renomme le produit dans les articles de blog publiés : « LinkeePost » devient « Vercéa », linkeepost.app devient vercea.app
// (titre, résumé, corps). Les adresses (slugs, en minuscules) ne changent JAMAIS : un lien existant ne casse pas.
// L'article du test E4 (une-ia-qui-ecrit-votre-post-linkedin-invente-t-elle…) est EXCLU par défaut : il porte l'ancien nom à dessein,
// avec une note datée à ajouter à la main ; --inclure-test pour le traiter aussi.
// SIMULATION par défaut (aucune écriture, extraits affichés) ; --apply enregistre, après une copie de sauvegarde.
// SAUVEGARDE : le conteneur n'a pas toujours le droit d'écrire dans data/. Deux voies :
//   1. --exporter : écrit UNIQUEMENT le JSON des textes d'origine sur la sortie ; à rediriger vers un fichier du serveur (voir ci-dessous) ;
//      puis --apply --sauvegarde-externe (le script ne vérifie pas le fichier : il faut l'avoir contrôlé) ;
//   2. sans option : --apply tente d'écrire data/blog-avant-renommage-<date>.json et S'ARRÊTE, sans rien modifier, si c'est impossible.
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --exporter < scripts/blog-renommer-produit.mjs > /root/blog-avant-renommage.json
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/blog-renommer-produit.mjs
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --apply < scripts/blog-renommer-produit.mjs
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

export const SLUG_TEST = "une-ia-qui-ecrit-votre-post-linkedin-invente-t-elle";
// PUR : le texte renommé. Domaine d'abord, puis nom ; « linkeepost » en minuscules (adresses, slugs) n'est pas touché.
export function renommer(t) {
  return String(t ?? "").replace(/linkeepost\.app/gi, "vercea.app").replace(/Linkee[Pp]ost/g, "Vercéa");
}
export const occurrences = (t) => (String(t ?? "").match(/linkeepost\.app|Linkee[Pp]ost/gi) ?? []).length;
export function extraits(t, max = 3) {
  const s = String(t ?? ""), out = [];
  for (const m of s.matchAll(/linkeepost\.app|Linkee[Pp]ost/g)) { out.push(`…${s.slice(Math.max(0, m.index - 45), m.index).replace(/\s+/g, " ")}«${m[0]}»${s.slice(m.index + m[0].length, m.index + m[0].length + 45).replace(/\s+/g, " ")}…`); if (out.length >= max) break; }
  return out;
}
// PUR : ce qu'il faut faire d'un article
export function planifier(a, { inclureTest = false } = {}) {
  const exclu = !inclureTest && a.slug.startsWith(SLUG_TEST);
  const n = occurrences(a.title) + occurrences(a.excerpt) + occurrences(a.content);
  return { slug: a.slug, exclu, n, titre: renommer(a.title), excerpt: a.excerpt == null ? null : renommer(a.excerpt), content: renommer(a.content), change: n > 0 && !exclu };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const inclureTest = process.argv.includes("--inclure-test");
  const exporter = process.argv.includes("--exporter");
  const sauvegardeExterne = process.argv.includes("--sauvegarde-externe");
  const prisma = new PrismaClient();
  try {
    const articles = await prisma.article.findMany({ select: { id: true, slug: true, title: true, excerpt: true, content: true, published: true } });
    const plans = articles.map((a) => ({ a, p: planifier(a, { inclureTest }) })).filter(({ p }) => p.n > 0);
    if (exporter) { // sortie réservée au JSON : rien d'autre, pour pouvoir la rediriger vers un fichier
      process.stdout.write(JSON.stringify(plans.filter(({ p }) => p.change).map(({ a }) => ({ id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, content: a.content })), null, 1) + "\n");
      return;
    }
    console.log(`${apply ? "APPLICATION" : "SIMULATION (rien n'est écrit)"} : ${plans.length} article(s) contiennent l'ancien nom\n`);
    for (const { a, p } of plans) {
      console.log(`${p.exclu ? "· EXCLU (article du test, à traiter à la main)" : "→"} ${a.published ? "publié" : "brouillon"} ${a.slug} : ${p.n} occurrence(s)`);
      for (const e of [...extraits(a.title, 1), ...extraits(a.excerpt, 1), ...extraits(a.content, 3)].slice(0, 4)) console.log(`     ${e}`);
    }
    const aFaire = plans.filter(({ p }) => p.change);
    console.log(`\n${aFaire.length} article(s) à modifier.`);
    if (!apply) { console.log("Rien n'a été modifié. Relancer avec --apply pour enregistrer."); return; }
    if (!aFaire.length) return;
    if (sauvegardeExterne) console.log("Sauvegarde externe déclarée (--exporter) : aucune copie locale n'est écrite.");
    else {
      const dossier = path.join(process.cwd(), "data");
      const fichier = path.join(dossier, `blog-avant-renommage-${new Date().toISOString().slice(0, 10)}.json`);
      try {
        fs.mkdirSync(dossier, { recursive: true });
        fs.writeFileSync(fichier, JSON.stringify(aFaire.map(({ a }) => ({ id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, content: a.content })), null, 1));
      } catch (e) {
        console.log(`ARRÊT : sauvegarde impossible (${e.code ?? e.message}). RIEN n'a été modifié.`);
        console.log("Exporter les textes d'origine vers un fichier du serveur avec --exporter (voir l'en-tête du script), puis relancer avec --apply --sauvegarde-externe.");
        return;
      }
      console.log(`Sauvegarde écrite : ${fichier}`);
    }
    for (const { a, p } of aFaire) await prisma.article.update({ where: { id: a.id }, data: { title: p.titre, excerpt: p.excerpt, content: p.content } });
    console.log(`${aFaire.length} article(s) mis à jour.`);
  } finally { await prisma.$disconnect(); }
}

if (!globalThis.__IMPORT_ONLY__) await main();
