// Jour de l'ouverture publique : redonne 14 jours d'essai aux comptes testeurs de la bêta (décision du 26 novembre 2026).
// SIMULATION par défaut : rien n'est écrit. Ajouter --apply pour enregistrer.
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/rouvrir-essai-testeurs.mjs
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --apply < scripts/rouvrir-essai-testeurs.mjs
// Options : --jours=14 (durée de l'essai), --sans-date (inclut aussi les comptes testeurs sans date de fin d'essai),
//   --inclure=adresse1,adresse2 (ajoute des comptes précis qui n'ont pas accepté d'invitation : créés à la main, ou avant le système
//   d'invitations). Les mêmes exclusions s'appliquent (désactivé, administrateur, agence, abonnement vivant, essai déjà plus long).
// Comptes concernés : ceux qui ont ACCEPTÉ une invitation de la bêta (table Invitation), actifs, non administrateurs, hors agences
// (clients et membres), sans abonnement vivant (active, trialing, past_due). La date n'est JAMAIS raccourcie : un compte dont l'essai
// finit plus tard que la nouvelle date est laissé tel quel. Les adresses sont masquées dans l'affichage.
import { PrismaClient } from "@prisma/client";

const VIVANTS = ["active", "trialing", "past_due"];
const masque = (e) => { const [a, d] = String(e).split("@"); return `${a.slice(0, 2)}***@${d ?? "?"}`; };

// PURE : classe les comptes. `comptes` : { id, email, role, disabled, agencyId, agencyMembership, subscriptionStatus, trialEndsAt }.
// Renvoie { aMettreAJour: [{...compte, nouvelleFin}], ignores: [{...compte, raison}] }.
export function choisir(comptes, idsAcceptes, { maintenant = new Date(), jours = 14, sansDate = false, emailsInclus = [] } = {}) {
  const inclus = new Set(emailsInclus.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  const concerne = (c) => idsAcceptes.has(c.id) || inclus.has(String(c.email).toLowerCase());
  const nouvelleFin = new Date(maintenant.getTime() + jours * 86400000);
  const aMettreAJour = [], ignores = [];
  for (const c of comptes) {
    const raison =
      !concerne(c) ? "n'a pas accepté d'invitation" :
      c.disabled ? "compte désactivé" :
      c.role === "admin" ? "administrateur" :
      c.agencyId || c.agencyMembership ? "agence (client ou membre)" :
      VIVANTS.includes(c.subscriptionStatus) ? "abonnement vivant" :
      !c.trialEndsAt && !sansDate ? "sans date de fin d'essai (utiliser --sans-date pour l'inclure)" :
      c.trialEndsAt && new Date(c.trialEndsAt) >= nouvelleFin ? "essai déjà plus long" : null;
    if (raison) { if (concerne(c)) ignores.push({ ...c, raison }); } else aMettreAJour.push({ ...c, nouvelleFin });
  }
  return { aMettreAJour, ignores };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sansDate = process.argv.includes("--sans-date");
  const inclure = (process.argv.find((a) => a.startsWith("--inclure=")) ?? "--inclure=").slice("--inclure=".length).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const jours = Number((process.argv.find((a) => a.startsWith("--jours=")) ?? "--jours=14").split("=")[1]);
  if (!Number.isInteger(jours) || jours < 1 || jours > 60) throw new Error("--jours doit être un entier entre 1 et 60");
  const prisma = new PrismaClient();
  try {
    const acceptees = await prisma.invitation.findMany({ where: { acceptedUserId: { not: null } }, select: { acceptedUserId: true } });
    const ids = new Set(acceptees.map((i) => i.acceptedUserId));
    const comptes = await prisma.user.findMany({
      where: { OR: [{ id: { in: [...ids] } }, ...(inclure.length ? [{ email: { in: inclure } }] : [])] },
      select: { id: true, email: true, role: true, disabled: true, agencyId: true, agencyMembership: { select: { id: true } }, subscriptionStatus: true, trialEndsAt: true },
    });
    const { aMettreAJour, ignores } = choisir(comptes, ids, { jours, sansDate, emailsInclus: inclure });
    const introuvables = inclure.filter((e) => !comptes.some((c) => String(c.email).toLowerCase() === e));
    for (const e of introuvables) console.log(`  ! ${masque(e)} : adresse introuvable (vérifier l'orthographe)`);
    console.log(`${apply ? "APPLICATION" : "SIMULATION (rien n'est écrit)"} : essai de ${jours} jours, ${comptes.length} compte(s) testeur(s) trouvé(s)\n`);
    for (const c of aMettreAJour) console.log(`  → ${masque(c.email)} : fin d'essai ${c.trialEndsAt ? new Date(c.trialEndsAt).toISOString().slice(0, 10) : "(aucune)"} -> ${c.nouvelleFin.toISOString().slice(0, 10)}`);
    for (const c of ignores) console.log(`  · ${masque(c.email)} : ignoré (${c.raison})`);
    console.log(`\n${aMettreAJour.length} à mettre à jour, ${ignores.length} ignoré(s).`);
    if (apply && aMettreAJour.length) {
      const r = await prisma.$transaction(aMettreAJour.map((c) => prisma.user.update({ where: { id: c.id }, data: { trialEndsAt: c.nouvelleFin } })));
      console.log(`${r.length} compte(s) mis à jour.`);
    } else if (!apply) console.log("Rien n'a été modifié. Relancer avec --apply pour enregistrer.");
  } finally { await prisma.$disconnect(); }
}

if (!globalThis.__IMPORT_ONLY__) await main();
