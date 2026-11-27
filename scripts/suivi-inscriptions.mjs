// Suivi des inscriptions : où les nouveaux comptes s'arrêtent. LECTURE SEULE (aucune écriture), adresses masquées.
// Étapes suivies : compte créé → parcours terminé (écran de fin) → LinkedIn connecté → premier brouillon → abonné ; plus l'e-mail de bienvenue.
// Exclus : administrateurs, comptes désactivés, clients et membres d'agence, adresses des domaines de test (--exclure=domaine1,domaine2 pour en ajouter).
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/suivi-inscriptions.mjs
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --jours=7 --exclure=bywharf.com < scripts/suivi-inscriptions.mjs
import { PrismaClient } from "@prisma/client";

const DOMAINES_TEST = ["linkeepost.app", "managed.postgenius.internal"];
const masque = (e) => { const [a, d] = String(e).split("@"); return `${a.slice(0, 2)}***@${d ?? "?"}`; };
const jour = (d) => new Date(d).toISOString().slice(0, 10);
// abonné = abonnement payant en cours (actif, ou en retard de paiement pendant les relances) ; « trialing » n'est pas utilisé : l'essai est géré hors Stripe
const PAYANTS = ["active", "past_due"];

// PUR : filtre les comptes à suivre
export function suivre(u, exclure = []) {
  const dom = String(u.email).split("@")[1]?.toLowerCase() ?? "";
  return u.role !== "admin" && !u.disabled && !u.agencyId && !u.agencyMembership && ![...DOMAINES_TEST, ...exclure.map((x) => x.toLowerCase())].includes(dom);
}
// PUR : étapes franchies par un compte
export function etapes(u) {
  return {
    cree: true,
    termine: Boolean(u.onboardedAt),
    linkedin: Boolean(u.linkedin?.personSub),
    brouillon: (u._count?.drafts ?? 0) > 0,
    abonne: PAYANTS.includes(u.subscriptionStatus),
    bienvenue: (u.lifecycleEmails?.length ?? 0) > 0,
  };
}
// PUR : tableau par jour, totaux, comptes bloqués avant la fin du parcours
export function agreger(users, { maintenant = new Date(), exclure = [] } = {}) {
  const gardes = users.filter((u) => suivre(u, exclure));
  const parJour = {};
  const total = { cree: 0, termine: 0, linkedin: 0, brouillon: 0, abonne: 0, bienvenue: 0 };
  const bloques = [];
  for (const u of gardes) {
    const e = etapes(u), j = jour(u.createdAt);
    parJour[j] ??= { cree: 0, termine: 0, linkedin: 0, brouillon: 0, abonne: 0, bienvenue: 0 };
    for (const k of Object.keys(total)) if (e[k]) { parJour[j][k]++; total[k]++; }
    const ageH = (maintenant.getTime() - new Date(u.createdAt).getTime()) / 3600000;
    if (!e.termine && ageH >= 1) bloques.push({ email: masque(u.email), ageH: Math.round(ageH), jour: j });
  }
  bloques.sort((a, b) => a.ageH - b.ageH);
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : "—");
  return { gardes: gardes.length, parJour, total, bloques, taux: { termine: pct(total.termine, total.cree), linkedin: pct(total.linkedin, total.termine), brouillon: pct(total.brouillon, total.termine), abonne: pct(total.abonne, total.cree) } };
}

async function main() {
  const argv = process.argv;
  const jours = Number((argv.find((a) => a.startsWith("--jours=")) ?? "--jours=14").split("=")[1]);
  if (!Number.isInteger(jours) || jours < 1 || jours > 365) throw new Error("--jours doit être un entier entre 1 et 365");
  const exclure = (argv.find((a) => a.startsWith("--exclure=")) ?? "--exclure=").slice("--exclure=".length).split(",").map((x) => x.trim()).filter(Boolean);
  const depuis = new Date(Date.now() - jours * 86400000);
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: depuis } },
      select: { email: true, createdAt: true, onboardedAt: true, role: true, disabled: true, agencyId: true, subscriptionStatus: true,
        agencyMembership: { select: { id: true } }, linkedin: { select: { personSub: true } }, _count: { select: { drafts: true } }, lifecycleEmails: { where: { key: "welcome" }, select: { key: true } } },
    });
    const r = agreger(users, { exclure });
    console.log(`SUIVI DES INSCRIPTIONS : ${jours} derniers jours (depuis le ${jour(depuis)}), ${r.gardes} compte(s) suivi(s) sur ${users.length} créé(s) — lecture seule\n`);
    console.log("jour        créés  parcours terminé  LinkedIn  brouillon  abonnés  bienvenue");
    for (const j of Object.keys(r.parJour).sort()) { const x = r.parJour[j]; console.log(`${j}  ${String(x.cree).padStart(5)}  ${String(x.termine).padStart(16)}  ${String(x.linkedin).padStart(8)}  ${String(x.brouillon).padStart(9)}  ${String(x.abonne).padStart(7)}  ${String(x.bienvenue).padStart(9)}`); }
    const t = r.total;
    console.log(`TOTAL       ${String(t.cree).padStart(5)}  ${String(t.termine).padStart(16)}  ${String(t.linkedin).padStart(8)}  ${String(t.brouillon).padStart(9)}  ${String(t.abonne).padStart(7)}  ${String(t.bienvenue).padStart(9)}`);
    console.log(`\nParcours terminé : ${r.taux.termine} des comptes créés · LinkedIn connecté : ${r.taux.linkedin} des parcours terminés · brouillon créé : ${r.taux.brouillon} des parcours terminés · abonnés : ${r.taux.abonne} des comptes créés`);
    console.log(`\nComptes qui n'ont pas terminé le parcours (créés il y a plus d'une heure) : ${r.bloques.length}`);
    for (const b of r.bloques.slice(0, 30)) console.log(`  ${b.email} · créé le ${b.jour} · il y a ${b.ageH} h`);
    if (r.bloques.length > 30) console.log(`  … et ${r.bloques.length - 30} autre(s)`);
  } finally { await prisma.$disconnect(); }
}

if (!globalThis.__IMPORT_ONLY__) await main();
